import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { modelOptions } from './models.js';

const ROOT=dirname(dirname(fileURLToPath(import.meta.url)));
const PROVIDERS=new Set(['chatgpt','claude']);
const label=id=>id==='claude'?'Claude':'ChatGPT';
export function providerId(value='chatgpt'){
  if(!PROVIDERS.has(value))throw new Error('Choose ChatGPT or Claude.');
  return value;
}

// Use the vendor's own CLI and credential storage. Product Studio never reads tokens.
export function subscriptionEnvironment(source=process.env){
  const env={...source};
  for(const key of Object.keys(env))if(/^(OPENAI_API_KEY|CODEX_API_KEY|OPENAI_BASE_URL|OPENAI_API_BASE|ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|ANTHROPIC_BASE_URL|CLAUDE_CODE_OAUTH_TOKEN|CLAUDE_CODE_USE_BEDROCK|CLAUDE_CODE_USE_VERTEX|CLAUDE_CODE_USE_FOUNDRY|AWS_BEARER_TOKEN_BEDROCK|GOOGLE_APPLICATION_CREDENTIALS)$/i.test(key))delete env[key];
  env.CLAUDE_CODE_SKIP_PROMPT_HISTORY='1';
  env.ENABLE_CLAUDEAI_MCP_SERVERS='false';
  return env;
}

function packageCommand(packageName,binName,env){
  const roots=[join(ROOT,'node_modules'),env.APPDATA&&join(env.APPDATA,'npm','node_modules'),join(dirname(process.execPath),'node_modules'),join(dirname(dirname(process.execPath)),'lib','node_modules'),'/usr/local/lib/node_modules','/opt/homebrew/lib/node_modules'].filter(Boolean);
  for(const root of roots){
    const directory=join(root,packageName),manifest=join(directory,'package.json');
    try{
      const pkg=JSON.parse(readFileSync(manifest,'utf8'));
      if(packageName==='@openai/codex'&&['x64','arm64'].includes(process.arch)){
        const target={win32:`${process.arch==='x64'?'x86_64':'aarch64'}-pc-windows-msvc`,darwin:`${process.arch==='x64'?'x86_64':'aarch64'}-apple-darwin`,linux:`${process.arch==='x64'?'x86_64':'aarch64'}-unknown-linux-musl`}[process.platform];
        if(target){
          let vendor=join(directory,'vendor');
          try{vendor=join(dirname(createRequire(manifest).resolve(`@openai/codex-${process.platform}-${process.arch}/package.json`)),'vendor');}catch{}
          const native=join(vendor,target,'bin',process.platform==='win32'?'codex.exe':'codex');
          if(existsSync(native))return {file:native,prefix:[],native:true};
        }
      }
      const relative=typeof pkg.bin==='string'?pkg.bin:pkg.bin?.[binName];
      if(relative&&existsSync(join(directory,relative))){
        const binary=join(directory,relative);
        return /\.(?:c?js|mjs)$/i.test(relative)?{file:process.execPath,prefix:[binary],native:false}:{file:binary,prefix:[],native:true};
      }
    }catch{}
  }
  return null;
}
export function resolveVendorCli(id,env=process.env){
  providerId(id);
  const name=id==='claude'?'claude':'codex';
  const packaged=packageCommand(id==='claude'?'@anthropic-ai/claude-code':'@openai/codex',name,env);
  if(packaged)return packaged;
  // Executables and POSIX shebangs can be spawned without a shell. Never run .cmd/.ps1 strings.
  for(const directory of (env.PATH||'').split(delimiter).filter(Boolean)){
    const file=join(directory,name+(process.platform==='win32'?'.exe':''));
    if(existsSync(file))return {file,prefix:[],native:true};
  }
  return null;
}

function terminateOwnedProcess(child,command,force){
  if(!Number.isInteger(child.pid)||child.pid<=0){child.kill(force?'SIGKILL':'SIGTERM');return;}
  if(process.platform==='win32'){
    // The normal packaged adapters resolve the actual native CLI. Its owned
    // process handle can be stopped without enumerating any other processes.
    if(command.native===true){child.kill(force?'SIGKILL':'SIGTERM');return;}
    // Windows does not deliver graceful POSIX signals. Kill only this spawned
    // process tree, including an official CLI wrapper's native child.
    const taskkill=join(process.env.SystemRoot||'C:\\Windows','System32','taskkill.exe');
    const killer=spawn(taskkill,['/PID',String(child.pid),'/T','/F'],{windowsHide:true,shell:false,stdio:'ignore'});
    killer.on('error',()=>{});
  }else{
    // runProcess creates a separate POSIX process group for its own CLI tree.
    try{process.kill(-child.pid,force?'SIGKILL':'SIGTERM');}catch{}
  }
}

