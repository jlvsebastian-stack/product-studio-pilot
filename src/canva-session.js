import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {resolveVendorCli,subscriptionEnvironment} from './providers.js';
import {modelOptions} from './models.js';

// A local, short-lived official client. Credentials remain with the vendor.
export function createCanvaSession({cwd,onApproval,onTool,onClientRequest,dynamicTools=[],model,reasoningEffort,env=process.env,spawnFn=spawn,resolveCli=resolveVendorCli,timeout=300000}={}){
  let child,nextId=1,threadId,turnId,pendingRequest,turnResult,finishTurn,failTurn,closed=false,confirmClose,closing,timer,finalMessage='';
  const waiting=new Map();
  const processExit=new Promise(resolve=>{confirmClose=resolve;});
  const send=message=>child.stdin.write(JSON.stringify(message)+'\n');
  const request=(method,params)=>new Promise((resolve,reject)=>{const id=nextId++;waiting.set(id,{resolve,reject});send({id,method,params});});
  const armTimeout=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(threadId&&turnId)send({id:nextId++,method:'turn/interrupt',params:{threadId,turnId}});failTurn(new Error('Canva production timed out. Its outcome is unconfirmed; check your Canva before creating another copy.'));},timeout);};
  const stop=signal=>{try{if(process.platform!=='win32'&&child.pid)process.kill(-child.pid,signal);else child.kill(signal);}catch{}};
  async function close(){
    if(!child||closed)return;
    if(closing)return closing;
    closing=new Promise((resolve,reject)=>{
      child.stdin.end();const gentle=setTimeout(()=>stop('SIGTERM'),1500),force=setTimeout(()=>stop('SIGKILL'),4000);
      const uncertain=setTimeout(()=>{const error=new Error('The Canva helper has not confirmed that it stopped. Wait before starting another production.');error.unconfirmedTermination=true;error.processExit=processExit;reject(error);},8000);
      processExit.then(()=>{clearTimeout(gentle);clearTimeout(force);clearTimeout(uncertain);resolve();});
    });return closing;
  }
  function respond(id,result){
    if(!pendingRequest||pendingRequest.id!==id)throw new Error('This approval is no longer pending.');
    send({id,result});pendingRequest=null;armTimeout();
  }
  async function run(prompt){
    finalMessage='';
    if(typeof model!=='string'||!model||typeof reasoningEffort!=='string')throw new Error('Choose the exact ChatGPT model and quality before starting native Canva production.');
    const selected=modelOptions('chatgpt',{model,reasoningEffort});
    const cli=resolveCli('chatgpt',env);if(!cli)throw new Error('The ChatGPT helper is missing. Run the launcher to finish setup.');
    const completed=new Promise((resolve,reject)=>{finishTurn=resolve;failTurn=error=>{for(const call of waiting.values())call.reject(error);waiting.clear();reject(error);};});completed.catch(()=>{});
    child=spawnFn(cli.file,[...cli.prefix,'--enable','apps','--disable','shell_tool','--disable','multi_agent','--disable','computer_use','--disable','in_app_browser','app-server','--stdio'],{cwd,env:subscriptionEnvironment(env),windowsHide:true,shell:false,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe']});
    child.stdin.on('error',()=>{});
    const lines=readline.createInterface({input:child.stdout});
    lines.on('line',line=>{
      if(line.length>8000000){failTurn(new Error('The Canva helper returned too much data.'));return;}
      let message;try{message=JSON.parse(line);}catch{return;}
      if(message.id!==undefined&&!message.method){const call=waiting.get(message.id);if(call){waiting.delete(message.id);message.error?call.reject(new Error(message.error.message)):call.resolve(message.result);}return;}
      if(message.method&&message.id!==undefined){
        pendingRequest=message;
        if(message.method==='item/tool/call'&&onClientRequest){Promise.resolve(onClientRequest(message)).then(held=>{if(held){if(pendingRequest?.id===message.id)clearTimeout(timer);}else{send({id:message.id,result:{success:false,contentItems:[{type:'inputText',text:'The local review request was not valid. Do not save the draft.'}]}});pendingRequest=null;failTurn(new Error('The native artwork preview could not be verified for approval.'));}}).catch(error=>{failTurn(error);});return;}
        if(message.method==='mcpServer/elicitation/request'&&message.params?.mode==='form'&&onApproval(message)){clearTimeout(timer);return;}
        if(message.method==='mcpServer/elicitation/request')respond(message.id,{action:'cancel',content:null});
        else{send({id:message.id,error:{code:-32601,message:'This production client does not support that request.'}});pendingRequest=null;}
        failTurn(new Error('Canva requested an action outside this approved sample. No permission or account settings were changed.'));return;
      }
      const params=message.params||{};
      if(message.method==='turn/started')turnId=params.turn?.id||turnId;
      if(message.method==='item/completed'&&params.item?.type==='agentMessage'&&(!params.item.phase||params.item.phase==='final_answer'))finalMessage=typeof params.item.text==='string'&&params.item.text.length<=24000?params.item.text:'';
      if(['item/started','item/completed'].includes(message.method)&&params.item?.type==='mcpToolCall')try{onTool({...params.item,lifecycle:message.method});}catch(error){failTurn(error);}
      if(message.method==='turn/completed'){turnResult=params.turn;finishTurn(turnResult);}
      if(message.method==='error')failTurn(new Error(params.error?.message||'The Canva helper could not finish.'));
    });
    let diagnostic='';child.stderr.on('data',chunk=>{diagnostic=(diagnostic+chunk.toString()).slice(-3000);});
    child.on('error',error=>{if(!child.pid){closed=true;confirmClose();}failTurn(new Error('The local Canva helper could not start: '+error.message));});
    child.on('close',()=>{closed=true;confirmClose();for(const call of waiting.values())call.reject(new Error('The Canva helper closed before answering.'));waiting.clear();if(!turnResult)failTurn(new Error(/Access is denied|os error 5/i.test(diagnostic)?'Normal local permissions are required to start the Canva helper. Relaunch the app normally.':'The Canva helper stopped before production was verified.'));});
    armTimeout();
    try{
      await request('initialize',{clientInfo:{name:'product_studio_local',title:'Product Studio local Canva production',version:'0.3.13'},capabilities:{experimentalApi:true,explicitGatewayOauth:true}});
      send({method:'initialized',params:{}});
      const start=await request('thread/start',{model:selected.model,config:{model_reasoning_effort:selected.reasoningEffort},...(dynamicTools.length?{dynamicTools}:{}),cwd,ephemeral:true,approvalPolicy:'on-request',approvalsReviewer:'user',sandbox:'read-only',allowProviderModelFallback:false});threadId=start.thread.id;
      if(start.approvalPolicy!=='on-request'||start.approvalsReviewer!=='user')throw new Error('This helper cannot present normal production approvals.');
      if(start.model&&start.model!==selected.model)throw new Error('The ChatGPT helper did not retain your exact selected model. No Canva production was started.');
      const turn=await request('turn/start',{threadId,model:selected.model,effort:selected.reasoningEffort,approvalPolicy:'on-request',approvalsReviewer:'user',sandboxPolicy:{type:'readOnly',networkAccess:false},input:[{type:'text',text:prompt}]});turnId=turn.turn.id;
      const result=await completed;if(result?.status==='failed')throw new Error(result.error?.message||'The Canva production turn failed.');return {...result,finalMessage};
    }finally{clearTimeout(timer);await close();}
  }
  return {run,respond,close,processExit};
}
