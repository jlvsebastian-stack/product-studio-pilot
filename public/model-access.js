export const modelAccessKey=selection=>selection?JSON.stringify([selection.provider,selection.model,selection.reasoningEffort]):'';
export function modelSelection(catalog,saved=''){
  const options=catalog.slice();
  if(saved&&!options.some(option=>option.id===saved))options.unshift({id:saved,label:`${saved} · saved choice`,saved:true});
  return {options,selected:saved||(options.find(option=>option.recommended)||options[0])?.id||''};
}

// One helper call at a time. Changes replace the waiting choice, never the user's selection.
export function createModelAccess({request,onChange=()=>{},now=Date.now}){
  let state={status:'idle',selection:null,message:'Connect your AI account to check model access.'},version=0,queued=null,running=null,expiryTimer;
  const expiredMessage='Model access confirmation expired. Check the selected model and quality again.';
  const results=new Map();
  const publish=value=>{state=value;onChange(state);};
  function expire(){if(state.status==='ready'&&state.expiresAt<=now()){results.delete(modelAccessKey(state.selection));publish({...state,status:'expired',message:expiredMessage});}}
  async function drain(){
    while(queued){
      const job=queued;queued=null;let outcome;
      try{
        const response=await request(job.selection);
        if(typeof response?.available!=='boolean')throw Error('The local app could not confirm model access. Check again.');
        outcome={status:response.available?'ready':response.retryable?'busy':'unavailable',message:response.message|| (response.available?'Selected model is ready.':'This model is unavailable on the connected subscription.')};
        if(response.available)outcome.expiresAt=now()+5*60*1000;
      }catch(error){outcome={status:error.retryable||[409,429].includes(error.status)?'busy':'error',message:error.message||'Model access could not be checked. Check again.'};}
      if(job.version===version){
        if(['ready','unavailable'].includes(outcome.status))results.set(modelAccessKey(job.selection),outcome);else results.delete(modelAccessKey(job.selection));
        publish({...outcome,selection:job.selection});if(outcome.status==='ready'){expiryTimer=setTimeout(expire,Math.max(0,outcome.expiresAt-now()));expiryTimer?.unref?.();}
      }
    }
    running=null;
  }
  return {
    results,
    get state(){return state.status==='ready'&&state.expiresAt<=now()?{...state,status:'expired',message:expiredMessage}:state;},
    get ready(){return state.status==='ready'&&state.expiresAt>now();},
    clear(){version++;queued=null;clearTimeout(expiryTimer);results.clear();publish({status:'idle',selection:null,message:'Connect your AI account to check model access.'});},
    invalidate(message='Check access for the selected model and quality before retrying.'){
      version++;queued=null;clearTimeout(expiryTimer);for(const [key,outcome]of results)if(outcome.status==='ready')results.delete(key);
      publish({status:'unconfirmed',selection:state.selection,message});
    },
    check(selection,{force=false}={}){
      const key=modelAccessKey(selection);
      if(!selection?.provider||!selection?.model||!selection?.reasoningEffort){this.clear();return Promise.resolve();}
      if(key===modelAccessKey(state.selection)&&(state.status==='checking'&&running||!force&&state.status==='ready'&&state.expiresAt>now()))return running||Promise.resolve();
      const selected={provider:selection.provider,model:selection.model,reasoningEffort:selection.reasoningEffort};
      clearTimeout(expiryTimer);queued={selection:selected,version:++version};publish({status:'checking',selection:selected,message:'Checking model access…'});
      if(!running)running=drain();
      return running;
    }
  };
}
