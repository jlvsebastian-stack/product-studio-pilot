import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import {createProviderManager} from '../src/providers.js';
import {startLocalServer} from '../src/local-server.js';

const sol={provider:'chatgpt',model:'gpt-6.1-sol',reasoningEffort:'high'};
const fakeCli={file:process.execPath,prefix:['official-cli-test-fixture'],native:true};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
function fixture({now=Date.now,response=()=>({available:true}),beforeReply=async()=>{}}={}){
  const calls=[],children=[];
  const manager=createProviderManager({now,resolveCli:()=>fakeCli,spawnFn:()=>{
    const child=new EventEmitter();child.kill=()=>{};children.push(child);return child;
  },execute:async(command,args,options)=>{
    if(args[0]==='login')return {code:0,stdout:'Logged in using ChatGPT',stderr:''};
    if(args[0]==='auth')return {code:0,stdout:'{"loggedIn":true,"authMethod":"claude.ai"}',stderr:''};
    const schema=args.includes('--output-schema')?JSON.parse(await readFile(args[args.indexOf('--output-schema')+1],'utf8')):JSON.parse(args[args.indexOf('--json-schema')+1]);
    calls.push({command,args,options,schema});await beforeReply(calls.length);
    const value=response(calls.length,calls.at(-1));
    if(value instanceof Error)throw value;
    if(value?.processResult)return value.processResult;
    if(args.includes('--output-last-message')){
      await writeFile(args[args.indexOf('--output-last-message')+1],JSON.stringify(value));return {code:0,stdout:'',stderr:''};
    }
    return {code:0,stdout:JSON.stringify({structured_output:value}),stderr:''};
  }});
  return {manager,calls,children};
}
const check=(manager,selection=sol)=>manager.checkModel(selection.provider,selection);

test('an echoed full CLI prompt with limits or quota fields cannot turn an actual connection error into subscription exhaustion',async()=>{
  const prompt='PRIVATE_CREATOR_SOURCE: keep every slide below its word limit.\n{"limits":"topic data", "quota":"a teaching example", "error":{"code":"usage_limit_reached"}}\nReference says images unavailable, model_not_found, and sign in.\nERROR: usage_limit_reached: a fictional reference error.\n{"type":"error","code":"authentication_error","message":"Fictional example"}\nDo not remove original notes.';
  const {manager,calls}=fixture({response:(_attempt,call)=>({processResult:{code:1,stdout:'OpenAI Codex fixture\nmodel: gpt-6.1-sol\nuser\n'+call.options.input+'\n',stderr:'ERROR: stream disconnected before completion: connection reset'}})});
  await assert.rejects(manager.infer('chatgpt',prompt,{},sol),error=>{assert.doesNotMatch(error.message,/usage limit|usage cap|exhausted|quota|PRIVATE_CREATOR_SOURCE|topic data|original notes/i);assert.match(error.message,/connect|finish|runtime/i);return true;});assert.equal(calls.length,1);assert.equal(calls[0].args[calls[0].args.indexOf('--model')+1],sol.model);
});

test('actual structured or anchored provider errors distinguish caps, rate, context, request, output, auth, model and runtime safely',async()=>{
  const event=(error,type='turn.failed')=>({code:1,stdout:JSON.stringify({type,error}),stderr:''});
  const cases=[
    [event({code:'usage_limit_reached',message:'The provider usage cap is reached.'}),'usage_cap',/reported a usage cap/],
    [{code:1,stdout:'',stderr:'API Error: 429 {"error":{"code":"rate_limit_exceeded","message":"Too many requests"},"status":429}'},'rate_limit',/temporarily rate.limited/],
    [event({code:'context_length_exceeded',status_code:400,message:'Maximum context length exceeded.'}),'context_limit',/context length/],
    [{code:1,stdout:'',stderr:'ERROR: The maximum context length is 100000 tokens.'},'context_limit',/context length/],
    [event({status:413,message:'Payload too large.'}),'request_limit',/request.size or per.request limit/],
    [event({code:'max_output_tokens_exceeded',message:'The output token budget was reached.'}),'output_limit',/output.length limit/],
    [event({code:'authentication_error',status:401,message:'Unauthorized.'}),'authentication',/Sign in to ChatGPT again/],
    [event({code:'model_not_found',message:'Requested model does not exist.'}),'model',/selected ChatGPT model or quality setting is unavailable/],
    [{code:1,stdout:'',stderr:'ERROR: image inputs are not supported by this model.'},'image_input',/cannot accept these image inputs/],
    [{code:1,stdout:'',stderr:'ERROR: failed to initialize in-process app-server client: Access is denied. (os error 5)'},'runtime',/relaunch.*normal local permissions/],
    [event({code:'server_error',status:503,message:'PRIVATE_ACCOUNT_DATA Bearer secret-value sk-should-not-leak-1234'}),'runtime',/helper or connection/],
    [event({code:'private_customer_identifier',status:400,message:'PRIVATE_ACCOUNT_DATA could not be handled.'}),'generic',/could not finish/]
  ];
  for(const [processResult,category,message]of cases){const {manager,calls}=fixture({response:()=>({processResult})});await assert.rejects(manager.infer('chatgpt','Private prompt includes word limits, quota, images unavailable and login guidance.',{},sol),error=>{assert.equal(error.providerDiagnostic.category,category);assert.equal(error.modelUnavailable,category==='model');assert.equal(error.providerDiagnostic.retryable,category!=='model');assert.match(error.message,message);assert.doesNotMatch(error.message+' '+JSON.stringify(error.providerDiagnostic),/PRIVATE_ACCOUNT_DATA|Bearer|secret-value|sk-should|private_customer_identifier/);if(category!=='usage_cap')assert.doesNotMatch(error.message,/usage cap|usage limit|subscription.*exhausted/);return true;});assert.equal(calls.length,1,'a failure never switches models or starts an automatic retry');assert.equal(calls[0].args[calls[0].args.indexOf('--model')+1],sol.model);assert.ok(calls[0].args.includes('model_reasoning_effort="high"'));}
});

