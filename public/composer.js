export const BACKUP_LIMIT=8_000_000;
const FILE_LIMIT=3*1024*1024,IMAGE_LIMIT=512*1024,TOTAL_FILE_LIMIT=6*1024*1024;
const newId=()=>globalThis.crypto?.randomUUID?.()||`reference-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function composerKeyAction(event,{hasContent=false,busy=false,composing=false}={}){
  if(event.key!=='Enter'||event.isComposing||composing||event.keyCode===229)return 'native';
  if(event.shiftKey)return 'newline';
  return event.repeat||busy||!hasContent?'blocked':'submit';
}
export function extractHttpLinks(text){
  const urls=[];
  for(const match of String(text).matchAll(/https?:\/\/[^\s<>"'`]+/gi)){
    let value=match[0].replace(/[.,;:!?]+$/g,'');
    while(value.endsWith(')')&&(value.match(/\)/g)||[]).length>(value.match(/\(/g)||[]).length)value=value.slice(0,-1);
    try{const url=new URL(value);if(['http:','https:'].includes(url.protocol)&&!urls.includes(url.href))urls.push(url.href);}catch{}
  }
  return urls;
}
export function referenceMessage(text,references=[]){
  const list=references.map(r=>`- ${r.name}${r.url?` (${r.url})`:''}`).join('\n');
  return [String(text).trim(),list?`References attached:\n${list}`:''].filter(Boolean).join('\n\n');
}
export function cleanReferences(value=[]){
  if(!Array.isArray(value)||value.length>5)throw Error('Keep up to five references in one project.');
  let textSize=0,images=0;
  const result=value.map(r=>{
    if(!r||typeof r.id!=='string'||!r.id||r.id.length>240||typeof r.name!=='string'||!r.name||r.name.length>240||!['file','link','image'].includes(r.kind)||typeof r.mimeType!=='string'||r.mimeType.length>120||typeof r.text!=='string'||r.text.length>16000||!['ready','excerpt','unavailable'].includes(r.status)||typeof r.note!=='string'||r.note.length>500)throw Error('This project has invalid reference details.');
    textSize+=r.text.length;
    const clean=Object.fromEntries(['id','name','kind','mimeType','text','status','note'].map(k=>[k,r[k]]));
    if(r.url!==undefined){try{const url=new URL(r.url);if(!['http:','https:'].includes(url.protocol)||r.url.length>2048)throw Error();clean.url=url.href;}catch{throw Error('This project has an invalid reference link.');}}
    if(r.imageData!==undefined){
      if(r.kind!=='image'||!['image/png','image/jpeg'].includes(r.mimeType)||typeof r.imageData!=='string'||!r.imageData.startsWith(`data:${r.mimeType};base64,`))throw Error('A reference image is invalid. Choose a PNG or JPEG.');
      const encoded=r.imageData.slice(r.imageData.indexOf(',')+1);
      if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)||encoded.length%4||encoded.length*3/4-(encoded.match(/=+$/)?.[0].length||0)>IMAGE_LIMIT)throw Error('Reference images must be PNG or JPEG files up to 512 KB.');
      clean.imageData=r.imageData;images++;
    }
    return clean;
  });
  if(textSize>60000)throw Error('Reference excerpts exceed the 60,000 character project limit.');
  if(images>2)throw Error('Keep up to two reference images.');
  if(new Set(result.map(r=>r.id)).size!==result.length)throw Error('This project has duplicate references.');
  return result;
}
export const projectReferences=project=>[...(project.references||[]),...(project.pendingReferences||[])];
export function recordRequest(project,text,{fromComposer=false,revisionIntent=false,completion=false}={}){
  const references=fromComposer?projectReferences(project):project.references||[];
  project.messages.push({role:'user',content:referenceMessage(text,fromComposer?project.pendingReferences:[])});
  const request={text,messageIndex:project.messages.length-1,fromComposer,revisionIntent,completion,references};
  if(fromComposer){if(project.pendingAnswer.trim()===text.trim())project.pendingAnswer='';project.references=references;project.pendingReferences=[];}
  project.retryRequest=null;project.stageReady=false;return request;
}
export const requestMessages=(project,request)=>project.messages.slice(0,request.messageIndex+1).slice(-48);
export const referenceStatus=r=>r.status==='processing'?'Preparing locally':r.status==='failed'?'Preparation failed':r.status==='unavailable'?'Unavailable':r.status==='excerpt'?'Excerpt prepared':r.kind==='image'?'Image attached':'Parsed locally';
export function readFileBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error(`${file.name} could not be read. Attach it again.`));reader.readAsDataURL(file);});}

