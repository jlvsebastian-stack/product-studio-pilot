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

function failureMessage(id,result){
  const text=result.stdout+'\n'+result.stderr;
  if(/failed to initialize (?:in-process )?app-server client/i.test(text)&&/access is denied|os error 5/i.test(text))return 'Windows denied the local AI helper access to its normal runtime. Close Product Studio and relaunch it with normal local permissions, then retry. Your draft is saved.';
  if(/(?:model|reasoning|effort|quality).{0,120}(?:not supported|unsupported|not available|unavailable|not found|does not exist|not have access|invalid|cannot|can.t use)|(?:unsupported|unknown|invalid).{0,40}(?:model|effort)|access.{0,40}(?:model)/i.test(text))return `The selected ${label(id)} model or quality setting is unavailable for this account or local helper. Choose another model or quality setting and retry. Your draft is saved.`;
  if(/limit|quota|rate.?limit|usage.?cap/i.test(text))return `Your ${label(id)} usage limit was reached. Your conversation is saved; wait for the limit to reset and retry.`;
  if(/401|unauthorized|authentication|not logged|login|sign.?in/i.test(text))return `Sign in to ${label(id)} again, then retry. Your draft is saved.`;
  return `${label(id)} could not finish this request. Check the account connection and retry; your draft is saved.`;
}

export function inferenceArguments(id,{schemaPath,outputPath,search=false,model,reasoningEffort}={}){
  const selected=modelOptions(id,{model,reasoningEffort});
  if(id==='chatgpt')return ['--disable','shell_tool','--disable','apps','--disable','multi_agent',...(search?['--search']:[]),'exec','--ignore-user-config','--model',selected.model,'-c',`model_reasoning_effort="${selected.reasoningEffort}"`,'--ephemeral','--skip-git-repo-check','--sandbox','read-only','--output-schema',schemaPath,'--output-last-message',outputPath,'-'];
  return ['-p','--model',selected.model,'--effort',selected.reasoningEffort,'--output-format','json','--json-schema',schemaPath,'--tools',search?'WebSearch,WebFetch':'','--allowedTools',search?'WebSearch,WebFetch':'','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--setting-sources','','--no-chrome','--restricted','--safe-mode','--no-session-persistence','--disable-slash-commands','--permission-mode','dontAsk','--max-turns','12'];
}

export function createProviderManager({env=process.env,resolveCli=resolveVendorCli,execute=runProcess,spawnFn=spawn}={}){
  const childEnv=subscriptionEnvironment(env),logins=new Map(),terminationHolds=new Set();let busy=false,blockedReason='';
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
    providerId(id);const cli=command(id);
    if(!cli)throw new Error(`${label(id)}'s local helper is not installed. Run the launcher again.`);
    if(logins.has(id))return {provider:id,started:true,message:`${label(id)} sign-in is already open. Complete it in your browser.`};
    const child=spawnFn(cli.file,[...cli.prefix,...(id==='chatgpt'?['login']:['auth','login'])],{env:childEnv,windowsHide:true,shell:false,stdio:['ignore','ignore','ignore']});
    logins.set(id,child);
    const timer=setTimeout(()=>{if(logins.get(id)===child){child.kill();logins.delete(id);}},15*60000);timer.unref();
    const done=()=>{clearTimeout(timer);if(logins.get(id)===child)logins.delete(id);};
    child.on('error',done);child.on('close',done);
    return {provider:id,started:true,message:`Complete ${label(id)}'s own sign-in in your browser, then choose Check connection.`};
  }
  async function infer(id,prompt,schema,{search=false,model,reasoningEffort}={}){
    providerId(id);const selected=modelOptions(id,{model,reasoningEffort});
    if(busy||terminationHolds.size)throw new Error(blockedReason||'Your AI is already working. Wait for the current reply to finish.');busy=true;
    let directory,pendingExit;
    try{
      if(!(await status(id)).ready)throw new Error(`Connect your ${label(id)} subscription before sending a message.`);
      directory=await mkdtemp(join(tmpdir(),'product-studio-'));
      const schemaPath=join(directory,'schema.json'),outputPath=join(directory,'response.json');
      await writeFile(schemaPath,JSON.stringify(schema),{mode:0o600});
      const args=inferenceArguments(id,{schemaPath:id==='claude'?JSON.stringify(schema):schemaPath,outputPath,search,...selected});
      const result=await execute(command(id),args,{input:prompt,cwd:directory,env:childEnv,timeout:search?180000:420000});
      if(result.code!==0)throw new Error(failureMessage(id,result));
      if(id==='chatgpt'){
        try{return JSON.parse(await readFile(outputPath,'utf8'));}catch{throw new Error('ChatGPT returned an unreadable reply. Your draft is unchanged; retry your question.');}
      }
      let value;
      try{value=JSON.parse(result.stdout);}catch{throw new Error('Claude returned an unreadable reply. Your draft is unchanged; retry your question.');}
      if(value.is_error)throw new Error(failureMessage(id,result));
      if(value.structured_output&&typeof value.structured_output==='object')return value.structured_output;
      if(typeof value.result==='string'){
        try{return JSON.parse(value.result);}catch{}
      }
      throw new Error('Claude did not return a complete structured reply. Your draft is unchanged; retry your question.');
    }catch(error){
      holdUnconfirmed(error);if(error.unconfirmedTermination)pendingExit=error.processExit;throw error;
    }finally{
      busy=false;
      const cleanup=()=>directory?rm(directory,{recursive:true,force:true}).catch(()=>{}):Promise.resolve();
      if(pendingExit)pendingExit.then(cleanup);else await cleanup();
    }
  }
  return {status,login,infer};
}
