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
    const value=response(calls.length);
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

test('the local model-access endpoint checks the exact selection and returns its availability',async()=>{
  let received;
  const app=await startLocalServer({port:0,openBrowser:false,providers:{checkModel:async(provider,selection)=>{
    received={provider,...selection};return {available:true,message:'The selected model responded.'};
  }}});
  try{
    const res=await fetch(app.url+'/api/check-model',{method:'POST',headers:{Origin:app.url,'Content-Type':'application/json'},body:JSON.stringify(sol)});
    assert.equal(res.status,200,'The selected-model check endpoint must exist');
    assert.deepEqual(await res.json(),{available:true,message:'The selected model responded.'});assert.deepEqual(received,sol);
    assert.equal((await(await fetch(app.url+'/api/health')).json()).version,'0.3.7');
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

test('quota, timeout, helper disconnect and malformed responses stay retryable through the actual adapter',async()=>{
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
    if(bad.processResult?.stderr.includes('quota'))assert.match(failed.message,/usage limit/);
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
    const temporary=await post();assert.equal(temporary.status,200);const pending=await temporary.json();assert.equal(pending.available,false);assert.equal(pending.retryable,true);assert.match(pending.message,/usage limit/);
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