test('ordinary JSON fields and prompt quotations cannot classify generic errors as image, model, authentication or usage failures',async()=>{
  const outputs=[JSON.stringify({limits:'daily limit',quota:'exhausted',error:{code:'usage_limit_reached'}}),JSON.stringify({type:'user',content:{error:{code:'model_not_found'},description:'images unavailable; sign in'}}),'Limits: quota.\nA reference mentions images unsupported and model_not_found.\nPlease sign in is quoted teaching content.'];
  for(const stdout of outputs){const {manager}=fixture({response:()=>({processResult:{code:1,stdout,stderr:'ERROR: An operation could not be completed.'}})});await assert.rejects(manager.infer('chatgpt','Bounded request.',{},sol),error=>{assert.equal(error.providerDiagnostic.category,'generic');assert.equal(error.modelUnavailable,false);assert.doesNotMatch(error.message,/usage cap|usage limit|Sign in|cannot accept.*image|model.*unavailable/i);return true;});}
});

test('short user words do not erase genuine structured error codes while their echoed prompt line is ignored',async()=>{
  for(const prompt of ['quota','usage_limit_reached']){const {manager}=fixture({response:()=>({processResult:{code:1,stdout:'user\n'+prompt+'\n',stderr:JSON.stringify({type:'turn.failed',error:{code:'usage_limit_reached',message:'Provider usage limit reached.'}})}})});await assert.rejects(manager.infer('chatgpt',prompt,{},sol),error=>error.providerDiagnostic.category==='usage_cap'&&error.providerDiagnostic.code==='usage_limit_reached');}
});

test('Claude error result records are classified independently of success content and private context',async()=>{
  for(const [body,category]of [[{type:'result',is_error:true,subtype:'error_max_turns'},'request_limit'],[{type:'result',is_error:true,subtype:'error_during_execution',errors:[{type:'rate_limit_error',status:429,message:'Too many requests.'}]},'rate_limit'],[{type:'result',is_error:true,subtype:'error_during_execution',errors:["You've hit your usage limit. Retry after the reset."]},'usage_cap']]){const {manager,calls}=fixture({response:()=>({processResult:{code:0,stdout:JSON.stringify(body),stderr:''}})});await assert.rejects(manager.infer('claude','A private outline with limits and a quota example.',{},{model:'claude-sonnet-5-5',reasoningEffort:'medium'}),error=>error.providerDiagnostic.category===category);assert.equal(calls.length,1);}
});

test('an actual model rejection remains definite when ordinary CLI output echoes limits and JSON topic fields',async()=>{
  const {manager}=fixture({response:(_attempt,call)=>({processResult:{code:1,stdout:'user\n'+call.options.input+'\n{"limits":"echoed topic field", "quota":"illustrative"}\n',stderr:'ERROR: model_not_found: the model does not exist'}})});const result=await check(manager);assert.equal(result.available,false);assert.notEqual(result.retryable,true);assert.match(result.message,/selected ChatGPT model or quality setting is unavailable/);assert.doesNotMatch(result.message,/usage limit|usage cap|exhausted/);
});

