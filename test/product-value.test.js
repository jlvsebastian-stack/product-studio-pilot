import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {interview,interviewPrompt} from '../src/interview.js';
import {freshProject} from '../src/product.js';

const titles=['Plan The Handover','Use The Handover Kit'];
const plan=titles.map(title=>'## '+title+'\n\n### Purpose\nGive a new shift lead a usable handover and show what changes when a colleague is absent.\n\n### Buyer Output\nA filled handover, reusable blank and a missed-update message.').join('\n\n');
const sample='## Plan The Handover\n\nUse the handover to record the next action, agreed owner and deadline.\n\n| Action | Owner | Due |\n| --- | --- | --- |\n| Confirm stock count | Check with the shift lead | Before handover |';
const brief=()=>({...freshProject().brief,title:'The First Shift Handover Kit',topic:'Shift handovers',buyer:'New shift leads',outcome:'Hand over an unfinished task without losing its owner or next step',offer:'A reusable handover sheet and follow-up messages',format:'Template kit',outline:titles.join('\n')});
const request=(extra={})=>({interviewStage:6,provider:'chatgpt',model:'gpt-6.1-sol',reasoningEffort:'medium',messages:[{role:'user',content:'I help new shift leads record unfinished tasks at handover.'}],brief:brief(),...extra});
const reply=(data,extra={})=>({replyKind:'progress',message:'A handover sheet and follow-up messages would give new shift leads something they can use immediately.',stageReady:true,summary:'Proposed handover kit.',brief:{...data.brief},suggestions:[],preferenceUpdates:[],companions:[],manuscriptEdit:null,...extra});
const question='To make the handover template useful beyond general advice, can you share one real example of what you change when a colleague misses an update?';

test('one relevant creator-judgment question survives the offer controller without becoming an approval gate',async()=>{
  const data=request(),original=structuredClone(data);let calls=0;
  const result=await interview(data,{infer:async()=>{calls++;return reply(data,{message:question});}});
  assert.equal(calls,1);assert.equal(result.stageReady,true);
  assert.equal(result.message,question);assert.equal((result.message.match(/\?/g)||[]).length,1);
  assert.deepEqual(result.brief,data.brief);assert.deepEqual(data,original);
});

test('a previously asked real-case question is not repeated and unknown expertise never blocks the offer',async()=>{
  for(const currentInput of ['I cannot remember an example. Please use a labeled suggestion.','Move on with a proposed example.']){
    const data=request({currentInput,messages:[{role:'user',content:'I help new shift leads with handovers.'},{role:'assistant',content:question},{role:'user',content:currentInput}]});
    const result=await interview(data,{infer:async()=>reply(data,{message:question})});
    assert.equal(result.stageReady,true);assert.doesNotMatch(result.message,/\?/);assert.equal(result.brief.method,'');assert.equal(result.brief.example,'');assert.equal(result.brief.productDraft,'');
  }
});

test('known creator judgment is reused rather than asked for again',async()=>{
  const data=request();data.brief.method='I ask who owns the next action before the shift ends.';data.brief.example='I separate a missed update from a completed task.';
  const result=await interview(data,{infer:async()=>reply(data,{message:question})});
  assert.equal(result.stageReady,true);assert.doesNotMatch(result.message,/\?/);assert.equal(result.brief.method,data.brief.method);assert.equal(result.brief.example,data.brief.example);
});

test('the same compact value skill reaches ordinary, dedicated planning and full-draft inference',()=>{
  const valueSkill=readFileSync(new URL('../skills/product-value/SKILL.md',import.meta.url),'utf8');
  for(const mode of ['interview','expand-outline','full-draft']){
    const data=request({mode,interviewStage:mode==='interview'?6:10,expandedOutline:plan,approvedExpandedOutline:plan,approvedOutline:titles.join('\n')});
    if(mode==='full-draft'){data.brief.productDraft=sample;data.approvedDraft=sample;}
    const {prompt}=interviewPrompt(data);
    assert.ok(prompt.includes(valueSkill),mode+' must load the actual shared skill, not only mention its name');
    const context=JSON.parse(prompt.slice(prompt.lastIndexOf('\n')+1));
    assert.equal(context.brief.buyer,data.brief.buyer);assert.equal(context.brief.offer,data.brief.offer);
    assert.equal(context.approvalState?.basic??(context.approvedOutline===data.approvedOutline),true);
    if(mode==='expand-outline')assert.ok(prompt.length<35000,'value planning must remain bounded');
  }
});

test('representative sample review tests buyer usability without changing source or human approvals',async()=>{
  const data=request({interviewStage:9,currentInput:'Create the first representative sample.',expandedOutline:plan,approvedExpandedOutline:plan,approvedOutline:titles.join('\n'),approvedDraft:''});
  const result=await interview(data,{infer:async()=>reply(data,{brief:{...data.brief,productDraft:null},message:'Here is your handover sample.',manuscriptEdit:{replacements:[],append:sample}})});
  assert.equal(result.brief.productDraft,sample);assert.equal(result.approvedExpandedOutline,plan);assert.equal(result.approvedDraft,undefined);
  assert.match(result.message,/try.*sample|use.*sample/i);assert.match(result.message,/buyer|reader/i);assert.match(result.message,/difficult|goes wrong|stuck/i);
});

test('full draft stays one complete provisional product and invites a buyer-task check',async()=>{
  const data=request({mode:'full-draft',interviewStage:10,expandedOutline:plan,approvedExpandedOutline:plan,approvedOutline:titles.join('\n'),approvedDraft:sample});data.brief.productDraft=sample;
  const draft=sample+'\n\n## Use The Handover Kit\n\nCopy the message and replace the task, owner and deadline with the agreed details. If the owner has not replied, record that status instead of assuming completion.';
  let calls=0;const result=await interview(data,{infer:async()=>{calls++;return reply(data,{brief:{...data.brief,productDraft:draft}});}});
  assert.equal(calls,1);assert.equal(result.brief.productDraft,draft);assert.equal(result.stageReady,false);assert.match(result.message,/whole.product review/i);assert.match(result.message,/buyer|reader/i);assert.match(result.message,/task|use/i);assert.equal(result.approvedExpandedOutline,plan);
});
