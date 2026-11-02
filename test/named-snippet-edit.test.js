import test from 'node:test';
import assert from 'node:assert/strict';
import {applyManuscriptEdit} from '../src/manuscript-edits.js';
import {namedSectionEditRequest} from '../public/scoped-edit-request.js';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as store from '../public/studio-store.js';
import * as outline from '../public/outline-plan.js';
import {recordRequest,requestMessages} from '../public/composer.js';
import {interview,interviewPrompt} from '../src/interview.js';
import {briefKeys} from '../src/product.js';

const heading='Filled Example: A 20-Minute Family-Photo Window';
const command='In ‘Filled Example: A 20-Minute Family-Photo Window’, V2 is not ready to use: it gives only the changed row and says the reader should copy G1–G5. Please replace just that V2 table excerpt and the explanation about avoiding repetition with the complete six-row V2 run sheet, ready for the callers. Keep G1–G5 exactly as agreed, replace G6 with G7, and keep every other part of the kit word for word. A buyer should not have to build the finished example themselves.';
const table='| Order / ID | Everyone |\n| --- | --- |\n| 6 / G7 | Maya, Leo, June |';
const explanation='The table above shows only the changed row to avoid repeating the example here.';
const fullTable='| Order / ID | Everyone |\n| --- | --- |\n| 1 / G1 | Maya, Leo, Rosa |\n| 2 / G2 | Maya, Leo, Elena, Nina |\n| 3 / G3 | Maya, Leo, Victor, Nina |\n| 4 / G4 | Maya, Leo, Grace, Tomas, Sam |\n| 5 / G5 | Maya, Leo, Nina, Sam |\n| 6 / G7 | Maya, Leo, June |';
const prefix='## Start Here\n\nKeep this approved introduction exactly.\n\n';
const source=prefix+'## '+heading+'\n\n### V1\n\nOriginal agreed rows stay unchanged.\n\n### V2\n\nKeep the V2 introduction unchanged.\n\n'+table+'\n\nKeep this change-confirmation email exactly.\n\n'+explanation+'\n\n### Difficult Case\n\nKeep this practical guidance exactly.\n\n## Final Check\n\nKeep this other section exactly.';
const edit={replacements:[{before:table,after:fullTable},{before:explanation,after:'The full current V2 sheet is ready for both callers.'}],append:null};

test('exact natural V2 feedback binds the colon-containing curly-quoted H2 and changes only its requested snippets',()=>{
  const result=applyManuscriptEdit(source,edit,{revisionIntent:true,currentInput:command});
  assert.equal(result.error,undefined);
  assert.equal(result.draft,source.replace(table,fullTable).replace(explanation,'The full current V2 sheet is ready for both callers.'));
  assert.ok(result.draft.startsWith(prefix));
});

test('named V2 feedback cannot patch another section even with explicit authority',()=>{
  const result=applyManuscriptEdit(source,{replacements:[{before:'Keep this other section exactly.',after:'Unrelated change.'}],append:null},{revisionIntent:true,currentInput:command});
  assert.equal(result.draft,source);assert.match(result.error,/target|selection|unchanged/i);
});

test('V2 table permission cannot change the confirmation email or practical guidance inside the same H2',()=>{
  for(const before of ['Keep the V2 introduction unchanged.','Keep this change-confirmation email exactly.','Keep this practical guidance exactly.','Original agreed rows stay unchanged.']){
    const result=applyManuscriptEdit(source,{replacements:[{before,after:'An unrelated rewrite.'}],append:null},{revisionIntent:true,currentInput:command});
    assert.equal(result.draft,source);assert.match(result.error,/target|selection|unchanged/i);
  }
  const result=applyManuscriptEdit(source,{replacements:[edit.replacements[0],{before:'Keep this change-confirmation email exactly.',after:'Unrelated rewrite.'}],append:null},{revisionIntent:true,currentInput:command});
  assert.equal(result.draft,source,'an allowed table change cannot smuggle an unrelated email edit');
  const anchor=table+'\n\nKeep this change-confirmation email exactly.';
  const combined=applyManuscriptEdit(source,{replacements:[{before:anchor,after:fullTable+'\n\nUnrelated rewrite.'}],append:null},{revisionIntent:true,currentInput:command});
  assert.equal(combined.draft,source,'unchanged anchor context does not enlarge actual change permission');
});

