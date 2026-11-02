import * as google from '../public/google-delivery.js';
import {namedSectionEditRequest} from '../public/scoped-edit-request.js';
import * as quality from '../public/quality-review.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as store from '../public/studio-store.js';
import * as outline from '../public/outline-plan.js';
import * as design from '../public/design-concepts.js';
import {currentAction} from '../public/current-action.js';
import {createModelAccess,modelAccessKey} from '../public/model-access.js';
import {recordRequest,requestMessages} from '../public/composer.js';

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const headings=['Map Exams And Commitments','Choose Useful Topics','Make A Realistic Plan','Check And Adjust'];
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function controller(format='Compact workbook'){
  const state=store.freshProject();state.interviewStage=10;state.stageReady=false;
  Object.assign(state.brief,{title:'A Practical Study Plan',format,outline:headings.join('\n'),productDraft:headings.map(heading=>'## '+heading+'\n\n'+('This is illustrative complete teaching content, with a practical example and an exercise that the learner can use. '.repeat(45))).join('\n\n')});
  state.approvedOutline=state.brief.outline;state.expandedOutline=headings.map(heading=>'## '+heading+'\n\n### Purpose\nExplain this practical action with an example and a useful exercise.').join('\n\n');state.approvedExpandedOutline=state.expandedOutline;state.approvedDraft=state.brief.productDraft;state.sampleApproved=true;state.pendingAnswer='Keep my unsent next question';
  const nodes={},requests=[];
  function element(){return {disabled:false,checked:false,style:{},dataset:{},controls:[],childIds:[],focus(){this.focused=true;},getBoundingClientRect:()=>({height:110}),querySelectorAll(){return this.controls;},querySelector(selector){return this.controls.find(item=>selector.includes('"'+item.dataset.currentAction+'"'));},async click(){if(!this.disabled)return this.onclick?.();}};}
  function container(){const node=element();Object.defineProperty(node,'innerHTML',{get(){return node.html||'';},set(html){for(const id of node.childIds)delete nodes[id];node.childIds=[];node.html=html;node.controls=[];for(const match of html.matchAll(/<(?:button|input|textarea|div|span)\b([^>]*)>/g)){
    const attributes=match[1],id=/\bid="([^"]+)"/.exec(attributes)?.[1],action=/\bdata-current-action="([^"]+)"/.exec(attributes)?.[1];
    if(!id&&!action)continue;const item=element();item.disabled=/\bdisabled\b/.test(attributes);item.checked=/\bchecked\b/.test(attributes);if(action){item.dataset.currentAction=action;node.controls.push(item);}if(id){nodes[id]=item;node.childIds.push(id);}
  }}});return node;}
  for(const id of ['new-project','open-project','provider','model','quality'])nodes[id]=element();
  nodes['workspace-content']=container();nodes['current-action']=container();
  const scope={...quality,...google,googleChecked:new Set(),googleResumeUrls:new Map(),restoreGoogleDelivery(){},namedSectionEditRequest,sectionViews:{},...store,...outline,...design,currentAction,state,canvaJobs:new Map(),outlineJobs:new Map(),view:'draft',working:false,runtimeReady:true,accountReady:true,catalog:{},diskSaveStatus:'saved',actionResizeObserver:null,provider:'chatgpt',selectedModel:'gpt-6.1-sol',quality:'medium',esc,canUseModel:()=>false,canResumeSlides:()=>false,hasConcepts:()=>design.isPresentation(state.brief),title:()=>state.brief.title,$:id=>nodes[id],document:{activeElement:null,documentElement:{style:{setProperty(){}}},querySelector(){return null;},querySelectorAll:()=>[]},palette(){},renderProgress(){},renderChat(){},updateModelNote(){},renderBrief:()=>'',renderDraft:()=>'<article>Retained approved manuscript</article>',renderExportPreview:()=>'',bindProductActions(){},bindDesignActions(){},bindOutlineActions(){},restoreCanvaJob(){},continueCanvaHandoff(){},schedulePreview(){},save(){scope.saved=(scope.saved||0)+1;},notice(message){scope.noticed=message;},panel(){},busy(value){scope.working=value;scope.render();},previewKey:()=>JSON.stringify([scope.state.id,scope.state.brief]),checkSelectedModel(){scope.modelChecks=(scope.modelChecks||0)+1;},post:async(path,body)=>{requests.push({path,body});return {pages:12,files:{pdf:{name:'study-plan.pdf',url:'/downloads/current/study-plan.pdf'},markdown:{name:'study-plan.md',url:'/downloads/current/study-plan.md'}}};}};
  vm.createContext(scope);vm.runInContext(source.slice(source.indexOf('function renderFinalQuality('),source.indexOf('function renderSuggestions(')),scope);vm.runInContext(source.slice(source.indexOf('function expandedOutlineMarkup('),source.indexOf('function renderOutlineReview(')),scope);
  scope.rich=esc;scope.renderSuggestions=()=>'';scope.uploadCover=()=>{};
  vm.runInContext(source.slice(source.indexOf('function invalidate('),source.indexOf('function panel(')),scope);
  vm.runInContext(source.slice(source.indexOf('function manuscriptHtml('),source.indexOf('function renderPlanHistory(')),scope);
  vm.runInContext(source.slice(source.indexOf('function renderDraft('),source.indexOf('function links(')),scope);
  for(const [start,end]of [['function nativeSamplesApproved(','function palette('],['function nativeReviewInstructions(','function renderDraft('],['function links(','function bindProductActions('],['async function exportSample(','function downloadProject(']])vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end)),scope);
  return {scope,state,nodes,requests};
}

