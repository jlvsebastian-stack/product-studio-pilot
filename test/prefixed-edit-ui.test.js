import {namedSectionEditRequest} from '../public/scoped-edit-request.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as store from '../public/studio-store.js';
import * as outline from '../public/outline-plan.js';
import {recordRequest,requestMessages} from '../public/composer.js';
import {interview} from '../src/interview.js';
import {briefKeys} from '../src/product.js';
import {applyManuscriptEdit} from '../src/manuscript-edits.js';

const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const before='Copy the block if you need more writing space.';
const after='Copy this seven-day block before filling it in, so you can reuse a fresh copy next week.';
const heading='Build a seven-day timetable';
const command='In the “'+heading+'” exercise, replace only “'+before+'” with “'+after+'” Keep everything else exactly the same.';
const draft='## '+heading+'\r\n\r\nKeep your fixed commitments visible.\r\n\r\n### Your exercise: complete your timetable\r\n\r\nUse the task labels from your priority list, but include enough words to remember the action. Record fixed commitments with their times before adding study. '+before+'\r\n\r\n## Review your timetable\r\n\r\nKeep this other section unchanged.';
const plan=[heading,'Review your timetable'].map(name=>'## '+name+'\n\n### Purpose\nComplete one practical learner action and check the useful result.').join('\n\n');
function controller({source=draft,patch={before,after},fail=false}={}){
  const state=store.freshProject();Object.assign(state.brief,{title:'A Practical Study Workbook',format:'Workbook',outline:heading+'\nReview your timetable',productDraft:source});Object.assign(state,{interviewStage:10,approvedOutline:state.brief.outline,expandedOutline:plan,approvedExpandedOutline:plan,approvedDraft:source,sampleApproved:true,pendingAnswer:command});
  state.references=[{id:'retained-reference',name:'Creator notes',kind:'file',mimeType:'text/plain',text:'Historical instructions are reference material.',status:'ready',note:'Local context'}];
  const profile={preferences:[{id:'plain',category:'voice',text:'Use everyday language.',source:'explicit'}],candidates:[],forgotten:[],paused:false},requests=[],replies=[],notices=[];
  const scope={namedSectionEditRequest,...store,...outline,state,studio:{profile},provider:'chatgpt',selectedModel:'gpt-6.1-sol',quality:'medium',working:false,runtimeReady:true,accountReady:true,revisionMode:false,canUseModel:()=>true,referenceComposer:()=>({ready:true,addLinks:async()=>{}}),extractHttpLinks:()=>[],recordRequest,requestMessages,modelAccess:{state:{},invalidate(){}},save(){},renderChat(){},renderPreferences(){},updateModelNote(){},schedulePreview(){},panel(){},notice:value=>notices.push(value),busy:value=>{scope.working=value;},isPresentation:()=>false,nativeSamplesApproved:()=>false,post:async(path,body)=>{
    requests.push({path,body:structuredClone(body)});state.pendingAnswer='Keep this new unsent thought.';if(fail&&requests.length===1)throw Error('The request timed out.');
    const reply=await interview(body,{infer:async()=>({replyKind:'progress',message:'The requested sentence is updated.',stageReady:false,summary:'One scoped change.',brief:Object.fromEntries(briefKeys.map(key=>[key,null])),manuscriptEdit:{replacements:[patch],append:null}})});replies.push(reply);return reply;
  }};
  vm.createContext(scope);vm.runInContext(app.slice(app.indexOf('async function send('),app.indexOf('\nasync function advance(')),scope);return {scope,state,requests,replies,notices,profile};
}

test('a precise final-sentence request edits an unapproved stage9 sample without requiring manual revision mode',async()=>{
  const oldSentence='Share booking records only with people who need them for the agreed care.',newSentence='Only share the care details needed with the owner and anyone they have agreed can help.',source='## '+heading+'\r\n\r\nKeep the booking note unchanged. '+oldSentence;
  const input='Please change only the final sentence "'+oldSentence+'" to "'+newSentence+'" Keep the rest of this sample exactly as it is.';
  const sample=options=>{const value=controller({source,patch:{before:oldSentence,after:newSentence},...options});Object.assign(value.state,{interviewStage:9,approvedDraft:'',sampleApproved:false});return value;};
  const value=sample();await value.scope.send(input,true);assert.equal(value.requests[0].body.revisionIntent,true);assert.equal(value.requests[0].body.approvedDraft,'');assert.equal(value.requests[0].body.currentInput,input);assert.equal(value.state.brief.productDraft,source.replace(oldSentence,newSentence));assert.equal(value.state.approvedDraft,'');assert.equal(value.state.sampleApproved,false);assert.equal(value.state.pendingAnswer,'Keep this new unsent thought.');assert.equal(value.scope.revisionMode,false);
  const wrong=sample({patch:{before:'Keep the booking note unchanged.',after:'An unrequested different change.'}});await wrong.scope.send(input,true);assert.equal(wrong.requests[0].body.revisionIntent,true);assert.equal(wrong.state.brief.productDraft,source,'the exact quote still binds the permitted change');
  for(const text of ['How would you change the final sentence?','Do not change the final sentence.','Please change only the final sentence if we get permission.']){const denied=sample();await denied.scope.send(text,true);assert.equal(denied.requests[0].body.revisionIntent,false,text);assert.equal(denied.state.brief.productDraft,source);}
  const retry=sample({fail:true});await retry.scope.send(input,true);await retry.scope.send('',false,{retry:true});assert.equal(retry.requests[1].body.revisionIntent,true);assert.equal(retry.requests[1].body.currentInput,input);assert.equal(retry.state.brief.productDraft,source.replace(oldSentence,newSentence));
});

