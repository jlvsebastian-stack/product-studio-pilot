import {cleanQualityReview} from './quality-review.js';
export const googleSourceKey=brief=>JSON.stringify([brief.title,brief.format,brief.productDraft,brief.tone,brief.design]);
export const googleDestination=brief=>/spreadsheet|sheets|calculator|tracker/i.test(brief.format||'')?'sheets':'docs';
export const googleLabel=destination=>destination==='sheets'?'Google Sheets':'Google Docs';
export function googleEditorUrl(value,destination,id){
  try{const url=new URL(value),kind=destination==='sheets'?'spreadsheets':'document',match=new RegExp('^/'+kind+'/d/([A-Za-z0-9_-]{3,200})/edit/?$').exec(url.pathname);return url.protocol==='https:'&&url.hostname==='docs.google.com'&&!url.username&&!url.password&&!url.port&&match&&(!id||id===match[1])?url.href:null;}catch{return null;}
}
export function cleanGoogleDelivery(value){
  if(!value||typeof value!=='object'||!/^[a-f0-9]{36}$/.test(value.id||'')||!['docs','sheets'].includes(value.destination)||!['running','ready','unavailable'].includes(value.status)||typeof value.sourceKey!=='string'||value.sourceKey.length>1000000)return null;
  const clean={id:value.id,destination:value.destination,sourceKey:value.sourceKey,status:value.status,message:typeof value.message==='string'?value.message.slice(0,1000):'',creationAttempted:value.creationAttempted===true,verified:value.verified===true};
  if(value.file){const file=value.file,url=googleEditorUrl(file.url,value.destination,file.id);if(!url||typeof file.id!=='string'||typeof file.title!=='string')return null;clean.file={id:file.id,title:file.title.slice(0,500),url};}
  if(clean.status==='ready'&&(!clean.verified||!clean.file))return null;
  if(clean.status==='ready'&&clean.verified&&typeof value.qualityReviewContext==='string'&&value.qualityReviewContext.length<=1000000){const review=cleanQualityReview(value.qualityReview);if(review){clean.qualityReview=review;clean.qualityReviewContext=value.qualityReviewContext;}}
  return clean;
}
export function nativeGoogleAction({project,runtime,connected,modelReady,provider,complete,working,serverChecked}){
  const brief=project.brief,job=cleanGoogleDelivery(project.googleDelivery),destination=googleDestination(brief),label=googleLabel(destination),sourceCurrent=job?.sourceKey===googleSourceKey(brief)&&job.destination===destination;
  if(!runtime||!brief.productDraft.trim()||project.approvedDraft!==brief.productDraft)return null;
  if(working&&job?.status!=='running')return null;
  if(job&&sourceCurrent&&!serverChecked)return {kind:'google-refresh',title:'Checking your saved Google delivery',detail:'Confirming the saved production receipt before showing an editor link.'};
  if(job&&sourceCurrent&&job.status==='running')return {kind:'google-progress',title:`Creating your ${googleLabel(job.destination)} file`,detail:job.message||'Using your own connected account and checking the actual file.'};
  if(job&&sourceCurrent&&job.status==='ready')return {kind:'google-ready',title:`Your ${googleLabel(job.destination)} file is ready to review`,detail:'The actual native file was created and read back. Open it to review the content and usability.',primary:{href:job.file.url,label:`Open in ${googleLabel(job.destination)}`},secondary:{id:'view-files',label:'View delivery'}};
  if(job&&sourceCurrent&&job.status==='unavailable'&&job.creationAttempted){
    if(destination==='docs'&&provider==='chatgpt'&&connected&&modelReady&&!working)return {kind:'google-resume',title:'Finish your existing Google Doc',detail:'Paste the exact existing Doc link. The app fills it only if blank, or formats it only if all approved content and tables match. Incomplete or mismatched content stays untouched. No new Doc is created.',primary:{id:'resume-google',label:'Finish existing Doc'},secondary:{id:'view-draft',label:'Review approved draft'}};
    if(destination==='sheets'&&job.file&&provider==='chatgpt'&&connected&&modelReady&&!working)return {kind:'google-recheck',title:'Recheck your existing Google Sheet',detail:'Run a read-only check of the known spreadsheet, tabs, cells and formulas against your approved product. No cells are changed and no new spreadsheet is created.',primary:{id:'recheck-google',label:'Recheck existing Google Sheet'},secondary:{id:'view-draft',label:'Review approved source'}};
    return {kind:'google-unavailable',title:'Google delivery needs a check',detail:job.message||'The creation outcome is unconfirmed. A duplicate will not be created automatically.',primary:{id:'view-draft',label:'Keep reviewing your draft'},secondary:{id:'view-files',label:'View delivery'}};
  }
  if(!complete||working)return null;
  if(provider!=='chatgpt')return {kind:'google-settings',title:`Create the actual ${label} file`,detail:'Native Google creation currently uses the ChatGPT helper. Your Claude selection stays unchanged; choose ChatGPT explicitly if you want to create this file.',primary:{id:'google-settings',label:'Review AI settings'},secondary:{id:'view-files',label:'View delivery'}};
  if(!connected||!modelReady)return null;
  return {kind:'google-create',title:`Create your native ${label} product`,detail:`Use your own connected Google account. This creates one private ${destination==='sheets'?'spreadsheet with working formulas':'editable document'} and checks its contents.`,primary:{id:'create-google',label:`Create in ${label}`,disabled:!connected||!modelReady},secondary:{id:'view-files',label:'View delivery'}};
}