test('explicit provider codes outrank trailing uncoded runtime wrappers in inference and model checks',async()=>{
  for(const [code,category]of [['model_not_found','model'],['context_length_exceeded','context_limit'],['usage_limit_reached','usage_cap']])for(const stderr of ['ERROR: stream disconnected before completion: connection reset','ERROR: failed to initialize in-process app-server client: Access is denied. (os error 5)']){
    const {manager,calls}=fixture({response:()=>({processResult:{code:1,stdout:JSON.stringify({type:'turn.failed',error:{code,message:'PRIVATE_PROVIDER_DETAIL'}}),stderr}})});
    await assert.rejects(manager.infer('chatgpt','PRIVATE_PROMPT with limits and supplied examples.',{},sol),error=>{assert.equal(error.providerDiagnostic.category,category);assert.equal(error.providerDiagnostic.code,code);assert.equal(error.modelUnavailable,category==='model');assert.doesNotMatch(error.message,/Windows denied|helper or connection|PRIVATE_PROVIDER_DETAIL|PRIVATE_PROMPT/);return true;});
    const result=await check(manager);assert.equal(result.available,false);assert.equal(result.retryable===true,category!=='model');assert.match(result.message,new RegExp(code));assert.equal(calls.length,2,'one explicit inference and one explicit model check only');assert.ok(calls.every(call=>call.args[call.args.indexOf('--model')+1]===sol.model&&call.args.includes('model_reasoning_effort="high"')));
  }
});

test('genuinely conflicting coded provider categories remain uncertain instead of permanently rejecting the selection',async()=>{
  const {manager,calls}=fixture({response:()=>({processResult:{code:1,stdout:JSON.stringify({type:'turn.failed',error:{code:'model_not_found',message:'Private model detail'}}),stderr:JSON.stringify({type:'error',error:{code:'usage_limit_reached',message:'Private cap detail'}})}})});const result=await check(manager);assert.equal(result.available,false);assert.equal(result.retryable,true);assert.match(result.message,/conflicting error details/);assert.doesNotMatch(result.message,/usage cap|usage limit|model.*unavailable|Private/);assert.equal(calls.length,1);
});

test('the local model-access endpoint checks the exact selection and returns its availability',async()=>{
  let received;
  const app=await startLocalServer({port:0,openBrowser:false,providers:{checkModel:async(provider,selection)=>{
    received={provider,...selection};return {available:true,message:'The selected model responded.'};
  }}});
  try{
    const res=await fetch(app.url+'/api/check-model',{method:'POST',headers:{Origin:app.url,'Content-Type':'application/json'},body:JSON.stringify(sol)});
    assert.equal(res.status,200,'The selected-model check endpoint must exist');
    assert.deepEqual(await res.json(),{available:true,message:'The selected model responded.'});assert.deepEqual(received,sol);
    assert.equal((await(await fetch(app.url+'/api/health')).json()).version,JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version);
    const module=await fetch(app.url+'/model-access.js');assert.equal(module.status,200);assert.match(module.headers.get('content-type'),/javascript/);
  }finally{await app.close();}
});

test('the manager sends one tiny structured check with the exact model and quality, without fallback',async()=>{
  const {manager,calls}=fixture();
  assert.equal(typeof manager.checkModel,'function','Model access must use the subscription-only provider lifecycle');
  assert.equal((await check(manager)).available,true);assert.equal(calls.length,1);
  const {args,options}=calls[0];
  assert.equal(args[args.indexOf('--model')+1],sol.model);assert.ok(args.includes('model_reasoning_effort="high"'));
  assert.equal(args.includes('--search'),false);assert.equal(args.includes('--image'),false);
  assert.ok(options.input.length<500);assert.match(options.input,/available/);
  assert.equal(options.env.OPENAI_API_KEY,undefined);assert.equal(options.env.ENABLE_CLAUDEAI_MCP_SERVERS,'false');
  assert.deepEqual(calls[0].schema,{type:'object',properties:{available:{type:'boolean'}},required:['available'],additionalProperties:false});
});

test('Claude checks use the exact model and quality through its existing structured subscription adapter',async()=>{
  const {manager,calls}=fixture();
  assert.equal((await check(manager,{provider:'claude',model:'claude-opus-5-5',reasoningEffort:'xhigh'})).available,true);
  assert.equal(calls.length,1);const {args}=calls[0];
  assert.equal(args[args.indexOf('--model')+1],'claude-opus-5-5');assert.equal(args[args.indexOf('--effort')+1],'xhigh');
  assert.equal(args[args.indexOf('--tools')+1],'');assert.ok(args.includes('--restricted'));assert.ok(args.includes('--no-chrome'));
});

