import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openLocalBrowser } from '../src/local-server.js';

const sourceRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
async function stopStartup(child){
  if(child.exitCode!==null||child.signalCode)return;
  await new Promise((done,reject)=>{
    const force=setTimeout(()=>child.kill('SIGKILL'),1000);
    const giveUp=setTimeout(()=>{clearTimeout(force);reject(new Error('The startup process did not confirm it stopped. Close that Product Studio process before retrying.'));},3000);
    child.once('close',()=>{clearTimeout(force);clearTimeout(giveUp);done();});child.kill();
  });
}
export async function launch({appRoot=sourceRoot,home=homedir(),nodePath=process.execPath,port=Number(process.env.STUDIO_PORT||8767),openBrowser=true,opener=openLocalBrowser,timeout=15000}={}){
  if(Number(process.versions.node.split('.')[0])<22)throw new Error('Product Studio needs Node.js 22 or newer.');
  appRoot=resolve(appRoot);
  if(!Number.isInteger(port)||port<0||port>65526)throw new Error('Choose a valid local port.');
  const pkg=JSON.parse(await readFile(join(appRoot,'package.json'),'utf8'));
  if(pkg.name!=='product-studio-local')throw new Error('Choose the Product Studio application folder.');
  await readFile(join(appRoot,'src','local-server.js'),'utf8');
  const logDirectory=join(resolve(home),'.product-studio');await mkdir(logDirectory,{recursive:true});
  const logPath=join(logDirectory,'studio.log'),fd=openSync(logPath,'a',0o600);
  let child;
  try{child=spawn(nodePath,[join(appRoot,'src','local-server.js')],{cwd:appRoot,env:{...process.env,STUDIO_PORT:String(port),STUDIO_OPEN_BROWSER:'0'},detached:true,windowsHide:true,stdio:['ignore',fd,fd,'ipc']});}
  finally{closeSync(fd);}
  let result;
  try{
    result=await new Promise((done,reject)=>{
      const timer=setTimeout(()=>reject(new Error(`Product Studio did not become ready. Check ${logPath}`)),timeout);
      const fail=()=>{clearTimeout(timer);reject(new Error(`Product Studio could not start. Run npm ci in its folder, then retry. Details: ${logPath}`));};
      child.once('error',fail);child.once('exit',fail);
      child.on('message',message=>{
        if(message?.type!=='product-studio-ready')return;
        if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(message.url)){clearTimeout(timer);reject(new Error('Product Studio returned an invalid local address.'));return;}
        clearTimeout(timer);child.removeListener('error',fail);child.removeListener('exit',fail);done(message);
      });
    });
  }catch(error){if(child.pid)await stopStartup(child);throw error;}
  if(child.connected)child.disconnect();child.unref();
  if(openBrowser)try{await opener(result.url);}catch{throw new Error(`Product Studio is running at ${result.url}, but the browser did not open. Open that address in your browser.`);}
  return {url:result.url,reused:!!result.reused,pid:child.pid};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2),options={};
  try{
    while(args.length){const key=args.shift();if(key==='--no-open')options.openBrowser=false;else if(key==='--home'&&args[0])options.home=args.shift();else if(key==='--port'&&args[0])options.port=Number(args.shift());else throw new Error('Usage: node scripts/launch.js [--no-open] [--port NUMBER] [--home PATH]');}
    await launch(options).then(result=>console.log(`Product Studio is ready: ${result.url}`));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
