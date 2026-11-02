import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProject} from '../src/product.js';
import {interview} from '../src/interview.js';
import {expandedOutlineSections,expandedOutlineValid,outlineApprovalCurrent,expandedOutlineApprovalCurrent,expandedOutlineCovered,manuscriptHeadings} from '../public/outline-plan.js';

const first='## Choose the action\n\nChoose the next concrete reader action before adding extra features.';
const second='\n\n## Test the action\n\nComplete the same action once and record what still blocks it.';
const brief=()=>({...freshProject().brief,title:'A useful action',topic:'Useful reader actions',format:'Guide',outline:'Choose the action\nTest the action',productDraft:first});
const request=(extra={})=>({interviewStage:10,brief:brief(),approvedDraft:first,currentInput:'Write the next section.',messages:[{role:'user',content:'Write the next section.'}],...extra});
const reply=(b,extra={})=>({message:'Here is the next section.',stageReady:true,summary:'For review.',brief:b,...extra});
const planFor=headings=>headings.map(heading=>'## '+heading+'\n\n### Purpose\n\nHelp the reader apply this unit to the current practical action.\n\n### Key points\n\n- Explain the decision and demonstrate its result.\n\n### Example and exercise\n\nUse a clearly illustrative example, then complete and check the reader’s own action.').join('\n\n');
const plan=planFor(['Choose the action','Test the action']);
const approved=(extra={})=>request({approvedOutline:brief().outline,expandedOutline:plan,approvedExpandedOutline:plan,...extra});

test('future content is held until a human has approved a full expanded outline, preserving existing manuscript',async()=>{
  const input=request(),result=await interview(input,{infer:async()=>reply({...input.brief,productDraft:first+second})});
  assert.equal(result.brief.productDraft,first);assert.equal(result.stageReady,false);assert.match(result.message,/expanded outline/i);
});