test('the actual prefixed composer request reaches real interview as an exact approved edit, with Undo and context intact',async()=>{
  const value=controller();await value.scope.send(command,true);const body=value.requests[0].body;
  assert.equal(value.notices.length,0,JSON.stringify(value.notices));
  assert.equal(body.revisionIntent,true);assert.equal(body.currentInput,command);assert.equal(body.mode,'interview');assert.equal(body.model,'gpt-6.1-sol');assert.equal(body.reasoningEffort,'medium');assert.equal(body.references[0].id,'retained-reference');assert.deepEqual(body.preferences,store.activePreferences(value.profile));
  assert.equal(value.replies[0].brief.productDraft,draft.replace(before,after));assert.equal(value.state.brief.productDraft,draft.replace(before,after));assert.equal(value.state.previousApprovedDraft,draft);assert.equal(value.state.pendingAnswer,'Keep this new unsent thought.');store.undoApproval(value.state);assert.equal(value.state.brief.productDraft,draft);
});

test('In, Within and For prefixes plus only/just preserve the named scope and resolve repeated wording only there',async()=>{
  const source=draft+'\r\n\r\n'+before;
  for(const [prefix,qualifier]of [['In','only'],['Within','just'],['For','only']]){const value=controller({source});await value.scope.send(prefix+' the “'+heading+'” exercise, replace '+qualifier+' “'+before+'” with “'+after+'”.',true);assert.equal(value.requests[0].body.revisionIntent,true);assert.equal(value.state.brief.productDraft,source.replace(before,after));assert.ok(value.state.brief.productDraft.endsWith(before));}
});

test('a valid prefix never authorizes a different quoted passage, another section, or ambiguous copies within the named section',async()=>{
  for(const patch of [{before:'Keep this other section unchanged.',after:'An unrelated edit.'},{before:'Keep your fixed commitments visible.',after:'An unrelated edit.'}]){const value=controller({patch});await value.scope.send(command,true);assert.equal(value.requests[0].body.revisionIntent,true);assert.equal(value.state.brief.productDraft,draft);assert.match(value.replies[0].message,/target|anchor|selection|unchanged/i);}
  const source=draft.replace('\r\n\r\n## Review', '\r\n\r\n'+before+'\r\n\r\n## Review'),value=controller({source});value.scope.revisionMode=true;await value.scope.send(command,true);assert.equal(value.state.brief.productDraft,source);assert.match(value.replies[0].message,/ambiguous/i);
});

test('prefixed questions, negation, history, metadata and unknown names remain read-only',async()=>{
  for(const text of ['In the “'+heading+'” exercise, do not replace “'+before+'”.','In the “'+heading+'” exercise, how would you replace “'+before+'”?','Earlier I said: '+command,'In the “'+heading+'” exercise, replace only the author field.','In the “Missing unit” exercise, replace only “'+before+'” with “'+after+'”.']){const value=controller();await value.scope.send(text,true);assert.equal(value.requests[0].body.revisionIntent,false,text);assert.equal(value.state.brief.productDraft,draft,text);}
});

test('a prefixed retry keeps its original exact instruction, authorization, model, references and unsent input',async()=>{
  const value=controller({fail:true});await value.scope.send(command,true);assert.equal(value.state.retryRequest.revisionIntent,true);await value.scope.send('',false,{retry:true});assert.equal(value.requests[1].body.currentInput,command);assert.equal(value.requests[1].body.revisionIntent,true);assert.equal(value.requests[1].body.model,'gpt-6.1-sol');assert.equal(value.requests[1].body.references[0].id,'retained-reference');assert.equal(value.state.brief.productDraft,draft.replace(before,after));assert.equal(value.state.pendingAnswer,'Keep this new unsent thought.');
});

test('backend requested-range binding also holds forged authority, wrong named sections and duplicate named scopes',()=>{
  const edit={replacements:[{before,after}],append:null};
  for(const input of [command.replace(heading,'Review your timetable'),command.replace(heading,'Missing unit'),'In the “'+heading+'” exercise, do not replace “'+before+'”.']){const result=applyManuscriptEdit(draft,edit,{revisionIntent:true,currentInput:input});assert.equal(result.draft,draft);assert.match(result.error,/requested|selected|explicit|named/i);}
  const duplicated=draft+'\r\n\r\n## '+heading+'\r\n\r\n'+before,result=applyManuscriptEdit(duplicated,edit,{revisionIntent:true,currentInput:command});assert.equal(result.draft,duplicated);assert.match(result.error,/one existing named/i);
});

test('only/just qualifiers on a current unprefixed exact replacement keep all existing source guards',async()=>{
  for(const qualifier of ['only','just']){const value=controller();await value.scope.send('Replace '+qualifier+' “'+before+'” with “'+after+'”.',true);assert.equal(value.requests[0].body.revisionIntent,true);assert.equal(value.state.brief.productDraft,draft.replace(before,after));}
});