test('checks require explicit supported selection fields and never substitute a default',async()=>{
  const {manager,calls}=fixture();
  for(const selection of [{...sol,model:undefined},{...sol,reasoningEffort:undefined},{...sol,provider:undefined},{...sol,model:'does-not-exist'},{...sol,reasoningEffort:'automatic'},{...sol,provider:'claude'}]){
    const result=await check(manager,selection);assert.equal(result.available,false);assert.equal(typeof result.message,'string');
  }
  assert.equal(calls.length,0);
});

test('only the expected real boolean reply confirms access; rejected, malformed and transient results are retried',async()=>{
  const badReplies=[{available:false},{available:'true'},{available:true,unexpected:true},{},true,
    {processResult:{code:1,stdout:'',stderr:'model_not_found: the selected model was not found'}},new Error('The local helper temporarily disconnected.')];
  for(const bad of badReplies){
    const {manager,calls}=fixture({response:attempt=>attempt===1?bad:{available:true}});
    const failed=await check(manager);assert.equal(failed.available,false);assert.ok(failed.message);
    assert.equal((await check(manager)).available,true);assert.equal(calls.length,2,'a rejection or transient failure is not cached');
    assert.ok(calls.every(({args})=>args[args.indexOf('--model')+1]===sol.model),'there is no fallback attempt');
  }
});

test('temporary rate limits, timeout, helper disconnect and malformed responses stay retryable through the actual adapter',async()=>{
  const uncertain=[
    {processResult:{code:1,stdout:'',stderr:'rate_limit_exceeded: usage quota reached'}},
    {processResult:{code:1,stdout:'',stderr:'The selected model is temporarily unavailable. Please try again.'}},
    new Error('The AI took too long. Your conversation is still saved; try a smaller request.'),
    new Error('The local helper temporarily disconnected.'),{available:false},{available:'true'},{}
  ];
  for(const bad of uncertain){
    const {manager,calls}=fixture({response:attempt=>attempt===1?bad:{available:true}});
    const failed=await check(manager);assert.equal(failed.available,false);assert.equal(failed.retryable,true,'uncertainty is not a model-access rejection');
    if(bad instanceof Error)assert.equal(failed.message,bad.message);
    if(bad.processResult?.stderr.includes('quota'))assert.match(failed.message,/rate.limit/);
    assert.equal((await check(manager)).available,true);assert.equal(calls.length,2);
  }
});

test('definite unsupported model, quality and access rejection remain unavailable without a retryable marker',async()=>{
  for(const stderr of ['model_not_found: the model does not exist','This reasoning effort is not supported with the selected model','You do not have access to this model']){
    const {manager,calls}=fixture({response:attempt=>attempt===1?{processResult:{code:1,stdout:'',stderr}}:{available:true}});
    const failed=await check(manager);assert.equal(failed.available,false);assert.notEqual(failed.retryable,true);assert.match(failed.message,/selected ChatGPT model or quality setting is unavailable/);
    assert.equal((await check(manager)).available,true);assert.equal(calls.length,2,'a definite negative is not permanently cached either');
  }
});

test('the HTTP result preserves temporary-versus-definite provider failure classification',async()=>{
  const {manager}=fixture({response:attempt=>({processResult:{code:1,stdout:'',stderr:attempt===1?'rate_limit_exceeded: usage quota reached':'model_not_found: the model does not exist'}})});
  const app=await startLocalServer({port:0,openBrowser:false,providers:manager});
  const post=()=>fetch(app.url+'/api/check-model',{method:'POST',headers:{Origin:app.url,'Content-Type':'application/json'},body:JSON.stringify(sol)});
  try{
    const temporary=await post();assert.equal(temporary.status,200);const pending=await temporary.json();assert.equal(pending.available,false);assert.equal(pending.retryable,true);assert.match(pending.message,/rate.limit/);
    const definite=await post();assert.equal(definite.status,200);const rejected=await definite.json();assert.equal(rejected.available,false);assert.notEqual(rejected.retryable,true);assert.match(rejected.message,/unavailable/);
  }finally{await app.close();}
});

test('successful checks cache briefly by provider, model and quality and expire in the running session',async()=>{
  let time=1000;const {manager,calls}=fixture({now:()=>time});
  await check(manager);await check(manager);assert.equal(calls.length,1);
  await check(manager,{...sol,reasoningEffort:'xhigh'});assert.equal(calls.length,2);
  await check(manager,{...sol,model:'gpt-6-astra'});assert.equal(calls.length,3);
  await check(manager,{provider:'claude',model:'claude-sonnet-5-5',reasoningEffort:'high'});assert.equal(calls.length,4);
  time+=5*60*1000;await check(manager);assert.equal(calls.length,5);
});

