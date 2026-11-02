import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {freshProject} from '../src/product.js';
const module=await import('../src/canva-producer.js').catch(()=>({}));
const brief={...freshProject().brief,title:'A useful handoff',format:'Webinar',productDraft:'## Choose the next task\n\nAsk the recipient which approved file they need to change this week, then demonstrate that one task.\n\n### Presenter notes\n\nExplain the actual task before showing the file.'};
const payload=()=>({brief:{...brief},approvedSource:brief.productDraft,concept:{id:'editorial',version:1,title:'Editorial',styleNotes:'Serif editorial'},provider:'chatgpt',model:'gpt-6.1-sol',reasoningEffort:'medium',preauthorizeDraft:false});
const expectedPages=[{title:'A useful handoff',visibleText:'A useful handoff',notes:''},{title:'Choose the next task',visibleText:'Ask the recipient which approved file they need to change this week, then demonstrate that one task.',notes:'Explain the actual task before showing the file.'}];
const renderer=()=>({html:'<!doctype html><html><body><section data-document-role="page" data-label="A useful handoff">A useful handoff</section><section data-document-role="page" data-label="Choose the next task" data-speaker-notes="Explain the actual task before showing the file.">Ask the recipient which approved file they need to change this week, then demonstrate that one task.</section></body></html>',pages:expectedPages});
const connected={status:async()=>({installed:true,ready:true,busy:false}),checkModel:async()=>({available:true,message:'Exact selection confirmed.'})};
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
async function finished(producer,id){for(let i=0;i<150;i++){const value=producer.status(id);if(!['running','approval'].includes(value.status))return value;await tick();}throw Error('Controlled job did not finish');}

