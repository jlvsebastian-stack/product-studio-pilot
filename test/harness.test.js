import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { freshProject } from '../src/product.js';
import { interview, interviewPrompt } from '../src/interview.js';
import { createProviderManager, inferenceArguments } from '../src/providers.js';

const request=(extra={})=>({interviewStage:1,messages:[{role:'user',content:'I helped a new coach turn a confusing intake into three specific questions.'}],brief:freshProject().brief,...extra});
const response=(brief={},extra={})=>({message:'What did you change, and why?',stageReady:false,summary:'One concrete case.',brief:{...freshProject().brief,...brief},...extra});
const run=(input,output)=>interview(input,{infer:async()=>output});
const known={topic:'Coach intake',buyer:'New independent coaches',outcome:'Choose three useful intake questions',method:'Remove questions that do not change a decision',example:'A confusing intake became three specific questions',limits:'Does not diagnose or offer legal advice',niche:'New independent coaches preparing a first client intake',offer:'An intake question guide',format:'Guide',outline:'Choose the decision\nWrite three questions',tone:'Plain and direct',design:'Readable ink palette'};

test('old requests stay valid and new brief and response fields default safely',async()=>{
  const result=await run(request(),response());
  assert.equal(result.brief.designPlan,'');assert.equal(result.brief.listingCopy,'');
  assert.deepEqual(result.suggestions,[]);assert.deepEqual(result.preferenceUpdates,[]);assert.deepEqual(result.companions,[]);
});

test('only a current quoted style instruction can be remembered explicitly',async()=>{
  const input=request({messages:[{role:'user',content:'I prefer Taglish.'},{role:'assistant',content:'Saved.'},{role:'user',content:'Please use short, direct sentences. My readers check this on their phones.'}]});
  const result=await run(input,response({}, {preferenceUpdates:[
    {text:'Please use short, direct sentences.',category:'voice',source:'explicit',evidence:'Please use short, direct sentences.'},
    {text:'I prefer Taglish.',category:'voice',source:'explicit',evidence:'I prefer Taglish.'},
    {text:'Use large headings',category:'design',source:'explicit',evidence:'My readers check this on their phones.'},
    {text:'Use gold accents',category:'design',source:'explicit',evidence:'Please use short, direct sentences.'}
  ]}));
  assert.deepEqual(result.preferenceUpdates,[
    {text:'Please use short, direct sentences.',category:'voice',source:'explicit',evidence:'Please use short, direct sentences.'},
    {text:'Use large headings',category:'design',source:'inferred',evidence:'My readers check this on their phones.'},
    {text:'Use gold accents',category:'design',source:'inferred',evidence:'Please use short, direct sentences.'}
  ]);
});

test('a fact or a request to forget does not become an explicit preference',async()=>{
  for(const content of ['I use a font editor in my day job.','My readers always prefer large headings.','Forget that I prefer Taglish.']){
    const result=await run(request({messages:[{role:'user',content}]}),response({}, {preferenceUpdates:[{text:content,category:content.includes('font')||content.includes('headings')?'design':'voice',source:'explicit',evidence:content}]}));
    assert.ok(!result.preferenceUpdates.some(p=>p.source==='explicit'));
  }
});

test('a directly chosen font is remembered as the current design instruction',async()=>{
  const content='Use DM Sans.';
  const result=await run(request({messages:[{role:'user',content}]}),response({}, {preferenceUpdates:[{text:content,category:'design',source:'explicit',evidence:content}]}));
  assert.equal(result.preferenceUpdates[0].source,'explicit');
});

test('approved preferences reach either provider as context separate from project facts',()=>{
  for(const provider of ['chatgpt','claude']){
    const {data,prompt}=interviewPrompt(request({provider,preferences:[{id:'voice1',text:'Use short sentences.',category:'voice',source:'explicit'}]}));
    assert.equal(data.preferences[0].text,'Use short sentences.');assert.equal(data.brief.tone,'');
    assert.match(prompt,/Use short sentences/);
  }
});

