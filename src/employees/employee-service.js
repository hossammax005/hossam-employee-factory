'use strict';
const {validateEmployeeConfig}=require('../core/config-validation');
const {EmployeeRepository}=require('./employee-repository');
class VersionConflictError extends Error{constructor(expected,actual){super('Configuration version conflict: expected '+expected+', current '+actual+'.');this.name='VersionConflictError';this.expectedVersion=expected;this.actualVersion=actual;}}
class EmployeeService {
  constructor({dataDir,repository}={}){if(!repository&&!dataDir)throw new TypeError('Provide dataDir or repository.');this.repository=repository||new EmployeeRepository(dataDir);}
  withEmployeeLock(id,fn){return this.repository.withEmployeeLock(id,fn);}
  async createEmployee({id,config}){const c=validateEmployeeConfig(config),t=new Date().toISOString(),record={schemaVersion:1,id,createdAt:t,updatedAt:t,lifecycle:'STOPPED',currentConfigVersion:1,config:c};return this.withEmployeeLock(id,()=>this.repository.create(record));}
  async getEmployee(id){const e=await this.repository.get(id);if(!e)throw new Error('Employee not found: '+id);return e;}
  async commitConfiguration(id,nextConfig,{reason,sourceVersion=null,expectedVersion}={}){return this.withEmployeeLock(id,async()=>{
    const employee=await this.getEmployee(id);
    if(expectedVersion!==undefined&&expectedVersion!==employee.currentConfigVersion)throw new VersionConflictError(expectedVersion,employee.currentConfigVersion);
    const config=validateEmployeeConfig(nextConfig),version=employee.currentConfigVersion+1,t=new Date().toISOString(),snapshot={version,createdAt:t,config,reason,sourceVersion};
    await this.repository.saveVersion(id,version,snapshot);
    const updated={...employee,config,currentConfigVersion:version,updatedAt:t};
    try{await this.repository.save(updated);}catch(e){const latest=await this.repository.get(id).catch(()=>null);if(latest?.currentConfigVersion!==version)await this.repository.removeUncommittedVersion(id,version).catch(()=>{});throw e;}
    return updated;
  });}
  async saveConfiguration(id,config,{reason='CONFIGURATION_UPDATE',expectedVersion}={}){return this.commitConfiguration(id,config,{reason,expectedVersion});}
  async restoreConfiguration(id,sourceVersion,{expectedVersion}={}){const source=await this.repository.getVersion(id,sourceVersion);if(!source)throw new Error('Configuration version not found: '+sourceVersion);return this.commitConfiguration(id,source.config,{reason:'RESTORE',sourceVersion,expectedVersion});}
  async listConfigurationVersions(id){await this.getEmployee(id);return this.repository.listVersions(id);}
}
module.exports={EmployeeService,VersionConflictError};