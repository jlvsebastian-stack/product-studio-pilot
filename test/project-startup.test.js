import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
import {freshProject,mergeSavedProjects,persistStudio} from '../public/studio-store.js';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
test('actual startup waits for disk reconciliation before timestamping an unchanged browser copy',async()=>{
  const browser=freshProject();browser.updatedAt=100;browser.brief.title='Saved Project';browser.brief.productDraft='OLD';const disk=structuredClone(browser);disk.updatedAt=200;disk.brief.productDraft='NEW complete draft';
  const studio={projects:[browser],activeId:browser.id,profile:{preferences:[],candidates:[],forgotten:[]}},storage=new Map(),nodes={};let finish;
  const scope={studio,state:browser,working:false,accountReady:true,autosaveOK:true,Date:class extends Date{static now(){return 1000;}},persistStudio,storage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},projectLibrary:{schedule(){}},$:id=>nodes[id]||=( {disabled:false}),render(){},renderPreferences(){},bootstrap(){},checkAccount:async()=>true,panel(){},notice(){},initializeProjectLibrary:()=>new Promise(resolve=>{finish=()=>{scope.state=mergeSavedProjects(studio,{projects:[disk],activeId:disk.id});resolve();};})};
  vm.createContext(scope);vm.runInContext(source.match(/^function save\(\).*$/m)[0],scope);
  const start=source.indexOf('async function startStudio(){');const startup=start>=0?source.slice(start,source.indexOf('\nstartStudio();',start)):source.slice(source.lastIndexOf('render();renderPreferences();'));
  const operation=vm.runInContext(`(async()=>{${startup};${start>=0?'await startStudio();':''}})()`,scope);assert.equal(browser.updatedAt,100,'Startup must not make stale browser work look newly edited');finish();await operation;assert.equal(scope.state.brief.productDraft,'NEW complete draft');assert.equal(scope.state.updatedAt,200);
});