test('sign-in and an actual inference failure invalidate successful checks',async()=>{
  const {manager,calls,children}=fixture({response:attempt=>attempt===3?{processResult:{code:1,stdout:'',stderr:'model_not_found: this model does not exist'}}:{available:true}});
  await check(manager);await manager.login('chatgpt');
  await assert.rejects(check(manager),error=>error.statusCode===409&&/sign-in/.test(error.message));
  children[0].emit('close',0);await check(manager);assert.equal(calls.length,2);
  await assert.rejects(manager.infer('chatgpt','Actual interview request',{},sol),/unavailable/);
  await check(manager);assert.equal(calls.length,4,'the failed interview invalidates the preceding access result');
});

test('a sign-in change during a check cannot confirm or cache the previous account result',async()=>{
  const entered=deferred(),gate=deferred();
  const {manager,calls,children}=fixture({beforeReply:async attempt=>{if(attempt===1){entered.resolve();await gate.promise;}}});
  const pending=check(manager);await entered.promise;await manager.login('chatgpt');children[0].emit('close',0);gate.resolve();
  const result=await pending;assert.equal(result.available,false);assert.equal(result.retryable,true);assert.match(result.message,/connection changed/);
  await check(manager);assert.equal(calls.length,2);
});

test('model checks and interviews share the existing lock, including a cached selection',async()=>{
  const entered=deferred(),gate=deferred();
  const {manager,calls}=fixture({beforeReply:async attempt=>{if(attempt===1){entered.resolve();await gate.promise;}}});
  const pending=check(manager);await entered.promise;
  await assert.rejects(check(manager,{...sol,reasoningEffort:'xhigh'}),error=>error.statusCode===409);
  await assert.rejects(manager.infer('chatgpt','Do not start concurrently',{},sol),error=>error.statusCode===409);
  assert.equal(calls.length,1);gate.resolve();assert.equal((await pending).available,true);
  const enteredInterview=deferred(),finishInterview=deferred();
  const second=fixture({beforeReply:async attempt=>{if(attempt===2){enteredInterview.resolve();await finishInterview.promise;}}});
  await check(second.manager);
  const interview=second.manager.infer('chatgpt','An interview owns the helper',{},sol);await enteredInterview.promise;
  await assert.rejects(check(second.manager),error=>error.statusCode===409);finishInterview.resolve();await interview;
  assert.equal(second.calls.length,2);
});

test('an unconfirmed helper stop remains busy until its actual exit is confirmed',async()=>{
  const exited=deferred();const error=Object.assign(new Error('The AI helper did not confirm that it stopped.'),{unconfirmedTermination:true,processExit:exited.promise});
  const {manager,calls}=fixture({response:attempt=>attempt===1?error:{available:true}});
  await assert.rejects(check(manager),held=>held.statusCode===409&&/did not confirm/.test(held.message));
  await assert.rejects(check(manager),held=>held.statusCode===409&&/did not confirm/.test(held.message));assert.equal(calls.length,1);
  exited.resolve();await Promise.resolve();assert.equal((await check(manager)).available,true);assert.equal(calls.length,2);
});

test('the access endpoint preserves local guards and reports transient busy as HTTP409',async()=>{
  const {manager}=fixture();const entered=deferred(),gate=deferred();let attempts=0;
  const providers={...manager,checkModel:async(...args)=>{attempts++;if(attempts===1){entered.resolve();await gate.promise;throw Object.assign(new Error('Your AI is already working.'),{statusCode:409});}return manager.checkModel(...args);}};
  const app=await startLocalServer({port:0,openBrowser:false,providers});
  const post=(body,origin=app.url)=>fetch(app.url+'/api/check-model',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  try{
    assert.equal((await post(sol,'https://foreign.example')).status,403);assert.equal(attempts,0);
    const pending=post(sol);await entered.promise;gate.resolve();const busy=await pending;
    assert.equal(busy.status,409);assert.deepEqual(await busy.json(),{available:false,message:'Your AI is already working.'});
    const result=await post(sol);assert.equal(result.status,200);assert.equal((await result.json()).available,true);
    const invalid=await post({...sol,model:'no-fallback-model'});assert.equal((await invalid.json()).available,false);
  }finally{gate.resolve();await app.close();}
});