test('complete approved written work at stage10 can use the normal Files tab and reviewed export without AI access',async()=>{
  for(const format of ['Compact workbook','Practical guide']){
    const {scope,state,nodes,requests}=controller(format),before=JSON.stringify(state);
    assert.equal(outline.expandedOutlineCovered(state),true);scope.render();
    assert.equal(nodes['files-tab'].disabled,false,'The complete approved product must have an enabled Files tab at stage10');
    assert.equal(scope.currentActionState().primary.id,'view-files','The prominent action must lead to local review instead of another AI check');
    assert.equal(JSON.stringify(state),before,'Offering local files must not approve, advance or alter the project');
    assert.equal(requests.length,0);await nodes['files-tab'].click();assert.equal(scope.view,'files');
    assert.equal(scope.currentActionState().kind,'export');assert.equal(nodes['current-files-reviewed'].checked,false);
    let button=nodes['current-action'].controls.find(item=>item.dataset.currentAction==='export');assert.equal(button.disabled,true);await button.click();assert.equal(requests.length,0,'The normal disabled export control cannot skip final review');
    nodes['current-files-reviewed'].checked=true;nodes['current-files-reviewed'].onchange({target:nodes['current-files-reviewed']});
    button=nodes['current-action'].controls.find(item=>item.dataset.currentAction==='export');assert.equal(button.disabled,false);await button.click();
    assert.equal(requests.length,1);assert.equal(requests[0].path,'/api/export-product');assert.equal(requests[0].body.reviewed,true);assert.equal(requests[0].body.brief.productDraft,JSON.parse(before).brief.productDraft);assert.equal(requests[0].body.draft,undefined);
    assert.match(nodes['download-links'].innerHTML||nodes['workspace-content'].innerHTML,/\/downloads\/current\/study-plan.pdf/);assert.match(nodes['workspace-content'].innerHTML,/Text \(Markdown\)/);
    assert.equal(state.approvedDraft,JSON.parse(before).approvedDraft);assert.equal(state.approvedExpandedOutline,JSON.parse(before).approvedExpandedOutline);assert.equal(state.interviewStage,10);assert.equal(state.pendingAnswer,'Keep my unsent next question');assert.equal(state.brief.listingCopy,'');assert.equal(state.companions.length,0);assert.equal(scope.modelChecks,undefined);assert.equal(scope.selectedModel,'gpt-6.1-sol');assert.equal(scope.quality,'medium');
  }
});

test('the current-action review button opens the same Files view even while the AI account is unavailable',async()=>{
  const {scope,state,nodes,requests}=controller();scope.accountReady=false;scope.render();
  const button=nodes['current-action'].controls.find(item=>item.dataset.currentAction==='view-files');assert.ok(button,'A normal local review action must be offered');assert.equal(button.disabled,false);await button.click();assert.equal(scope.view,'files');assert.equal(nodes['current-files-reviewed'].checked,false);assert.equal(requests.length,0);assert.equal(state.reviewed,false);assert.equal(state.interviewStage,10);
});

