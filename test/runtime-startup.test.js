import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {currentAction} from '../public/current-action.js';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const bootstrap=source.slice(source.indexOf('async function bootstrap(){'),source.indexOf('async function uploadCover('));
function controller(fetch){const nodes={};const scope={fetch,runtimeReady:false,runtimeError:'',catalog:null,$:id=>nodes[id]||=( {}),renderModels(){},schedulePreview(){},checkSelectedModel(){},notice(message){scope.message=message;},render(){scope.action=currentAction({runtime:scope.runtimeReady,runtimeError:scope.runtimeError});}};vm.createContext(scope);vm.runInContext(bootstrap,scope);return scope;}
test('real bootstrap stays pending during health fetch and only reports update failure after version readback',async()=>{
  let complete;const scope=controller(()=>new Promise(resolve=>{complete=resolve;}));const run=scope.bootstrap();scope.render();assert.equal(scope.action.kind,'runtime-checking');assert.equal(scope.runtimeError,'');
  complete({ok:true,json:async()=>({app:'product-studio-local',version:'0.3.20'})});await run;assert.equal(scope.runtimeReady,false);assert.equal(scope.action.title,'Finish the app update');
});
test('real bootstrap distinguishes unreachable app and usable runtime without any provider requests',async()=>{
  const offline=controller(async()=>{throw new TypeError('Failed to fetch');});await offline.bootstrap();assert.equal(offline.action.title,'Reconnect to the local app');assert.match(offline.action.detail,/could not be reached/);assert.doesNotMatch(offline.action.detail,/finish.*update/);
  const paths=[],ready=controller(async path=>{paths.push(path);return {ok:true,json:async()=>path==='/api/health'?{app:'product-studio-local',version:'0.3.21'}:{chatgpt:[],claude:[]}};});await ready.bootstrap();assert.equal(ready.runtimeReady,true);assert.deepEqual(paths,['/api/health','/api/models']);assert.equal(ready.runtimeError,'');
});