export function createReferenceComposer(project,{ingest,readFile=readFileBase64,onChange=()=>{}}={}){
  project.references??=[];project.pendingReferences??=[];
  const inputs=[];
  function checkRoom(count,imageCount=0){
    const refs=projectReferences(project);
    if(refs.length+inputs.length+count>5)throw Error('Keep up to five references. Remove a reference before attaching another.');
    if(refs.filter(r=>r.kind==='image').length+inputs.filter(r=>r.kind==='image').length+imageCount>2)throw Error('Keep up to two images. Remove an image before attaching another.');
  }
  async function prepare(entries,body){
    inputs.push(...entries);onChange();
    try{
      const response=await ingest(await body());
      if(!Array.isArray(response?.references)||response.references.length!==entries.length)throw Error('The local app returned incomplete reference details. Remove these references and attach them again.');
      for(let i=0;i<entries.length;i++){
        if(!inputs.includes(entries[i]))continue;
        const existing=projectReferences(project),reference={...response.references[i]},remaining=Math.max(0,60000-existing.reduce((sum,r)=>sum+r.text.length,0));
        if(typeof reference.text==='string'&&reference.text.length>remaining){reference.text=reference.text.slice(0,remaining);reference.status='excerpt';reference.note='Excerpt shortened to fit this project’s 60,000 character reference limit.';}
        const [clean]=cleanReferences([reference]);cleanReferences([...existing,clean]);project.pendingReferences.push(clean);inputs.splice(inputs.indexOf(entries[i]),1);
      }
    }catch(error){for(const entry of entries)if(inputs.includes(entry)){entry.status='failed';entry.note=error.message||'Could not prepare this reference. Remove it and attach it again.';}}
    finally{onChange();}
  }
  return {
    inputs,
    get processing(){return inputs.some(r=>r.status==='processing');},
    get ready(){return inputs.length===0;},
    remove(id){const index=inputs.findIndex(r=>r.id===id);if(index>=0)inputs.splice(index,1);project.pendingReferences=project.pendingReferences.filter(r=>r.id!==id);project.references=project.references.filter(r=>r.id!==id);onChange();},
    async addLinks(links){
      const known=new Set([...projectReferences(project),...inputs].map(r=>r.url).filter(Boolean));
      const urls=[...new Set(links.map(value=>{const url=new URL(value);if(!['http:','https:'].includes(url.protocol))throw Error('Attach an HTTP or HTTPS link.');return url.href;}))].filter(url=>!known.has(url));
      if(!urls.length)return;checkRoom(urls.length);
      const entries=urls.map(url=>({id:newId(),name:url,kind:'link',url,status:'processing',note:'Fetching the public page and preparing a bounded text excerpt.'}));
      await prepare(entries,async()=>({links:urls}));
    },
    async addFiles(fileList){
      const files=Array.from(fileList);if(!files.length)return;
      checkRoom(files.length,files.filter(f=>/^image\//.test(f.type)).length);
      if(files.reduce((sum,f)=>sum+f.size,0)>TOTAL_FILE_LIMIT)throw Error('Attach up to 6 MB of files at a time.');
      for(const file of files){if(/^image\//.test(file.type)&&(!['image/png','image/jpeg'].includes(file.type)||file.size>IMAGE_LIMIT))throw Error('Choose PNG or JPEG reference images up to 512 KB each.');if(file.size>FILE_LIMIT)throw Error(`${file.name} exceeds the 3 MB file limit.`);}
      const entries=files.map(file=>({id:newId(),name:file.name,kind:/^image\//.test(file.type)?'image':'file',mimeType:file.type,status:'processing',note:'Reading the file and preparing it locally.'}));
      await prepare(entries,async()=>({files:await Promise.all(files.map(async file=>({name:file.name,mimeType:file.type||'application/octet-stream',data:await readFile(file)})))}));
    }
  };
}

export function bindComposer({form,answer,fileInput,attachButton,dropZone,getBusy,hasContent,onSubmit,onInput,onFiles,onLinks}){
  let composing=false,compositionEnded=false,compositionTimer,dragDepth=0;
  form.onsubmit=event=>{event.preventDefault();if(!getBusy()&&!composing&&!compositionEnded&&hasContent())onSubmit();};
  answer.oninput=()=>onInput(answer.value);
  answer.oncompositionstart=()=>{clearTimeout(compositionTimer);composing=true;compositionEnded=false;};answer.oncompositionend=()=>{composing=false;compositionEnded=true;compositionTimer=setTimeout(()=>{compositionEnded=false;},200);};
  answer.onkeyup=event=>{if(event.key==='Enter'){clearTimeout(compositionTimer);compositionEnded=false;}};
  answer.onkeydown=event=>{const action=composerKeyAction(event,{busy:getBusy(),hasContent:hasContent(),composing:composing||compositionEnded});if(action==='submit'||action==='blocked')event.preventDefault();if(action==='submit')form.requestSubmit();};
  attachButton.onclick=()=>fileInput.click();fileInput.onchange=()=>{onFiles(Array.from(fileInput.files));fileInput.value='';};
  answer.onpaste=event=>{const images=Array.from(event.clipboardData?.items||[]).filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);if(images.length){event.preventDefault();onFiles(images);}else{const links=extractHttpLinks(event.clipboardData?.getData('text/plain')||'');if(links.length)setTimeout(()=>onLinks(links),0);}};
  dropZone.ondragenter=event=>{if(Array.from(event.dataTransfer?.types||[]).some(type=>['Files','text/uri-list'].includes(type))){event.preventDefault();dragDepth++;dropZone.classList.add('drag-over');}};
  dropZone.ondragover=event=>{event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';};
  dropZone.ondragleave=()=>{if(--dragDepth<=0){dragDepth=0;dropZone.classList.remove('drag-over');}};
  dropZone.ondrop=event=>{event.preventDefault();dragDepth=0;dropZone.classList.remove('drag-over');const files=Array.from(event.dataTransfer?.files||[]);if(files.length)onFiles(files);else{const links=extractHttpLinks(event.dataTransfer?.getData('text/uri-list')||event.dataTransfer?.getData('text/plain')||'');if(links.length)onLinks(links);}};
}
