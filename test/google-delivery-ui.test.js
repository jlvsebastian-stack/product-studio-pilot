import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProject,checkpoint,loadStudio} from '../public/studio-store.js';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const ui=await import('../public/google-delivery.js').catch(()=>({}));
const project=()=>{const p=freshProject();p.brief.title='Cake calculator';p.brief.format='Spreadsheet calculator';p.brief.productDraft='Inputs, recipe costs, price and margin formulas with blank and zero guards.';p.approvedDraft=p.brief.productDraft;return p;};
const job=p=>({id:'a'.repeat(36),destination:'sheets',sourceKey:ui.googleSourceKey(p.brief),status:'ready',verified:true,creationAttempted:true,message:'Created and read back.',file:{id:'sheet123',title:p.brief.title,url:'https://docs.google.com/spreadsheets/d/sheet123/edit'}});
test('native Google action chooses Sheets, requires approved source and exposes only checked current links',()=>{
  const p=project();const state={project:p,runtime:true,connected:true,modelReady:true,provider:'chatgpt',complete:true,working:false,serverChecked:true};
  assert.equal(ui.nativeGoogleAction(state).primary.id,'create-google');assert.equal(ui.nativeGoogleAction(state).primary.label,'Create in Google Sheets');
  p.googleDelivery=job(p);assert.equal(ui.nativeGoogleAction(state).primary.href,p.googleDelivery.file.url);
  assert.equal(ui.nativeGoogleAction({...state,serverChecked:false}).kind,'google-refresh');
  p.brief.productDraft+=' New price assumption.';assert.equal(ui.nativeGoogleAction(state),null,'unapproved changes cannot retain a ready link');
  p.approvedDraft=p.brief.productDraft;assert.equal(ui.nativeGoogleAction(state).primary.id,'create-google','the old artifact is retained but not current');
});
test('cloud URLs and destination are validated, Claude is explicit and uncertain creations are held',()=>{
  const p=project();p.googleDelivery=job(p);p.googleDelivery.file.url='https://docs.google.com.evil.test/spreadsheets/d/sheet123/edit';assert.equal(ui.cleanGoogleDelivery(p.googleDelivery),null);
  p.googleDelivery=null;const state={project:p,runtime:true,connected:true,modelReady:true,provider:'claude',complete:true,working:false,serverChecked:true};assert.equal(ui.nativeGoogleAction(state).primary.id,'google-settings');assert.match(ui.nativeGoogleAction(state).detail,/ChatGPT/);
  p.googleDelivery={...job(p),status:'unavailable',verified:false,file:undefined,message:'The creation outcome is unconfirmed.'};assert.equal(ui.nativeGoogleAction({...state,provider:'chatgpt'}).primary.id,'view-draft');
});
test('Save and Open preserve the native receipt without treating expired local download URLs as native files',()=>{
  const p=project();p.googleDelivery=job(p);const saved=checkpoint(p);const storage={getItem:key=>key==='product-studio-projects-v3'?JSON.stringify({version:3,activeId:p.id,projects:[saved]}):null,setItem(){}};const reopened=loadStudio(storage).projects[0];assert.deepEqual(reopened.googleDelivery,p.googleDelivery);assert.equal(reopened.files,null);assert.equal(reopened.approvedDraft,reopened.brief.productDraft);
});
test('the actual app sends the reviewed source and exact AI selection, and does not overwrite another opened project',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8'),functions=app.slice(app.indexOf('function acceptGoogleSnapshot('),app.indexOf('async function send('));
  const first=project(),other=project();other.id='other';const calls=[],snapshot=job(first);
  const scope={...ui,state:first,working:false,provider:'chatgpt',googleChecked:new Set(),googlePolling:new Set(),googleRefreshing:new Set(),selectedCombination:()=>({provider:'chatgpt',model:'gpt-6.1-sol',reasoningEffort:'high'}),canUseModel:()=>true,localFilesReady:()=>true,save(){},render(){},notice(){},setTimeout:callback=>{callback();},fetch:async()=>({ok:true,json:async()=>snapshot}),post:async(path,body)=>{calls.push({path,body});scope.state=other;return {...snapshot,status:'running',verified:false,file:undefined};}};
  scope.busy=value=>{scope.working=value;};vm.createContext(scope);await vm.runInContext(functions+';createNativeGoogle()',scope);
  assert.equal(calls[0].path,'/api/create-google');assert.equal(calls[0].body.approvedSource,first.approvedDraft);assert.equal(calls[0].body.destination,'sheets');assert.equal(calls[0].body.model,'gpt-6.1-sol');assert.equal(calls[0].body.reasoningEffort,'high');assert.equal(first.googleDelivery.file.url,snapshot.file.url);assert.equal(other.googleDelivery,null);assert.equal(scope.state.id,'other');
});
test('delayed saved-receipt success and failure cannot replace a newer receipt in the same project',async t=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8'),functions=app.slice(app.indexOf('function acceptGoogleSnapshot('),app.indexOf('async function send('));
  for(const outcome of ['success','failure'])await t.test(outcome,async()=>{
    const p=project(),old=job(p),newer={...job(p),id:'b'.repeat(36),status:'running',verified:false,file:undefined};p.googleDelivery=old;
    let resolveFetch,rejectFetch;const fetchResult=new Promise((resolve,reject)=>{resolveFetch=resolve;rejectFetch=reject;});
    const scope={...ui,state:p,runtimeReady:true,working:false,googleChecked:new Set(),googlePolling:new Set(),googleRefreshing:new Set(),fetch:()=>fetchResult,save(){scope.saved=true;},render(){scope.rendered=true;},busy(){scope.busied=true;},notice(){}};
    vm.createContext(scope);vm.runInContext(functions,scope);scope.restoreGoogleDelivery(p);p.googleDelivery=newer;
    if(outcome==='success')resolveFetch({ok:true,json:async()=>old});else rejectFetch(Error('The older check failed.'));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(p.googleDelivery,newer,outcome+' must retain the current job object');assert.equal(scope.saved,undefined);assert.equal(scope.rendered,undefined);assert.equal(scope.busied,undefined);assert.equal(scope.googleChecked.has(old.id),false);
  });
});
const heldDoc=p=>({...job(p),destination:'docs',status:'unavailable',verified:false,file:undefined,message:'Creation was accepted; the document needs checking.'});
test('Files keeps the native Google create, refresh or open action primary while PDF copies remain optional',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8'),fn=app.slice(app.indexOf('function currentActionState(){'),app.indexOf('function actionToken('));
  for(const kind of ['google-create','google-refresh','google-ready']){
    const expected={kind,primary:{href:'https://docs.google.com/spreadsheets/d/sheet123/edit'}},scope={state:{brief:{},interviewStage:10,googleDelivery:{id:'a'.repeat(36)}},runtimeReady:true,accountReady:true,working:false,provider:'chatgpt',view:'files',googleChecked:new Set(),canUseModel:()=>true,localFilesReady:()=>true,nativeGoogleAction:()=>expected,isPresentation:()=>false};
    vm.createContext(scope);vm.runInContext(fn,scope);assert.equal(scope.currentActionState(),expected);
  }
});
test('only a checked held Doc with current approval and the connected ChatGPT model offers recovery',()=>{
  const p=project();p.brief.format='Written guide';p.googleDelivery=heldDoc(p);const context={project:p,runtime:true,connected:true,modelReady:true,provider:'chatgpt',complete:true,working:false,serverChecked:true};
  const action=ui.nativeGoogleAction(context);assert.equal(action.kind,'google-resume');assert.equal(action.primary.id,'resume-google');assert.equal(action.primary.label,'Finish existing Doc');assert.match(action.detail,/fills it only if blank/i);assert.match(action.detail,/formats it only if all approved content and tables match/i);assert.match(action.detail,/Incomplete or mismatched content stays untouched/);assert.match(action.detail,/No new Doc is created/);
  for(const change of [{runtime:false},{connected:false},{modelReady:false},{provider:'claude'},{working:true},{serverChecked:false}])assert.notEqual(ui.nativeGoogleAction({...context,...change})?.kind,'google-resume');
  p.brief.productDraft+=' Changed.';assert.notEqual(ui.nativeGoogleAction(context)?.kind,'google-resume');p.approvedDraft=p.brief.productDraft;assert.notEqual(ui.nativeGoogleAction(context)?.kind,'google-resume');
  const sheets=project();sheets.googleDelivery={...job(sheets),status:'unavailable',verified:false,file:undefined};assert.equal(ui.nativeGoogleAction({...context,project:sheets}).primary.id,'view-draft');
});
test('actual resume uses the same job, reviewed source and exact selection without creating another Doc',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8'),functions=app.slice(app.indexOf('function acceptGoogleSnapshot('),app.indexOf('async function send('));
  const first=project(),other=project();first.brief.format='Written guide';first.googleDelivery=heldDoc(first);other.id='other';const held=first.googleDelivery,url='https://docs.google.com/document/d/existing123/edit',ready={...held,status:'ready',verified:true,file:{id:'existing123',title:first.brief.title,url}},calls=[];
  const scope={...ui,state:first,runtimeReady:true,accountReady:true,working:false,provider:'chatgpt',googleChecked:new Set([held.id]),googlePolling:new Set(),googleRefreshing:new Set(),googleResumeUrls:new Map([[held.id,url]]),selectedCombination:()=>({provider:'chatgpt',model:'gpt-6.1-sol',reasoningEffort:'high'}),canUseModel:()=>true,localFilesReady:()=>true,save(){},render(){},notice(){},setTimeout:callback=>callback(),fetch:async()=>({ok:true,json:async()=>ready}),post:async(path,body)=>{calls.push({path,body});scope.state=other;return {...held,status:'running'};}};
  scope.busy=value=>{scope.working=value;};vm.createContext(scope);await vm.runInContext(functions+';resumeNativeGoogle()',scope);
  assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/resume-google');assert.equal(calls[0].body.id,held.id);assert.equal(calls[0].body.url,url);assert.equal(calls[0].body.approvedSource,first.approvedDraft);assert.equal(calls[0].body.brief.productDraft,first.approvedDraft);assert.equal(calls[0].body.model,'gpt-6.1-sol');assert.equal(calls[0].body.reasoningEffort,'high');assert.equal(first.googleDelivery.id,held.id);assert.equal(first.googleDelivery.file.url,url);assert.equal(other.googleDelivery,null);assert.equal(scope.state,other);assert.equal(scope.googleResumeUrls.has(held.id),false);
});
test('actual resume rejects stale approval and wrong-job responses while retaining the held receipt',async t=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8'),functions=app.slice(app.indexOf('function acceptGoogleSnapshot('),app.indexOf('async function send('));
  for(const scenario of ['unapproved','stale-source','wrong-job','wrong-source','wrong-destination'])await t.test(scenario,async()=>{
    const p=project();p.brief.format='Written guide';const held=heldDoc(p);p.googleDelivery=held;const calls=[],errors=[];
    if(scenario==='unapproved')p.approvedDraft='';if(scenario==='stale-source'){p.brief.productDraft+=' Updated.';p.approvedDraft=p.brief.productDraft;}
    const reply={...held,status:'running',...(scenario==='wrong-job'?{id:'b'.repeat(36)}:scenario==='wrong-source'?{sourceKey:'wrong'}:scenario==='wrong-destination'?{destination:'sheets'}:{})};
    const scope={...ui,state:p,runtimeReady:true,accountReady:true,working:false,provider:'chatgpt',googleChecked:new Set([held.id]),googlePolling:new Set(),googleRefreshing:new Set(),googleResumeUrls:new Map([[held.id,'https://docs.google.com/document/d/existing123/edit']]),selectedCombination:()=>({provider:'chatgpt',model:'gpt-6.1-sol',reasoningEffort:'high'}),canUseModel:()=>true,localFilesReady:()=>true,save(){},render(){},notice:message=>errors.push(message),post:async(path,body)=>{calls.push({path,body});return reply;}};
    scope.busy=value=>{scope.working=value;};vm.createContext(scope);await vm.runInContext(functions+';resumeNativeGoogle()',scope);
    assert.equal(p.googleDelivery,held);assert.equal(calls.length,['unapproved','stale-source'].includes(scenario)?0:1);assert.equal(calls.some(call=>call.path==='/api/create-google'),false);if(calls.length)assert.match(errors[0],/did not match/);
  });
});
test('resume replies cannot replace a changed source or newer receipt while the request is pending',async t=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8'),functions=app.slice(app.indexOf('function acceptGoogleSnapshot('),app.indexOf('async function send('));
  for(const scenario of ['changed-source','newer-receipt'])await t.test(scenario,async()=>{
    const p=project();p.brief.format='Written guide';p.googleDelivery=heldDoc(p);const held=p.googleDelivery,newer={...held,id:'b'.repeat(36)},ready={...held,status:'ready',verified:true,file:{id:'existing123',title:p.brief.title,url:'https://docs.google.com/document/d/existing123/edit'}};
    const scope={...ui,state:p,runtimeReady:true,accountReady:true,working:false,provider:'chatgpt',googleChecked:new Set([held.id]),googlePolling:new Set(),googleRefreshing:new Set(),googleResumeUrls:new Map([[held.id,ready.file.url]]),selectedCombination:()=>({provider:'chatgpt',model:'gpt-6.1-sol',reasoningEffort:'high'}),canUseModel:()=>true,save(){},render(){},notice(){},post:async()=>{if(scenario==='changed-source'){p.brief.productDraft+=' Changed.';p.approvedDraft=p.brief.productDraft;}else p.googleDelivery=newer;return ready;}};
    scope.busy=value=>{scope.working=value;};vm.createContext(scope);await vm.runInContext(functions+';resumeNativeGoogle()',scope);assert.equal(p.googleDelivery,scenario==='changed-source'?held:newer);assert.equal(scope.googleResumeUrls.has(held.id),true);
  });
});
test('the actual current-action renderer exposes a labeled recovery field and retains typing across renders',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8'),renderer=app.slice(app.indexOf('function renderCurrentAction('),app.indexOf('function showWorkspace(')),p=project();p.brief.format='Written guide';p.googleDelivery=heldDoc(p);
  const button={dataset:{currentAction:'resume-google'},disabled:true},input={id:'google-resume-url',focus(){this.focused=true;}},bar={innerHTML:'',querySelectorAll:()=>[button],querySelector:()=>button,getBoundingClientRect:()=>({height:100})},scope={...ui,state:p,googleResumeUrls:new Map(),actionResizeObserver:{},view:'files',esc:value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),$:(id)=>id==='current-action'?bar:id==='google-resume-url'?input:null,currentActionState:()=>ui.nativeGoogleAction({project:p,runtime:true,connected:true,modelReady:true,provider:'chatgpt',complete:true,working:false,serverChecked:true}),actionToken:()=>'',document:{activeElement:input,documentElement:{style:{setProperty(){}}}},restoreCanvaJob(){},continueCanvaHandoff(){},restoreGoogleDelivery(){},canvaEditorUrl:()=>null};
  vm.createContext(scope);vm.runInContext(renderer+';renderCurrentAction()',scope);assert.match(bar.innerHTML,/<label for="google-resume-url">Exact existing Google Doc link<\/label>/);assert.match(bar.innerHTML,/Finish existing Doc/);assert.match(bar.innerHTML,/data-current-action="resume-google"[^>]*disabled/);
  const url='https://docs.google.com/document/d/existing123/edit';input.oninput({target:{value:url}});assert.equal(button.disabled,false);vm.runInContext('renderCurrentAction()',scope);assert.ok(bar.innerHTML.includes('value="'+url+'"'));assert.equal(input.focused,true);input.oninput({target:{value:'https://example.com/document/d/wrong/edit'}});assert.equal(button.disabled,true);
});
test('only a checked held Sheet with its known file and current connected ChatGPT source offers read-only recheck',()=>{
  const p=project();p.googleDelivery={...job(p),status:'unavailable',verified:false};const context={project:p,runtime:true,connected:true,modelReady:true,provider:'chatgpt',complete:true,working:false,serverChecked:true};
  const action=ui.nativeGoogleAction(context);assert.equal(action.kind,'google-recheck');assert.equal(action.primary.id,'recheck-google');assert.equal(action.primary.label,'Recheck existing Google Sheet');assert.match(action.detail,/read.only/i);assert.match(action.detail,/no cells are changed/i);assert.match(action.detail,/no new spreadsheet/i);assert.equal(action.primary.href,undefined);
  for(const change of [{runtime:false},{connected:false},{modelReady:false},{provider:'claude'},{working:true},{serverChecked:false}])assert.notEqual(ui.nativeGoogleAction({...context,...change})?.kind,'google-recheck');
  const held=p.googleDelivery;p.googleDelivery={...held,file:undefined};assert.notEqual(ui.nativeGoogleAction(context)?.kind,'google-recheck');p.googleDelivery=held;p.approvedDraft='';assert.notEqual(ui.nativeGoogleAction(context)?.kind,'google-recheck');p.approvedDraft=p.brief.productDraft;p.brief.productDraft+=' Changed.';p.approvedDraft=p.brief.productDraft;assert.notEqual(ui.nativeGoogleAction(context)?.kind,'google-recheck');
});
test('actual Sheet recheck sends only the same-job read-only endpoint and exact approved source/model',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8'),functions=app.slice(app.indexOf('function acceptGoogleSnapshot('),app.indexOf('async function send(')),first=project(),other=project(),ready=job(first),calls=[];other.id='other';first.googleDelivery={...ready,status:'unavailable',verified:false};const held=first.googleDelivery;
  const scope={...ui,state:first,runtimeReady:true,accountReady:true,working:false,provider:'chatgpt',googleChecked:new Set([held.id]),googlePolling:new Set(),googleRefreshing:new Set(),selectedCombination:()=>({provider:'chatgpt',model:'gpt-6.1-sol',reasoningEffort:'high'}),canUseModel:()=>true,save(){},render(){},notice(){},setTimeout:callback=>callback(),fetch:async()=>({ok:true,json:async()=>ready}),post:async(path,body)=>{calls.push({path,body});scope.state=other;return {...held,status:'running'};}};
  scope.busy=value=>{scope.working=value;};vm.createContext(scope);await vm.runInContext(functions+';recheckNativeGoogle()',scope);
  assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/recheck-google');assert.equal(calls[0].body.id,held.id);assert.equal(calls[0].body.approvedSource,first.approvedDraft);assert.equal(calls[0].body.brief.productDraft,first.approvedDraft);assert.equal(calls[0].body.provider,'chatgpt');assert.equal(calls[0].body.model,'gpt-6.1-sol');assert.equal(calls[0].body.reasoningEffort,'high');assert.equal(calls[0].body.url,undefined);assert.equal(first.googleDelivery.id,held.id);assert.equal(first.googleDelivery.file.id,held.file.id);assert.equal(first.googleDelivery.file.url,ready.file.url);assert.equal(other.googleDelivery,null);assert.equal(scope.state,other);
});
test('actual Sheet recheck holds stale sources, unknown files and mismatched or superseded replies',async t=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8'),functions=app.slice(app.indexOf('function acceptGoogleSnapshot('),app.indexOf('async function send('));
  for(const scenario of ['unapproved','stale-source','no-file','wrong-job','wrong-source','wrong-destination','changed-source','newer-receipt'])await t.test(scenario,async()=>{
    const p=project();p.googleDelivery={...job(p),status:'unavailable',verified:false};if(scenario==='no-file')delete p.googleDelivery.file;const held=p.googleDelivery,newer={...held,id:'b'.repeat(36)},calls=[],errors=[];
    if(scenario==='unapproved')p.approvedDraft='';if(scenario==='stale-source'){p.brief.productDraft+=' Updated.';p.approvedDraft=p.brief.productDraft;}
    const reply={...held,status:'running',...(scenario==='wrong-job'?{id:'b'.repeat(36)}:scenario==='wrong-source'?{sourceKey:'wrong'}:scenario==='wrong-destination'?{destination:'docs',file:undefined}:{})};
    const scope={...ui,state:p,runtimeReady:true,accountReady:true,working:false,provider:'chatgpt',googleChecked:new Set([held.id]),googlePolling:new Set(),googleRefreshing:new Set(),selectedCombination:()=>({provider:'chatgpt',model:'gpt-6.1-sol',reasoningEffort:'high'}),canUseModel:()=>true,save(){},render(){},notice:message=>errors.push(message),post:async(path,body)=>{calls.push({path,body});if(scenario==='changed-source'){p.brief.productDraft+=' Changed.';p.approvedDraft=p.brief.productDraft;}if(scenario==='newer-receipt')p.googleDelivery=newer;return reply;}};
    scope.busy=value=>{scope.working=value;};vm.createContext(scope);await vm.runInContext(functions+';recheckNativeGoogle()',scope);assert.equal(p.googleDelivery,scenario==='newer-receipt'?newer:held);assert.equal(calls.length,['unapproved','stale-source','no-file'].includes(scenario)?0:1);assert.equal(calls.every(call=>call.path==='/api/recheck-google'),true);if(scenario.startsWith('wrong-'))assert.match(errors[0],/did not match/);
  });
});
test('the ordinary Sheet current-action button dispatches recheck without a URL field',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8'),controls=app.slice(app.indexOf('function renderCurrentAction('),app.indexOf('function approveNativeSamples(')),p=project();p.googleDelivery={...job(p),status:'unavailable',verified:false};
  const button={dataset:{currentAction:'recheck-google'}},bar={innerHTML:'',querySelectorAll:()=>[button],getBoundingClientRect:()=>({height:100})},scope={...ui,state:p,googleResumeUrls:new Map(),actionResizeObserver:{},view:'files',esc:String,$:id=>id==='current-action'?bar:null,currentActionState:()=>ui.nativeGoogleAction({project:p,runtime:true,connected:true,modelReady:true,provider:'chatgpt',complete:true,working:false,serverChecked:true}),actionToken:()=>'',document:{activeElement:null,documentElement:{style:{setProperty(){}}}},restoreCanvaJob(){},continueCanvaHandoff(){},restoreGoogleDelivery(){},canvaEditorUrl:()=>null,recheckNativeGoogle:()=>{scope.called=true;}};
  vm.createContext(scope);vm.runInContext(controls+';renderCurrentAction()',scope);assert.match(bar.innerHTML,/Recheck existing Google Sheet/);assert.doesNotMatch(bar.innerHTML,/<input|google-resume-url/);await button.onclick();assert.equal(scope.called,true);
});