test('first whole-draft approval and post-edit reapproval are normal human actions before local Files review, without AI',async()=>{
  for(const kind of ['first-whole','post-edit']){
    const {scope,state,nodes,requests}=controller(kind==='first-whole'?'Practical guide':'Compact workbook');scope.accountReady=false;
    if(kind==='first-whole')state.approvedDraft=state.brief.productDraft.split('## '+headings[1])[0];
    else state.brief.productDraft=state.brief.productDraft.replace('This is illustrative complete teaching content','This is a focused authorized revision to the teaching content');
    const priorApproval=state.approvedDraft,sourceText=state.brief.productDraft,plan=state.approvedExpandedOutline;
    if(kind==='post-edit')assert.equal(outline.creationProgress(state).drafted,0,'This fixture includes the real approved-prefix mismatch after a scoped edit');
    assert.notEqual(priorApproval,sourceText);assert.equal(outline.expandedOutlineCovered(state),true);scope.render();
    for(const heading of headings)assert.ok(nodes['workspace-content'].innerHTML.includes(heading),'The entire draft must be readable before approving it');
    assert.equal(nodes['files-tab'].disabled,true,'Unapproved work still cannot open final Files');assert.equal(state.approvedDraft,priorApproval,'Rendering never approves content');assert.equal(requests.length,0);
    const approve=nodes['current-action'].controls.find(item=>item.dataset.currentAction==='approve-draft');assert.ok(approve,'The normal bar must expose whole-draft approval even with no AI access');assert.equal(approve.disabled,false);assert.match(nodes['current-action'].innerHTML,/Approve full draft/);await approve.click();
    assert.equal(state.approvedDraft,sourceText);assert.equal(state.previousApprovedDraft,priorApproval,'The existing approval handler must keep its real Undo snapshot');assert.equal(outline.creationProgress(state).drafted,4);assert.equal(outline.creationProgress(state).approved,4);assert.equal(state.brief.productDraft,sourceText);assert.equal(state.approvedExpandedOutline,plan);assert.equal(state.reviewed,false);assert.equal(nodes['files-tab'].disabled,false);assert.equal(requests.length,0);
    const files=nodes['current-action'].controls.find(item=>item.dataset.currentAction==='view-files');assert.ok(files);await files.click();assert.equal(scope.view,'files');assert.equal(nodes['current-files-reviewed'].checked,false);
    let download=nodes['current-action'].controls.find(item=>item.dataset.currentAction==='export');assert.equal(download.disabled,true);await download.click();assert.equal(requests.length,0);
    nodes['current-files-reviewed'].checked=true;nodes['current-files-reviewed'].onchange({target:nodes['current-files-reviewed']});download=nodes['current-action'].controls.find(item=>item.dataset.currentAction==='export');assert.equal(download.disabled,false);await download.click();
    assert.equal(requests.length,1);assert.equal(requests[0].path,'/api/export-product');assert.equal(requests[0].body.brief.productDraft,sourceText);assert.equal(requests[0].body.reviewed,true);assert.equal(scope.modelChecks,undefined);assert.equal(state.interviewStage,10);assert.equal(state.pendingAnswer,'Keep my unsent next question');assert.equal(scope.selectedModel,'gpt-6.1-sol');assert.equal(scope.quality,'medium');
  }
});

test('offline whole-draft approval is not offered for partial, stale, outline-only, presentation or active work',()=>{
  const changes=[
    state=>{state.brief.productDraft=state.brief.productDraft.split('## '+headings[1])[0];},
    state=>{state.brief.outline+='\nUnapproved scope';},
    state=>{state.expandedOutline+='\n\nUnapproved plan revision';},
    state=>{state.brief.productDraft=headings.map(heading=>'## '+heading).join('\n\n');},
    state=>{state.brief.format='Webinar presentation';}
  ];
  for(const change of changes){const {scope,state,nodes}=controller();state.approvedDraft=state.brief.productDraft.slice(0,200);change(state);scope.render();assert.equal(nodes['current-action'].controls.some(item=>item.dataset.currentAction==='approve-draft'),false);}
  for(const flag of ['working','runtimeReady']){const {scope,state,nodes}=controller();state.approvedDraft=state.brief.productDraft.slice(0,200);scope[flag]=flag==='working';scope.render();assert.equal(nodes['current-action'].controls.some(item=>item.dataset.currentAction==='approve-draft'),false);}
});

