'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
class JsonFileStore {
  constructor(rootDir){if(!rootDir)throw new TypeError('rootDir is required.');this.rootDir=path.resolve(rootDir);}
  resolve(relativePath){const target=path.resolve(this.rootDir,relativePath);if(target!==this.rootDir&&!target.startsWith(this.rootDir+path.sep))throw new Error('Storage path escapes the configured data directory.');return target;}
  async readJson(relativePath){try{return JSON.parse(await fs.readFile(this.resolve(relativePath),'utf8'));}catch(e){if(e.code==='ENOENT')return null;if(e instanceof SyntaxError)throw new Error('Invalid JSON in storage file: '+relativePath,{cause:e});throw e;}}
  async writeJson(relativePath,value){const target=this.resolve(relativePath);await fs.mkdir(path.dirname(target),{recursive:true});const temp=target+'.'+process.pid+'.'+randomUUID()+'.tmp';let h;try{h=await fs.open(temp,'wx',0o600);await h.writeFile(JSON.stringify(value,null,2)+'\n','utf8');await h.sync();await h.close();h=null;await fs.rename(temp,target);await this.syncDirectory(path.dirname(target));}catch(e){if(h)await h.close().catch(()=>{});await fs.rm(temp,{force:true}).catch(()=>{});throw e;}}
  async writeJsonExclusive(relativePath,value){const target=this.resolve(relativePath);await fs.mkdir(path.dirname(target),{recursive:true});const temp=target+'.'+process.pid+'.'+randomUUID()+'.tmp';let h;try{h=await fs.open(temp,'wx',0o600);await h.writeFile(JSON.stringify(value,null,2)+'\n','utf8');await h.sync();await h.close();h=null;await fs.link(temp,target);await fs.rm(temp,{force:true});await this.syncDirectory(path.dirname(target));}catch(e){if(h)await h.close().catch(()=>{});await fs.rm(temp,{force:true}).catch(()=>{});throw e;}}
  async ensureDirectory(p){await fs.mkdir(this.resolve(p),{recursive:true});}
  async createDirectoryExclusive(p){await fs.mkdir(this.resolve(p));}
  async rename(from,to){const dest=this.resolve(to);await fs.rename(this.resolve(from),dest);await this.syncDirectory(path.dirname(dest));}
  async remove(p,options={}){await fs.rm(this.resolve(p),{force:true,...options});}
  async syncDirectory(dir){let h;try{h=await fs.open(dir,'r');await h.sync();}catch(e){if(!['EINVAL','ENOTSUP','EISDIR','EPERM'].includes(e.code))throw e;}finally{if(h)await h.close().catch(()=>{});}}
  async list(p){try{return await fs.readdir(this.resolve(p),{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return[];throw e;}}
}
module.exports={JsonFileStore};