test('ambiguous version tables or repetition explanations are held instead of widening to their whole H2',()=>{
  for(const draft of [source.replaceAll(/\bV2\b/g,'Current'),source.replace(table,table+'\n\n'+table),source.replace(explanation,explanation+'\n\n'+explanation)]){
    const result=applyManuscriptEdit(draft,edit,{revisionIntent:true,currentInput:command});assert.equal(result.draft,draft);assert.match(result.error,/Quote the exact table|not unique/i);
  }
});

test('a quoted heading with a colon retains existing second-paragraph selection without table-specific requirements',()=>{
  const current='## Notes: Before Pickup\n\nFirst paragraph stays.\n\nSecond paragraph changes.\n\nThird paragraph stays.';
  const input='In “Notes: Before Pickup”, please change only the second paragraph to clearer wording.';
  const result=applyManuscriptEdit(current,{replacements:[{before:'Second paragraph changes.',after:'Use the confirmed pickup time.'}],append:null},{revisionIntent:true,currentInput:input});
  assert.equal(result.draft,current.replace('Second paragraph changes.','Use the confirmed pickup time.'));
  const wrong=applyManuscriptEdit(current,{replacements:[{before:'Third paragraph stays.',after:'Unrelated rewrite.'}],append:null},{revisionIntent:true,currentInput:input});assert.equal(wrong.draft,current);
});

test('a named second-sentence edit retains its existing selector and protects adjacent sentences',()=>{
  const current='## Notes: Before Pickup\n\nFirst sentence stays. Second sentence changes. Third sentence stays.',input='In “Notes: Before Pickup”, please change only the second sentence to clearer wording.';
  const result=applyManuscriptEdit(current,{replacements:[{before:'Second sentence changes.',after:'Use the confirmed time.'}],append:null},{revisionIntent:true,currentInput:input});assert.equal(result.draft,current.replace('Second sentence changes.','Use the confirmed time.'));
});

test('a uniquely labeled Table B needs no version number or repetition explanation to bind just that table',()=>{
  const current='## Pickups: Examples\n\n### Table A\n\n| Time | Status |\n| --- | --- |\n| 2 PM | Requested |\n\n### Table B\n\n| Time | Status |\n| --- | --- |\n| 4 PM | Agreed |\n\nKeep the confirmation email unchanged.';
  const input='In “Pickups: Examples”, please replace just Table B with the updated pickup table.';
  const result=applyManuscriptEdit(current,{replacements:[{before:'| 4 PM | Agreed |',after:'| 4 PM | Confirmed |'}],append:null},{revisionIntent:true,currentInput:input});assert.equal(result.draft,current.replace('| 4 PM | Agreed |','| 4 PM | Confirmed |'));
  const wrong=applyManuscriptEdit(current,{replacements:[{before:'Keep the confirmation email unchanged.',after:'Unrelated rewrite.'}],append:null},{revisionIntent:true,currentInput:input});assert.equal(wrong.draft,current);
});

test('the shared current-request parser holds questions, conditions, history, metadata, unknown and ambiguous headings',()=>{
  for(const text of [
    command.replace('Please replace','How would you replace'),
    command.replace('Please replace','Please do not replace'),
    command.replace('Please replace','If I approve, please replace'),
    'Earlier I said: '+command,
    command.replace('V2 is not ready to use:', 'Previously I asked:'),
    command.replace('that V2 table excerpt and the explanation about avoiding repetition','the author metadata'),
    command.replace(heading,'Missing Example'),
    command.replace('Please replace','Should I replace'),
  ])assert.equal(namedSectionEditRequest(source,text),null,text);
  assert.equal(namedSectionEditRequest(source,command)?.heading,heading);
  assert.equal(namedSectionEditRequest(source+'\n\n## '+heading+'\n\nDuplicate.',command),null);
  assert.equal(namedSectionEditRequest('```md\n## '+heading+'\n```',command),null);
});

