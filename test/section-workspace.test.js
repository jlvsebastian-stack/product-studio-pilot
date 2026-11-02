import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as outline from '../public/outline-plan.js';

const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plan='Whole product: retain the guide and supporting prompts.\n\n## Choose The Goal\n\n### Purpose\nChoose a concrete visitor action.\n\n- Example: a reader follows a contact link.\n- Practice: name the action.\n\n## Check The Result\n\n### Purpose\nCheck the complete workflow and record improvements.';
function controller(){
  const state={id:'first',interviewStage:10,brief:{title:'A useful product',format:'Guide',outline:'Choose The Goal\nCheck The Result',productDraft:'## Choose The Goal\n\nKeep this exact sample and all its notes.'},expandedOutline:plan,approvedOutline:'Choose The Goal\nCheck The Result',approvedExpandedOutline:'',approvedDraft:'',pendingAnswer:'Keep this unsent thought',notes:[]};
  const nodes={},scope={state,sectionViews:{},...outline,esc,rich:esc,manuscriptHtml:text=>'<p>'+esc(text)+'</p>',expandedOutlineMarkup:text=>'<p>'+esc(text)+'</p>',$:id=>nodes[id],document:{querySelectorAll:()=>[]}};
  vm.createContext(scope);
  const start=app.indexOf('function sectionWorkspaceData('),end=app.indexOf('function renderOutlineReview(');
  assert.ok(start>=0,'The actual workspace must separate section navigation and details');
  vm.runInContext(app.slice(start,end),scope);
  return {scope,state,nodes};
}
test('a real section list shows one selected detail, factual draft status and no source mutation',()=>{
  const {scope,state}=controller(),before=JSON.stringify(state),html=scope.renderSectionWorkspace('plan');
  assert.match(html,/Choose The Goal/);assert.match(html,/Check The Result/);assert.match(html,/Draft exists/);assert.match(html,/Not drafted/);
  assert.match(html,/Choose a concrete visitor action/);assert.doesNotMatch(html,/Check the complete workflow and record improvements/);
  assert.match(html,/Read whole plan/);assert.equal(JSON.stringify(state),before);
});
test('selecting another section updates only the workspace and keeps exact state, chat and approvals',()=>{
  const {scope,state,nodes}=controller();scope.renderSectionWorkspace('plan');const before=JSON.stringify(state);let html='',focus;
  nodes['plan-section-workspace']={set outerHTML(value){html=value;}};
  scope.document={querySelectorAll:()=>[]};nodes['plan-section-1']={focus(){focus='second';}};
  scope.selectWorkspaceSection('plan',1,'plan-section-1');
  assert.match(html,/Check the complete workflow and record improvements/);assert.doesNotMatch(html,/Choose a concrete visitor action/);assert.equal(focus,'second');assert.equal(JSON.stringify(state),before);
});
test('whole-plan review includes preface and every unit, while project changes reset private selection',()=>{
  const {scope,state}=controller();scope.renderSectionWorkspace('plan');scope.sectionViews.plan.all=true;
  const whole=scope.renderSectionWorkspace('plan');assert.match(whole,/retain the guide and supporting prompts/);assert.match(whole,/Choose a concrete visitor action/);assert.match(whole,/record improvements/);
  state.id='second';state.expandedOutline='## A Different Unit\n\n### Purpose\nKeep another project separate and easy to review.';
  const other=scope.renderSectionWorkspace('plan');assert.match(other,/A Different Unit/);assert.doesNotMatch(other,/Check The Result|supporting prompts/);assert.equal(scope.sectionViews.plan.all,false);
});
test('headings and bodies are escaped and invalid duplicate headings keep a complete readable fallback',()=>{
  const {scope,state}=controller();state.expandedOutline='## <img src=x onerror=alert(1)>\n\n### Purpose\nShow <script>alert(1)</script> as source text only.';
  const html=scope.renderSectionWorkspace('plan');assert.doesNotMatch(html,/<img|<script/);assert.match(html,/&lt;img/);
  state.expandedOutline=plan+'\n\n## Choose The Goal\n\n### Purpose\nDo not hide this duplicated section.';
  const invalid=scope.renderSectionWorkspace('plan');assert.match(invalid,/Do not hide this duplicated section/);assert.match(invalid,/Review the complete plan/);
});
test('product navigation reads one real source section and preserves access to the entire manuscript',()=>{
  const {scope,state}=controller();state.brief.productDraft+='\n\n## Check The Result\n\nA real second source unit with exact presenter notes.';
  const before=JSON.stringify(state),html=scope.renderSectionWorkspace('product');assert.match(html,/Keep this exact sample/);assert.doesNotMatch(html,/real second source unit/);assert.match(html,/Read full manuscript/);
  scope.sectionViews.product.all=true;assert.match(scope.renderSectionWorkspace('product'),/real second source unit/);assert.equal(JSON.stringify(state),before);
});
test('basic-only and empty plans do not fabricate completed content',()=>{
  const {scope,state}=controller();state.expandedOutline='';state.brief.productDraft='';
  const basic=scope.renderSectionWorkspace('plan');assert.match(basic,/Choose The Goal/);assert.match(basic,/expanded plan/i);assert.doesNotMatch(basic,/Draft exists/);
  scope.sectionViews.plan.all=true;const whole=scope.renderSectionWorkspace('plan').match(/<article class="section-inspector section-whole">([\s\S]*?)<\/article>/)[1];assert.match(whole,/Choose The Goal/);assert.match(whole,/Check The Result/);
  state.brief.outline='';assert.equal(scope.renderSectionWorkspace('plan'),'');
});

