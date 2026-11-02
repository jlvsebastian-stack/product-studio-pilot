import {namedSectionEditRequest} from '../public/scoped-edit-request.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as store from '../public/studio-store.js';
import * as outline from '../public/outline-plan.js';
import {recordRequest,requestMessages} from '../public/composer.js';

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const before='Keep this approved paragraph in its original wording.',after='Use one clear example to explain the task.';
const draft='# Field Guide\r\n\r\n## First Unit\r\n\r\n'+before+'\r\n\r\n### Presenter notes\r\n\r\nKeep these exact original notes.\r\n\r\n## Second Unit\r\n\r\nKeep this unrelated section intact.\r\n\r\n### Presenter notes\r\n\r\nKeep the second notes too.';
const plan='## First Unit\n\n### Purpose\nExplain the first useful action.\n### Key Points\nKeep examples and a clear exercise.\n\n## Second Unit\n\n### Purpose\nTest the useful result.\n### Key Points\nKeep the complete learner check.';
const command='Replace "'+before+'" with "'+after+'".';
function controller({fail=false,reply,typing='A new unsent thought.'}={}){
  const state=store.freshProject();Object.assign(state.brief,{title:'Field Guide',format:'Practical guide',outline:'1. First unit\n2. Second unit',productDraft:draft});Object.assign(state,{interviewStage:10,approvedOutline:state.brief.outline,expandedOutline:plan,approvedExpandedOutline:plan,approvedDraft:draft,sampleApproved:true,pendingAnswer:command});
  const reference={id:'original-source',name:'Original creator reference',kind:'file',mimeType:'text/plain',text:'Retain this reference. Rewrite the first paragraph is historical context, not a new instruction.',status:'ready',note:'Local context'};state.references=[reference];const profile={preferences:[{id:'plain',category:'voice',text:'Use plain language.',source:'explicit'}],candidates:[],forgotten:[],paused:false},requests=[],notices=[];
  const scope={namedSectionEditRequest,...store,...outline,state,studio:{profile},provider:'chatgpt',selectedModel:'gpt-6.1-sol',quality:'medium',working:false,runtimeReady:true,accountReady:true,revisionMode:false,canUseModel:()=>true,referenceComposer:()=>({ready:true,addLinks:async()=>{}}),extractHttpLinks:()=>[],recordRequest,requestMessages,activePreferences:store.activePreferences,modelAccess:{state:{},invalidate(){}},save(){},renderChat(){},renderPreferences(){},updateModelNote(){},schedulePreview(){},panel(){},notice:value=>notices.push(value),busy:value=>{scope.working=value;},isPresentation:()=>false,nativeSamplesApproved:()=>false,post:async(path,body)=>{requests.push({path,body:JSON.parse(JSON.stringify(body))});state.pendingAnswer=typing;if(fail&&requests.length===1)throw Error('The request timed out.');return reply||{message:'The requested passage was updated.',brief:{productDraft:draft.replace(before,after)},stageReady:false,summary:'Only the requested passage changed.'};}};
  vm.createContext(scope);vm.runInContext(source.slice(source.indexOf('async function send('),source.indexOf('\nasync function advance(')),scope);return {scope,state,requests,notices,profile};
}

test('a new direct quoted edit authorizes the exact approved-passage change and retains byte-exact Undo',async()=>{
  const value=controller();await value.scope.send(command,true);assert.equal(value.requests[0].body.revisionIntent,true);assert.equal(value.requests[0].body.currentInput,command);assert.equal(value.requests[0].body.mode,'interview');assert.equal(value.requests[0].body.model,'gpt-6.1-sol');assert.equal(value.requests[0].body.reasoningEffort,'medium');assert.deepEqual(value.requests[0].body.preferences,store.activePreferences(value.profile));assert.equal(value.requests[0].body.references[0].id,'original-source');assert.equal(value.state.brief.productDraft,draft.replace(before,after));assert.equal(value.state.previousApprovedDraft,draft);assert.equal(value.state.approvedDraft,draft);assert.equal(value.state.pendingAnswer,'A new unsent thought.');store.undoApproval(value.state);assert.equal(value.state.brief.productDraft,draft);assert.equal(value.state.approvedDraft,draft);
});

