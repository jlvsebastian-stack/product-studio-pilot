import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');

test('settings are a closed disclosure while project buttons remain directly available',()=>{
  const header=html.slice(html.indexOf('<header>'),html.indexOf('</header>'));
  for(const id of ['new-project','save-project','open-project','settings-toggle'])assert.ok(header.includes(`id="${id}"`));
  assert.match(header,/id="settings-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="settings-panel"/);
  assert.match(html,/<section id="settings-panel"[^>]*hidden/);
  const settings=html.slice(html.indexOf('<section id="settings-panel"'),html.indexOf('<section id="projects-panel"'));
  for(const id of ['provider','model','quality','account-toggle','preferences-toggle'])assert.ok(settings.includes(`id="${id}"`),id+' remains available in Settings');
  assert.ok(!header.includes('id="provider"'));
});

test('settings disclosure and nested panels preserve state without AI requests',()=>{
  const nodes={};for(const id of ['settings-panel','settings-toggle','account-panel','account-toggle','preferences-panel','preferences-toggle','projects-panel','open-project'])nodes[id]={hidden:true,attributes:{},setAttribute(key,value){this.attributes[key]=value;},focus(){this.focused=true;}};
  const saved={source:'Keep the exact creator source',typing:'Keep my question',model:'gpt-6.1-sol',quality:'medium'},before=JSON.stringify(saved);
  const scope={$:id=>nodes[id],state:saved};vm.createContext(scope);
  vm.runInContext(app.slice(app.indexOf('function toggleSettings('),app.indexOf('function nativeSamplesApproved(')),scope);
  scope.toggleSettings(true);assert.equal(nodes['settings-panel'].hidden,false);assert.equal(nodes['settings-toggle'].attributes['aria-expanded'],'true');
  scope.panel('account-panel',true);assert.equal(nodes['account-panel'].hidden,false);assert.equal(nodes['settings-panel'].hidden,false);
  scope.panel('preferences-panel',true);assert.equal(nodes['preferences-panel'].hidden,false);assert.equal(nodes['account-panel'].hidden,true);
  scope.toggleSettings(false,true);assert.equal(nodes['settings-panel'].hidden,true);assert.equal(nodes['preferences-panel'].hidden,true);assert.equal(nodes['settings-toggle'].attributes['aria-expanded'],'false');assert.equal(nodes['settings-toggle'].focused,true);
  scope.toggleSettings(true);scope.panel('projects-panel',true);assert.equal(nodes['settings-panel'].hidden,true);assert.equal(nodes['projects-panel'].hidden,false);
  assert.equal(JSON.stringify(saved),before);
});

test('project overview shows the current decision instead of repeating a whole sample and plan history',()=>{
  const state={interviewStage:9,brief:{title:'A Useful Kit',buyer:'New meeting coordinators',outcome:'Send a clear recap',offer:'Reusable recap messages',outline:'Capture decisions\nSend the recap',productDraft:'## Capture Decisions\n\nExact sample source that belongs in the draft view.'},notes:[{title:'Audience',summary:'Keep this decision'}],suggestions:[],approvedDraft:'',expandedOutline:'## Capture Decisions\n\n### Purpose\nMake a clear record.',approvedExpandedOutline:''};
  const scope={state,facts:[['buyer','Who it helps'],['outcome','The useful outcome'],['offer','Your offer']],esc:String,rich:String,currentDraftSection:()=>({text:state.brief.productDraft,pending:true}),outlineApprovalCurrent:()=>true,expandedOutlineApprovalCurrent:()=>false,renderOutlineReview:()=>'<section>Current outline review</section>',renderSuggestions:()=>'',renderPlanHistory:()=>'<section>Previous decisions and exact sample source</section>',isPresentation:()=>false,STAGES:Array.from({length:12},()=>['Stage','']),outlineNextStep:()=>'',expandedOutlineCovered:()=>false,nativeSamplesApproved:()=>false,manuscriptHtml:String,renderSampleReview:()=>'<button>Duplicate sample export</button>',renderExportPreview:()=>'<details>Duplicate export preview</details>'};
  scope.working=false;vm.createContext(scope);vm.runInContext(app.slice(app.indexOf('function renderBrief('),app.indexOf('function renderSuggestions(')),scope);
  const before=JSON.stringify(state),markup=scope.renderBrief();
  assert.match(markup,/Current outline review/);assert.doesNotMatch(markup,/Exact sample source|Duplicate sample export|Duplicate export preview/);
  assert.match(markup,/Who it helps/);assert.match(markup,/Working brief/);assert.equal(JSON.stringify(state),before);
});

test('one explicit approval reuses a complete early baseline and still stops at market comparison',async()=>{
  for(const stage of [1,2,3,4]){
    const state={interviewStage:stage,stageReady:true,summary:'The creator reviewed this proposed direction.',notes:[],brief:{topic:'Plan exam week around work',buyer:'First-year students with evening shifts',outcome:'Make a usable seven-day revision plan',niche:'Exam planning for students working evening shifts',productDraft:''}},requests=[];
    const scope={state,working:false,canUseModel:()=>true,hasConcepts:()=>false,STAGES:Array.from({length:12},(_,i)=>['Step '+(i+1)]),save(){},send:async message=>requests.push({stage:state.interviewStage,message}),render(){},notice(){}};vm.createContext(scope);
    vm.runInContext(app.slice(app.indexOf('async function advance('),app.indexOf('async function prepareCompletion(')),scope);
    await scope.advance();assert.equal(state.interviewStage,5);assert.equal(requests.length,1);assert.equal(requests[0].stage,5);assert.equal(state.notes.length,1);assert.equal(state.notes[0].stage,stage);assert.equal(state.brief.productDraft,'');assert.equal(state.stageReady,false);
  }
});

test('unknown or broad early baselines and missing approval cannot skip decisions',async()=>{
  for(const change of [{buyer:'Everyone'},{outcome:''},{niche:'Students'},{topic:'unknown'},{niche:'I have not decided yet'},{niche:'Audience still needs to be decided'},{buyer:'I do not know who this helps yet'},{niche:'The niche is still unknown'},{niche:'I haven’t chosen a niche yet'}]){
    const state={interviewStage:1,stageReady:true,summary:'Proposed',notes:[],brief:{topic:'Plan exam week around work',buyer:'First-year students with evening shifts',outcome:'Make a seven-day revision plan',niche:'Exam planning for students working evening shifts',productDraft:'',...change}};
    const scope={state,working:false,canUseModel:()=>true,hasConcepts:()=>false,STAGES:Array.from({length:12},()=>['Step']),save(){},send:async()=>{},render(){},notice(){}};vm.createContext(scope);vm.runInContext(app.slice(app.indexOf('async function advance('),app.indexOf('async function prepareCompletion(')),scope);
    await scope.advance();assert.equal(state.interviewStage,2,JSON.stringify(change));state.interviewStage=1;state.stageReady=false;await scope.advance();assert.equal(state.interviewStage,1);
  }
});

test('a specific supplied buyer can complete the early baseline without a separate niche field',async()=>{
  const buyer='New home bakers taking custom-cake orders through Messenger';
  for(const change of [{},{niche:'Audience still needs to be decided'},{buyer:'Everyone'},{buyer:'People who want help with their business'},{outcome:''}]){
    const state={interviewStage:1,stageReady:true,summary:'Approved this direction.',notes:[],brief:{topic:'Handle custom cake orders',buyer,outcome:'Get the cake details and confirm the order without missed changes',method:'Collect size, flavor, delivery and deposit in one written confirmation.',niche:'',productDraft:'',...change}},before=JSON.stringify({brief:state.brief}),requests=[];
    const scope={state,working:false,canUseModel:()=>true,hasConcepts:()=>false,STAGES:Array.from({length:12},()=>['Step']),save(){},send:async()=>requests.push(state.interviewStage),render(){},notice(){}};vm.createContext(scope);vm.runInContext(app.slice(app.indexOf('async function advance('),app.indexOf('async function prepareCompletion(')),scope);
    await scope.advance();assert.equal(state.interviewStage,Object.keys(change).length?2:5,JSON.stringify(change));assert.equal(JSON.stringify({brief:state.brief}),before);assert.equal(requests.length,1);
  }
});

test('presentation CSS loads before app refinements instead of overriding them after startup',()=>{
  const stylesheet=html.indexOf('<link rel="stylesheet" href="/design-concepts.css">');
  assert.ok(stylesheet>=0&&stylesheet<html.indexOf('<style>'));
  assert.doesNotMatch(app,/conceptStyles\.href=['"]\/design-concepts\.css/);
});

test('conversation and working are compact nondecision states and retain native handoff side effects',()=>{
  const nodes={'current-action':{innerHTML:'',getBoundingClientRect:()=>({height:30}),querySelectorAll:()=>[],querySelector:()=>null,focus(){}},'busy-title':{textContent:'Checking real market sources'}},calls=[];
  const scope={googleResumeUrls:new Map(),restoreGoogleDelivery:()=>calls.push('google'),$:id=>nodes[id],view:'brief',state:{reviewed:false},actionResizeObserver:null,document:{activeElement:null,documentElement:{style:{setProperty(){}}}},esc:String,canvaEditorUrl:()=>false,currentActionState:()=>({kind:'conversation',title:'Continue the conversation',detail:'Tell the AI more.',primary:{id:'focus-chat',label:'Go to conversation'}}),actionToken:()=>'',restoreCanvaJob:()=>calls.push('restore'),continueCanvaHandoff:()=>calls.push('handoff')};
  vm.createContext(scope);vm.runInContext(app.slice(app.indexOf('function renderCurrentAction('),app.indexOf('function showWorkspace(')),scope);
  scope.renderCurrentAction();assert.doesNotMatch(nodes['current-action'].innerHTML,/<button|Go to conversation/);assert.match(nodes['current-action'].innerHTML,/current-action-idle/);
  scope.currentActionState=()=>({kind:'working',title:'John Connor is working',detail:'You can keep typing.'});scope.renderCurrentAction();assert.match(nodes['current-action'].innerHTML,/Checking real market sources/);assert.match(nodes['current-action'].innerHTML,/workspace-status/);assert.equal(calls.join(','),'restore,handoff,google,restore,handoff,google');
});

test('the shared busy callback keeps only the current-action status visible',()=>{
  const nodes={busy:{style:{}},'busy-title':{textContent:''}},scope={$:id=>nodes[id],working:false,render(){},refreshExpiredModelAccess(){}};vm.createContext(scope);
  vm.runInContext(app.slice(app.indexOf('function busy('),app.indexOf('\nasync function send(')),scope);
  scope.busy(true,'Preparing the complete draft');assert.equal(scope.working,true);assert.equal(nodes.busy.style.display,'none');assert.equal(nodes['busy-title'].textContent,'Preparing the complete draft');
  scope.busy(false);assert.equal(scope.working,false);assert.equal(nodes.busy.style.display,'none');
});

test('the actual manuscript reader renders escaped semantic tables and preserves surrounding content',()=>{
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const scope={esc,rich:text=>esc(text).replace(/\n/g,'<br>')};vm.createContext(scope);vm.runInContext(app.slice(app.indexOf('function manuscriptHtml('),app.indexOf('function renderPlanHistory(')),scope);
  const source='## Choose the Right Reply\n\nKeep this introduction exactly.\n\n| Situation | Reply |\n| --- | :--- |\n| Size is missing | Ask **which size** they need. |\n| Flavor is vanilla \\| chocolate | <img src=x onerror=alert(1)> |\n\nKeep this closing paragraph exactly.',before=source,markup=scope.manuscriptHtml(source);
  assert.match(markup,/<table>/);assert.match(markup,/<thead><tr><th scope="col">Situation<\/th>/);assert.match(markup,/<tbody><tr><td>Size is missing<\/td>/);assert.match(markup,/<strong>which size<\/strong>/);assert.match(markup,/vanilla \| chocolate/);assert.match(markup,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(markup,/<img\b|\| --- \|/);
  assert.ok(markup.indexOf('Keep this introduction exactly.')<markup.indexOf('<table>'));assert.ok(markup.indexOf('</table>')<markup.indexOf('Keep this closing paragraph exactly.'));assert.equal(source,before);
  for(const invalid of ['| Header | Value |\n| not a delimiter | --- |\n| A | B |','| Header | Value |\n| --- | --- |\n| Missing cell |']){const rendered=scope.manuscriptHtml(invalid);assert.doesNotMatch(rendered,/<table>/);assert.equal(rendered,'<p>'+scope.rich(invalid)+'</p>');}
});

test('Your Product shows the actual sample before export and approval guidance, with edit controls retained',()=>{
  const source='## Choose the Right Reply\n\nACTUAL_SAMPLE_CONTENT_FIRST',state={brief:{productDraft:source,design:'Clear editable replies'},approvedDraft:'Earlier approved source',previousApprovedDraft:'Older approved source',sampleApproved:false},scope={state,view:'draft',working:false,currentDraftSection:()=>({text:source}),expandedOutlineCovered:()=>false,esc:String,manuscriptHtml:()=>'<h3>Choose the Right Reply</h3><p>ACTUAL_SAMPLE_CONTENT_FIRST</p>',renderSectionWorkspace:()=>'<article>ACTUAL_SAMPLE_CONTENT_FIRST</article>',renderSampleReview:()=>'<section class="sample-review"><button id="export-sample">Create sample for review</button></section>',renderExportPreview:()=>'<details>Export preview</details>',renderSuggestions:()=>''};
  vm.createContext(scope);vm.runInContext(app.slice(app.indexOf('function renderDraft('),app.indexOf('function links(')),scope);
  const before=JSON.stringify(state),markup=scope.renderDraft();assert.ok(markup.indexOf('ACTUAL_SAMPLE_CONTENT_FIRST')<markup.indexOf('id="export-sample"'));assert.ok(markup.indexOf('ACTUAL_SAMPLE_CONTENT_FIRST')<markup.indexOf('class="approval-note"'));assert.match(markup,/id="toggle-editor"/);assert.match(markup,/<details[^>]*><summary>Editing and approval options<\/summary>/);assert.match(markup,/id="revise-draft"/);assert.match(markup,/id="undo-draft"/);assert.equal(JSON.stringify(state),before);
  scope.view='edit';const edit=scope.renderDraft();assert.ok(edit.indexOf('id="toggle-editor"')<edit.indexOf('id="manuscript"'));assert.match(edit,/Read current section/);assert.ok(edit.indexOf('id="manuscript"')<edit.indexOf('id="export-sample"'));assert.ok(edit.includes(source));
});
