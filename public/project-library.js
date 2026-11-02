// One local project library; JSON downloads are only explicit portable backups.
export function createProjectLibrary({studio,checkpoint,merge,request,onStatus=()=>{},delay=500}){
  let ready=false,timer,running;const pending=new Map(),saved=new Map();
  function queue(){for(const project of studio.projects){const snapshot=checkpoint(project),serialized=JSON.stringify(snapshot);if(saved.get(project.id)!==serialized)pending.set(project.id,{project:snapshot,serialized});}}
  async function flush(){
    clearTimeout(timer);if(!ready)return false;if(running){if(!await running)return false;return pending.size?flush():true;}
    running=(async()=>{try{while(pending.size){const [id,item]=pending.has(studio.activeId)?[studio.activeId,pending.get(studio.activeId)]:pending.entries().next().value;pending.delete(id);await request('POST',{project:item.project,activeId:studio.activeId});saved.set(id,item.serialized);}onStatus('saved');return true;}catch(error){queue();onStatus('error',error.message);return false;}})();
    try{return await running;}finally{running=null;}
  }
  return {
    async initialize(){try{const library=await request('GET');merge(studio,library);for(const project of library.projects||[])saved.set(project.id,JSON.stringify(checkpoint(project)));ready=true;queue();await flush();return true;}catch(error){onStatus('error',error.message);return false;}},
    schedule(){queue();if(!ready)return;onStatus('saving');clearTimeout(timer);timer=setTimeout(flush,delay);},
    async save(){if(!ready&&!await this.initialize())return false;queue();return flush();}
  };
}