test('expanded-outline parsing ignores fenced headings and requires unique units with usable subordinate detail',()=>{
  const source=planFor(['Choose the action'])+'\n\n```markdown\n## Not a unit\n### Not detail\n```\n\n'+planFor(['Test the action']);assert.deepEqual(expandedOutlineSections(source).map(section=>section.heading),['Choose the action','Test the action']);assert.match(expandedOutlineSections(source)[0].body,/### Purpose/);assert.equal(expandedOutlineValid(source),true);
  for(const invalid of ['', '## Bare heading', '## Bare heading\n\n### Purpose',planFor(['Duplicate','Duplicate']),'```md\n'+plan+'\n```'])assert.equal(expandedOutlineValid(invalid),false);
  assert.equal(outlineApprovalCurrent({brief:{outline:''},approvedOutline:''}),false);assert.equal(outlineApprovalCurrent(approved()),true);assert.equal(expandedOutlineApprovalCurrent(approved()),true);assert.equal(expandedOutlineApprovalCurrent(approved({expandedOutline:plan+'\nNew detail.'})),false);assert.equal(expandedOutlineApprovalCurrent(approved({brief:{...brief(),outline:'Changed basic outline'}})),false);
});

test('legacy expansion waits for explicit basic approval without inference, manufactured approvals or source reset',async()=>{
  let calls=0;const input=request({mode:'expand-outline'}),result=await interview(input,{infer:async()=>{calls++;throw Error('No approval yet');}});assert.equal(calls,0);assert.deepEqual(result.brief,input.brief);assert.equal(result.approvedOutline,'');assert.equal(result.approvedExpandedOutline,'');assert.equal(result.expandedOutline,'');assert.equal(result.stageReady,false);assert.match(result.message,/basic outline/i);
});

test('dedicated expansion preserves all source and returns a whole-product proposal without AI approval or stage advance',async()=>{
  const input=request({mode:'expand-outline',currentInput:'',approvedOutline:brief().outline,model:'gpt-6.1-sol',reasoningEffort:'high'});let calls=0;
  const result=await interview(input,{infer:async(provider,prompt,schema,options)=>{calls++;assert.equal(provider,'chatgpt');assert.equal(options.model,'gpt-6.1-sol');assert.equal(options.reasoningEffort,'high');assert.match(prompt,/ENTIRE product outline/);assert.match(prompt,/EVERY item/);assert.match(prompt,/Choose the action/);assert.ok(schema.required.includes('expandedOutline'));return reply({...input.brief,productDraft:'AI source rewrite',outline:'AI outline rewrite'},{expandedOutline:plan,approvedOutline:'AI approved',approvedExpandedOutline:plan});}});
  assert.equal(calls,1);assert.deepEqual(result.brief,input.brief);assert.equal(result.expandedOutline,plan);assert.equal(result.approvedOutline,input.approvedOutline);assert.equal(result.approvedExpandedOutline,'');assert.equal(result.stageReady,false);assert.match(result.message,/review.*expanded outline/i);assert.equal(expandedOutlineApprovalCurrent(result),false);
});

test('dedicated plan chat refines the proposal and answers concerns while preserving all human approvals and source',async()=>{
  const input=request({mode:'expand-outline',currentInput:'Please add a final reader check to the expanded plan.',approvedOutline:brief().outline,expandedOutline:plan}),revised=planFor(['Choose the action','Test the action','Check the result']);let received;
  const result=await interview(input,{infer:async(_id,prompt)=>{received=prompt;return reply(input.brief,{expandedOutline:revised});}});assert.match(received,/Please add a final reader check/);assert.equal(result.expandedOutline,revised);assert.equal(result.approvedExpandedOutline,'');assert.deepEqual(result.brief,input.brief);assert.equal(result.stageReady,false);
  const concerned=await interview({...input,currentInput:'Why does this need another exercise?'},{infer:async()=>reply({...input.brief,productDraft:'Unauthorized change'},{replyKind:'discussion',message:'The exercise lets the reader check the concrete action; we can keep it brief.',expandedOutline:revised})});assert.equal(concerned.expandedOutline,plan);assert.deepEqual(concerned.brief,input.brief);assert.match(concerned.message,/exercise lets the reader/);assert.equal(concerned.approvedExpandedOutline,'');assert.equal(concerned.stageReady,false);
});

test('typed basic or format reconsideration during plan chat proposes only those decisions and holds the old expanded plan',async()=>{
  const input=request({mode:'expand-outline',currentInput:'Please reconsider the format and basic outline.',approvedOutline:brief().outline,expandedOutline:plan}),proposal={...input.brief,outline:'Choose the action\nPractice the task',format:'Workbook',topic:'Unrelated model invention',productDraft:'Unauthorized rewrite'};
  const result=await interview(input,{infer:async()=>reply(proposal,{expandedOutline:planFor(['An unrelated new unit']),approvedOutline:proposal.outline,approvedExpandedOutline:plan})});assert.equal(result.brief.outline,proposal.outline);assert.equal(result.brief.format,'Workbook');assert.equal(result.brief.topic,input.brief.topic);assert.equal(result.brief.productDraft,input.brief.productDraft);assert.equal(result.expandedOutline,plan);assert.equal(result.approvedOutline,input.approvedOutline);assert.equal(result.approvedExpandedOutline,'');assert.equal(result.stageReady,false);assert.match(result.message,/review and approve.*before regenerating/i);
  const button=await interview({...input,currentInput:''},{infer:async()=>reply(proposal,{expandedOutline:plan})});assert.deepEqual(button.brief,input.brief,'a plain generation action cannot change basic decisions');
});

test('initial stage8 expansion and legacy presentation expansion preserve source and explicit agreed material roles',async()=>{
  const draft=first+'\n\n### Presenter notes\n\nKeep original ALPHA demonstration wording.'+second+'\n\n### Presenter notes\n\nKeep original BRAVO wording exactly.',b={...brief(),format:'Webinar presentation with presenter notes',offer:'A presentation, build guide, prompts and test checklist',productDraft:draft};
  for(const [interviewStage,current]of [[8,{...b,productDraft:''}],[10,b]]){
    const input=request({mode:'expand-outline',interviewStage,brief:current,approvedOutline:current.outline}),result=await interview(input,{infer:async(_id,prompt)=>{assert.match(prompt,/AGREED MATERIAL ROLES/);assert.match(prompt,/build guide, prompts, test checklist/);assert.match(prompt,/distinct from visible audience slide copy/);assert.match(prompt,/no fourteen-word ceiling/);return reply({...current,productDraft:'An unauthorized model rewrite.'},{expandedOutline:planFor(['Choose the action','Test the action','Review the result'])});}});assert.deepEqual(result.brief,current);assert.equal(result.stageReady,false);assert.equal(result.approvedExpandedOutline,'');assert.equal(expandedOutlineSections(result.expandedOutline).length,3);
  }
});

test('an expanded proposal cannot omit, rename or move already-drafted headings or return bare units',async()=>{
  const input=request({mode:'expand-outline',approvedOutline:brief().outline,expandedOutline:plan});
  for(const candidate of [planFor(['Test the action']),planFor(['Choose another action','Test the action']),planFor(['New introduction','Choose the action','Test the action']),'## Choose the action\n\n## Test the action']){const result=await interview(input,{infer:async()=>reply(input.brief,{expandedOutline:candidate})});assert.deepEqual(result.brief,input.brief);assert.equal(result.expandedOutline,plan);assert.equal(result.approvedExpandedOutline,'');assert.equal(result.stageReady,false);assert.match(result.message,/heading|detail|unit/i);}
});

test('pending approvals preserve normal concern answers and never accept model-written approval fields',async()=>{
  const input=request({currentInput:'I am unsure whether this plan is useful.',messages:[{role:'user',content:'I am unsure whether this plan is useful.'}]});const result=await interview(input,{infer:async()=>reply({...input.brief,productDraft:first+second},{replyKind:'discussion',message:'We can test its usefulness with one concrete reader action before expanding.',approvedOutline:input.brief.outline,expandedOutline:plan,approvedExpandedOutline:plan})});assert.equal(result.brief.productDraft,first);assert.match(result.message,/test its usefulness/);assert.equal(result.approvedOutline,'');assert.equal(result.expandedOutline,'');assert.equal(result.approvedExpandedOutline,'');assert.equal(result.stageReady,false);
});

test('stale basic approval, edited expanded plans and same-turn format or outline changes hold all future drafting',async()=>{
  for(const extra of [{approvedOutline:''},{approvedOutline:'An earlier basic outline'},{expandedOutline:plan+'\nProposed extra detail.'},{approvedExpandedOutline:''}]){const input=approved(extra),result=await interview(input,{infer:async()=>reply({...input.brief,productDraft:first+second})});assert.equal(result.brief.productDraft,first);assert.equal(result.stageReady,false);assert.match(result.message,/outline/i);}
  for(const change of [{outline:'A newly proposed basic outline'},{format:'Webinar'}]){const input=approved(),result=await interview(input,{infer:async()=>reply({...input.brief,...change,productDraft:first+second})});assert.equal(result.brief.productDraft,first);assert.equal(result.stageReady,false);assert.match(result.message,/outline|format/i);assert.equal(result.approvedExpandedOutline,plan,'human snapshots are echoed, not silently rewritten');}
});

test('the expanded approval gate protects both initial samples and explicit revisions even when the model is unready',async()=>{
  for(const input of [request({interviewStage:9,brief:{...brief(),productDraft:''},approvedDraft:''}),request({interviewStage:11,revisionIntent:true})]){const proposed=input.brief.productDraft?first.replace('Choose the next concrete','Rewrite the next concrete'):first,result=await interview(input,{infer:async()=>reply({...input.brief,productDraft:proposed},{stageReady:false})});assert.equal(result.brief.productDraft,input.brief.productDraft);assert.equal(result.stageReady,false);assert.match(result.message,/outline/);}
});

test('approved expanded headings permit only the next planned unit, even when revision is requested',async()=>{
  const input=approved(),result=await interview(input,{infer:async()=>reply({...input.brief,productDraft:first+second})});assert.equal(result.brief.productDraft,first+second);
  for(const [tail,revisionIntent]of [['\n\n## Unplanned unit\n\nAn unplanned action.',false],['\n\n## Later unit\n\nSkip the next planned unit.',true],['\n\n## Test the action\n\nA test.\n\n## Later unit\n\nAnother unit in the same turn.',true]]){const longPlan=planFor(['Choose the action','Test the action','Later unit']),data=approved({expandedOutline:longPlan,approvedExpandedOutline:longPlan,revisionIntent}),held=await interview(data,{infer:async()=>reply({...data.brief,productDraft:first+tail})});assert.equal(held.brief.productDraft,first);assert.equal(held.stageReady,false);assert.match(held.message,/expanded-outline|next undrafted|one section|order/i);}
});

test('stage10 completion uses exact expanded headings rather than basic lines or body mentions',async()=>{
  const fullPlan=planFor(['Choose the action','Test the action','Record the outcome']),partial=first+second+'\n\nThe phrase Record the outcome is mentioned here; it is not a drafted unit.',data=approved({expandedOutline:fullPlan,approvedExpandedOutline:fullPlan,brief:{...brief(),productDraft:partial},approvedDraft:partial});const held=await interview(data,{infer:async()=>reply(data.brief)});assert.equal(held.stageReady,false);
  const complete=partial+'\n\n## Record the outcome\n\nKeep the confirmed result beside the action.',done=approved({...data,brief:{...brief(),productDraft:complete},approvedDraft:complete}),ready=await interview(done,{infer:async()=>reply(done.brief)});assert.equal(ready.stageReady,true);
});

test('legacy review and packaging remain unready until every approved expanded unit is drafted in order',async()=>{
  const b={...brief(),buyer:'First-time creators',outcome:'Complete a useful reader action',method:'Choose one concrete reader action and test it'};
  for(const interviewStage of [10,11,12]){
    const partial=approved({interviewStage,brief:b,approvedDraft:first}),held=await interview(partial,{infer:async()=>reply(partial.brief,{message:'The product is ready for the next step.'})});assert.equal(held.stageReady,false,`stage${interviewStage} cannot finish only one of two planned units`);assert.equal(held.brief.productDraft,first);assert.match(held.message,/expanded outline|expanded-plan|planned unit/i);
    const complete=approved({interviewStage,brief:{...b,productDraft:first+second},approvedDraft:first+second}),ready=await interview(complete,{infer:async()=>reply(complete.brief)});assert.equal(ready.stageReady,true,`stage${interviewStage} may complete its covered plan`);assert.equal(ready.brief.productDraft,first+second);
    const discussed=await interview(partial,{infer:async()=>reply(partial.brief,{replyKind:'discussion',message:'We can keep the explanation brief and work through the remaining action together.'})});assert.equal(discussed.stageReady,false);assert.equal(discussed.message,'We can keep the explanation brief and work through the remaining action together.');assert.equal(discussed.brief.productDraft,first);
  }
});

test('shared completion coverage uses exact canonical headings, cover-title and fence semantics',()=>{
  const base=approved(),covered={...base,brief:{...base.brief,productDraft:'# A useful action\n\n'+first+'\n\n```md\n## Not a real unit\n```'+second.replace('## Test','# Test')}};assert.deepEqual(manuscriptHeadings(covered.brief),['Choose the action','Test the action']);assert.equal(expandedOutlineCovered(covered),true);
  for(const productDraft of [first,first+'\n\nMention Test the action only in prose.',second+'\n\n'+first,first+second.replace('Test the action','test the action'),first+second+'\n\n## Extra unit\n\nAn unplanned section.'])assert.equal(expandedOutlineCovered({...covered,brief:{...covered.brief,productDraft}}),false);
  assert.equal(expandedOutlineCovered({...covered,approvedExpandedOutline:''}),false);assert.equal(expandedOutlineCovered({...covered,approvedOutline:'Stale basic outline'}),false);
});