export function runProcess(command,args,{input='',cwd,env,timeout=30000,maxOutput=2000000,spawnFn=spawn,terminationGrace=1500,terminationTimeout=8000}={}){
  return new Promise((resolve,reject)=>{
    let child,stdout='',stderr='',size=0,settled=false,terminationError,closed=false;
    let timer,forceTimer,stuckTimer,confirmExit;
    const processExit=new Promise(resolveExit=>{confirmExit=resolveExit;});
    const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(forceTimer);clearTimeout(stuckTimer);error?reject(error):resolve(result);};
    const terminate=error=>{
      if(terminationError||closed)return;
      terminationError=error;clearTimeout(timer);
      try{terminateOwnedProcess(child,command,false);}catch{}
      if(process.platform!=='win32')forceTimer=setTimeout(()=>{if(!closed)try{terminateOwnedProcess(child,command,true);}catch{};},terminationGrace);
      stuckTimer=setTimeout(()=>{
        if(closed)return;
        const error=new Error('The AI helper did not confirm that it stopped. No new request will start. Wait; if it stays stuck, close Product Studio and its AI helper before reopening.');
        error.unconfirmedTermination=true;error.processExit=processExit;
        finish(error);
      },terminationTimeout);
    };
    try{child=spawnFn(command.file,[...command.prefix,...args],{cwd,env,windowsHide:true,shell:false,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe']});}
    catch{reject(new Error('The local AI helper could not start. Restart Product Studio and try again.'));return;}
    timer=setTimeout(()=>terminate(new Error('The AI took too long. Your conversation is still saved; try a smaller request.')),timeout);
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    const collect=which=>chunk=>{if(terminationError)return;size+=Buffer.byteLength(chunk);if(size>maxOutput){terminate(new Error('The AI response was too large. Your draft is unchanged.'));return;}if(which==='out')stdout+=chunk;else stderr+=chunk;};
    child.stdout.on('data',collect('out'));child.stderr.on('data',collect('err'));
    child.on('error',()=>{
      const error=new Error('The local AI helper could not start. Restart Product Studio and try again.');
      if(!child.pid){closed=true;confirmExit();finish(error);}else terminate(error);
    });
    child.on('close',code=>{closed=true;confirmExit();finish(terminationError,{code,stdout,stderr});});
    child.stdin.on('error',()=>{});child.stdin.end(input);
  });
}

const failureCodes={
  usage_cap:['usage_limit_reached','usage_limit_exceeded','insufficient_quota','quota_exceeded','subscription_usage_limit_reached'],
  rate_limit:['rate_limit_exceeded','rate_limit_error','too_many_requests'],
  context_limit:['context_length_exceeded','context_window_exceeded','prompt_too_long','input_too_long'],
  request_limit:['request_too_large','payload_too_large','input_size_exceeded','error_max_turns','max_turns_exceeded'],
  output_limit:['max_output_tokens_exceeded','output_limit_exceeded','response_too_large','max_tokens_exceeded'],
  model:['model_not_found','invalid_model','unsupported_model','model_not_supported','unsupported_reasoning_effort','invalid_reasoning_effort'],
  authentication:['authentication_error','invalid_api_key','unauthorized','not_authenticated','token_expired'],
  runtime:['server_error','internal_server_error','service_unavailable','overloaded_error','connection_error','stream_error','econnreset','epipe','eacces']
};
const categoryForCode=code=>Object.keys(failureCodes).find(category=>failureCodes[category].includes(String(code||'').toLowerCase()));
function withoutRequest(text,{prompt='',input=''}={}){
  let clean=String(text||'').replace(/\r\n/g,'\n');
  // Codex's human CLI output may echo the entire private prompt. Never use that
  // text, its JSON fields, or supplied quotations as provider error evidence.
  for(const value of new Set([prompt,input].filter(Boolean).map(value=>String(value).replace(/\r\n/g,'\n')))){
    if(value.includes('\n')||value.length>=80)for(const literal of [value,JSON.stringify(value)])clean=clean.split(literal).join('[request omitted]');
    else clean=clean.split('\n').map(line=>line===value?'[request omitted]':line).join('\n');
  }
  return clean;
}
function errorRecord(value,fallback={}){
  const extra=Object.fromEntries(Object.entries(fallback).filter(([,item])=>item!==undefined));
  if(typeof value==='string')return {message:value.slice(0,8000),...extra};
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  return {message:typeof value.message==='string'?value.message.slice(0,8000):'',code:value.code,type:value.type,status:value.status??value.status_code??value.http_status,...extra};
}
function structuredErrors(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return [];
  if(['error','turn.failed'].includes(value.type))return [errorRecord(value.error||value,{status:value.status??value.status_code??value.error?.status,code:value.error?.code??value.code,type:value.error?.type??value.subtype})].filter(Boolean);
  if(value.type==='response.failed')return [errorRecord(value.response?.error)].filter(Boolean);
  if(value.is_error===true){const errors=[...(Array.isArray(value.errors)?value.errors.slice(-8):[]),...(value.error?[value.error]:[]),...(typeof value.result==='string'?[value.result]:[])];return (errors.length?errors:[{type:value.subtype,code:value.code}]).map(item=>errorRecord(item,{type:typeof item==='object'?item?.type:value.subtype})).filter(Boolean);}
  // An API error envelope is recognized only at its root, never by recursively
  // searching arbitrary prompt/topic/result JSON for words such as "quota".
  if(value.error&&Object.keys(value).every(key=>['error','status','status_code','http_status','type'].includes(key)))return [errorRecord(value.error,{status:value.status??value.status_code??value.http_status??value.error.status})].filter(Boolean);
  return [];
}
function errorRecords(text){
  const records=[];try{records.push(...structuredErrors(JSON.parse(text)));}catch{}
  for(const raw of text.split('\n').slice(-200)){
    const line=raw.trim();if(!line)continue;
    try{records.push(...structuredErrors(JSON.parse(line)));continue;}catch{}
    const prefixed=/^(?:(?:API\s+)?ERROR\s*:\s*|\d{4}-\d\d-\d\d\S*\s+ERROR\s+|Reconnecting\.\.\.\s*)/i.exec(line),message=prefixed?line.slice(prefixed[0].length):line,code=/^([a-z][a-z0-9_.-]{0,63})(?:\s*:\s*|$)/i.exec(message)?.[1];
    const explicit=/^(?:(?:The|This)\s+(?:(?:selected|requested)\s+)?(?:model|reasoning effort|quality)|You (?:do not|don't) have access to .{0,40}model|You(?:'ve| have) (?:hit|reached|exceeded) (?:your )?(?:current )?(?:usage limit|quota)|Image inputs (?:are|is) not supported\b|Not (?:logged|signed) in|Unauthorized\b|Failed to initialize (?:in-process )?app-server client)/i.test(message);
    if(prefixed||categoryForCode(code)||explicit){records.push({message,code:categoryForCode(code)?code:undefined});const jsonAt=message.indexOf('{');if(jsonAt>=0)try{records.push(...structuredErrors(JSON.parse(message.slice(jsonAt))));}catch{}}
  }
  return records;
}
function classifyFailure(record){
  const text=record.message,code=[record.code,record.type].find(value=>categoryForCode(value)),known=categoryForCode(code),statusValue=record.status??text.match(/(?:^|\b)(?:HTTP(?: error)?\s*[:=]?\s*|unexpected status(?: code)?\s*:\s*|status(?:_code| code)?\s*[:=]\s*)([1-5]\d\d)\b/i)?.[1]??text.match(/^([1-5]\d\d)\b/)?.[1],status=Number.isInteger(Number(statusValue))&&Number(statusValue)>=100&&Number(statusValue)<=599?Number(statusValue):undefined;
  let category=known;
  if(!category&&/failed to initialize (?:in-process )?app-server client/i.test(text)&&/access is denied|os error 5/i.test(text))category='runtime';
  if(!category&&/\b(?:maximum context length|context (?:window|length).{0,60}(?:exceeded|too (?:large|long)|limit))\b|\b(?:prompt|input) is too long\b/i.test(text))category='context_limit';
  if(!category&&(status===413||/\b(?:request|payload).{0,35}(?:too large|size.{0,15}exceeded)\b|\bmaximum (?:number of )?turns (?:reached|exceeded)\b/i.test(text)))category='request_limit';
  if(!category&&/\b(?:output|response).{0,30}(?:too large|length limit|token limit|limit (?:reached|exceeded))\b|\bmax(?:imum)?[_ ]output[_ ]tokens\b/i.test(text))category='output_limit';
  if(!category&&/^(?:You(?:'ve| have) (?:hit|reached|exceeded) (?:your )?(?:current )?(?:usage limit|quota))\b|\b(?:subscription|daily|weekly|monthly|usage) (?:limit|cap) (?:has been |is |was )?(?:reached|exceeded|exhausted)\b/i.test(text))category='usage_cap';
  if(!category&&(status===429||/^rate limit (?:reached|exceeded)|\btoo many requests\b/i.test(text)))category='rate_limit';
  if(!category&&/(?:image|vision|multimodal).{0,100}(?:not supported|unsupported|unavailable|not available)|(?:not supported|unsupported).{0,100}(?:image|vision|multimodal)|(?:unknown|unexpected|unrecognized).{0,50}(?:--image|--input-format)/i.test(text))category='image_input';
  if(!category&&!/temporar|overload|timeout|timed?\s*out|service.?unavailable/i.test(text)&&/(?:model|reasoning|effort|quality).{0,120}(?:not supported|unsupported|not found|does not exist|invalid)|(?:unsupported|unknown|invalid).{0,90}(?:model|effort)|(?:do(?:es)? not|don't|doesn't) have access to.{0,60}model|(?:account|subscription).{0,60}not (?:allowed|permitted).{0,60}model|model.{0,100}(?:unavailable|not available).{0,60}(?:account|subscription)/i.test(text))category='model';
  if(!category&&(status===401||status===403||/^(?:unauthorized|authentication (?:failed|required)|not (?:logged|signed) in|please (?:log|sign) in)\b/i.test(text)))category='authentication';
  if(!category&&(status>=500||/disconnect|connection (?:reset|refused|closed)|\bEOF\b|temporar|overload|timed?\s*out|runtime|app-server/i.test(text)))category='runtime';
  return {category:category||'generic',...(code?{code:String(code).toLowerCase()}:{}),...(status?{status}:{}),retryable:category!=='model'};
}
function failureError(id,result,request){
  const structured=[...errorRecords(withoutRequest(result.stdout,request)),...errorRecords(withoutRequest(result.stderr,request))],classified=structured.map(classifyFailure),coded=classified.filter(item=>item.code),conflicting=new Set(coded.map(item=>item.category)).size>1;
  // Explicit allowlisted provider codes outrank an uncoded CLI transport wrapper.
  // Conflicting coded categories are uncertain; stream order cannot resolve them.
  const diagnostic=conflicting?{category:'generic',type:'conflicting_provider_errors',retryable:true}:coded.at(-1)||classified.findLast(item=>item.category!=='generic')||classified.at(-1)||{category:'generic',retryable:true};
  const name=label(id),messages={
    usage_cap:`${name} reported a usage cap for this request. Your draft is saved; check the provider's usage and reset details before retrying.`,
    rate_limit:`${name} temporarily rate-limited this request. Your draft is saved; wait briefly before retrying the same selection.`,
    context_limit:`This ${name} request exceeded its context length. Your draft is saved; reduce the request or reference material before retrying.`,
    request_limit:`This ${name} request reached a request-size or per-request limit. Your draft is saved; try a smaller request.`,
    output_limit:`The ${name} reply reached an output-length limit. Your draft is saved; request a smaller section before retrying.`,
    model:`The selected ${name} model or quality setting is unavailable for this account or local helper. Your selection and draft are saved; check this selection before retrying.`,
    authentication:`Sign in to ${name} again, then retry. Your draft is saved.`,
    image_input:`${name}'s selected model or local helper cannot accept these image inputs. Choose a compatible model or update the local helper, then retry. Your draft is saved.`,
    runtime:`The ${name} helper or connection could not finish this request. Your draft is saved; retry this same selection when the connection is ready.`,
    generic:`${name} could not finish this request. Your selection and draft are saved; you can retry this request.`
  };
  const windowsDenied=diagnostic.category==='runtime'&&(!diagnostic.code||diagnostic.code==='eacces')&&structured.some(record=>/failed to initialize (?:in-process )?app-server client/i.test(record.message)&&/access is denied|os error 5/i.test(record.message)),message=conflicting?`${name} returned conflicting error details. Your selection and draft are saved; check this request again when the connection is ready.`:windowsDenied?'Windows denied the local AI helper access to its normal runtime. Close Product Studio and relaunch it with normal local permissions, then retry. Your draft is saved.':messages[diagnostic.category];
  return Object.assign(new Error(message+` [${diagnostic.code||diagnostic.type||diagnostic.category}${diagnostic.status?`; HTTP ${diagnostic.status}`:''}]`),{modelUnavailable:diagnostic.category==='model',providerDiagnostic:diagnostic});
}

export function inferenceArguments(id,{schemaPath,outputPath,search=false,model,reasoningEffort,imagePaths=[],multimodal=false}={}){
  const selected=modelOptions(id,{model,reasoningEffort});
  if(id==='chatgpt')return ['--disable','shell_tool','--disable','apps','--disable','multi_agent',...(search?['--search']:[]),'exec','--ignore-user-config','--model',selected.model,'-c',`model_reasoning_effort="${selected.reasoningEffort}"`,'--ephemeral','--skip-git-repo-check','--sandbox','read-only','--output-schema',schemaPath,'--output-last-message',outputPath,...imagePaths.flatMap(path=>['--image',path]),'-'];
  return ['-p','--model',selected.model,'--effort',selected.reasoningEffort,'--output-format','json',...(multimodal?['--input-format','stream-json']:[]),'--json-schema',schemaPath,'--tools',search?'WebSearch,WebFetch':'','--allowedTools',search?'WebSearch,WebFetch':'','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--setting-sources','','--no-chrome','--restricted','--safe-mode','--no-session-persistence','--disable-slash-commands','--permission-mode','dontAsk','--max-turns','12'];
}

function validatedImages(images){
  if(!Array.isArray(images)||images.length>2)throw new Error('Attach at most two PNG or JPEG images.');
  return images.map(image=>{
    if(!image||!['image/png','image/jpeg'].includes(image.mimeType)||typeof image.name!=='string'||image.name.length>240||typeof image.data!=='string'||!image.data.length||image.data.length>Math.ceil(512*1024/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image.data))throw new Error('Use a valid PNG or JPEG image of at most 512 KiB.');
    const bytes=Buffer.from(image.data,'base64');
    if(!bytes.length||bytes.length>512*1024||bytes.toString('base64')!==image.data)throw new Error('Use a valid PNG or JPEG image of at most 512 KiB.');
    if(!validImageStructure(bytes,image.mimeType))throw new Error('The image contents do not match a valid PNG or JPEG within 4096 pixels per side.');
    return {...image,bytes};
  });
}

function validImageStructure(bytes,mimeType){
  const dimensions=(width,height)=>width>0&&height>0&&width<=4096&&height<=4096&&width*height<=16000000;
  if(mimeType==='image/png'){
    if(bytes.length<45||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return false;
    let offset=8,first=true,data=false;
    while(offset+12<=bytes.length){
      const length=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8);
      if(length>bytes.length-offset-12)return false;
      if(first){if(type!=='IHDR'||length!==13||!dimensions(bytes.readUInt32BE(offset+8),bytes.readUInt32BE(offset+12)))return false;first=false;}
      else if(type==='IHDR')return false;
      if(type==='IDAT')data=true;
      offset+=length+12;
      if(type==='IEND')return length===0&&data&&offset===bytes.length;
    }
    return false;
  }
  if(bytes.length<12||bytes[0]!==255||bytes[1]!==216||bytes[bytes.length-2]!==255||bytes.at(-1)!==217)return false;
  let offset=2,frame=false;
  while(offset<bytes.length-2){
    if(bytes[offset++]!==255)return false;
    while(bytes[offset]===255)offset++;
    const marker=bytes[offset++];
    if(marker===0||marker===216||marker===217)return false;
    if(marker===1||marker>=208&&marker<=215)continue;
    if(offset+2>bytes.length)return false;
    const length=bytes.readUInt16BE(offset);
    if(length<2||offset+length>bytes.length-2)return false;
    if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){
      if(length<8||!dimensions(bytes.readUInt16BE(offset+5),bytes.readUInt16BE(offset+3)))return false;
      frame=true;
    }
    if(marker===218)return frame&&length>=6&&offset+length<bytes.length-2;
    offset+=length;
  }
  return false;
}

export function createProviderManager({env=process.env,resolveCli=resolveVendorCli,execute=runProcess,spawnFn=spawn,now=Date.now}={}){
  const childEnv=subscriptionEnvironment(env),logins=new Map(),terminationHolds=new Set(),modelChecks=new Map();let busy=false,blockedReason='',checkGeneration=0;
  const invalidateChecks=()=>{modelChecks.clear();checkGeneration++;};
  const busyError=()=>Object.assign(new Error(blockedReason||'Your AI is already working. Wait for the current reply to finish, then check again.'),{statusCode:409});
  function holdUnconfirmed(error){
    if(!error.unconfirmedTermination||!error.processExit)return;
    terminationHolds.add(error.processExit);blockedReason=error.message;
    error.processExit.then(()=>{terminationHolds.delete(error.processExit);if(!terminationHolds.size)blockedReason='';});
  }
  const command=id=>resolveCli(providerId(id),env);
  async function status(id='chatgpt'){
    providerId(id);const cli=command(id),base={provider:id,installed:!!cli,ready:false,loginRunning:logins.has(id)};
    if(!cli)return {...base,message:`${label(id)}'s local helper is not installed. Run the launcher again to finish setup.`};
    try{
      const r=await execute(cli,id==='chatgpt'?['login','status']:['auth','status','--json'],{env:childEnv,timeout:20000});
      let ready=false;
      if(id==='chatgpt')ready=r.code===0&&/logged in (?:using|with) chatgpt/i.test(r.stdout+r.stderr)&&!/api.?key/i.test(r.stdout+r.stderr);
      else{
        const value=JSON.parse(r.stdout);
        ready=r.code===0&&value.loggedIn===true&&/claude\.ai|oauth/i.test(value.authMethod||'')&&!/api.?key|console|bedrock|vertex|foundry/i.test(value.authMethod||'');
      }
      return {...base,ready,busy:busy||terminationHolds.size>0,message:blockedReason||(ready?`Your ${label(id)} subscription is connected.`:base.loginRunning?`Complete ${label(id)}'s sign-in in your browser, then check the connection.`:`Sign in to ${label(id)} with your subscription. API-key connections are not used by this app.`)};
    }catch(error){holdUnconfirmed(error);return {...base,busy:busy||terminationHolds.size>0,message:blockedReason||`Could not check ${label(id)}. Run the launcher again or sign in and retry.`};}
  }
  async function login(id='chatgpt'){
    providerId(id);invalidateChecks();const cli=command(id);
    if(!cli)throw new Error(`${label(id)}'s local helper is not installed. Run the launcher again.`);
    if(logins.has(id))return {provider:id,started:true,message:`${label(id)} sign-in is already open. Complete it in your browser.`};
    const child=spawnFn(cli.file,[...cli.prefix,...(id==='chatgpt'?['login']:['auth','login'])],{env:childEnv,windowsHide:true,shell:false,stdio:['ignore','ignore','ignore']});
    logins.set(id,child);
    const timer=setTimeout(()=>{if(logins.get(id)===child){child.kill();logins.delete(id);}},15*60000);timer.unref();
    const done=()=>{clearTimeout(timer);if(logins.get(id)===child)logins.delete(id);};
    child.on('error',done);child.on('close',done);
    return {provider:id,started:true,message:`Complete ${label(id)}'s own sign-in in your browser, then choose Check connection.`};
  }
  async function infer(id,prompt,schema,{search=false,model,reasoningEffort,images=[]}={}){
    providerId(id);const selected=modelOptions(id,{model,reasoningEffort});
    const attached=validatedImages(images);
    if(busy||terminationHolds.size)throw busyError();busy=true;
    let directory,pendingExit;
    try{
      if(!(await status(id)).ready)throw new Error(`Connect your ${label(id)} subscription before sending a message.`);
      directory=await mkdtemp(join(tmpdir(),'product-studio-'));
      const schemaPath=join(directory,'schema.json'),outputPath=join(directory,'response.json');
      await writeFile(schemaPath,JSON.stringify(schema),{mode:0o600});
      const imagePaths=[];
      if(id==='chatgpt')for(const [index,image] of attached.entries()){
        const path=join(directory,`reference-${index+1}.${image.mimeType==='image/png'?'png':'jpg'}`);
        await writeFile(path,image.bytes,{mode:0o600});imagePaths.push(path);
      }
      // Native image inputs do not grant the agent a filesystem-reading tool.
      // Claude's documented streaming user message carries base64 image blocks.
      const input=id==='claude'&&attached.length?JSON.stringify({type:'user',message:{role:'user',content:[{type:'text',text:prompt},...attached.map(image=>({type:'image',source:{type:'base64',media_type:image.mimeType,data:image.data}}))]},parent_tool_use_id:null})+'\n':prompt;
      const args=inferenceArguments(id,{schemaPath:id==='claude'?JSON.stringify(schema):schemaPath,outputPath,search,...selected,imagePaths,multimodal:attached.length>0});
      const result=await execute(command(id),args,{input,cwd:directory,env:childEnv,timeout:search?180000:420000});
      if(result.code!==0)throw failureError(id,result,{prompt,input});
      if(id==='chatgpt'){
        try{return JSON.parse(await readFile(outputPath,'utf8'));}catch{throw new Error('ChatGPT returned an unreadable reply. Your draft is unchanged; retry your question.');}
      }
      let value;
      try{value=JSON.parse(result.stdout);}catch{throw new Error('Claude returned an unreadable reply. Your draft is unchanged; retry your question.');}
      if(value.is_error)throw failureError(id,result,{prompt,input});
      if(value.structured_output&&typeof value.structured_output==='object')return value.structured_output;
      if(typeof value.result==='string'){
        try{return JSON.parse(value.result);}catch{}
      }
      throw new Error('Claude did not return a complete structured reply. Your draft is unchanged; retry your question.');
    }catch(error){
      invalidateChecks();holdUnconfirmed(error);if(error.unconfirmedTermination)pendingExit=error.processExit;throw error;
    }finally{
      busy=false;
      const cleanup=()=>directory?rm(directory,{recursive:true,force:true}).catch(()=>{}):Promise.resolve();
      if(pendingExit)pendingExit.then(cleanup);else await cleanup();
    }
  }
  async function checkModel(id,{model,reasoningEffort}={}){
    let selected;
    try{
      if(typeof id!=='string'||typeof model!=='string'||!model||typeof reasoningEffort!=='string')throw new Error('Choose the provider, model and quality to check.');
      providerId(id);selected=modelOptions(id,{model,reasoningEffort});
    }catch(error){return {available:false,message:error.message};}
    if(busy||terminationHolds.size)throw busyError();
    if(logins.has(id))throw Object.assign(new Error(`Complete ${label(id)} sign-in before checking the selected model.`),{statusCode:409});
    const key=JSON.stringify([id,selected.model,selected.reasoningEffort]);
    for(const [entry,expires]of modelChecks)if(expires<=now())modelChecks.delete(entry);
    const message=`The selected ${label(id)} model and quality responded successfully.`;
    if(modelChecks.has(key))return {available:true,message};
    const generation=checkGeneration;
    try{
      const value=await infer(id,'Connection check only. Reply with exactly {"available":true}. Do not research, use tools, or create any content.',{type:'object',properties:{available:{type:'boolean'}},required:['available'],additionalProperties:false},selected);
      if(generation!==checkGeneration)return {available:false,retryable:true,message:'Your connection changed during this check. Check the selected model again.'};
      if(!value||typeof value!=='object'||Array.isArray(value)||value.available!==true||Object.keys(value).length!==1){
        invalidateChecks();return {available:false,retryable:true,message:`${label(id)} did not return the expected model check. Check this selection again.`};
      }
      // Only successful responses are cached, for five minutes in this process.
      while(modelChecks.size>=32)modelChecks.delete(modelChecks.keys().next().value);
      modelChecks.set(key,now()+5*60*1000);
      return {available:true,message};
    }catch(error){if(error.statusCode===409||error.unconfirmedTermination){error.statusCode=409;throw error;}return {available:false,...(error.modelUnavailable?{}:{retryable:true}),message:error.message||`The selected ${label(id)} model could not be checked. Try again.`};}
  }
  return {status,login,infer,checkModel};
}
