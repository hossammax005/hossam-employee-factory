'use strict';
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {JsonFileStore}=require('../storage/json-file-store');
const EMPLOYEE_ID_PATTERN=/^[a-zA-Z0-9_-]{1,64}$/;
class EmployeeRepository {
  constructor(dataDir){this.store=new JsonFileStore(dataDir);}
  assertEmployeeId(id){if(typeof id!=='string'||!EMPLOYEE_ID_PATTERN.test(id))throw new TypeError('employeeId may contain only letters, numbers, underscore, and hyphen (1-64 chars).');}
  employeeDir(id){this.assertEmployeeId(id);return path.posix.join('employees',id);}
  versionName(v){if(!Number.isSafeInteger(v)||v<1)throw new TypeError('version must be a positive safe integer.');return 'v'+String(v).padStart(6,'0')+'.json';}
  async create(record){
    const dir=this.employeeDir(record.id),lock=dir+'.create-lock',stage=dir+'.create-'+process.pid+'-'+randomUUID();
    await this.store.ensureDirectory('employees');
    try{await this.store.createDirectoryExclusive(lock);}catch(e){if(e.code==='EEXIST')throw new Error('Employee creation is already in progress: '+record.id);throw e;}
    try{
      if(await this.store.readJson(dir+'/employee.json'))throw new Error('Employee already exists: '+record.id);
      await this.store.createDirectoryExclusive(stage);
      await this.store.writeJson(stage+'/employee.json',record);
      await this.store.writeJsonExclusive(stage+'/versions/'+this.versionName(record.currentConfigVersion),{version:record.currentConfigVersion,createdAt:record.createdAt,config:record.config,reason:'INITIAL',sourceVersion:null});
      await this.store.rename(stage,dir);
      return record;
    }catch(e){await this.store.remove(stage,{recursive:true}).catch(()=>{});throw e;}
    finally{await this.store.remove(lock,{recursive:true}).catch(()=>{});}
  }
  async get(id){return this.store.readJson(this.employeeDir(id)+'/employee.json');}
  async listEmployees(){const entries=await this.store.list('employees'),out=[];for(const e of entries){if(!e.isDirectory()||!EMPLOYEE_ID_PATTERN.test(e.name))continue;const r=await this.get(e.name);if(r)out.push(r);}return out;}
  async save(record){await this.store.writeJson(this.employeeDir(record.id)+'/employee.json',record);return record;}
  async saveVersion(id,v,snapshot){await this.store.writeJsonExclusive(this.employeeDir(id)+'/versions/'+this.versionName(v),snapshot);return snapshot;}
  async removeUncommittedVersion(id,v){await this.store.remove(this.employeeDir(id)+'/versions/'+this.versionName(v));}
  async getVersion(id,v){return this.store.readJson(this.employeeDir(id)+'/versions/'+this.versionName(v));}
  async listVersions(id){const dir=this.employeeDir(id)+'/versions',entries=await this.store.list(dir),out=[];for(const e of entries){if(e.isFile()&&/^v\d{6}\.json$/.test(e.name)){const v=await this.store.readJson(dir+'/'+e.name);if(v)out.push(v);}}return out.sort((a,b)=>a.version-b.version);}
}
module.exports={EmployeeRepository,EMPLOYEE_ID_PATTERN};