test('vague expertise cannot become ready through repeated conversation alone',async()=>{
  const result=await run(request({messages:Array.from({length:20},()=>({role:'user',content:'I know marketing.'}))}),response({topic:'Marketing'},{stageReady:true}));
  assert.equal(result.stageReady,false);
  const enough=await run(request(),response(known,{stageReady:true}));assert.equal(enough.stageReady,true);
});

test('a model-filled invented case cannot supply the creator evidence needed for discovery',async()=>{
  const result=await run(request({messages:[{role:'user',content:'I know marketing.'}]}),response(known,{stageReady:true}));
  assert.equal(result.stageReady,false);
});

test('market readiness requires multiple grounded source links and does not treat UNRUN as proof',async()=>{
  for(const marketEvidence of ['One offer https://example.com/offer','UNRUN. https://example.com/a https://other.example/b']){
    const result=await run(request({interviewStage:5,brief:{...freshProject().brief,...known}}),response({...known,marketEvidence},{stageReady:true}));assert.equal(result.stageReady,false);
  }
  const result=await run(request({interviewStage:5}),response({...known,marketEvidence:'Observed offer contents: https://example.com/a and https://other.example/b. Prices unconfirmed.'},{stageReady:true}));assert.equal(result.stageReady,true);
});

test('early stages reject a premature manuscript and retain earlier confirmed fields',async()=>{
  const input=request({interviewStage:8,brief:{...freshProject().brief,...known}});
  const result=await run(input,response({outline:'Choose the decision\nWrite three questions',productDraft:'# An entire book\n\nInvented early content'},{stageReady:true}));
  assert.equal(result.brief.productDraft,'');assert.equal(result.brief.buyer,'New independent coaches');assert.equal(result.stageReady,false);
});

test('a representative sample cannot silently expand before creator approval',async()=>{
  const sample='## Choose the decision\n\nDecide what you must learn before asking questions.';
  const initial=await run(request({interviewStage:9,brief:{...freshProject().brief,...known}}),response({...known,productDraft:sample+'\n\n## Write three questions\n\nMore sections.'},{stageReady:true}));
  assert.equal(initial.brief.productDraft,'');assert.equal(initial.stageReady,false);
  const unapproved=await run(request({interviewStage:10,approvedDraft:'',brief:{...freshProject().brief,...known,productDraft:sample}}),response({...known,productDraft:sample+'\n\n## Write three questions\n\nMore sections.'},{stageReady:true}));
  assert.equal(unapproved.brief.productDraft,sample);assert.equal(unapproved.stageReady,false);
  const approved=await run(request({interviewStage:10,approvedDraft:sample,brief:{...freshProject().brief,...known,productDraft:sample}}),response({...known,productDraft:sample+'\n\n## Write three questions\n\nAsk about one actual decision.'}));
  assert.match(approved.brief.productDraft,/Ask about one actual decision/);
});

test('unapproved generated section must be reviewed before another section is appended',async()=>{
  const approved='## First section\n\nCreator-approved text.';
  const proposal=approved+'\n\n## Second section\n\nA proposed exercise.';
  const result=await run(request({interviewStage:10,approvedDraft:approved,brief:{...freshProject().brief,...known,productDraft:proposal}}),response({...known,productDraft:proposal+'\n\n## Third section\n\nUnreviewed expansion.'}));
  assert.equal(result.brief.productDraft,proposal);assert.equal(result.stageReady,false);
});

test('stage9 rejects multiple actual H1 or mixed sections while permitting the document title',async()=>{
  for(const productDraft of [
    '# First sample section\n\nA useful lesson.\n\n# Second sample section\n\nAnother lesson without feedback.',
    '# Coach intake guide\n\n## First sample section\n\nA useful lesson.\n\n# Second sample section\n\nAnother lesson without feedback.'
  ]){
    const brief={...freshProject().brief,...known,title:'Coach intake guide'};
    const result=await run(request({interviewStage:9,brief,approvedDraft:''}),response({...brief,productDraft},{stageReady:true}));
    assert.equal(result.brief.productDraft,'');assert.equal(result.stageReady,false);
  }
});