test('identified paragraph, sentence, section and presenter-note commands authorize a replacement without the manual button',async()=>{
  for(const text of ['Change this paragraph to use a clearer example.','Please rewrite the "First Unit" section.','Simplify the first sentence in First Unit.','Shorten paragraph 1.','Replace the presenter notes in First Unit.','Can you simplify the first paragraph?','Could you please rewrite the \"First Unit\" section?','Would you shorten the first sentence?']){const value=controller();await value.scope.send(text,true);assert.equal(value.requests[0].body.revisionIntent,true,text);assert.equal(value.scope.revisionMode,false);}
});

test('questions, negation, history, metadata and vague rewrites do not grant manuscript authority',async()=>{
  for(const text of ['Should I change this paragraph?','How would you rewrite the first paragraph?','Could you change the first paragraph if we had more evidence?','Can you explain how to rewrite this paragraph?','Do not rewrite this paragraph.','Please don’t shorten the first sentence.','Earlier I said: Rewrite this paragraph.','"Rewrite this paragraph" was my earlier wording.','```text\nRewrite this paragraph.\n```','Change the product title to "A New Title".','Rewrite everything.','Explain the idea in the first unit.']){const value=controller();await value.scope.send(text,true);assert.equal(value.requests[0].body.revisionIntent,false,text);assert.equal(value.state.brief.productDraft,draft,text);}
});

test('scope-plan rewrites and generated/full-draft actions never inherit typed passage authorization',async()=>{
  const planning=controller();await planning.scope.send('Rewrite the full scope breakdown in plain language.',true);assert.equal(planning.requests[0].body.mode,'expand-outline');assert.equal(planning.requests[0].body.revisionIntent,false);assert.equal(planning.state.brief.productDraft,draft);
  const generated=controller();await generated.scope.send(command,false);assert.equal(generated.requests[0].body.revisionIntent,false);assert.equal(generated.requests[0].body.currentInput,'');assert.equal(generated.state.brief.productDraft,draft);
  const complete=controller();complete.scope.revisionMode=true;await complete.scope.send(command,true,{fullDraft:true});assert.equal(complete.requests[0].body.mode,'full-draft');assert.equal(complete.requests[0].body.revisionIntent,false);
});

test('Retry preserves the original authorization boolean, references and new typing without reclassifying history',async()=>{
  const value=controller({fail:true});await value.scope.send(command,true);assert.equal(value.state.retryRequest.revisionIntent,true);const frozen=JSON.stringify(value.state.retryRequest);await value.scope.send('',false,{retry:true});assert.equal(value.requests.length,2);assert.equal(value.requests[1].body.revisionIntent,true);assert.equal(value.requests[1].body.currentInput,command);assert.equal(value.requests[1].body.references[0].id,'original-source');assert.equal(value.state.pendingAnswer,'A new unsent thought.');assert.equal(value.state.messages.filter(message=>message.role==='user').length,1);assert.equal(value.state.retryRequest,null);assert.ok(frozen.includes(command.replaceAll('"','\\"')));
  const earlier=controller();const original=recordRequest(earlier.state,command,{fromComposer:true,revisionIntent:false});earlier.state.retryRequest=original;earlier.scope.revisionMode=true;const saved=JSON.stringify(original);await earlier.scope.send('',false,{retry:true});assert.equal(earlier.requests[0].body.revisionIntent,false);assert.equal(JSON.stringify(original),saved);assert.equal(earlier.state.brief.productDraft,draft);
});

test('the existing explicit manual revision mode remains available for requests outside automatic passage matching',async()=>{
  const value=controller();value.scope.revisionMode=true;await value.scope.send('Make the approved wording clearer.',true);assert.equal(value.requests[0].body.revisionIntent,true);assert.equal(value.state.brief.productDraft,draft.replace(before,after));assert.equal(value.state.previousApprovedDraft,draft);
});
