import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createServer, request } from 'node:http';
import { spawn } from 'node:child_process';
import { createProviderManager, subscriptionEnvironment, inferenceArguments, runProcess } from '../src/providers.js';
import { startLocalServer } from '../src/local-server.js';
import { interviewPrompt, interview } from '../src/interview.js';
import { freshProject } from '../src/product.js';

const fakeCli={file:process.execPath,prefix:['unmodified-vendor-cli.js']};
const reply=()=>({message:'What happened in the last real situation where you helped someone?',stageReady:false,summary:'More concrete experience is needed.',brief:freshProject().brief});
const payload=()=>({provider:'chatgpt',interviewStage:1,messages:[{role:'user',content:'I know marketing and want to help everyone.'}],brief:freshProject().brief,notes:[]});
const appProviders={status:async id=>({provider:id,installed:true,ready:true,message:'Connected'}),login:async id=>({provider:id,started:true}),infer:async()=>reply()};

test('subscription child environment removes API/cloud credentials and auto-connected cloud MCP',()=>{
  const env=subscriptionEnvironment({PATH:'bin',OPENAI_API_KEY:'do-not-send',CODEX_API_KEY:'do-not-send',OPENAI_BASE_URL:'https://other.example',ANTHROPIC_API_KEY:'do-not-send',ANTHROPIC_AUTH_TOKEN:'do-not-send',CLAUDE_CODE_OAUTH_TOKEN:'do-not-send',CLAUDE_CODE_USE_VERTEX:'1',ENABLE_CLAUDEAI_MCP_SERVERS:'true',HOME:'kept-for-vendor-login'});
  assert.equal(env.OPENAI_API_KEY,undefined);assert.equal(env.ANTHROPIC_API_KEY,undefined);assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN,undefined);assert.equal(env.CLAUDE_CODE_USE_VERTEX,undefined);
  assert.equal(env.ENABLE_CLAUDEAI_MCP_SERVERS,'false');assert.equal(env.HOME,'kept-for-vendor-login');
});
test('provider status accepts subscriptions and refuses API-key billing',async()=>{
  const make=(stdout,stderr='',code=0)=>createProviderManager({resolveCli:()=>fakeCli,execute:async()=>({stdout,stderr,code})});
  assert.equal((await make('','Logged in using ChatGPT').status('chatgpt')).ready,true);
  assert.equal((await make('Logged in using an API key').status('chatgpt')).ready,false);
  assert.equal((await make(JSON.stringify({loggedIn:true,authMethod:'claude.ai'})).status('claude')).ready,true);
  assert.equal((await make(JSON.stringify({loggedIn:true,authMethod:'api_key'})).status('claude')).ready,false);
  assert.equal((await createProviderManager({resolveCli:()=>null}).status('claude')).installed,false);
  await assert.rejects(make('').status('other'),/Choose ChatGPT or Claude/);
});
test('vendor invocations restrict tools/configuration and keep prompt out of command arguments',async()=>{
  const args=inferenceArguments('chatgpt',{schemaPath:'schema.json',outputPath:'response.json'});
  assert.ok(args.includes('--ignore-user-config'));assert.ok(args.includes('--ephemeral'));assert.ok(!args.includes('--search'));
  assert.ok(inferenceArguments('chatgpt',{search:true}).includes('--search'));
  const claude=inferenceArguments('claude',{schemaPath:'{}'});
  assert.equal(claude[claude.indexOf('--tools')+1],'');assert.ok(claude.includes('--strict-mcp-config'));assert.ok(claude.includes('--no-chrome'));assert.ok(claude.includes('--restricted'));assert.ok(claude.includes('--safe-mode'));
  const calls=[];
  const manager=createProviderManager({resolveCli:()=>fakeCli,execute:async(command,received,options)=>{
    calls.push({command,args:received,options});
    if(received[0]==='login')return {code:0,stdout:'Logged in using ChatGPT',stderr:''};
    assert.equal(options.input,'Private creator context');assert.ok(!received.includes(options.input));
    await writeFile(received[received.indexOf('--output-last-message')+1],JSON.stringify(reply()));
    return {code:0,stdout:'',stderr:''};
  }});
  assert.deepEqual(await manager.infer('chatgpt','Private creator context',{}),reply());
  const directory=calls[1].options.cwd;
  await assert.rejects(readFile(join(directory,'response.json')),/ENOENT/);
});
test('Claude structured result is parsed without any account token handling',async()=>{
  const manager=createProviderManager({resolveCli:()=>fakeCli,execute:async(_,args)=>args[0]==='auth'?{code:0,stdout:'{"loggedIn":true,"authMethod":"claude.ai"}',stderr:''}:{code:0,stdout:JSON.stringify({structured_output:reply()}),stderr:''}});
  assert.deepEqual(await manager.infer('claude','A bounded interview',{}),reply());
});
test('process runner uses argv/stdin and hides windows without a shell',async()=>{
  let options,args,input='';
  const spawnFn=(_,received,opts)=>{
    args=received;options=opts;const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>{};
    child.stdin.on('data',v=>input+=v.toString());child.stdin.on('finish',()=>{child.stdout.write('done');child.emit('close',0);});return child;
  };
  const value=await runProcess(fakeCli,['-p'],{input:'Only stdin contains the prompt',spawnFn});
  assert.equal(value.stdout,'done');assert.equal(input,'Only stdin contains the prompt');assert.equal(options.shell,false);assert.equal(options.windowsHide,true);assert.deepEqual(args,['unmodified-vendor-cli.js','-p']);
});
function controlledProcess(){
  const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.signals=[];child.kill=signal=>{child.signals.push(signal);return true;};return child;
}
test('timeout and output-limit responses remain pending until the owned child closes',async()=>{
  for(const reason of ['timeout','output']){
    const child=controlledProcess();let settled=false;
    const pending=runProcess(fakeCli,['-p'],{spawnFn:()=>child,timeout:reason==='timeout'?2:1000,maxOutput:8,terminationGrace:100,terminationTimeout:1000});
    pending.then(()=>{settled=true;},()=>{settled=true;});
    if(reason==='output')child.stdout.write('more than eight bytes');
    await new Promise(resolve=>setTimeout(resolve,15));
    assert.ok(child.signals.length>0);assert.equal(settled,false,'termination request alone is not proof of exit');
    child.emit('close',143);
    await assert.rejects(pending,reason==='timeout'?/took too long/:/too large/);
  }
});
test('unconfirmed termination keeps inference locked and its workspace intact until close',async()=>{
  const child=controlledProcess();let directory,modelCalls=0;
  const manager=createProviderManager({resolveCli:()=>fakeCli,execute:async(command,args,options)=>{
    if(args[0]==='login')return {code:0,stdout:'Logged in using ChatGPT',stderr:''};
    modelCalls++;directory=options.cwd;
    if(modelCalls===1)return runProcess(command,args,{...options,spawnFn:()=>child,timeout:2,terminationGrace:5,terminationTimeout:20});
    await writeFile(args[args.indexOf('--output-last-message')+1],JSON.stringify(reply()));return {code:0,stdout:'',stderr:''};
  }});
  await assert.rejects(manager.infer('chatgpt','A bounded request',{}),/did not confirm that it stopped/);
  assert.ok(await readFile(join(directory,'schema.json'),'utf8'),'the still-owned workspace is preserved');
  await assert.rejects(manager.infer('chatgpt','Do not launch a second request',{}),/did not confirm that it stopped/);
  assert.equal(modelCalls,1);
  const heldDirectory=directory;child.emit('close',143);
  let removed=false;
  for(let i=0;i<50;i++){
    try{await readFile(join(heldDirectory,'schema.json'));}catch(error){if(error.code==='ENOENT'){removed=true;break;}throw error;}
    await new Promise(resolve=>setTimeout(resolve,5));
  }
  assert.equal(removed,true,'workspace cleanup waits for confirmed exit');
  assert.deepEqual(await manager.infer('chatgpt','A fresh request after exit',{}),reply());assert.equal(modelCalls,2);
});
test('a real owned background process exits before its timeout response is released',async()=>{
  let child;
  try{
    await assert.rejects(runProcess({file:process.execPath,prefix:[],native:true},['-e','setInterval(()=>{},1000)'],{
      timeout:100,terminationGrace:50,terminationTimeout:3000,
      spawnFn:(file,args,options)=>(child=spawn(file,args,options))
    }),/took too long/);
    assert.ok(child.exitCode!==null||child.signalCode!==null,'the actual process exit is confirmed');
  }finally{
    // This fixture has no descendants; preserve cleanup if the OS denies tree termination.
    if(child&&child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
  }
});
test('login starts only explicit vendor sign-in and reuses an ongoing attempt',async()=>{
  let calls=0,received;
  const manager=createProviderManager({resolveCli:()=>fakeCli,spawnFn:(file,args,opts)=>{calls++;received={file,args,opts};const child=new EventEmitter();child.kill=()=>{};return child;}});
  assert.equal((await manager.login('claude')).started,true);await manager.login('claude');
  assert.equal(calls,1);assert.deepEqual(received.args,['unmodified-vendor-cli.js','auth','login']);assert.equal(received.opts.shell,false);assert.equal(received.opts.windowsHide,true);
});
test('interview uses real skills, preserves context and prevents invented market readiness',async()=>{
  const p=payload();const built=interviewPrompt(p);
  assert.match(built.prompt,/name: creator-interview/);assert.doesNotMatch(built.prompt,/Ask one focused question/);assert.match(built.prompt,/INSIDE this application/);assert.match(built.prompt,/I know marketing/);
  p.interviewStage=5;const result=await interview(p,{infer:async(_,prompt,schema,options)=>{assert.equal(options.search,true);return {...reply(),stageReady:true};}});
  assert.equal(result.stageReady,false);assert.match(result.message,/unverified/);
  p.interviewStage=13;assert.throws(()=>interviewPrompt(p));
});
test('real local HTTP server protects host/origin, serves only public files, and supports interview/export/download',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'product-studio-test-'));
  await mkdir(join(directory,'public'));await writeFile(join(directory,'public','index.html'),'<h1>Product Studio</h1>');await writeFile(join(directory,'public','app.js'),'// public app');
  const testExporter=async()=>({pages:2,files:[['book.pdf','application/pdf'],['book.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],['book-canva.pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation'],['book.md','text/markdown'],['book-project.json','application/json']].map(([name,mimeType])=>({name,mimeType,blob:Buffer.from('actual-test-file-bytes').toString('base64')}))});
  const app=await startLocalServer({port:0,openBrowser:false,providers:appProviders,publicDirectory:pathToFileURL(join(directory,'public')+'/'),exporter:testExporter});
  const post=(path,body,origin=app.url)=>fetch(app.url+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  try{
    assert.match(await(await fetch(app.url+'/')).text(),/Product Studio/);
    assert.equal((await fetch(app.url+'/src/providers.js')).status,404);assert.equal((await fetch(app.url+'/.env')).status,404);
    assert.equal((await fetch(app.url+'/api/status?provider=claude')).status,200);
    assert.equal((await post('/api/interview',payload(),'https://foreign.example')).status,403);
    assert.equal((await fetch(app.url+'/api/interview',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
    const badHost=await new Promise((resolve,reject)=>{const req=request(app.url+'/api/health',{headers:{Host:'foreign.example'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});
    assert.equal(badHost,403);
    assert.equal((await post('/api/login',{provider:'claude'})).status,200);
    assert.equal((await post('/api/interview',payload())).status,200);
    assert.equal((await post('/api/export-product',{brief:freshProject().brief,reviewed:false})).status,400);
    const exported=await(await post('/api/export-product',{brief:freshProject().brief,reviewed:true})).json();
    assert.equal(exported.pages,2);
    const download=await fetch(app.url+exported.files.pdf.url);assert.equal(await download.text(),'actual-test-file-bytes');assert.match(download.headers.get('content-disposition'),/attachment/);
    const archive=Buffer.from(await(await fetch(app.url+exported.files.zip.url)).arrayBuffer());assert.equal(archive.subarray(0,2).toString(),'PK');
    assert.equal((await post('/api/interview',{huge:'x'.repeat(4000000)})).status,413);
  }finally{await app.close();await rm(directory,{recursive:true,force:true});}
});
test('a second launch reuses only Product Studio; another app on the port gets a free next port',async()=>{
  const one=await startLocalServer({port:0,openBrowser:false,providers:appProviders});
  let two;
  try{two=await startLocalServer({port:Number(new URL(one.url).port),openBrowser:false,providers:appProviders});assert.equal(two.reused,true);assert.equal(two.url,one.url);}finally{if(two&&!two.reused)await two.close();await one.close();}
  const other=createServer((_,res)=>res.end('Some other app'));
  await new Promise(resolve=>other.listen(0,'127.0.0.1',resolve));
  const port=other.address().port;let app;
  try{app=await startLocalServer({port,openBrowser:false,providers:appProviders});assert.notEqual(Number(new URL(app.url).port),port);assert.equal(app.reused,false);}finally{if(app)await app.close();await new Promise(resolve=>other.close(resolve));}
});