test('the new local Canva route accepts selected concept + exact approved source without exposing source files',async t=>{
  const {createLocalHandler}=await import('../src/local-server.js');
  let received;
  const canvaProducer={busy:false,start:async body=>{received=body;return {id:'opaque-job',status:'running',message:'Creating Canva sample'};},recheck:async body=>({id:'existing-job',status:'running',message:body.designId}),status:id=>({id,status:'approval',message:'Review the normal Canva approval'}),approve:async()=>({id:'opaque-job',status:'running',message:'Continuing'})};
  const server=createServer(createLocalHandler({canvaProducer}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}`;
  const post=(path,body,origin=url)=>fetch(url+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const response=await post('/api/create-canva',payload());assert.equal(response.status,200,'A real production route is required');assert.equal((await response.json()).status,'running');assert.deepEqual(received,payload());
  assert.equal((await(await fetch(url+'/api/canva-production/opaque-job')).json()).status,'approval');
  assert.equal((await post('/api/canva-production/opaque-job/approval',{approvalId:'one',action:'accept'})).status,200);
  assert.equal((await(await post('/api/recheck-canva',{...payload(),designId:'DAHexample'})).json()).id,'existing-job');
  assert.equal((await post('/api/create-canva',payload(),'https://foreign.example')).status,403);
  assert.equal((await fetch(url+'/src/canva-producer.js')).status,404);
});

function nativeRecords({swapNotes=false,swapContent=false,count=2,url='https://www.canva.com/design/DAHexample/edit'}={}){
  const id='DAHexample';return [
    {tool:'canva.import-design-from-url',arguments:{},data:{design_id:id}},
    {tool:'canva.get-design',arguments:{design_id:id},data:{design:{id,title:'A useful handoff — Editorial sample',page_count:count,urls:{edit_url:url}}}},
    {tool:'canva.get-design-content',arguments:{design_id:id},data:{pages:expectedPages.map((page,index)=>({page_number:index+1,text:expectedPages[swapContent?1-index:index].visibleText}))}},
    {tool:'canva.get-presenter-notes',arguments:{design_id:id},data:{pages:expectedPages.map((page,index)=>({page_number:index+1,notes:expectedPages[swapNotes?1-index:index].notes}))}}
  ];
}
test('actual provider results, not model success claims, determine native Canva readiness',()=>{
  assert.equal(typeof module.createCanvaProducer,'function','A subscription-owned native producer is required');
  assert.equal(module.verifyCanvaResult([],expectedPages).verified,false,'a final model claim alone cannot prove completion');
  assert.equal(module.verifyCanvaResult(nativeRecords(),expectedPages).verified,true);
  for(const options of [{swapNotes:true},{swapContent:true},{count:1},{url:'https://www.canva.com/design/DAHexample/view'}])assert.equal(module.verifyCanvaResult(nativeRecords(options),expectedPages).verified,false,'every required native contract is checked');
});

test('an opaque import receipt can bind only to real matching native metadata and complete page-specific readback',()=>{
  const records=nativeRecords();records[0].data={import:{status:'complete'}};
  records[1].data.design.title='A useful handoff — Editorial sample';
  assert.equal(module.verifyCanvaResult(records,expectedPages,{expectedTitle:'A useful handoff — Editorial sample'}).verified,true);
  assert.equal(module.verifyCanvaResult(records,expectedPages,{expectedTitle:'Another sample'}).verified,false);
  records[3].data.pages[1].notes='Missing source notes';assert.equal(module.verifyCanvaResult(records,expectedPages,{expectedTitle:'A useful handoff — Editorial sample'}).verified,false);
  records[1].data={text:'The model claims DAHexample was created.'};assert.equal(module.verifyCanvaResult(records,expectedPages,{expectedTitle:'A useful handoff — Editorial sample'}).id,'');
});

test('per-page native reading order can vary while every approved block and duplicate occurrence remains required',()=>{
  const pages=[{title:'Compare',visibleText:'Compare Awareness Read the guide Ask about the guide Direct sales Pay for the guide Buy the guide Guide Guide',visibleBlocks:['Compare','Awareness','Read the guide','Ask about the guide','Direct sales','Pay for the guide','Buy the guide','Guide','Guide'],notes:'Explain the choices.'}];
  const records=[{tool:'canva.get-design',arguments:{design_id:'DAHcompare'},data:{design:{id:'DAHcompare',title:'Compare — Warm sample',page_count:1,urls:{edit_url:'https://www.canva.com/d/compare'}}}},{tool:'canva.get-design-content',arguments:{design_id:'DAHcompare',pages:[1]},data:{text:'Compare Awareness Ask about the guide Read the guide Direct sales Buy the guide Pay for the guide Guide Guide'}},{tool:'canva.get-presenter-notes',arguments:{design_id:'DAHcompare'},data:[{page_number:1,notes:'Explain the choices.'}]}];
  assert.equal(module.verifyCanvaReadback('DAHcompare',records,pages).verified,true);
  records[1].data.text=records[1].data.text.replace(/ Guide$/,'');assert.equal(module.verifyCanvaReadback('DAHcompare',records,pages).verified,false,'one occurrence cannot satisfy two approved repeated blocks');
});

test('only actual Canva edit URL forms are accepted, including returned short and tokenized links',()=>{
  for(const url of ['https://www.canva.com/d/abc123','https://www.canva.com/design/DAHexample/edit','https://www.canva.com/design/DAHexample/token/edit'])assert.equal(module.canvaEditUrl(url),url);
  for(const url of ['https://www.canva.com/design/DAHexample/view','https://canva.com.evil.example/d/a','javascript:alert(1)','https://user:password@www.canva.com/d/abc'])assert.equal(module.canvaEditUrl(url),null);
});

test('a completed MCP envelope containing a native error is never treated as successful import',()=>{
  assert.match(module.nativeToolError({status:'completed',result:{isError:true,content:[{type:'text',text:'This client cannot convert local design_file paths.'}]}}),/cannot convert local design_file/);
  assert.match(module.nativeToolError({status:'completed',result:{structuredContent:{result:{is_error:true,message:'Artifact upload is unavailable.'}}}}),/Artifact upload is unavailable/);
  assert.equal(module.nativeToolError({status:'completed',result:{structuredContent:{items:[{id:'real-design'}]}}}),null);
  const records=nativeRecords();records[0].data={items:[{id:'DAHexample'}]};records[1].data={items:[{id:'DAHexample',page_count:2,urls:{edit_url:'https://www.canva.com/design/DAHexample/token/edit'}}]};
  assert.equal(module.verifyCanvaResult(records,expectedPages).verified,true,'the actual items wrapper is supported without inventing a receipt');
});

test('native null-structuredContent, plain per-page richtext and raw note arrays verify without mixing pages or view links',async()=>{
  const records=nativeRecords();records[1].data={design:{id:'DAHexample',page_count:2,urls:{view_url:'https://www.canva.com/d/viewtoken',edit_url:'https://www.canva.com/d/edittoken'}}};
  records.splice(2,1,...expectedPages.map((page,index)=>({tool:'canva.get-design-content',arguments:{design_id:'DAHexample',pages:[index+1]},data:{content:[{type:'text',text:page.visibleText.replace(/ /g,'\n')}],structuredContent:null}})));
  records.at(-1).data=expectedPages.map((page,index)=>({page_number:index+1,notes:page.notes}));
  const result=module.verifyCanvaResult(records,expectedPages);assert.equal(result.verified,true);assert.equal(result.url,'https://www.canva.com/d/edittoken');
  [records[2].arguments.pages,records[3].arguments.pages]=[records[3].arguments.pages,records[2].arguments.pages];assert.equal(module.verifyCanvaResult(records,expectedPages).verified,false,'global presence does not prove correct page placement');
  [records[2].arguments.pages,records[3].arguments.pages]=[records[3].arguments.pages,records[2].arguments.pages];
  records[3].data={content:[{type:'text',text:'Native audience text is missing.'}],_meta:{cachedOriginalSource:expectedPages[1].visibleText}};
  assert.equal(module.verifyCanvaResult(records,expectedPages).verified,false,'metadata/original-source caches are not native audience readback');
});

test('the production adapter unwraps real null-structuredContent wire payloads before verified-ready',async()=>{
  const id='DAHwire',wire=(tool,args,value,plain=false)=>({tool,arguments:args,status:'completed',result:{structuredContent:null,isError:false,content:[{type:'text',text:plain?value:JSON.stringify(value)}]}});
  const producer=module.createCanvaProducer({providers:connected,renderer,createSession:options=>({run:async()=>{
    options.onTool(wire('canva.import-design-from-url',{}, {design_id:id}));
    options.onTool(wire('canva.get-design',{design_id:id},{design:{id,title:'A useful handoff — Editorial sample',page_count:2,urls:{view_url:'https://www.canva.com/d/view',edit_url:'https://www.canva.com/d/edit'}}}));
    for(const [index,page]of expectedPages.entries())options.onTool(wire('canva.get-design-content',{design_id:id,pages:[index+1]},page.visibleText,true));
    options.onTool(wire('canva.get-presenter-notes',{design_id:id},expectedPages.map((page,index)=>({page_number:index+1,notes:page.notes}))));
  }})});
  const result=await finished(producer,(await producer.start(payload())).id);assert.equal(result.status,'ready');assert.deepEqual(result.design,{id,url:'https://www.canva.com/d/edit'});
});

test('opaque native imports expose bounded receipt evidence and bind to actual matching metadata',async()=>{
  const records=nativeRecords();records[0].data={import:{status:'complete'}};
  const producer=module.createCanvaProducer({providers:connected,renderer,createSession:options=>({run:async()=>{
    for(const record of records)options.onTool({tool:record.tool,arguments:record.arguments,status:'completed',result:{content:[{type:'text',text:JSON.stringify(record.data)}],structuredContent:null,_meta:{secret:'not-public'}}});
  }})});
  const result=await finished(producer,(await producer.start(payload())).id);assert.equal(result.status,'ready');assert.equal(result.verification.receipt,'metadata-bound');assert.deepEqual(result.verification.receiptFields,['import','import.status']);
  assert.equal(result.diagnostics.nativeCalls.length,4);assert.doesNotMatch(JSON.stringify(result.diagnostics),/secret|not-public|Explain the actual task/);
  const unknown=module.createCanvaProducer({providers:connected,renderer,createSession:options=>({run:async()=>options.onTool({tool:'canva.import-design-from-url',arguments:{},status:'completed',result:{structuredContent:{import:{status:'complete'}}}})})});
  const partial=await finished(unknown,(await unknown.start(payload())).id);assert.equal(partial.status,'unavailable');assert.match(partial.message,/import receipt did not identify/);assert.equal(partial.verification.receipt,'opaque');assert.equal((await unknown.start(payload())).id,partial.id);
});

test('read-only recheck validates the exact existing design and seeds ordinary creation deduplication',async()=>{
  let launches=0,approvalRefused=false;
  const producer=module.createCanvaProducer({providers:connected,renderer,createSession:options=>({run:async prompt=>{
    launches++;assert.match(prompt,/READ ONLY recheck/);assert.match(prompt,/"DAHexample"/);assert.match(prompt,/Never create a replacement/);assert.match(prompt,/No approval or write is authorized/);
    approvalRefused=options.onApproval({id:77,params:{mode:'form',message:'Allow Canva to run tool "canva.import-design-from-url"?',_meta:{codex_approval_kind:'mcp_tool_call',tool_params:{design_file:join(options.cwd,'approved-sample.html'),intended_design_type:'presentation'}}}})===false;
    await assert.rejects(readFile(join(options.cwd,'approved-sample.html')),/ENOENT/,'readback creates no transfer source');
    for(const record of nativeRecords().slice(1))options.onTool({tool:record.tool,arguments:record.arguments,status:'completed',result:{structuredContent:record.data}});
  }})});
  await assert.rejects(producer.recheck({...payload(),designId:'https://www.canva.com/d/example'}),/exact existing Canva design ID/);
  const started=await producer.recheck({...payload(),designId:'DAHexample'}),result=await finished(producer,started.id);
  assert.equal(result.status,'ready');assert.equal(result.design.id,'DAHexample');assert.equal(result.verification.receipt,'existing-design-readback');assert.equal(approvalRefused,true);
  assert.equal((await producer.start(payload())).id,result.id);assert.equal(launches,1,'ordinary UI create returns the verified existing file without import');
});

function controlledSession({approve=false,records=nativeRecords(),error}={}){
  let resolveApproval,options,closed=false;const responses=[],gate=new Promise(resolve=>{resolveApproval=resolve;});
  const factory=received=>{options=received;return {processExit:Promise.resolve(),close:async()=>{closed=true;},respond:(id,result)=>{responses.push({id,result});resolveApproval(result.action);},run:async prompt=>{
    assert.match(prompt,/Do not rewrite, regenerate/);assert.match(await readFile(options.cwd+'/approved-sample.html','utf8'),/data-speaker-notes/);
    if(approve){assert.equal(options.onApproval({id:7,method:'mcpServer/elicitation/request',params:{mode:'form',message:'Allow Canva to run tool "canva.import-design-from-url"?',_meta:{codex_approval_kind:'mcp_tool_call',tool_title:'Import Design From Public HTTPS URL',tool_params:{design_file:join(options.cwd,'approved-sample.html'),intended_design_type:'presentation'}}}}),true);const action=await gate;if(action!=='accept')throw Error('The Canva import was declined.');}
    if(error)throw error;
    for(const record of records)options.onTool({tool:record.tool,arguments:record.arguments,status:'completed',result:{structuredContent:record.data}});
    closed=true;return {status:'completed',fakeModelClaim:{verified:true}};
  }};};return {factory,responses,get options(){return options;},get closed(){return closed;}};
}

test('the source gate, exact selected provider/model and normal single-call approval protect production',async()=>{
  const native=controlledSession({approve:true}),producer=module.createCanvaProducer({providers:connected,renderer,createSession:native.factory});
  await assert.rejects(producer.start({...payload(),approvedSource:'Older content'}),/Approve the current source/);
  assert.equal((await producer.start({...payload(),provider:'claude',model:'claude-sonnet-5-5'})).status,'unavailable');assert.equal(native.options,undefined);
  const started=await producer.start(payload());
  for(let i=0;i<100&&producer.status(started.id).status!=='approval';i++)await tick();
  const pending=producer.status(started.id);assert.equal(pending.status,'approval');assert.equal(producer.busy,true);
  await assert.rejects(producer.approve(started.id,{approvalId:'stale',action:'accept'}),/no longer pending/);
  await producer.approve(started.id,{approvalId:pending.approval.id,action:'accept'});
  const result=await finished(producer,started.id);assert.equal(result.status,'ready');assert.equal(native.responses.length,1);assert.deepEqual(native.responses[0],{id:7,result:{action:'accept',content:{}}});
  assert.equal(native.closed,true);assert.equal(producer.busy,false);await assert.rejects(readFile(native.options.cwd+'/approved-sample.html'),/ENOENT/);
  assert.equal((await producer.start(payload())).id,started.id,'double click cannot create another identical native sample');
});

test('available exact ChatGPT selections are checked before production and passed unchanged to its native session',async()=>{
  for(const selected of [{model:'gpt-6.1-sol',reasoningEffort:'high'},{model:'gpt-6.1-sol',reasoningEffort:'xhigh'},{model:'gpt-6-astra',reasoningEffort:'medium'},{model:'gpt-6-astra',reasoningEffort:'high'}]){
    const checks=[];let sessionOptions,checked=false;
    const producer=module.createCanvaProducer({providers:{...connected,checkModel:async(provider,options)=>{checks.push({provider,...options});checked=true;return {available:true};}},renderer:()=>{assert.equal(checked,true,'access is confirmed before preparing a transfer');return renderer();},createSession:options=>{sessionOptions=options;return {run:async()=>{for(const record of nativeRecords())options.onTool({tool:record.tool,arguments:record.arguments,status:'completed',result:{structuredContent:record.data}});}};}});
    const started=await producer.start({...payload(),...selected});assert.equal(started.status,'running');const result=await finished(producer,started.id);
    assert.equal(result.status,'ready');assert.deepEqual(checks,[{provider:'chatgpt',...selected}]);assert.equal(sessionOptions.model,selected.model);assert.equal(sessionOptions.reasoningEffort,selected.reasoningEffort);
  }
});

test('a genuinely unavailable exact selection stops before preparing or importing any Canva content',async()=>{
  let prepared=0,launched=0;const checks=[];
  const producer=module.createCanvaProducer({providers:{...connected,checkModel:async(provider,selected)=>{checks.push({provider,...selected});return {available:false,message:'This account cannot use gpt-6-astra at high quality.'};}},renderer:()=>{prepared++;return renderer();},createSession:()=>{launched++;throw Error('Do not launch production');}});
  const raw={...payload(),model:'gpt-6-astra',reasoningEffort:'high'},started=await producer.start(raw);assert.equal(started.status,'running');const result=await finished(producer,started.id);
  assert.equal(result.status,'unavailable');assert.match(result.message,/This account cannot use gpt-6-astra at high quality/);assert.deepEqual(checks,[{provider:'chatgpt',model:'gpt-6-astra',reasoningEffort:'high'}]);assert.equal(prepared,0);assert.equal(launched,0);assert.equal(raw.model,'gpt-6-astra');assert.equal(raw.reasoningEffort,'high');assert.equal(producer.busy,false);
});

test('production reuses the real provider access contract without treating its own job ownership as provider busy',async()=>{
  const {createProviderManager}=await import('../src/providers.js');let checks=0,producer;
  const providers=createProviderManager({resolveCli:()=>({file:'controlled-codex',prefix:[]}),execute:async(_cli,args)=>{
    if(args[0]==='login')return {code:0,stdout:'Logged in using ChatGPT',stderr:''};
    assert.equal(producer.busy,true);assert.equal(args[args.indexOf('--model')+1],'gpt-6-astra');assert.ok(args.includes('model_reasoning_effort="high"'));
    checks++;await writeFile(args[args.indexOf('--output-last-message')+1],'{"available":true}');return {code:0,stdout:'',stderr:''};
  }});
  producer=module.createCanvaProducer({providers,renderer,createSession:options=>({run:async()=>{for(const record of nativeRecords())options.onTool({tool:record.tool,arguments:record.arguments,status:'completed',result:{structuredContent:record.data}});}})});
  const result=await finished(producer,(await producer.start({...payload(),model:'gpt-6-astra',reasoningEffort:'high'})).id);assert.equal(result.status,'ready');assert.equal(checks,1);assert.equal((await providers.status('chatgpt')).busy,false);
});

test('terminal readiness waits for transfer cleanup under concurrent job completion',async()=>{
  await Promise.all(Array.from({length:12},async()=>{
    let complete,options;
    const producer=module.createCanvaProducer({providers:connected,renderer,createSession:received=>{options=received;return {run:()=>new Promise(resolve=>{complete=()=>{
      for(const record of nativeRecords())options.onTool({tool:record.tool,arguments:record.arguments,status:'completed',result:{structuredContent:record.data}});
      resolve({status:'completed'});
    };})};}});
    const started=await producer.start(payload());for(let i=0;i<100&&!complete;i++)await tick();assert.equal(typeof complete,'function');
    complete();await Promise.resolve();
    assert.equal(producer.status(started.id).status,'running','cleanup cannot expose a terminal result while ownership is held');
    assert.equal(producer.busy,true);
    const result=await finished(producer,started.id);assert.equal(result.status,'ready');assert.equal(producer.busy,false);
    await assert.rejects(readFile(join(options.cwd,'approved-sample.html')),/ENOENT/);
  }));
});

test('missing native notes or a readable provider error stays incomplete and preserves the approved source',async()=>{
  for(const native of [controlledSession({records:nativeRecords({swapNotes:true})}),controlledSession({records:[]})]){
    const producer=module.createCanvaProducer({providers:connected,renderer,createSession:native.factory}),raw=payload();const result=await finished(producer,(await producer.start(raw)).id);
    assert.equal(result.status,'unavailable');assert.equal(raw.brief.productDraft,brief.productDraft);assert.doesNotMatch(result.message,/were verified/);
    if(result.design){assert.equal(result.design.id,'DAHexample');assert.equal((await producer.start({...raw,brief:{...raw.brief,marketEvidence:'A new research note; same source and concept.'}})).id,result.id,'partial creation is retained instead of silently importing again');}
  }
  const native=controlledSession({error:Error('Local design_file conversion is not supported by this client.')});
  const producer=module.createCanvaProducer({providers:connected,renderer,createSession:native.factory});const result=await finished(producer,(await producer.start(payload())).id);assert.match(result.message,/design_file conversion is not supported/);
});

test('a helper disconnect after creation retains the actual editor link and cannot silently import another copy',async()=>{
  const producer=module.createCanvaProducer({providers:connected,renderer,createSession:options=>({run:async()=>{
    for(const record of nativeRecords().slice(0,2))options.onTool({tool:record.tool,arguments:record.arguments,status:'completed',result:{structuredContent:record.data}});
    throw Error('The helper disconnected before native notes readback.');
  }})});
  const result=await finished(producer,(await producer.start(payload())).id);
  assert.equal(result.status,'unavailable');assert.match(result.message,/disconnected/);
  assert.deepEqual(result.design,{id:'DAHexample',url:'https://www.canva.com/design/DAHexample/edit'});
  assert.equal((await producer.start(payload())).id,result.id,'unknown post-import verification is retained instead of repeating creation');
});

test('normal app-server production uses the exact isolated model and exposes approval instead of silently granting it',async()=>{
  const {createCanvaSession}=await import('../src/canva-session.js');
  const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>child.emit('close',0);
  const messages=[];let received,spawnArgs,spawnOptions,approval;
  const send=message=>child.stdout.write(JSON.stringify(message)+'\n');
  child.stdin.on('data',chunk=>{for(const line of chunk.toString().trim().split('\n')){
    const message=JSON.parse(line);messages.push(message);
    if(message.method==='initialize')send({id:message.id,result:{}});
    if(message.method==='thread/start')send({id:message.id,result:{thread:{id:'thread',ephemeral:true},model:'gpt-6.1-sol',approvalPolicy:'on-request',approvalsReviewer:'user'}});
    if(message.method==='turn/start'){send({id:message.id,result:{turn:{id:'turn'}}});setImmediate(()=>send({method:'mcpServer/elicitation/request',id:700,params:{mode:'form',message:'Allow the sample import?'}}));}
    if(message.id===700){send({method:'item/completed',params:{item:{type:'mcpToolCall',tool:'canva.import-design-from-url',status:'failed',error:{message:'Exact native importer error'}}}});send({method:'turn/completed',params:{turn:{id:'turn',status:'completed'}}});}
  }});child.stdin.on('finish',()=>child.emit('close',0));
  const session=createCanvaSession({cwd:'controlled-workspace',model:'gpt-6.1-sol',reasoningEffort:'medium',env:{OPENAI_API_KEY:'do-not-use',PATH:'retained'},resolveCli:()=>({file:'official-codex',prefix:[],native:true}),spawnFn:(file,args,options)=>{received=file;spawnArgs=args;spawnOptions=options;return child;},onApproval:request=>{approval=request;return true;},onTool:item=>{assert.equal(item.error.message,'Exact native importer error');}});
  let settled=false;const pending=session.run('Only the approved sample.');pending.then(()=>{settled=true;},()=>{settled=true;});
  for(let i=0;i<50&&!approval;i++)await tick();assert.equal(approval.id,700);assert.equal(settled,false);assert.equal(messages.some(message=>message.id===700),false,'no approval is synthesized');
  session.respond(700,{action:'accept',content:{}});await pending;
  assert.equal(received,'official-codex');assert.ok(spawnArgs.includes('app-server'));assert.ok(!spawnArgs.includes('exec'));assert.ok(spawnArgs.includes('apps'));assert.ok(!spawnArgs.some(arg=>/approval.*approve|dangerously/.test(arg)));
  assert.equal(spawnOptions.shell,false);assert.equal(spawnOptions.windowsHide,true);assert.equal(spawnOptions.env.OPENAI_API_KEY,undefined);
  const thread=messages.find(message=>message.method==='thread/start').params,turn=messages.find(message=>message.method==='turn/start').params;
  assert.equal(thread.model,'gpt-6.1-sol');assert.equal(thread.config.model_reasoning_effort,'medium');assert.equal(thread.approvalPolicy,'on-request');assert.equal(thread.approvalsReviewer,'user');assert.equal(thread.ephemeral,true);assert.equal(thread.allowProviderModelFallback,false);assert.equal(turn.model,'gpt-6.1-sol');assert.equal(turn.effort,'medium');
  assert.deepEqual(messages.find(message=>message.id===700),{id:700,result:{action:'accept',content:{}}});
});

test('each supported exact production selection reaches both official app-server requests without fallback',async()=>{
  const {createCanvaSession}=await import('../src/canva-session.js');
  for(const selected of [{model:'gpt-6.1-sol',reasoningEffort:'high'},{model:'gpt-6.1-sol',reasoningEffort:'xhigh'},{model:'gpt-6-astra',reasoningEffort:'medium'},{model:'gpt-6-astra',reasoningEffort:'high'}]){
    const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>child.emit('close',0);const messages=[];
    const send=message=>child.stdout.write(JSON.stringify(message)+'\n');
    child.stdin.on('data',chunk=>{for(const line of chunk.toString().trim().split('\n')){
      const message=JSON.parse(line);messages.push(message);
      if(message.method==='initialize')send({id:message.id,result:{}});
      if(message.method==='thread/start')send({id:message.id,result:{thread:{id:'thread'},model:message.params.model,approvalPolicy:'on-request',approvalsReviewer:'user'}});
      if(message.method==='turn/start'){send({id:message.id,result:{turn:{id:'turn'}}});setImmediate(()=>send({method:'turn/completed',params:{turn:{id:'turn',status:'completed'}}}));}
    }});child.stdin.on('finish',()=>child.emit('close',0));
    const session=createCanvaSession({cwd:'controlled-workspace',...selected,resolveCli:()=>({file:'official-codex',prefix:[]}),spawnFn:()=>child,onApproval:()=>false,onTool:()=>{}});await session.run('Only the selected approved sample.');
    const thread=messages.find(message=>message.method==='thread/start').params,turn=messages.find(message=>message.method==='turn/start').params;
    assert.equal(thread.model,selected.model);assert.equal(thread.config.model_reasoning_effort,selected.reasoningEffort);assert.equal(thread.allowProviderModelFallback,false);assert.equal(turn.model,selected.model);assert.equal(turn.effort,selected.reasoningEffort);
  }
});

test('an unconfirmed helper exit keeps production busy and its transfer file owned until actual close',async()=>{
  let resolveExit,options;const processExit=new Promise(resolve=>{resolveExit=resolve;});
  const producer=module.createCanvaProducer({providers:connected,renderer,createSession:received=>{options=received;return {processExit,run:async()=>{const error=Object.assign(Error('Owned helper exit is unconfirmed.'),{unconfirmedTermination:true,processExit});throw error;}};}});
  const started=await producer.start(payload());for(let i=0;i<100&&!producer.status(started.id).message.includes('unconfirmed');i++)await tick();
  const pending=producer.status(started.id);assert.equal(pending.status,'running');assert.match(pending.message,/unconfirmed/);assert.equal(producer.busy,true);assert.match(await readFile(join(options.cwd,'approved-sample.html'),'utf8'),/data-document-role/);
  await assert.rejects(producer.start({...payload(),brief:{...brief,title:'Another project'}}),error=>error.statusCode===409);
  resolveExit();const result=await finished(producer,started.id);assert.equal(result.status,'unavailable');assert.equal(producer.busy,false);await assert.rejects(readFile(join(options.cwd,'approved-sample.html')),/ENOENT/);
});

test('a stalled initialization is bounded and closes only its own helper before rejecting',async()=>{
  const {createCanvaSession}=await import('../src/canva-session.js');
  const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();let closed=false;
  child.stdin.on('finish',()=>{closed=true;child.emit('close',0);});child.kill=()=>child.emit('close',0);
  const session=createCanvaSession({cwd:'controlled-workspace',model:'gpt-6.1-sol',reasoningEffort:'medium',timeout:20,resolveCli:()=>({file:'official-codex',prefix:[]}),spawnFn:()=>child,onApproval:()=>false,onTool:()=>{}});
  const outcome=await Promise.race([session.run('Only the approved sample.').then(()=>null,error=>error),new Promise(resolve=>setTimeout(()=>resolve(Error('test boundary: initialization remained pending')),120))]);
  assert.match(outcome.message,/production timed out/i);assert.equal(closed,true);
});

test('genuine human approvals pause the helper clock and execution is bounded again after the response',async()=>{
  const {createCanvaSession}=await import('../src/canva-session.js');
  for(const dynamic of [false,true]){
    const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>child.emit('close',0);let approval,settled=false;
    const send=message=>child.stdout.write(JSON.stringify(message)+'\n');
    child.stdin.on('data',chunk=>{for(const line of chunk.toString().trim().split('\n')){const message=JSON.parse(line);
      if(message.method==='initialize')send({id:message.id,result:{}});
      if(message.method==='thread/start')send({id:message.id,result:{thread:{id:'thread'},model:'gpt-6.1-sol',approvalPolicy:'on-request',approvalsReviewer:'user'}});
      if(message.method==='turn/start'){send({id:message.id,result:{turn:{id:'turn'}}});send(dynamic?{id:77,method:'item/tool/call',params:{tool:'approve_canva_artwork',arguments:{transaction_id:'native'}}}:{id:77,method:'mcpServer/elicitation/request',params:{mode:'form',message:'Allow this one approved image?'}});}
      if(message.id===77&&!dynamic)send({method:'turn/completed',params:{turn:{id:'turn',status:'completed'}}});
    }});child.stdin.on('finish',()=>child.emit('close',0));
    const session=createCanvaSession({cwd:'controlled-workspace',model:'gpt-6.1-sol',reasoningEffort:'medium',timeout:30,resolveCli:()=>({file:'controlled-helper',prefix:[]}),spawnFn:()=>child,onTool:()=>{},onApproval:message=>{approval=message;return true;},onClientRequest:async message=>{approval=message;return true;}});
    const pending=session.run('Only the approved sample.');pending.then(()=>{settled=true;},()=>{settled=true;});for(let i=0;i<30&&!approval;i++)await tick();assert.equal(approval.id,77);
    await new Promise(resolve=>setTimeout(resolve,80));assert.equal(settled,false,'human response time is not execution time');
    session.respond(77,dynamic?{success:true,contentItems:[{type:'inputText',text:'approved'}]}:{action:'accept',content:{}});
    if(dynamic)await assert.rejects(pending,/production timed out/,'a stalled actual operation remains bounded after approval');else await pending;
  }
});

test('active production blocks other model starts and serves only the public concept assets',async t=>{
  const {createLocalHandler}=await import('../src/local-server.js');
  const server=createServer(createLocalHandler({canvaProducer:{busy:true},providers:{infer(){throw Error('Do not invoke interview');},login(){throw Error('Do not change login');}}}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}`;
  for(const path of ['/api/interview','/api/check-model','/api/login']){
    const response=await fetch(url+path,{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,409);
  }
  for(const path of ['/design-concepts.js','/design-concepts.css','/assets/fonts/DMSans.ttf'])assert.equal((await fetch(url+path)).status,200);
  assert.equal((await fetch(url+'/assets/../src/providers.js')).status,404);assert.equal((await fetch(url+'/assets/.env')).status,404);
});