test('local files do not strand the existing optional online finishing and listing path',async()=>{
  const {scope,state,nodes,requests}=controller();scope.canUseModel=()=>true;state.interviewStage=11;state.stageReady=true;scope.STAGES=Array.from({length:12},(_,i)=>['Stage '+(i+1),'']);scope.prepareCompletion=async()=>{scope.prepared=(scope.prepared||0)+1;};
  vm.runInContext(source.slice(source.indexOf('async function advance('),source.indexOf('async function prepareCompletion(')),scope);scope.render();
  assert.ok(nodes['current-action'].controls.some(item=>item.dataset.currentAction==='view-files'),'Primary files remain available');const advance=nodes['current-action'].controls.find(item=>item.dataset.currentAction==='advance');assert.ok(advance,'The existing online finishing action must remain reachable');assert.equal(requests.length,0);assert.equal(scope.prepared,undefined,'Rendering never requests optional AI work');
  await advance.click();assert.equal(state.interviewStage,12);assert.equal(scope.view,'files');assert.equal(scope.prepared,1,'An explicit existing advance can prepare optional completion work');assert.ok(nodes['prepare-completion'],'The existing listing/companion entry remains visible at its normal stage');await nodes['prepare-completion'].click();assert.equal(scope.prepared,2);assert.equal(requests.length,0,'This controller test does not invoke any real provider');
});

test('partial, outline-only, stale-plan and unapproved written work cannot use final local export',async()=>{
  const changes=[
    state=>{state.brief.productDraft=state.brief.productDraft.split('## '+headings[1])[0];state.approvedDraft=state.brief.productDraft;},
    state=>{state.brief.productDraft=headings.map(heading=>'## '+heading).join('\n\n');state.approvedDraft=state.brief.productDraft;},
    state=>{state.brief.outline+='\nNew scope';},
    state=>{state.expandedOutline+='\n\nRevised detail awaiting approval.';},
    state=>{state.brief.productDraft+='\n\nA proposed change not yet approved.';},
    state=>{state.interviewStage=9;}
  ];
  for(const change of changes){const {scope,state,nodes,requests}=controller();change(state);scope.render();assert.equal(nodes['files-tab'].disabled,true);assert.notEqual(scope.currentActionState().primary?.id,'view-files');assert.equal(nodes['current-files-reviewed'],undefined);await nodes['files-tab'].click();assert.equal(scope.view,'draft');state.reviewed=true;const before=JSON.stringify(state);await scope.exportFiles();assert.equal(requests.length,0,'Invoking the export action itself must also retain the complete current-approval gate');assert.equal(JSON.stringify(state),before);}
  for(const change of changes.slice(0,5)){const {scope,state,nodes}=controller();change(state);state.interviewStage=11;scope.view='files';scope.canUseModel=()=>true;scope.render();assert.notEqual(scope.currentActionState().kind,'export','A later legacy stage and working AI cannot bypass source completeness');assert.equal(nodes['current-files-reviewed'],undefined);}
});

test('presentation gates and active work retain their current actions instead of the written local-export path',()=>{
  const {scope,nodes}=controller('Webinar presentation');scope.render();assert.equal(nodes['files-tab'].disabled,true);assert.notEqual(scope.currentActionState().primary?.id,'view-files');assert.equal(nodes['current-files-reviewed'],undefined);
  const written=controller();written.scope.working=true;written.scope.render();assert.equal(written.scope.currentActionState().kind,'working');
});

test('a plan change after entering Files removes final export authority without losing the source or unsent text',async()=>{
  const {scope,state,nodes,requests}=controller();scope.render();const button=nodes['current-action'].controls.find(item=>item.dataset.currentAction==='view-files');assert.ok(button);await button.click();nodes['current-files-reviewed'].checked=true;nodes['current-files-reviewed'].onchange({target:nodes['current-files-reviewed']});const retained=state.brief.productDraft;state.expandedOutline+='\n\nNew plan proposal.';scope.render();assert.notEqual(scope.currentActionState().kind,'export');await scope.exportFiles();assert.equal(requests.length,0);assert.equal(state.brief.productDraft,retained);assert.equal(state.pendingAnswer,'Keep my unsent next question');
});

