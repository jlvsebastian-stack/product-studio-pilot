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
const heading='Choose the Right Reply';
const body='### Start with the request\r\n\r\nCheck whether the change is clear. Ask for the missing detail before accepting.\r\n\r\n### Choose the next reply\r\n\r\nIf the design changes the price, get agreement on that price before accepting. If the change is unavailable, kindly decline. An unanswered request stays unresolved.';
const source='## '+heading+'\r\n\r\n'+body;
const replacement='## '+heading+'\r\n\r\n| What is happening? | Which reply should I use? |\r\n| --- | --- |\r\n| Missing details | Ask for the detail before accepting. |\r\n| Design changes price | Get agreement to the revised price before accepting. |\r\n| Unavailable change | Kindly decline. |\r\n| No answer | Follow up; keep the request unresolved. |';
const plan=[heading,'Copy-Ready Messages for Late Changes'].map(title=>'## '+title+'\n\n### Purpose\nGive the baker a practical reply and preserve the price-agreement check.').join('\n\n');
const command='I reviewed the PDF. Please rewrite only “Choose the Right Reply” as a compact decision table with columns “What is happening?” and “Which reply should I use?”. Keep the existing situations and the price-agreement check, but shorten the explanations so I can scan it during a customer chat. Keep the other planned sections unchanged.';
function controller({draft=source,patch={before:source,after:replacement},approved='',stage=9,title='Late-Change Replies'}={}){
  const state=store.freshProject();Object.assign(state.brief,{title,topic:'Late order changes',buyer:'Home bakers',outcome:'Reply clearly to a late order change',format:'Template kit',outline:heading+'\nCopy-Ready Messages for Late Changes',productDraft:draft});Object.assign(state,{interviewStage:stage,approvedOutline:state.brief.outline,expandedOutline:plan,approvedExpandedOutline:plan,approvedDraft:approved,sampleApproved:!!approved});
  const requests=[],replies=[],profile={preferences:[],candidates:[],forgotten:[],paused:false};
  const scope={namedSectionEditRequest,...store,...outline,state,studio:{profile},provider:'chatgpt',selectedModel:'gpt-6.1-sol',quality:'medium',working:false,runtimeReady:true,accountReady:true,revisionMode:false,canUseModel:()=>true,referenceComposer:()=>({ready:true,addLinks:async()=>{}}),extractHttpLinks:()=>[],recordRequest,requestMessages,modelAccess:{state:{},invalidate(){}},save(){},renderChat(){},renderPreferences(){},updateModelNote(){},schedulePreview(){},panel(){},notice(){},busy(value){scope.working=value;},isPresentation:()=>false,nativeSamplesApproved:()=>false,post:async(path,request)=>{requests.push(structuredClone(request));state.pendingAnswer='Keep this unsent thought.';const result=await interview(request,{infer:async()=>({replyKind:'progress',message:'The named sample is now a compact decision table.',stageReady:false,summary:'Only the named sample changed.',brief:Object.fromEntries(briefKeys.map(key=>[key,null])),manuscriptEdit:{replacements:[patch],append:null}})});replies.push(result);return result;}};
  vm.createContext(scope);vm.runInContext(app.slice(app.indexOf('async function send('),app.indexOf('\nasync function advance(')),scope);return {scope,state,requests,replies};
}

test('the exact natural review request authorizes and rewrites only its named unapproved sample through UI and server',async()=>{
  const value=controller();await value.scope.send(command,true);
  assert.equal(value.requests.length,1);assert.equal(value.requests[0].revisionIntent,true);assert.equal(value.requests[0].currentInput,command);assert.equal(value.state.brief.productDraft,replacement);
  assert.equal(value.state.approvedDraft,'');assert.equal(value.state.approvedOutline,heading+'\nCopy-Ready Messages for Late Changes');assert.equal(value.state.approvedExpandedOutline,plan);assert.equal(value.state.pendingAnswer,'Keep this unsent thought.');assert.equal(value.requests[0].model,'gpt-6.1-sol');assert.equal(value.requests[0].reasoningEffort,'medium');
});

test('a quoted canonical H2 needs no section noun and is distinct from product-title metadata',async()=>{
  for(const prefix of ['', 'I checked the sample. ', 'We read the draft. ']){
    const value=controller({title:heading});await value.scope.send(prefix+'Please rewrite only “'+heading+'” as a compact decision table.',true);assert.equal(value.requests[0].revisionIntent,true);assert.equal(value.state.brief.productDraft,replacement);
  }
});

test('a named section in a larger draft retains every outside byte',async()=>{
  const outside='\r\n\r\n## Copy-Ready Messages for Late Changes\r\n\r\nKeep these exact other messages and prices unchanged.\r\n',draft=source+outside,value=controller({draft,stage:10,approved:draft});await value.scope.send(command,true);
  assert.equal(value.requests[0].revisionIntent,true);assert.equal(value.state.brief.productDraft,replacement+outside);assert.equal(value.state.approvedDraft,draft);assert.equal(value.state.previousApprovedDraft,draft);
  const wrong=controller({draft,stage:10,approved:draft,patch:{before:'Keep these exact other messages and prices unchanged.',after:'An unrequested revision.'}});await wrong.scope.send(command,true);assert.equal(wrong.state.brief.productDraft,draft);assert.match(wrong.replies[0].message,/selection|target|unchanged/i);
});

