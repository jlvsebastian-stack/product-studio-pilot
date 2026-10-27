import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {freshProject,applyReply} from '../public/studio-store.js';
import {recordRequest,requestMessages} from '../public/composer.js';
import {createProviderManager} from '../src/providers.js';
const picker=await import('../public/model-access.js').catch(()=>({}));
const sol={provider:'chatgpt',model:'gpt-6.1-sol',reasoningEffort:'high'};
const astra={provider:'chatgpt',model:'gpt-6-astra',reasoningEffort:'high'};

test('a catalog entry cannot enable sending until the exact selected model and quality pass a real check',async()=>{
  assert.equal(typeof picker.createModelAccess,'function','The picker must preflight subscription model access');
  let complete,received;
  const access=picker.createModelAccess({request:selection=>{received=selection;return new Promise(resolve=>{complete=resolve;});}});
  const check=access.check(sol);assert.equal(access.state.status,'checking');assert.equal(access.ready,false);assert.deepEqual(received,sol);
  complete({available:true,message:'Selected model responded.'});await check;assert.equal(access.ready,true);assert.equal(access.state.selection.model,'gpt-6.1-sol');
});
test('rapid choices serialize helper calls and stale results cannot enable or reject the newest choice',async()=>{
  assert.equal(typeof picker.createModelAccess,'function');const calls=[],resolvers=[];
  const access=picker.createModelAccess({request:selection=>{calls.push(selection);return new Promise(resolve=>resolvers.push(resolve));}});
  const pending=access.check(sol);access.check(astra);access.check({...sol,reasoningEffort:'xhigh'});
  assert.equal(calls.length,1);assert.equal(access.ready,false);assert.equal(access.state.selection.reasoningEffort,'xhigh');
  resolvers[0]({available:false,message:'Old high combination unavailable'});await Promise.resolve();await Promise.resolve();assert.equal(calls.length,2);assert.equal(calls[1].model,'gpt-6.1-sol');assert.equal(calls[1].reasoningEffort,'xhigh');assert.equal(access.ready,false);
  resolvers[1]({available:true,message:'Available'});await pending;assert.equal(access.ready,true);assert.equal(access.state.selection.reasoningEffort,'xhigh');
});
test('quality changes require their own check and rejected selections remain selected',async()=>{
  assert.equal(typeof picker.createModelAccess,'function');const requests=[];
  const access=picker.createModelAccess({request:async selection=>{requests.push(selection);return {available:selection.reasoningEffort==='high',message:'This quality is unavailable'};}});
  await access.check(sol);assert.equal(access.ready,true);await access.check({...sol,reasoningEffort:'xhigh'});assert.equal(access.ready,false);assert.equal(access.state.status,'unavailable');assert.equal(access.state.selection.model,'gpt-6.1-sol');assert.equal(requests.length,2);
});
test('a busy helper or transport failure stays unconfirmed instead of falsely labeling a model rejected',async()=>{
  assert.equal(typeof picker.createModelAccess,'function');let attempt=0;
  const access=picker.createModelAccess({request:async()=>{attempt++;if(attempt===1)throw Object.assign(Error('Another local check is running'),{status:409});if(attempt===2)throw Error('Local app unavailable');return {available:true,message:'Available'};}});
  await access.check(sol);assert.equal(access.state.status,'busy');assert.equal(access.ready,false);assert.equal(access.results.size,0);
  await access.check(sol,{force:true});assert.equal(access.state.status,'error');assert.equal(access.results.size,0);
  await access.check(sol,{force:true});assert.equal(access.ready,true);
});
test('disconnect and provider changes invalidate old checks without starting concurrent helper operations',async()=>{
  assert.equal(typeof picker.createModelAccess,'function');const calls=[],resolvers=[];
  const access=picker.createModelAccess({request:selection=>{calls.push(selection);return new Promise(resolve=>resolvers.push(resolve));}});
  const pending=access.check(sol);access.clear();access.check({provider:'claude',model:'claude-opus-4-7',reasoningEffort:'high'});assert.equal(calls.length,1);
  resolvers[0]({available:true,message:'Old ChatGPT check'});await Promise.resolve();await Promise.resolve();assert.equal(access.ready,false);assert.equal(calls.length,2);
  resolvers[1]({available:false,message:'Claude model unavailable'});await pending;assert.equal(access.state.selection.provider,'claude');assert.equal(access.state.status,'unavailable');assert.equal(access.ready,false);
});
test('explicit saved model choices survive catalog changes instead of silently choosing another model',()=>{
  assert.equal(typeof picker.modelSelection,'function');
  const selection=picker.modelSelection([{id:'gpt-6-astra',label:'Astra',recommended:true}],'gpt-6.1-sol');
  assert.equal(selection.selected,'gpt-6.1-sol');assert.equal(selection.options.some(option=>option.id==='gpt-6.1-sol'),true);
  assert.equal(picker.modelSelection([{id:'default',label:'Existing default',recommended:true}],'').selected,'default');
});
test('duplicate startup signals and repeated check clicks never start a second helper for the same choice',async()=>{
  let calls=0,complete;
  const access=picker.createModelAccess({request:()=>{calls++;return new Promise(resolve=>{complete=resolve;});}});
  const pending=access.check(sol);access.check(sol);assert.equal(calls,1);complete({available:true,message:'Available'});await pending;await access.check(sol);assert.equal(calls,1);
  const again=access.check(sol,{force:true});assert.equal(calls,2);assert.equal(access.ready,false);complete({available:true,message:'Available'});await again;assert.equal(access.ready,true);
});
test('browser confirmation expires after five minutes and the same choice must consult the helper again',async()=>{
  let clock=1000,checks=0;
  const access=picker.createModelAccess({now:()=>clock,request:async()=>{checks++;return {available:true,message:'Available'};}});
  await access.check(sol);clock+=299999;assert.equal(access.ready,true);clock++;
  assert.equal(access.ready,false,'Five-minute-old readiness cannot enable Send or Retry');await access.check(sol);assert.equal(checks,2);assert.equal(access.ready,true);
});
test('the actual send failure invalidates access while retaining exact choice, retry references and new typing',async()=>{
  let checks=0;const access=picker.createModelAccess({request:async()=>{checks++;return {available:true,message:'Available'};}});await access.check(sol);
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8'),sendSource=source.slice(source.indexOf('async function send('),source.indexOf('\nasync function advance('));
  const project=freshProject(),reference={id:'guide',name:'Creator guide.txt',kind:'file',mimeType:'text/plain',text:'Reference context',status:'ready',note:'Parsed locally'};
  project.pendingAnswer='Use the guide';project.pendingReferences=[reference];let interviews=0;
  const scope={working:false,runtimeReady:true,accountReady:true,modelAccess:access,canUseModel:()=>access.ready,state:project,provider:sol.provider,selectedModel:sol.model,quality:sol.reasoningEffort,revisionMode:false,referenceComposer:()=>({ready:true,addLinks:async()=>{}}),extractHttpLinks:()=>[],recordRequest,requestMessages,studio:{profile:{}},activePreferences:()=>[],save(){},renderChat(){},notice(){},panel(){},post:async()=>{interviews++;if(interviews>1)return {message:'A successful retry',brief:{}};project.pendingAnswer='A new thought while waiting';throw Error('Provider connection failed');},busy(value){scope.working=value;},applyReply,renderPreferences(){},updateModelNote(){},schedulePreview(){}};
  vm.createContext(scope);vm.runInContext(sendSource,scope);await scope.send('Use the guide',true);
  assert.equal(access.ready,false,'The real send catch must invalidate the browser confirmation');assert.equal(project.retryRequest.text,'Use the guide');assert.equal(project.retryRequest.references[0].id,'guide');assert.equal(project.pendingAnswer,'A new thought while waiting');assert.equal(scope.selectedModel,'gpt-6.1-sol');assert.equal(scope.quality,'high');
  await scope.send('',false,{retry:true});assert.equal(interviews,1,'Retry cannot call the provider before a fresh check');await access.check(sol);assert.equal(checks,2);assert.equal(access.ready,true);
  await scope.send('',false,{retry:true});assert.equal(interviews,2);assert.equal(project.retryRequest,null);assert.equal(project.messages.filter(message=>message.role==='user').length,1);assert.equal(project.messages.at(-1).content,'A successful retry');assert.equal(project.pendingAnswer,'A new thought while waiting');
});
test('invalidating an in-flight check prevents its stale success from restoring a confirmed option',async()=>{
  let complete;const access=picker.createModelAccess({request:()=>new Promise(resolve=>{complete=resolve;})});
  const pending=access.check(sol);access.invalidate('The connection changed. Check again.');complete({available:true,message:'Old result'});await pending;
  assert.equal(access.ready,false);assert.equal(access.state.status,'unconfirmed');assert.equal(access.results.size,0);
});
test('the real provider checker and picker distinguish temporary quota from a definite model rejection',async()=>{
  for(const [stderr,status] of [['rate_limit_exceeded: usage quota reached','busy'],['model_not_found: the model does not exist','unavailable']]){
    const manager=createProviderManager({resolveCli:()=>({file:process.execPath,prefix:[]}),execute:async(_,args)=>args[0]==='login'?{code:0,stdout:'Logged in using ChatGPT',stderr:''}:{code:1,stdout:'',stderr}});
    const access=picker.createModelAccess({request:selection=>manager.checkModel(selection.provider,selection)});await access.check(sol);
    assert.equal(access.ready,false);assert.equal(access.state.status,status);assert.equal(access.results.get(picker.modelAccessKey(sol))?.status,status==='unavailable'?'unavailable':undefined);assert.equal(access.state.selection.model,'gpt-6.1-sol');
  }
});
test('the actual model note keeps success quiet and shows actionable checking or failure retry',async()=>{
  let response={available:true,message:'Selected model responded'};
  const access=picker.createModelAccess({request:async()=>response});await access.check(sol);
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8'),noteSource=source.slice(source.indexOf('function updateModelNote('),source.indexOf('\nfunction renderModels('));
  const option={value:sol.model,dataset:{label:'Sol'},textContent:'Sol'};
  const nodes={'model-note':{hidden:false},'model-access-status':{textContent:''},'check-model-access':{hidden:false},model:{options:[option]}};
  const scope={$:id=>nodes[id],modelAccess:access,runtimeReady:true,accountReady:true,runtimeError:'',working:false,provider:sol.provider,quality:sol.reasoningEffort,modelAccessKey:picker.modelAccessKey,checkSelectedModel(){}};
  vm.createContext(scope);vm.runInContext(noteSource,scope);scope.updateModelNote();
  assert.equal(nodes['model-note'].hidden,true,'Normal success needs no visible status announcement');assert.equal(nodes['model-access-status'].textContent,'');assert.equal(nodes['check-model-access'].hidden,true);assert.equal(option.textContent,'Sol');
  access.invalidate('The last reply failed. Check again.');scope.updateModelNote();assert.equal(nodes['model-note'].hidden,false);assert.equal(nodes['check-model-access'].hidden,false);assert.match(nodes['model-access-status'].textContent,/last reply failed/);
  response={available:false,retryable:true,message:'Usage limit reached. Retry after reset.'};await access.check(sol);scope.updateModelNote();assert.equal(nodes['check-model-access'].hidden,false);assert.match(nodes['model-access-status'].textContent,/not confirmed/);assert.equal(option.textContent,'Sol');
  response={available:false,message:'This model is unsupported'};await access.check(sol,{force:true});scope.updateModelNote();assert.match(option.textContent,/unavailable/);assert.equal(nodes['check-model-access'].hidden,false);
  const checking=access.check(sol,{force:true});scope.updateModelNote();assert.equal(nodes['model-note'].hidden,false);assert.match(nodes['model-access-status'].textContent,/Checking model access/);assert.equal(nodes['check-model-access'].hidden,true);await checking;
});
test('actual expiry, visibility and busy callbacks refresh Sol High once without retrying quota or failure',async context=>{
  context.mock.timers.enable({apis:['setTimeout','Date'],now:1000});
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const modelSource=source.slice(source.indexOf('const selectedCombination='),source.indexOf('\nfunction title('));
  const busySource=source.slice(source.indexOf('function busy('),source.indexOf('\nasync function send('));
  const visibilitySource=source.split('\n').find(line=>line.startsWith("document.addEventListener('visibilitychange'"));
  const calls=[],nodes={busy:{style:{}},'busy-title':{textContent:''}},document={hidden:false,addEventListener(_,callback){this.onVisibility=callback;}};
  let response={available:true,message:'Ready'};
  const scope={provider:sol.provider,selectedModel:sol.model,quality:sol.reasoningEffort,working:false,runtimeReady:true,accountReady:true,document,createModelAccess:picker.createModelAccess,modelAccessKey:picker.modelAccessKey,post:async(_,selection)=>{calls.push(JSON.parse(JSON.stringify(selection)));return response;},updateModelNote(){},renderChat(){},render(){},$:id=>nodes[id],state:{pendingAnswer:'My unsent creator input'}};
  vm.createContext(scope);vm.runInContext(modelSource+'\n'+busySource+'\n'+visibilitySource+'\nglobalThis.access=modelAccess;',scope);
  await scope.access.check(sol);context.mock.timers.tick(300000);await Promise.resolve();await Promise.resolve();assert.equal(calls.length,2,'Foreground expiry must refresh automatically');assert.deepEqual(calls[1],sol);assert.equal(scope.access.ready,true);
  document.hidden=true;context.mock.timers.tick(300000);assert.equal(calls.length,2,'A hidden tab must not launch periodic checks');document.hidden=false;document.onVisibility();await Promise.resolve();await Promise.resolve();assert.equal(calls.length,3);
  scope.busy(true);context.mock.timers.tick(300000);assert.equal(calls.length,3,'Expiry waits for the active interview');scope.busy(false);await Promise.resolve();await Promise.resolve();assert.equal(calls.length,4);
  response={available:false,retryable:true,message:'Quota reached. Retry after reset.'};context.mock.timers.tick(300000);await Promise.resolve();await Promise.resolve();assert.equal(calls.length,5);assert.equal(scope.access.state.status,'busy');context.mock.timers.tick(600000);document.onVisibility();scope.busy(false);assert.equal(calls.length,5,'Quota must not create an automatic retry loop');
  scope.access.invalidate('The last reply failed');document.onVisibility();scope.busy(false);assert.equal(calls.length,5,'A real failure requires an explicit retry');scope.accountReady=false;scope.access.clear();document.onVisibility();assert.equal(calls.length,5);assert.equal(scope.selectedModel,'gpt-6.1-sol');assert.equal(scope.quality,'high');assert.equal(scope.state.pendingAnswer,'My unsent creator input');
});