test('stage10 blocks H1 and mixed-section expansion beyond one unreviewed actual section',async()=>{
  const approved='## Approved sample\n\nKeep these creator-approved words exactly.';
  for(const tail of [
    '\n\n# Second section\n\nA proposed standalone section.\n\n# Third section\n\nA separate new section without feedback.',
    '\n\n# Second section\n\nA proposed standalone section.\n\n## Third section\n\nA separate new section without feedback.'
  ]){
    const brief={...freshProject().brief,...known,productDraft:approved};
    const result=await run(request({interviewStage:10,brief,approvedDraft:approved}),response({...brief,productDraft:approved+tail},{stageReady:true}));
    assert.equal(result.brief.productDraft,approved);assert.equal(result.stageReady,false);
  }
});

test('a document title, one actual section and subordinate or fenced headings remain a valid sample',async()=>{
  const productDraft='# Coach intake guide\n\n## Choose the decision\n\nWrite the decision first.\n\n### Worked example\n\nAn illustrative example.\n\n```markdown\n# This heading is example code\n## So is this one\n```\n\n### Your turn\n\nWrite one decision.';
  const brief={...freshProject().brief,...known,title:'Coach intake guide'};
  const result=await run(request({interviewStage:9,brief,approvedDraft:''}),response({...brief,productDraft},{stageReady:true}));
  assert.equal(result.brief.productDraft,productDraft);assert.equal(result.stageReady,true);
});

test('one H1 addition and refinements within that unapproved section remain available',async()=>{
  const approved='# Coach intake guide\n\n## Approved sample\n\nKeep these creator-approved words exactly.';
  const proposal=approved+'\n\n# Next section\n\nA proposed instruction.\n\n### Worked example\n\nAn illustrative first example.';
  const brief={...freshProject().brief,...known,title:'Coach intake guide',productDraft:approved};
  const added=await run(request({interviewStage:10,brief,approvedDraft:approved}),response({...brief,productDraft:proposal}));
  assert.equal(added.brief.productDraft,proposal);
  const refined=proposal.replace('An illustrative first example.','A clearer illustrative example.\n\n### Check your work\n\nCheck whether the question changes a decision.');
  const result=await run(request({interviewStage:10,brief:{...brief,productDraft:proposal},approvedDraft:approved}),response({...brief,productDraft:refined}));
  assert.equal(result.brief.productDraft,refined);assert.ok(result.brief.productDraft.startsWith(approved));
});

test('approved draft remains an exact prefix unless revision was explicitly requested',async()=>{
  const approved='## First section\r\n\r\nThe creator’s exact words.  ';
  const input=request({interviewStage:11,approvedDraft:approved,brief:{...freshProject().brief,...known,productDraft:approved}});
  const revised=response({...known,productDraft:'## First section\n\nA model rewrite.'},{stageReady:true});
  const protectedResult=await run(input,revised);assert.equal(protectedResult.brief.productDraft,approved);assert.equal(protectedResult.stageReady,false);
  const explicit=await run({...input,revisionIntent:true},response({...known,productDraft:'## First section\n\nA requested rewrite.'}));assert.match(explicit.brief.productDraft,/requested rewrite/);
});

test('legacy requests protect their accumulated draft rather than treating it as empty',async()=>{
  const draft='## Existing draft\n\nA saved creator section.';
  const result=await run(request({interviewStage:11,brief:{...freshProject().brief,...known,productDraft:draft}}),response({...known,productDraft:''}));assert.equal(result.brief.productDraft,draft);
});

test('suggestions need a basis in creator evidence and completion companions stay optional and relevant',async()=>{
  const brief={...freshProject().brief,...known,productDraft:'## Choose the decision\n\nA complete reviewed method and exercise.'};
  const result=await run(request({interviewStage:12,approvedDraft:brief.productDraft,brief}),response({...brief,listingCopy:'A practical guide for new independent coaches choosing intake questions.'},{suggestions:[{title:'Add a question checklist',why:'Help apply the method.',basis:'Remove questions that do not change a decision'},{title:'Raise your price',why:'Guaranteed sales.',basis:'1000 customers already bought it'}],companions:[{title:'Intake decision checklist',format:'Checklist',why:'Helps new independent coaches choose their three useful intake questions.'}]}));
  assert.equal(result.suggestions.length,1);assert.equal(result.companions.length,1);assert.match(result.brief.listingCopy,/intake questions/);
  const early=await run(request(),response({}, {companions:[{title:'Bonus',format:'Guide',why:'Extra revenue'}]}));assert.deepEqual(early.companions,[]);
});