test('whole-source replacement is held for approved/completed single-unit text or a changed canonical heading',async()=>{
  for(const options of [{approved:source},{stage:10},{patch:{before:source,after:replacement.replace(heading,'A New Unit')}}]){
    const value=controller(options);await value.scope.send(command,true);assert.equal(value.state.brief.productDraft,source);assert.match(value.replies[0].message,/whole product|section|heading|unchanged/i);
  }
});

test('questions, negation, history, unknown and multiple quoted targets never gain automatic authority',async()=>{
  const texts=['I reviewed the PDF. How would you rewrite “'+heading+'”?','I reviewed the PDF. Please do not rewrite “'+heading+'”.','Earlier I said: '+command,'I reviewed the PDF. Earlier I asked: Rewrite “'+heading+'”.','I reviewed the PDF. Please rewrite “'+heading+'” if we have more evidence.','I reviewed the PDF. Please rewrite “Missing heading” as a table.','Please rewrite “'+heading+'” and “Copy-Ready Messages for Late Changes” as tables.','Change the product title to “'+heading+'”.'];
  for(const text of texts){const value=controller();await value.scope.send(text,true);assert.equal(value.requests[0].revisionIntent,false,text);assert.equal(value.state.brief.productDraft,source,text);}
  const duplicated=controller({draft:source+'\r\n\r\n'+source});await duplicated.scope.send(command,true);assert.equal(duplicated.requests[0].revisionIntent,false);assert.equal(duplicated.state.brief.productDraft,source+'\r\n\r\n'+source);
});

test('server scope checks reject forged authority for conditional, historical and ambiguous quoted requests',()=>{
  const edit={replacements:[{before:source,after:replacement}],append:null};
  for(const input of ['I reviewed the PDF. How would you rewrite “'+heading+'”?','I reviewed the PDF. Please do not rewrite “'+heading+'”.','Earlier I said: '+command,'I reviewed the PDF. Please rewrite “'+heading+'” if we have more evidence.','Please rewrite “'+heading+'” and “Another Unit” as tables.']){
    const result=applyManuscriptEdit(source,edit,{revisionIntent:true,currentInput:input,sampleSection:true});assert.equal(result.draft,source,input);assert.ok(result.error,input);
  }
  const titleOnly='## '+heading,result=applyManuscriptEdit(titleOnly,{replacements:[{before:titleOnly,after:'## A Different Unit\n\nAn invented lesson.'}],append:null},{revisionIntent:true,currentInput:'Rewrite “'+heading+'” as a table.',sampleSection:true});assert.equal(result.draft,titleOnly);assert.ok(result.error);
});

test('explicit if-scenario content keeps the exact named scope under existing manual edit authority',async()=>{
  const outside='\r\n\r\n## Copy-Ready Messages for Late Changes\r\n\r\nKeep these exact other messages unchanged.\r\n',draft=source+outside,after='If the customer changes pickup time, check availability before accepting. If a design changes price, get price agreement first.',edit={replacements:[{before:body,after}],append:null};
  for(const input of ['Please rewrite only “'+heading+'” to explain what to do if the customer changes pickup time.','Please rewrite only “'+heading+'” to include guidance if the customer does not reply.','Please rewrite only “'+heading+'” to explain that the request stays unresolved unless the customer confirms.','Please rewrite only “'+heading+'” to explain what to do if we miss a pickup update.']){
    const direct=applyManuscriptEdit(draft,edit,{revisionIntent:true,currentInput:input});assert.equal(direct.error,undefined,input);assert.equal(direct.draft,draft.replace(body,after));assert.ok(direct.draft.endsWith(outside));
    const value=controller({draft,approved:draft,stage:10,patch:edit.replacements[0]});value.scope.revisionMode=true;await value.scope.send(input,true);assert.equal(value.requests[0].revisionIntent,true);assert.equal(value.state.brief.productDraft,draft.replace(body,after));assert.equal(value.state.approvedDraft,draft);assert.equal(value.state.previousApprovedDraft,draft);
  }
});

test('content framing cannot turn conditional permission into current source-edit authorization',()=>{
  const edit={replacements:[{before:body,after:'An unrequested replacement.'}],append:null};
  for(const tail of ['if we have more evidence.','unless I approve the change.','to explain pickup changes, but only if we have approval.','to explain what to do if the customer changes pickup time, unless I approve the rewrite.']){
    const result=applyManuscriptEdit(source,edit,{revisionIntent:true,currentInput:'Please rewrite only “'+heading+'” '+tail,sampleSection:true});assert.equal(result.draft,source,tail);assert.match(result.error,/conditional|permission/i);
  }
});
