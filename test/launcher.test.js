import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { installLauncher } from '../scripts/setup.js';
import { launch } from '../scripts/launch.js';

const artifacts=resolve('test-artifacts');
const ownedPids=new Map();
async function fixture(t){
  await mkdir(artifacts,{recursive:true});const folder=await mkdtemp(join(artifacts,'launcher-'));
  ownedPids.set(folder,[]);
  t.after(async()=>{for(const pid of ownedPids.get(folder))await stopPid(pid);ownedPids.delete(folder);if(!folder.startsWith(artifacts+sep))throw new Error('Unexpected cleanup path');await rm(folder,{recursive:true,force:true});});return folder;
}
async function stopPid(pid){
  try{process.kill(pid);}catch(error){if(error.code==='ESRCH')return;throw error;}
  const end=Date.now()+3000;
  while(Date.now()<end){try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH')return;throw error;}await delay(20);}
  throw new Error('The owned test server did not confirm termination.');
}
test('setup registers the actual install and identical launch skills idempotently',async t=>{
  const home=await fixture(t),result=await installLauncher({home});
  const registry=JSON.parse(await readFile(result.registryPath,'utf8'));
  assert.equal(registry.kind,'product-studio-install');assert.equal(registry.appRoot,process.cwd());assert.equal(registry.nodePath,process.execPath);
  assert.equal(result.skills.length,2);
  for(const file of result.skills){const text=await readFile(file,'utf8');assert.match(text,/name: product-studio/);assert.match(text,/install\.json/);assert.match(text,/Launch/);}
  assert.deepEqual(await installLauncher({home}),result);
});
test('setup preserves unrelated skills and does not partially write registry',async t=>{
  const home=await fixture(t),file=join(home,'.claude','skills','product-studio','SKILL.md');
  await mkdir(join(home,'.claude','skills','product-studio'),{recursive:true});await writeFile(file,'My existing unrelated skill');
  await assert.rejects(installLauncher({home}),/preserved/);assert.equal(await readFile(file,'utf8'),'My existing unrelated skill');
  await assert.rejects(readFile(join(home,'.product-studio','install.json')),error=>error.code==='ENOENT');
});
test('setup preserves an unrelated install record',async t=>{
  const home=await fixture(t),file=join(home,'.product-studio','install.json');await mkdir(join(home,'.product-studio'),{recursive:true});await writeFile(file,'{"kind":"other"}');
  await assert.rejects(installLauncher({home}),/preserved/);assert.equal(await readFile(file,'utf8'),'{"kind":"other"}');
});
test('launch starts an actual background server, requests opening its URL, and reuses it',async t=>{
  const home=await fixture(t),opened=[];
  const first=await launch({home,port:0,opener:async url=>opened.push(url)});
  ownedPids.get(home).push(first.pid);
  assert.equal(first.reused,false);assert.deepEqual(opened,[first.url]);
  assert.equal((await(await fetch(first.url+'/api/health')).json()).app,'product-studio-local');
  const again=await launch({home,port:Number(new URL(first.url).port),opener:async url=>opened.push(url)});
  assert.equal(again.url,first.url);assert.equal(again.reused,true);assert.deepEqual(opened,[first.url,first.url]);
});
test('no-open launches in the background without requesting any browser',async t=>{
  const home=await fixture(t);let opened=false;
  const result=await launch({home,port:0,openBrowser:false,opener:async()=>{opened=true;}});ownedPids.get(home).push(result.pid);
  assert.equal(opened,false);assert.ok((await fetch(result.url+'/api/health')).ok);
});
test('the server remains healthy after the launching command has exited',async t=>{
  const home=await fixture(t);
  const code=`import {launch} from ${JSON.stringify(new URL('../scripts/launch.js',import.meta.url).href)}; console.log(JSON.stringify(await launch({home:process.argv[1],port:0,openBrowser:false})));`;
  const {stdout}=await promisify(execFile)(process.execPath,['--input-type=module','-e',code,home],{windowsHide:true,timeout:20000});
  const result=JSON.parse(stdout.trim());ownedPids.get(home).push(result.pid);
  assert.equal((await(await fetch(result.url+'/api/health')).json()).app,'product-studio-local');
});
test('missing and failed installs never report ready',async t=>{
  const home=await fixture(t);await assert.rejects(launch({home,appRoot:join(home,'absent'),openBrowser:false}),/ENOENT/);
  await assert.rejects(launch({home,nodePath:join(home,'missing-node'),openBrowser:false}),/could not start/);
  const appRoot=join(home,'broken');await mkdir(join(appRoot,'src'),{recursive:true});await writeFile(join(appRoot,'package.json'),'{"name":"product-studio-local"}');await writeFile(join(appRoot,'src','local-server.js'),'process.exit(2);');
  await assert.rejects(launch({home,appRoot,openBrowser:false}),/could not start/);
});
test('a startup that never becomes ready is stopped before the timeout rejects',async t=>{
  const home=await fixture(t),appRoot=join(home,'stuck');await mkdir(join(appRoot,'src'),{recursive:true});await writeFile(join(appRoot,'package.json'),'{"name":"product-studio-local"}');
  await writeFile(join(appRoot,'src','local-server.js'),'setInterval(()=>{},1000);');
  await assert.rejects(launch({home,appRoot,openBrowser:false,timeout:100}),/did not become ready/);
});