test('model-invented brief material cannot ground suggestions or unrelated companion claims',async()=>{
  const brief={...freshProject().brief,...known,productDraft:'## Choose the decision\n\nA complete reviewed method and exercise.'};
  const result=await run(request({interviewStage:12,approvedDraft:brief.productDraft,brief}),response({...brief,marketEvidence:'1000 customers already bought it'},{suggestions:[{title:'Raise your price',why:'Increase revenue.',basis:'1000 customers already bought it'}],companions:[{title:'Forex signal subscription',format:'Newsletter',why:'Guaranteed trading profits every week.'}]}));
  assert.deepEqual(result.suggestions,[]);assert.ok(!result.companions.some(item=>/forex|trading|profits/i.test(JSON.stringify(item))));
});

test('a completed product always receives grounded optional companions and listing copy when the model omits them',async()=>{
  const productDraft='## Choose the decision\n\nBefore adding a question to an intake form, write the decision its answer would change. If an answer would not change what you do next, remove that question. A new independent coach can begin with the client’s immediate situation, desired next step and practical constraints. Keep sensitive questions outside the intake unless there is a clear reason and an appropriate way to handle the information.\n\n## Write three questions\n\nWrite one question for each decision. Use plain wording and ask for a concrete example rather than a broad self-rating. Read the questions aloud and remove any phrase that asks two things at once. Check each answer against the decision beside it: if different answers lead to the same next action, revise or remove that question. This method helps choose useful questions; it does not diagnose a client or replace professional legal advice.';
  const brief={...freshProject().brief,...known,title:'Three useful intake questions',productDraft};
  const result=await run(request({interviewStage:12,approvedDraft:productDraft,brief}),response(brief,{stageReady:true}));
  assert.equal(result.brief.productDraft,productDraft);
  assert.equal(result.companions.length,2);
  assert.deepEqual(result.companions.map(item=>item.format),['Checklist','Worksheet']);
  for(const item of result.companions){assert.match(item.title,/Coach intake/);assert.match(item.why,/New independent coaches/);assert.match(item.why,/Remove questions that do not change a decision/);assert.match(item.why,/optional|choose/i);}
  assert.match(result.brief.listingCopy,/Three useful intake questions/);assert.match(result.brief.listingCopy,/New independent coaches/);
  assert.match(result.brief.listingCopy,/Choose three useful intake questions/);assert.match(result.brief.listingCopy,/Remove questions that do not change a decision/);
  assert.match(result.brief.listingCopy,/Does not diagnose or offer legal advice/);
  assert.doesNotMatch(result.brief.listingCopy,/application checklist|decision worksheet|bonus included|guaranteed|sales|customers/i);
});

test('completion replaces filtered unrelated ideas with different useful formats instead of duplicating the primary product',async()=>{
  const brief={...freshProject().brief,...known,format:'Checklist',productDraft:'## Intake checks\n\nCheck that each question changes a concrete decision.'};
  const result=await run(request({interviewStage:12,approvedDraft:brief.productDraft,brief}),response(brief,{companions:[{title:'Forex subscription',format:'Newsletter',why:'Guaranteed trading profits.'}]}));
  assert.ok(result.companions.length>=1);assert.ok(result.companions.every(item=>item.format!=='Checklist'));
  assert.ok(result.companions.every(item=>item.why.includes('New independent coaches')));
  assert.doesNotMatch(JSON.stringify(result.companions),/forex|profits|guaranteed/i);
});