async function failedInterview(error,{confirmed=true,changeSelection=false}={}){
  const ui=controller(),{scope,state,requests}=ui,selection={provider:scope.provider,model:scope.selectedModel,reasoningEffort:scope.quality};
  let checks=0;scope.modelAccess=createModelAccess({request:async()=>{checks++;return {available:true};}});if(confirmed)await scope.modelAccess.check(selection);
  scope.canUseModel=()=>scope.modelAccess.ready&&modelAccessKey(scope.modelAccess.state.selection)===modelAccessKey({provider:scope.provider,model:scope.selectedModel,reasoningEffort:scope.quality});
  const text='Can you explain the daily check?',reference={id:'retained-guide',name:'Study context.txt',kind:'file',mimeType:'text/plain',text:'Private fixture context.',status:'ready',note:'Parsed locally'};
  state.pendingAnswer=text;state.pendingReferences=[reference];
  Object.assign(scope,{recordRequest,requestMessages,revisionMode:false,referenceComposer:()=>({ready:true,addLinks:async()=>{}}),extractHttpLinks:()=>[],studio:{profile:{preferences:[]}},renderPreferences(){},post:async(path,body)=>{requests.push({path,body});if(requests.length===1){state.pendingAnswer='A new unsent thought while waiting';if(changeSelection)scope.selectedModel='gpt-6-astra';throw error;}return {message:'The connection recovered.',brief:{...state.brief},stageReady:false};}});
  vm.runInContext(source.slice(source.indexOf('async function send('),source.indexOf('async function advance(')),scope);
  await scope.send(text,true);return {...ui,text,checks:()=>checks};
}

test('settled runtime or coded transport failures retain the exact prior confirmed choice for explicit Retry only',async()=>{
  for(const code of ['runtime','connection_error','econnreset']){
    const error=Object.assign(Error(`The ChatGPT helper or connection could not finish this request. Your draft is saved; retry this same selection when the connection is ready. [${code}]`),{status:400});
    const {scope,state,requests,text,checks}=await failedInterview(error),retained=state.brief.productDraft,approved=state.approvedDraft,expanded=state.expandedOutline;
    assert.equal(scope.modelAccess.ready,true,'An ended transient transport failure is not a new model-access rejection');assert.equal(scope.canUseModel(),true);assert.equal(requests.length,1);assert.equal(checks(),1,'Failure must not start another model probe');assert.equal(state.retryRequest.text,text);assert.equal(state.retryRequest.references[0].id,'retained-guide');assert.equal(state.pendingAnswer,'A new unsent thought while waiting');assert.doesNotMatch(state.messages.at(-1).content,/Check access/);
    await scope.send('',false,{retry:true});assert.equal(requests.length,2);assert.equal(requests[1].path,'/api/interview');assert.equal(requests[1].body.currentInput,text);assert.equal(requests[1].body.model,'gpt-6.1-sol');assert.equal(requests[1].body.reasoningEffort,'medium');assert.equal(requests[1].body.references[0].id,'retained-guide');assert.equal(checks(),1);assert.equal(state.retryRequest,null);assert.equal(state.messages.filter(message=>message.role==='user').length,1);assert.equal(state.pendingAnswer,'A new unsent thought while waiting');assert.equal(state.brief.productDraft,retained);assert.equal(state.approvedDraft,approved);assert.equal(state.expandedOutline,expanded);assert.equal(scope.selectedModel,'gpt-6.1-sol');assert.equal(scope.quality,'medium');
  }
});

test('auth/model rejection,409,unconfirmed termination and changed or never-confirmed choices remain held',async()=>{
  const failures=[
    Object.assign(Error('Sign in to ChatGPT again. [authentication_error]'),{status:401}),
    Object.assign(Error('The selected model is unavailable. [model_not_found]'),{status:400}),
    Object.assign(Error('Your AI is still working. [runtime]'),{status:409}),
    Object.assign(Error('The AI helper did not confirm that it stopped. No new request will start. [runtime]'),{status:400}),
    Error('Failed to fetch')
  ];
  for(const error of failures){const {scope,state,requests,checks}=await failedInterview(error);assert.equal(scope.canUseModel(),false);assert.equal(scope.modelAccess.ready,false);assert.ok(state.retryRequest);await scope.send('',false,{retry:true});assert.equal(requests.length,1);assert.equal(checks(),1);assert.equal(state.pendingAnswer,'A new unsent thought while waiting');}
  const changed=await failedInterview(Object.assign(Error('Connection could not finish. [runtime]'),{status:400}),{changeSelection:true});assert.equal(changed.scope.canUseModel(),false);await changed.scope.send('',false,{retry:true});assert.equal(changed.requests.length,1);assert.equal(changed.scope.selectedModel,'gpt-6-astra','A later explicit choice must not be reset');
  const unconfirmed=await failedInterview(Object.assign(Error('Connection could not finish. [runtime]'),{status:400}),{confirmed:false});assert.equal(unconfirmed.scope.canUseModel(),false);assert.equal(unconfirmed.requests.length,0);assert.equal(unconfirmed.checks(),0);assert.equal(unconfirmed.state.retryRequest,null);
});
