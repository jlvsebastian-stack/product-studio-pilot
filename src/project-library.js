import {mkdir,open,readFile,readdir,rename,unlink,stat} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {setTimeout as pause} from 'node:timers/promises';
import {loadStudio,checkpoint,freshProject} from '../public/studio-store.js';

export const MAX_PROJECT_BYTES=4_000_000;
const safeId=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,149}$/.test(value);
const failure=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
const keys=new Set(Object.keys(checkpoint(freshProject())));
const briefKeys=new Set(Object.keys(freshProject().brief));
const queues=new Map();
export function defaultProjectDirectory(){return process.platform==='win32'?join(process.env.LOCALAPPDATA||join(homedir(),'AppData','Local'),'ProductStudio','projects'):process.platform==='darwin'?join(homedir(),'Library','Application Support','ProductStudio','projects'):join(homedir(),'.product-studio','projects');}

// Reuse browser checkpoint validation without changing IDs, touching browser
// storage, or importing a project as a new copy.
export function validateLibraryProject(project){
  if(!project||typeof project!=='object'||Array.isArray(project)||!safeId(project.id)||!Number.isSafeInteger(project.updatedAt)||project.updatedAt<0)throw failure('This project needs a valid ID and saved time.');
  if(Object.keys(project).some(key=>!keys.has(key)))throw failure('Save a project checkpoint, without file paths or extra fields.');
  if(!project.brief||typeof project.brief!=='object'||Array.isArray(project.brief)||Object.entries(project.brief).some(([key,value])=>!briefKeys.has(key)||typeof value!=='string'))throw failure('This project has invalid brief fields.');
  let encoded;try{encoded=JSON.stringify(project);}catch{throw failure('This project could not be read.');}
  if(Buffer.byteLength(encoded)>MAX_PROJECT_BYTES)throw failure('This project is too large for the local library.',413);
  const memory=new Map([['product-studio-projects-v3',JSON.stringify({version:3,activeId:project.id,projects:[project]})]]);
  const studio=loadStudio({getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)});
  if(studio.storageWarning||studio.recoveryBackup||studio.projects.length!==1||studio.projects[0].id!==project.id)throw failure('This saved project has invalid fields. Your existing library is unchanged.');
  const clean=checkpoint(studio.projects[0]);
  for(const [key,value]of Object.entries(project)){
    if(key==='brief'){if(Object.entries(value).some(([field,text])=>clean.brief[field]!==text))throw failure('The project brief could not be preserved.');}
    else if(key==='slideConcepts'&&value===null&&clean.slideProduction?.mode==='concepts'&&clean.slideProduction.status==='ready'&&isDeepStrictEqual(clean.slideConcepts,clean.slideProduction))continue;
    else if(key==='retryRequest'&&value===null&&clean.retryRequest)continue;
    else if(!isDeepStrictEqual(value,clean[key]))throw failure('This project contains invalid or unsupported checkpoint fields. Your existing library is unchanged.');
  }
  if(Buffer.byteLength(JSON.stringify(clean))>MAX_PROJECT_BYTES)throw failure('This project is too large for the local library.',413);
  return clean;
}

export function createProjectLibrary({directory=defaultProjectDirectory()}={}){
  if(typeof directory!=='string'||!directory)throw Error('Choose a private project-library directory.');
  directory=resolve(directory);
  const metadataPath=join(directory,'library.json'),lockPath=join(directory,'.save-lock');
  // Hash the logical ID to avoid case collisions and platform-reserved names.
  const projectPath=id=>join(directory,createHash('sha256').update(id).digest('hex')+'.json');
  async function atomicWrite(path,value){
    const temporary=path+'.'+randomBytes(8).toString('hex')+'.tmp';let handle;
    try{handle=await open(temporary,'wx',0o600);await handle.writeFile(JSON.stringify(value));await handle.sync();await handle.close();handle=null;await rename(temporary,path);}
    finally{if(handle)await handle.close().catch(()=>{});await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
  }
  async function unlockAbandoned(){
    try{
      const text=await readFile(lockPath,'utf8');let owner;try{owner=JSON.parse(text);}catch{const info=await stat(lockPath);if(Date.now()-info.mtimeMs<30000)return;}
      if(owner){if(!Number.isInteger(owner.pid)||owner.pid<1)return;try{process.kill(owner.pid,0);return;}catch(error){if(error.code!=='ESRCH')return;}}
      if(await readFile(lockPath,'utf8')===text)await unlink(lockPath);
    }catch(error){if(error.code!=='ENOENT')throw error;}
  }
  async function locked(operation){
    await mkdir(directory,{recursive:true,mode:0o700});let handle;const until=Date.now()+3000;
    while(!handle){try{handle=await open(lockPath,'wx',0o600);}catch(error){if(error.code!=='EEXIST')throw error;await unlockAbandoned();if(Date.now()>=until)throw failure('Another local app window is saving a project. Try Save project again.',409);await pause(20);}}
    try{await handle.writeFile(JSON.stringify({pid:process.pid,token:randomBytes(12).toString('hex')}));}catch(error){await handle.close();await unlink(lockPath).catch(()=>{});throw error;}
    try{return await operation();}finally{await handle.close();await unlink(lockPath).catch(error=>{if(error.code!=='ENOENT')throw error;});}
  }
  async function serialized(operation){
    const previous=queues.get(directory)||Promise.resolve(),running=previous.catch(()=>{}).then(()=>locked(operation));queues.set(directory,running);
    try{return await running;}finally{if(queues.get(directory)===running)queues.delete(directory);}
  }
  async function readLibrary(){
    const projects=[];
    for(const file of (await readdir(directory)).filter(name=>/^[a-f0-9]{64}\.json$/.test(name))){
      const path=join(directory,file);if((await stat(path)).size>MAX_PROJECT_BYTES)throw failure('A saved project is too large to open safely. Its file was preserved.');
      const project=validateLibraryProject(JSON.parse(await readFile(path,'utf8')));if(projectPath(project.id)!==path)throw failure('A saved project ID does not match its library file. The file was preserved.');projects.push(project);
    }
    projects.sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id));
    let activeId='';try{const metadata=JSON.parse(await readFile(metadataPath,'utf8'));if(!safeId(metadata.activeId))throw Error('Invalid active project');activeId=metadata.activeId;}catch(error){if(error.code!=='ENOENT')throw failure('The project-library selection could not be read. Your project files were preserved.');}
    if(!projects.some(project=>project.id===activeId))activeId=projects[0]?.id||'';
    return {projects,activeId};
  }
  async function list(){try{return await serialized(readLibrary);}catch(error){if(error.statusCode)throw error;throw failure('Your local project library could not be read. Its files were preserved.');}}
  async function save(body){
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!['project','activeId'].includes(key)))throw failure('Save one project checkpoint. File paths are not accepted.');
    const project=validateLibraryProject(body.project);
    if(body.activeId!==undefined&&!safeId(body.activeId))throw failure('Choose a valid active project ID.');
    try{return await serialized(async()=>{
      const library=await readLibrary(),previous=library.projects.find(saved=>saved.id===project.id);
      if(body.activeId!==undefined&&body.activeId!==project.id&&!library.projects.some(saved=>saved.id===body.activeId))throw failure('The active project is not in this local library.');
      if(previous&&previous.updatedAt>project.updatedAt)return library;
      await atomicWrite(projectPath(project.id),project);
      const activeId=body.activeId||library.activeId||project.id;await atomicWrite(metadataPath,{activeId});
      return readLibrary();
    });}catch(error){if(error.statusCode)throw error;throw failure('The project could not be saved to the local library. Your current project stays open.');}
  }
  return {list,save};
}