const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
test('the actual edit prompt provides only exact authorized fragments and forbids adjacent introduction or email normalization',()=>{
  const value=controller(),{state}=value,{prompt}=interviewPrompt({interviewStage:10,brief:state.brief,messages:[{role:'user',content:command}],currentInput:command,revisionIntent:true,approvedDraft:state.approvedDraft,approvedOutline:state.approvedOutline,expandedOutline:value.plan,approvedExpandedOutline:value.plan});
  const context=JSON.parse(prompt.split('APPLICATION CONTEXT:\n').at(-1));
  assert.ok(Array.isArray(context.authorizedManuscriptFragments),'the provider must receive the precise permitted source fragments');
  assert.deepEqual(context.authorizedManuscriptFragments.map(fragment=>fragment.before),[table,explanation]);
  assert.match(prompt,/one separate replacement per authorized fragment/i);
  assert.match(prompt,/nearby introductions, emails/i);
});
function controller({patch=edit,fail=false}={}){
  const state=store.freshProject(),plan=['Start Here',heading,'Final Check'].map(title=>'## '+title+'\n\n### Purpose\nGive the buyer a ready-to-use asset and practical check.').join('\n\n');
  Object.assign(state.brief,{title:'Family Photo Flow Kit',format:'Google Docs kit',outline:'Start Here\n'+heading+'\nFinal Check',productDraft:source});
  Object.assign(state,{interviewStage:10,approvedDraft:prefix.trimEnd(),sampleApproved:true,approvedOutline:state.brief.outline,expandedOutline:plan,approvedExpandedOutline:plan});
  const requests=[],replies=[],scope={...store,...outline,namedSectionEditRequest,state,studio:{profile:{preferences:[],candidates:[],forgotten:[],paused:false}},provider:'chatgpt',selectedModel:'gpt-6.1-sol',quality:'medium',working:false,runtimeReady:true,accountReady:true,revisionMode:false,canUseModel:()=>true,referenceComposer:()=>({ready:true,addLinks:async()=>{}}),extractHttpLinks:()=>[],recordRequest,requestMessages,modelAccess:{state:{},invalidate(){}},save(){},renderChat(){},renderPreferences(){},updateModelNote(){},schedulePreview(){},panel(){},notice(){},busy(value){scope.working=value;},isPresentation:()=>false,nativeSamplesApproved:()=>false,post:async(path,request)=>{
    requests.push(structuredClone(request));state.pendingAnswer='Keep this unsent note.';if(fail&&requests.length===1)throw Error('Temporary failure.');
    const result=await interview(request,{infer:async(_provider,prompt)=>{
      const context=JSON.parse(prompt.split('APPLICATION CONTEXT:\n').at(-1));
      assert.equal(context.revisionIntent,request.revisionIntent);assert.equal(context.currentInput,request.currentInput);
      return {replyKind:'progress',message:'The V2 example is now a complete calling sheet.',stageReady:false,summary:'Only the requested V2 snippets changed.',brief:Object.fromEntries(briefKeys.map(key=>[key,null])),manuscriptEdit:patch};
    }});replies.push(result);return result;
  }};
  vm.createContext(scope);vm.runInContext(app.slice(app.indexOf('async function send('),app.indexOf('\nasync function advance(')),scope);return {scope,state,requests,replies,plan};
}

test('normal typed feedback reaches interview with narrow authority and preserves other source, plans, approval and unsent input',async()=>{
  const value=controller(),approved=value.state.approvedDraft;await value.scope.send(command,true);
  assert.equal(value.requests[0].revisionIntent,true);assert.equal(value.requests[0].currentInput,command);
  assert.equal(value.state.brief.productDraft,source.replace(table,fullTable).replace(explanation,'The full current V2 sheet is ready for both callers.'));
  assert.equal(value.state.approvedDraft,approved);assert.equal(value.state.approvedExpandedOutline,value.plan);assert.equal(value.state.expandedOutline,value.plan);assert.equal(value.state.pendingAnswer,'Keep this unsent note.');
  assert.equal(value.requests[0].model,'gpt-6.1-sol');assert.equal(value.requests[0].reasoningEffort,'medium');
});

test('a frozen retry does not acquire inferred authority from a later parser update',async()=>{
  const value=controller();value.state.retryRequest=recordRequest(value.state,command,{fromComposer:true,revisionIntent:false});
  await value.scope.send('',false,{retry:true});assert.equal(value.requests[0].revisionIntent,false);assert.equal(value.state.brief.productDraft,source);
});

test('current named-scope questions and conditional or generated instructions never gain composer edit authority',async()=>{
  for(const [text,typed]of [[command.replace('Please replace','How would you replace'),true],[command.replace('Please replace','If I approve, please replace'),true],[command.replace('Please replace','Please do not replace'),true],[command.replace(heading,'Missing Example'),true],[command,false]]){
    const value=controller();await value.scope.send(text,typed);assert.equal(value.requests[0].revisionIntent,false,text);assert.equal(value.state.brief.productDraft,source,text);
  }
});
