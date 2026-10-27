import {cleanReferences,projectReferences} from './composer.js';
const PROJECTS='product-studio-projects-v3', PROFILE='product-studio-preferences-v1';
const categories=['voice','design','workflow'];
export const PREFERENCE_LIMIT=80;
export const activePreferences=profile=>profile.preferences.slice(0,PREFERENCE_LIMIT).map(({id,text,category,source})=>({id,text,category,source}));
export function currentDraftSection(project){
  const draft=project.brief.productDraft||'',approved=project.approvedDraft||'',pending=draft!==approved;
  const source=(pending&&approved&&draft.startsWith(approved)?draft.slice(approved.length):draft).replace(/\r\n/g,'\n').trim();
  const heading=[...source.matchAll(/^##\s+([^\n]+)/gm)].at(-1);
  return {heading:heading?.[1]||source.match(/^#\s+([^\n]+)/)?.[1]||'Current draft',text:source.slice(heading?.index??0),pending};
}
export function acceptSampleFiles(project,files,requestKey,currentKey){if(requestKey!==currentKey)return false;project.sampleFiles=files;project.sampleFingerprint=requestKey;return true;}
export const FIRST='Let’s find a useful product in what you already know. What’s something you know well or often help people with? That gives us a starting topic—we’ll shape the rest together.';
const briefKeys=['title','topic','buyer','outcome','method','example','limits','author','tone','theme','niche','marketEvidence','offer','format','outline','design','designPlan','listingCopy','productDraft'];
export const blankBrief=()=>Object.fromEntries(briefKeys.map(k=>[k,k==='theme'?'clay':'']));
const id=()=>globalThis.crypto?.randomUUID?.()||`project-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const normalized=t=>String(t).trim().toLowerCase().replace(/\s+/g,' ');
const emptyProfile=()=>({preferences:[],candidates:[],forgotten:[],paused:false});
export const freshProject=()=>({id:id(),updatedAt:Date.now(),brief:blankBrief(),interviewStage:1,messages:[{role:'assistant',content:FIRST}],notes:[],stageReady:false,summary:'',reviewed:false,files:null,demo:false,pendingAnswer:'',references:[],pendingReferences:[],retryRequest:null,approvedDraft:'',previousApprovedDraft:'',sampleApproved:false,coverImage:'',suggestions:[],companions:[],changeNote:''});

function readProject(raw,{newId=false}={}){
  const source=raw?.project?{...raw.project,interviewStage:raw.project.stage}:raw;
  if(!source?.brief||typeof source.brief!=='object'||Array.isArray(source.brief))throw Error('Choose a saved product project.');
  const p=freshProject();
  for(const key of briefKeys)if(source.brief[key]!==undefined){if(typeof source.brief[key]!=='string')throw Error('This project has invalid brief fields.');p.brief[key]=source.brief[key];}
  p.interviewStage=source.interviewStage??1;
  if(!Number.isInteger(p.interviewStage)||p.interviewStage<1||p.interviewStage>12)throw Error('This project has an invalid creation stage.');
  for(const key of ['pendingAnswer','summary','approvedDraft','previousApprovedDraft','coverImage','changeNote'])if(source[key]!==undefined){if(typeof source[key]!=='string')throw Error('This project has invalid text fields.');p[key]=source[key];}
  if(p.coverImage&&!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(p.coverImage))throw Error('Choose a PNG or JPEG image.');
  if(p.coverImage.length>1400000)throw Error('The project image exceeds the 1 MB limit.');
  for(const key of ['stageReady','demo','sampleApproved'])if(source[key]!==undefined){if(typeof source[key]!=='boolean')throw Error('This project has invalid approval fields.');p[key]=source[key];}
  if(source.messages!==undefined){if(!Array.isArray(source.messages)||source.messages.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'))throw Error('This conversation is invalid.');p.messages=source.messages.map(({role,content})=>({role,content}));}
  p.references=cleanReferences(source.references);p.pendingReferences=cleanReferences(source.pendingReferences);cleanReferences(projectReferences(p));
  if(source.retryRequest){const request=source.retryRequest;if(typeof request.text!=='string'||!Number.isInteger(request.messageIndex)||p.messages[request.messageIndex]?.role!=='user')throw Error('This project has an invalid retry checkpoint.');p.retryRequest={text:request.text,messageIndex:request.messageIndex,fromComposer:request.fromComposer===true,revisionIntent:request.revisionIntent===true,completion:request.completion===true,references:cleanReferences(request.references)};}
  else if(p.messages.at(-1)?.role==='assistant'&&p.messages.at(-1).content.startsWith('I couldn’t finish that reply.')){const messageIndex=p.messages.findLastIndex(m=>m.role==='user');if(messageIndex>=0)p.retryRequest={text:p.messages[messageIndex].content,messageIndex,fromComposer:true,revisionIntent:false,completion:false,references:p.references};}
  if(source.notes!==undefined){if(!Array.isArray(source.notes)||source.notes.some(n=>!n||!Number.isInteger(n.stage)||typeof n.title!=='string'||typeof n.summary!=='string'))throw Error('This project has invalid stage notes.');p.notes=source.notes.map(({stage,title,summary})=>({stage,title,summary}));}
  for(const [key,fields] of [['suggestions',['title','why','basis']],['companions',['title','format','why']]])if(source[key]!==undefined){if(!Array.isArray(source[key])||source[key].some(item=>!item||fields.some(field=>typeof item[field]!=='string')))throw Error('This project has invalid product suggestions.');p[key]=source[key].slice(0,6).map(item=>Object.fromEntries(fields.map(field=>[field,item[field]])));}
  if(!p.approvedDraft)p.sampleApproved=false;
  p.id=!newId&&typeof source.id==='string'?source.id:p.id;p.updatedAt=Number.isFinite(source.updatedAt)?source.updatedAt:Date.now();
  // Download URLs expire with the local server; a restored copy needs a fresh review/export.
  return p;
}
export function loadStudio(storage){
  const studio={version:3,activeId:'',projects:[],profile:emptyProfile(),storageWarning:''};
  const preserve=raw=>{studio.recoveryBackup=raw;if(!storage.getItem('product-studio-recovery-backup'))storage.setItem('product-studio-recovery-backup',raw);};
  try{
    const original=storage.getItem(PROJECTS);let raw;
    try{raw=JSON.parse(original||'null');}catch{if(original)preserve(original);throw Error('Unreadable saved library');}
    if(original&&(!raw||raw.version!==3||!Array.isArray(raw.projects))){preserve(original);throw Error('Unsupported saved library');}
    if(raw?.version===3&&Array.isArray(raw.projects)){
      for(const p of raw.projects){try{studio.projects.push(readProject(p));}catch{preserve(original);studio.storageWarning='A saved project could not be read. Its original browser copy was retained.';}}
      studio.activeId=raw.activeId;
    }
    if(!studio.projects.length){
      const old=storage.getItem('product-studio-local-v2');
      if(old){try{const migrated=readProject(JSON.parse(old));migrated.approvedDraft=migrated.approvedDraft||migrated.brief.productDraft;studio.projects.push(migrated);if(!storage.getItem('product-studio-legacy-backup'))storage.setItem('product-studio-legacy-backup',old);}catch{studio.storageWarning='Your earlier browser project was retained but could not be opened. Open a JSON backup to recover it.';}}
    }
    const saved=JSON.parse(storage.getItem(PROFILE)||'null');
    if(saved&&Array.isArray(saved.preferences)){
      studio.profile.preferences=saved.preferences.filter(p=>p&&typeof p.id==='string'&&typeof p.text==='string'&&categories.includes(p.category)).map(p=>({id:p.id,text:p.text,category:p.category,source:'explicit'}));
      studio.profile.candidates=Array.isArray(saved.candidates)?saved.candidates.filter(p=>p&&typeof p.id==='string'&&typeof p.text==='string'&&categories.includes(p.category)&&['explicit','inferred'].includes(p.source)).map(({id,text,category,source})=>({id,text,category,source})):[];
      studio.profile.forgotten=Array.isArray(saved.forgotten)?saved.forgotten.filter(x=>typeof x==='string'):[];
      studio.profile.paused=saved.paused===true;
    }
  }catch{studio.storageWarning='Browser storage is unavailable. Save a project backup to keep your work.';}
  if(!studio.projects.length)studio.projects.push(freshProject());
  if(!studio.projects.some(p=>p.id===studio.activeId))studio.activeId=studio.projects[0].id;
  return studio;
}
export function persistStudio(storage,studio){
  try{
    if(studio.recoveryBackup&&!storage.getItem('product-studio-recovery-backup'))storage.setItem('product-studio-recovery-backup',studio.recoveryBackup);
    storage.setItem(PROJECTS,JSON.stringify({version:3,activeId:studio.activeId,projects:studio.projects.map(checkpoint)}));
    storage.setItem(PROFILE,JSON.stringify({preferences:studio.profile.preferences,candidates:studio.profile.candidates,forgotten:studio.profile.forgotten,paused:studio.profile.paused}));
    return {ok:true};
  }catch{return {ok:false,error:'Autosave is unavailable. Save a project backup now to keep your work.'};}
}
export function newProject(studio){const p=freshProject();studio.projects.unshift(p);studio.activeId=p.id;return p;}
export function openProject(studio,projectId){const p=studio.projects.find(p=>p.id===projectId);if(!p)throw Error('This project could not be found.');studio.activeId=p.id;return p;}
export function checkpoint(p){
  const clean={};for(const key of ['id','updatedAt','brief','interviewStage','messages','notes','stageReady','summary','demo','pendingAnswer','approvedDraft','previousApprovedDraft','sampleApproved','coverImage','changeNote','suggestions','companions'])clean[key]=p[key];
  clean.references=cleanReferences(p.references);clean.pendingReferences=cleanReferences(p.pendingReferences);cleanReferences(projectReferences(clean));
  clean.retryRequest=p.retryRequest?{...p.retryRequest,references:cleanReferences(p.retryRequest.references)}:null;
  return clean;
}
export function importProject(studio,raw){const p=readProject(raw,{newId:true});studio.projects.unshift(p);studio.activeId=p.id;return p;}

export function learnPreferences(profile,updates,currentInput){
  if(profile.paused)return;
  for(const update of Array.isArray(updates)?updates.slice(0,12):[]){
    if(!update||typeof update.text!=='string'||!update.text.trim()||!categories.includes(update.category))continue;
    const key=normalized(update.text);if(profile.forgotten.includes(key)||[...profile.preferences,...profile.candidates].some(p=>normalized(p.text)===key))continue;
    const pref={id:id(),text:update.text.trim().slice(0,1000),category:update.category,source:update.source};
    const evidence=typeof update.evidence==='string'?update.evidence:'';
    if(update.source==='explicit'&&evidence&&currentInput.includes(evidence)&&evidence.includes(update.text)){
      if(profile.preferences.length<PREFERENCE_LIMIT)profile.preferences.push({...pref,source:'explicit'});
      else profile.candidates.push({...pref,source:'explicit'});
    }
    else if(update.source==='inferred')profile.candidates.push({...pref,source:'inferred'});
  }
}
export function confirmPreference(profile,preferenceId){const candidate=profile.candidates.find(p=>p.id===preferenceId);if(!candidate||profile.preferences.length>=PREFERENCE_LIMIT)return false;profile.preferences.push({...candidate,source:'explicit'});profile.candidates=profile.candidates.filter(p=>p.id!==preferenceId);return true;}
export function editPreference(profile,preferenceId,text,category){const pref=profile.preferences.find(p=>p.id===preferenceId);if(!pref||!text.trim()||!categories.includes(category))return;profile.forgotten.push(normalized(pref.text));pref.text=text.trim().slice(0,1000);pref.category=category;pref.source='explicit';}
export function forgetPreference(profile,preferenceId){const pref=[...profile.preferences,...profile.candidates].find(p=>p.id===preferenceId);if(pref)profile.forgotten.push(normalized(pref.text));profile.preferences=profile.preferences.filter(p=>p.id!==preferenceId);profile.candidates=profile.candidates.filter(p=>p.id!==preferenceId);}
export function approveDraft(project){if(!project.brief.productDraft.trim())return;if(project.approvedDraft!==project.brief.productDraft){project.previousApprovedDraft=project.approvedDraft;project.approvedDraft=project.brief.productDraft;}project.sampleApproved=true;project.changeNote=project.interviewStage===9?'You approved this representative sample.':'You approved the current manuscript.';}
export function undoApproval(project){if(!project.previousApprovedDraft)return;project.brief.productDraft=project.previousApprovedDraft;project.approvedDraft=project.previousApprovedDraft;project.previousApprovedDraft='';project.reviewed=false;project.files=null;project.changeNote='Restored the previous approved manuscript.';}
export function applyReply(project,reply,revisionIntent=false,{profile,currentInput='',creatorInput=false}={}){
  const proposed=reply.brief?.productDraft;
  const protectedChange=project.approvedDraft&&!revisionIntent&&typeof proposed==='string'&&!proposed.startsWith(project.approvedDraft);
  if(revisionIntent&&project.approvedDraft&&typeof proposed==='string'&&proposed!==project.approvedDraft)project.previousApprovedDraft=project.approvedDraft;
  for(const key of briefKeys)if(typeof reply.brief?.[key]==='string'&&!(key==='productDraft'&&protectedChange))project.brief[key]=reply.brief[key];
  project.messages.push({role:'assistant',content:reply.message||'Your project is updated.'});project.stageReady=reply.stageReady===true;project.summary=reply.summary||'';
  project.suggestions=Array.isArray(reply.suggestions)?reply.suggestions.slice(0,6):[];project.companions=Array.isArray(reply.companions)?reply.companions.slice(0,6):[];
  project.changeNote=protectedChange?'Your approved text was kept. Use Revise approved text to request a change.':reply.summary||'Your working brief and product have been updated.';
  if(profile&&creatorInput)learnPreferences(profile,reply.preferenceUpdates,currentInput);
  project.reviewed=false;project.files=null;project.updatedAt=Date.now();return {protectedChange};
}