test('draft status accepts canonical H1 sections, excludes the cover and requires a real body',()=>{
  const {scope,state}=controller();state.brief.productDraft='# A useful product\n\nCover description.\n\n# Choose The Goal\n\nActual existing drafted content.\n\n# Check The Result';
  const before=JSON.stringify(state),data=scope.sectionWorkspaceData('plan');
  assert.equal(data.draft.length,2);assert.equal(data.draft[0].heading,'Choose The Goal');
  const html=scope.renderSectionWorkspace('plan');assert.match(html,/Draft exists/);assert.match(html,/Not drafted/);assert.equal(JSON.stringify(state),before);
  const product=scope.renderSectionWorkspace('product');assert.match(product,/Section 1 of 2/);assert.match(product,/Actual existing drafted content/);
});

test('plan title, count, approval status and whole-view control share one compact toolbar',()=>{
  const {scope}=controller(),html=scope.renderSectionWorkspace('plan');
  assert.match(html,/<div class="section-workspace-head">[\s\S]*<h1>Product plan<\/h1>[\s\S]*2 sections[\s\S]*Expanded plan awaiting approval[\s\S]*Read whole plan<\/button><\/div>/);
  assert.match(html,/About this plan/);assert.match(html,/data-section-picker="plan"/);
  vm.runInContext(app.slice(app.indexOf('function renderBrief('),app.indexOf('function renderSuggestions(')),scope);
  Object.assign(scope,{facts:[],currentDraftSection:()=>({text:''}),renderOutlineReview:()=>html,renderSuggestions:()=>'',working:false});
  const brief=scope.renderBrief();assert.equal((brief.match(/<h1>/g)||[]).length,1);assert.doesNotMatch(brief,/Choose a section to see its plan and drafting progress/);
});
test('a malformed expanded proposal keeps every source line available instead of showing empty sections',()=>{
  const {scope,state}=controller();state.expandedOutline='Retain this unstructured proposal, including every material role.';
  const html=scope.renderSectionWorkspace('plan');assert.match(html,/Retain this unstructured proposal/);assert.match(html,/section headings and usable detail/);
});
test('removing the selected heading falls back to an existing section without writing a project field',()=>{
  const {scope,state}=controller();scope.renderSectionWorkspace('plan');scope.sectionViews.plan.heading='Check The Result';
  state.expandedOutline=plan.slice(0,plan.indexOf('## Check The Result'));const before=JSON.stringify(state);
  const html=scope.renderSectionWorkspace('plan');assert.equal(scope.sectionViews.plan.heading,'Choose The Goal');assert.match(html,/Choose a concrete visitor action/);assert.equal(JSON.stringify(state),before);
});
test('explicit whole-plan workspace review preserves the chat scroll and does not approve source',()=>{
  const {scope,state,nodes}=controller();nodes.messages={scrollTop:160};let renders=0;
  Object.assign(scope,{view:'draft',render(){renders++;nodes.messages.scrollTop=999;},document:{querySelector:()=>null}});
  vm.runInContext(app.slice(app.indexOf('function showWorkspace('),app.indexOf('async function runCurrentAction(')),scope);
  const before=JSON.stringify(state);scope.showWorkspace('brief',true);
  assert.equal(nodes.messages.scrollTop,160);assert.equal(renders,1);assert.equal(scope.sectionViews.plan.all,true);assert.equal(scope.view,'brief');assert.equal(JSON.stringify(state),before);
});
test('the displayed phase returns to plan review for a pending plan without changing the stored stage',()=>{
  const {scope,state}=controller();let html='';scope.document={querySelector:()=>({set innerHTML(value){html=value;}})};scope.localFilesReady=()=>false;
  vm.runInContext(app.slice(app.indexOf('function renderProgress('),app.indexOf('function renderChat(')),scope);
  scope.renderProgress();assert.match(html,/Phase 2 of 4/);assert.equal(state.interviewStage,10);
  state.approvedExpandedOutline=state.expandedOutline;scope.renderProgress();assert.match(html,/Phase 3 of 4/);assert.equal(state.interviewStage,10);
});