test('completion asks for missing creator facts instead of inventing companion or listing content',async()=>{
  const brief={...freshProject().brief,topic:'Intake',format:'Guide',productDraft:'## Intake\n\nAn existing manuscript that still lacks a confirmed buyer or method.'};
  const result=await run(request({interviewStage:12,brief,approvedDraft:brief.productDraft}),response(brief,{stageReady:true}));
  assert.deepEqual(result.companions,[]);assert.equal(result.brief.listingCopy,'');assert.equal(result.stageReady,false);
  assert.match(result.message,/buyer|who.*for/i);assert.match(result.message,/method|approach/i);assert.match(result.message,/companion|listing/i);
});

test('chosen model and effort are validated and reach each official CLI without fallback',async()=>{
  const fakeCli={file:process.execPath,prefix:[]};
  for(const [id,model] of [['chatgpt','gpt-6.1-sol'],['chatgpt','gpt-6-astra'],['claude','claude-sonnet-5-5'],['claude','claude-opus-5-5']]){
    let used;
    const manager=createProviderManager({resolveCli:()=>fakeCli,execute:async(_,args)=>{
      if(args[0]==='login')return {code:0,stdout:'Logged in using ChatGPT',stderr:''};
      if(args[0]==='auth')return {code:0,stdout:'{"loggedIn":true,"authMethod":"claude.ai"}',stderr:''};
      used=args;
      if(id==='chatgpt')await writeFile(args[args.indexOf('--output-last-message')+1],JSON.stringify(response()));
      return {code:0,stdout:JSON.stringify({structured_output:response()}),stderr:''};
    }});
    await manager.infer(id,'Context',{}, {model,reasoningEffort:'high'});
    assert.equal(used[used.indexOf('--model')+1],model);
    if(id==='chatgpt')assert.ok(used.includes('model_reasoning_effort="high"'));else assert.equal(used[used.indexOf('--effort')+1],'high');
    assert.ok(!used.includes('--fallback-model'));
  }
  assert.throws(()=>inferenceArguments('chatgpt',{model:'arbitrary-paid-api-route'}),/model/i);
  assert.throws(()=>inferenceArguments('claude',{reasoningEffort:'unsupported'}),/quality|effort/i);
  const defaults=inferenceArguments('chatgpt');assert.ok(defaults.includes('gpt-6-astra'));assert.ok(defaults.includes('model_reasoning_effort="medium"'));
});

test('a first request without a model uses the verified Astra medium recommendation',async()=>{
  let options;
  await interview(request(),{infer:async(_,__,___,received)=>{options=received;return response();}});
  assert.equal(options.model,'gpt-6-astra');assert.equal(options.reasoningEffort,'medium');
});

test('Windows helper startup denial gives a normal local-permissions recovery instead of login advice',async()=>{
  const manager=createProviderManager({resolveCli:()=>({file:'official-cli',prefix:[]}),execute:async(_,args)=>args[0]==='login'?{code:0,stdout:'Logged in using ChatGPT',stderr:''}:{code:1,stdout:'',stderr:'Error: failed to initialize in-process app-server client: Access is denied. (os error 5)'}});
  await assert.rejects(manager.infer('chatgpt','Controlled test fixture',{}),error=>{
    assert.match(error.message,/relaunch.*normal local permissions/i);assert.match(error.message,/draft is saved/i);
    assert.doesNotMatch(error.message,/sign.?in|account connection|administrator|disable.*security/i);return true;
  });
});

test('interview forwards selected quality and reports unavailable models without retry or API route',async()=>{
  let options;
  await interview(request({model:'gpt-6.1-sol',reasoningEffort:'xhigh'}),{infer:async(_,__,___,received)=>{options=received;return response();}});
  assert.equal(options.model,'gpt-6.1-sol');assert.equal(options.reasoningEffort,'xhigh');
  let calls=0;
  const manager=createProviderManager({resolveCli:()=>({file:'official-cli',prefix:[]}),execute:async(_,args)=>{
    if(args[0]==='login')return {code:0,stdout:'Logged in using ChatGPT',stderr:''};
    calls++;return {code:1,stdout:'',stderr:'The requested model gpt-6.1-sol is not supported for this account.'};
  }});
  await assert.rejects(manager.infer('chatgpt','Context',{}, {model:'gpt-6.1-sol'}),/choose another model/i);assert.equal(calls,1);
});
