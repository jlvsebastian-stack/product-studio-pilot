import {mkdtemp,writeFile,readFile,rm,mkdir,readdir,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {briefSchema} from './product.js';
import {modelOptions} from './models.js';
import {createCanvaSession} from './canva-session.js';
import {createOriginalArtwork,artworkReviewTool} from './canva-original-art.js';
import {qualityReviewInstructions,parseQualityReview,groundedQualityReview} from './final-quality.js';
import {qualityReviewKey} from '../public/quality-review.js';
import {CANVA_PRESENTATION_FONTS,cleanPresentationStyle} from '../public/presentation-style.js';
import {DESIGN_CONCEPTS,readConceptSections,fullSourceFingerprint,sourceFingerprint,nativeMetadataFingerprint,nativeSourceBindings,NATIVE_CANVA_POLICY_VERSION,artworkBindingOf,cleanArtworkBinding} from '../public/design-concepts.js';

const ids=new Set(['editorial','studio','warm']);
const normalized=value=>String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim();
const safeMessage=value=>String(value||'Canva did not finish this sample.').replace(/Bearer\s+\S+|sk-[A-Za-z0-9_-]{12,}/gi,'[redacted]').slice(0,650);
export function canvaEditUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&['canva.com','www.canva.com'].includes(url.hostname)&&/^\/(?:d\/[A-Za-z0-9_-]+|design\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?\/edit)(?:\/)?$/.test(url.pathname)?url.href:null;}catch{return null;}}
function dataOf(item){
  const unwrap=value=>{
    if(typeof value==='string'){try{return unwrap(JSON.parse(value));}catch{return value;}}
    if(!value||typeof value!=='object')return value;
    for(const key of ['structuredContent','structured_content','result'])if(value[key]!==undefined&&value[key]!==null)return unwrap(value[key]);
    for(const entry of value.content||[])if(entry.type==='text')try{return unwrap(JSON.parse(entry.text));}catch{}
    if(Array.isArray(value.content))return {text:value.content.filter(entry=>entry.type==='text'&&typeof entry.text==='string').map(entry=>entry.text).join('\n')};
    return value;
  };return unwrap(item.result||{});
}
function strings(value){if(typeof value==='string')return [value];if(Array.isArray(value))return value.flatMap(strings);if(value&&typeof value==='object')return Object.entries(value).filter(([key])=>key!=='_meta').flatMap(([,item])=>strings(item));return [];}
function designId(value){return value?.design_id||value?.designId||value?.design?.id||(value?.items?.length===1?value.items[0].id:'')||value?.data?.design_id||value?.data?.design?.id||'';}
const designOf=value=>value?.design||value?.items?.[0]||value;
const sampleTitle=job=>(job.brief.title||'My product')+' — '+(job.concept.title||job.concept.id)+(job.direct&&job.mode==='deck'?' deck':' sample');
const sourceUnits=brief=>readConceptSections(brief).filter(section=>section.audience.trim());
const styleOf=brief=>({design:brief.design||'',tone:brief.tone||''});
const sameStyle=(a,b)=>a?.design===b?.design&&a?.tone===b?.tone;
const sourceGuard=(brief,conceptId,direct,mode)=>createHash('sha256').update(JSON.stringify([brief.title,brief.outcome,brief.author,brief.format,brief.productDraft,styleOf(brief),conceptId,!!direct,mode])).digest('hex');
function retainedSourcesCurrent(job,brief,conceptId){
  if(job.concept.id!==conceptId||!sameStyle(styleOf(job.brief),styleOf(brief))||job.brief.title!==brief.title||job.brief.outcome!==brief.outcome||job.brief.author!==brief.author||job.brief.format!==brief.format)return false;
  const previous=sourceUnits(job.brief),current=sourceUnits(brief);
  return previous.length<=current.length&&previous.every((source,index)=>{const other=current[index];return other&&source.id===other.id&&source.title===other.title&&source.audience===other.audience&&source.notes===other.notes;});
}
function audienceMatches(page,text){
  const blocks=Array.isArray(page.visibleBlocks)&&page.visibleBlocks.length?page.visibleBlocks:[page.visibleText||''];
  if(!blocks.every(block=>text?.includes(normalized(block))))return false;
  const counts=value=>{const result=new Map();for(const word of normalized(value).toLocaleLowerCase('en-US').match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)||[])result.set(word,(result.get(word)||0)+1);return result;};
  const actual=counts(text);return [...counts(blocks.join(' '))].every(([word,count])=>(actual.get(word)||0)>=count);
}
function receiptShape(value){
  const fields=[];const visit=(node,path,depth)=>{if(fields.length>=24||depth>3)return;if(Array.isArray(node)){fields.push(path+'[]');if(node[0])visit(node[0],path+'[]',depth+1);}else if(node&&typeof node==='object')for(const [key,item]of Object.entries(node)){if(key==='_meta'||!/^\w{1,60}$/.test(key))continue;const next=path?path+'.'+key:key;fields.push(next);visit(item,next,depth+1);if(fields.length>=24)break;}};visit(value,'',0);return fields;
}
export function nativeToolError(item){
  const result=item.result||{},data=dataOf(item),error=typeof item.error==='string'?item.error:item.error?.message;
  if(item.status==='failed'||error||result.isError===true||result.is_error===true||data?.isError===true||data?.is_error===true||data?.success===false||data?.status==='failed')return safeMessage(error||data?.error?.message||data?.message||data?.error||strings(data).join(' ')||strings(result).join(' '));
  return null;
}
function indexedPages(value,notesOnly=false){
  const result=new Map();
  const visit=(node,key)=>{if(!node||typeof node!=='object')return;
    if(Array.isArray(node)&&/pages|notes/i.test(key||''))node.forEach((page,index)=>{if(page&&typeof page==='object'){
      const number=page.page_number??page.pageNumber??page.page_index??page.pageIndex??page.page??page.index??index+1;
      const content=notesOnly?(page.presenter_notes??page.presenterNotes??page.notes):page;
      if(Number.isInteger(number)&&content!==undefined)result.set(number,normalized(strings(content).join(' ')));
    }});
    if(!Array.isArray(node)){
    const page=node.page_number??node.pageNumber??node.page_index??node.pageIndex??node.page??node.index;
    const content=notesOnly?(node.presenter_notes??node.presenterNotes??node.notes):node;
    if(Number.isInteger(page)&&content!==undefined)result.set(page,normalized(strings(content).join(' ')));
  }for(const [childKey,child]of Object.entries(node))if(child&&typeof child==='object')visit(child,childKey);};visit(value);return result;
}
export function verifyCanvaResult(records,pages,{expectedTitle}={}){
  const imported=records.find(record=>/import-design-from-url/.test(record.tool)),receiptId=designId(imported?.data);
  const candidates=[...new Set(records.filter(record=>/get-design$/.test(record.tool)&&expectedTitle&&normalized(designOf(record.data)?.title)===normalized(expectedTitle)&&designId(record.data)===record.arguments?.design_id).map(record=>designId(record.data)).filter(Boolean))];
  const id=receiptId||(candidates.length===1?candidates[0]:'');
  return {...verifyCanvaReadback(id,records,pages,{expectedTitle}),receipt:receiptId?'recognized':id?'metadata-bound':imported?'opaque':'missing',metadataCandidates:candidates.length,receiptFields:receiptShape(imported?.data)};
}
export function verifyCanvaReadback(id,records,pages,{expectedTitle}={}){
  const metadata=records.findLast(record=>/get-design$/.test(record.tool)&&record.arguments?.design_id===id)?.data;
  const design=designOf(metadata);
  const url=canvaEditUrl(design?.urls?.edit_url||design?.edit_url||design?.editUrl);
  const count=metadata?.design?.page_count??metadata?.page_count??metadata?.pageCount??metadata?.design?.pageCount??metadata?.items?.[0]?.page_count;
  const content=records.findLast(record=>/get-design-content$/.test(record.tool)&&record.arguments?.design_id===id)?.data;
  const notes=records.findLast(record=>/get-presenter-notes$/.test(record.tool)&&record.arguments?.design_id===id)?.data;
  const nativeContent=indexedPages(content),nativeNotes=indexedPages(notes,true);
  for(const record of records)if(/get-design-content$/.test(record.tool)&&record.arguments?.design_id===id&&record.arguments.pages?.length===1&&Number.isInteger(record.arguments.pages[0]))nativeContent.set(record.arguments.pages[0],normalized(strings(record.data).join(' ')));
  const contentVerified=!!content&&pages.every((page,index)=>audienceMatches(page,nativeContent.get(index+1)||''));
  const notesVerified=!!notes&&pages.every((page,index)=>!normalized(page.notes)||nativeNotes.get(index+1)?.includes(normalized(page.notes)));
  const titleVerified=!expectedTitle||normalized(design?.title)===normalized(expectedTitle);
  const metadataVerified=!!id&&!!url&&designId(metadata)===id&&count===pages.length&&titleVerified;
  return {id,url,metadataVerified,titleVerified,contentVerified,notesVerified,verified:metadataVerified&&contentVerified&&notesVerified};
}
async function renderTransfer(brief,conceptId,resolved){
  const {renderCanvaTransfer}=await import('../public/design-concepts.js');
  const assetData={fonts:{}};
  const style=cleanPresentationStyle(resolved?.production?.concepts.find(concept=>concept.conceptId===conceptId)?.visualSystem)||DESIGN_CONCEPTS.find(concept=>concept.id===conceptId).visualSystem;
  for(const font of new Set([style.headingFont,style.bodyFont].map(family=>family.replaceAll(' ',''))))assetData.fonts[font]='data:font/ttf;base64,'+(await readFile(new URL(`../public/assets/fonts/${font}.ttf`,import.meta.url))).toString('base64');
  if(resolved)assetData.images=resolved.images;
  else if(conceptId==='warm')assetData.warmIllustration='data:image/png;base64,'+(await readFile(new URL('../public/assets/warm-digital-products.png',import.meta.url))).toString('base64');
  return renderCanvaTransfer({brief,conceptId,production:resolved?.production,assetData});
}
export function createCanvaProducer({providers,slideProduction,renderer=renderTransfer,createSession=createCanvaSession,fetchFn=fetch,now=Date.now,directory}={}){
  const jobs=new Map(),fingerprints=new Map(),previews=new Map();let active=null;
  async function persist(job){if(!directory)return;await mkdir(directory,{recursive:true});const target=join(directory,job.id+'.json'),temporary=target+'.tmp';const value={version:1,id:job.id,fingerprint:job.fingerprint,status:job.status,message:job.message,brief:job.brief,concept:job.concept,productionId:job.productionId,direct:job.direct,mode:job.mode,selected:job.selected,preauthorizeDraft:job.preauthorizeDraft,sampleJobId:job.sampleJobId,nativePlans:job.nativePlans,pages:job.pages,creationAttempted:job.creationAttempted,design:job.design,verification:job.verification,finished:job.finished,started:job.started,recoveryId:job.recoveryId,renderPolicyVersion:job.renderPolicyVersion,artworkBinding:job.artworkBinding,qualityReview:job.status==='ready'&&job.verification?.verified?parseQualityReview(job.qualityReview):null,qualityReviewContext:job.status==='ready'&&job.verification?.verified&&parseQualityReview(job.qualityReview)?job.qualityReviewContext:null};await writeFile(temporary,JSON.stringify(value),{mode:0o600});await rename(temporary,target);}
  const ready=(async()=>{if(!directory)return;let files;try{files=await readdir(directory);}catch(error){if(error.code==='ENOENT')return;throw error;}const receipts=files.filter(file=>/^[a-f0-9]{36}\.json$/.test(file));if(receipts.length>500)throw Error('The private Canva receipt library needs review before another creation. No duplicate design was started.');for(const file of receipts){try{const saved=JSON.parse(await readFile(join(directory,file),'utf8'));if(saved.version!==1||saved.id+'.json'!==file||!ids.has(saved.concept?.id)||typeof saved.fingerprint!=='string')continue;const brief=briefSchema.parse(saved.brief);if(saved.design&&!canvaEditUrl(saved.design.url))continue;const job={...saved,brief,records:[],calls:[]};if(saved.status!=='ready'||saved.verification?.verified!==true){job.status='unavailable';job.message=saved.creationAttempted?'A prior Canva creation has an unconfirmed or incomplete result. Check the existing design; this app will not import a duplicate.':saved.message||'This previous Canva preparation did not finish.';}jobs.set(job.id,job);if(job.creationAttempted||job.status==='ready')fingerprints.set(job.fingerprint,job.id);}catch{ /* Invalid private receipts cannot authorize readiness or a new write. */ }}const ordered=[...jobs.values()].sort((a,b)=>(a.started||a.finished||0)-(b.started||b.finished||0));jobs.clear();fingerprints.clear();for(const job of ordered){jobs.set(job.id,job);if(job.creationAttempted||job.status==='ready')fingerprints.set(job.fingerprint,job.id);}})();
  ready.catch(()=>{});
  const cachePreview=image=>{for(const [id,entry]of previews)if(entry.owner!==active?.id&&entry.expires<now())previews.delete(id);if(previews.size>=128)throw Error('The native preview batch exceeds the local review limit. Review a smaller batch before saving.');const id=randomBytes(20).toString('hex');previews.set(id,{bytes:image.bytes,mimeType:image.mimeType,owner:active?.id,expires:now()+30*60*1000});return {url:'/canva-previews/'+id};};
  const snapshot=job=>{
    const finishing=active===job&&!['running','approval'].includes(job.status);
    const automatic=job.preauthorizeDraft&&!!job.approval;
    return {id:job.id,status:finishing||automatic?'running':job.status,message:finishing?(job.status==='ready'?'Finishing the local Canva session and removing its temporary transfer.':`${job.message} The local Canva session is still finishing; wait before another attempt.`):automatic?'Continuing only the Canva draft actions authorized by this creation request.':job.message,...(job.direct?{productionId:job.productionId,...job.artworkBinding?{artworkBinding:job.artworkBinding}:{},...job.sampleJobId?{sampleJobId:job.sampleJobId}:{},renderPolicyVersion:job.renderPolicyVersion||1,mode:job.mode,conceptId:job.concept.id,fullSourceFingerprint:fullSourceFingerprint(job.brief,job.concept.id),style:styleOf(job.brief),pageCount:job.pages?.length||0,verified:!finishing&&job.status==='ready'&&job.verification?.verified===true,sampleFingerprint:sourceFingerprint(job.brief),metadataFingerprint:nativeMetadataFingerprint(job.brief,job.concept.id,job.renderPolicyVersion||1),sourceBindings:nativeSourceBindings(job.brief)}:{}),...(job.design?{design:job.design}:{}),...(job.approval&&!automatic?{approval:job.approval.public}:{}),...(job.status==='ready'&&!finishing&&job.verification?.verified&&parseQualityReview(job.qualityReview)?{qualityReview:parseQualityReview(job.qualityReview),qualityReviewContext:job.qualityReviewContext}:{}),verification:job.verification||null,diagnostics:{nativeCalls:job.calls||[],expectedPages:job.pages?.length||0}};
  };
  function status(id){const job=jobs.get(id);if(!job)throw Object.assign(new Error('This Canva production is no longer available.'),{statusCode:404});return snapshot(job);}
  async function start(raw,recoveryId){
    await ready;
    const brief=briefSchema.parse(raw.brief);
    if(raw.approvedSource!==brief.productDraft||brief.productDraft.trim().length<80)throw new Error('Approve the current source before creating a Canva sample.');
    if(!ids.has(raw.concept?.id)||raw.concept.version!==undefined&&raw.concept.version!==1)throw new Error('Choose one of the rendered design concepts first.');
    if(!/presentation|slides?|\bdeck\b|\bwebinars?\b/i.test(brief.format))return {id:'',status:'unavailable',message:'Canva sample production is for a presentation format. Your source and chosen format are unchanged.'};
    if(raw.provider!=='chatgpt')return {id:'',status:'unavailable',message:'Native Canva production currently supports your connected ChatGPT apps. Native Claude delivery is not available; your provider selection was not changed.'};
    let selected;
    try{if(typeof raw.model!=='string'||!raw.model||typeof raw.reasoningEffort!=='string')throw new Error('Choose the exact ChatGPT model and quality before creating a Canva sample.');selected=modelOptions('chatgpt',{model:raw.model,reasoningEffort:raw.reasoningEffort});}
    catch(error){return {id:'',status:'unavailable',message:error.message};}
    const direct=raw.direct===true,mode=raw.mode==='deck'?'deck':'samples';
    if(raw.direct!==undefined&&typeof raw.direct!=='boolean'||raw.preauthorizeDraft!==undefined&&typeof raw.preauthorizeDraft!=='boolean')throw Error('Choose a valid Canva creation mode.');
    if(direct&&raw.mode!==undefined&&!['samples','deck'].includes(raw.mode))throw Error('Choose sample or full-deck production.');
    if((direct||slideProduction)&&!recoveryId&&!raw.productionId)return {id:'',status:'unavailable',message:'Prepare the selected presentation’s actual final-use artwork before creating its Canva sample. Your saved artwork is retained; no icon layout was substituted.'};
    if(direct&&!slideProduction?.resolve)return {id:'',status:'unavailable',message:'The local artwork module is unavailable. Relaunch the app before creating this illustrated Canva sample.'};
    const base=direct&&mode==='deck'?jobs.get(raw.sampleJobId):undefined;
    if(direct&&mode==='deck'&&!recoveryId&&(raw.approvedSamples!==true||!base||!await sampleReady(base.id,brief,raw.concept.id)))throw Error('Review and approve a verified Canva sample for this unchanged source and style before creating the full deck.');
    const knownRecovery=recoveryId?[...jobs.values()].findLast(job=>job.design?.id===recoveryId&&job.direct&&job.mode===mode):undefined;
    const recoveryScope=recoveryId?(knownRecovery||[...jobs.values()].findLast(job=>job.direct&&job.mode===mode&&job.creationAttempted&&job.productionId&&fullSourceFingerprint(job.brief,raw.concept.id)===fullSourceFingerprint(brief,raw.concept.id)&&retainedSourcesCurrent(job,brief,raw.concept.id))):undefined;
    if(direct&&recoveryId&&(!recoveryScope||recoveryScope.renderPolicyVersion!==NATIVE_CANVA_POLICY_VERSION||!retainedSourcesCurrent(recoveryScope,brief,raw.concept.id)||fullSourceFingerprint(recoveryScope.brief,raw.concept.id)!==fullSourceFingerprint(brief,raw.concept.id)))throw Error('This existing Canva draft cannot be rechecked as a current sample: keep its earlier link and create a corrected sample for the current source and render policy.');
    if(direct&&recoveryId&&raw.productionId&&raw.productionId!==recoveryScope.productionId)throw Error('Read-only recovery requires the exact original artwork of the existing Canva draft. No new artwork or replacement was requested.');
    const concept={id:raw.concept.id,version:1,title:DESIGN_CONCEPTS.find(concept=>concept.id===raw.concept.id).title};
    // Legacy callers retain their established title; direct titles come from the selected template.
    if(!direct&&typeof raw.concept.title==='string')concept.title=raw.concept.title.slice(0,120);
    const guardFingerprint=sourceGuard(brief,concept.id,direct,mode);
    const priorSource=[...jobs.values()].findLast(job=>job.creationAttempted&&sourceGuard(job.brief,job.concept.id,job.direct,job.mode||'samples')===guardFingerprint);
    if(!recoveryId&&priorSource?.status!=='ready'&&priorSource)return status(priorSource.id);
    const fingerprint=createHash('sha256').update(JSON.stringify([brief.title,brief.outcome,brief.author,brief.format,brief.productDraft,styleOf(brief),concept.id,1,raw.productionId||'',direct,direct?NATIVE_CANVA_POLICY_VERSION:0,mode,raw.sampleJobId||'',selected.model,selected.reasoningEffort])).digest('hex');
    const cached=fingerprints.get(fingerprint),existing=cached&&(!direct||jobs.get(cached)?.renderPolicyVersion===NATIVE_CANVA_POLICY_VERSION)?cached:undefined;if(existing&&jobs.has(existing)&&!recoveryId)return status(existing);
    if(active)throw Object.assign(new Error('Your AI is already producing a Canva sample. Finish or decline its approval first.'),{statusCode:409});
    const job={id:randomBytes(18).toString('hex'),fingerprint,status:'running',started:now(),message:recoveryId?'Checking your existing Canva sample without creating another design.':'Preparing your selected concept for Canva.',brief,concept,productionId:recoveryScope?.productionId||raw.productionId,selected,records:[],calls:[],creationAttempted:!!recoveryId,recoveryId,direct,renderPolicyVersion:direct?NATIVE_CANVA_POLICY_VERSION:undefined,mode,sampleJobId:recoveryScope?.sampleJobId||base?.id,preauthorizeDraft:raw.preauthorizeDraft!==false};jobs.set(job.id,job);fingerprints.set(fingerprint,job.id);active=job;
    try{await persist(job);}catch(error){active=null;jobs.delete(job.id);fingerprints.delete(fingerprint);throw Error('The private Canva receipt could not be saved; no design was created.'+(/^[A-Z_]+$/.test(error.code||'')?' '+error.code:''));}
    queueMicrotask(()=>run(job));return snapshot(job);
  }
  async function sampleReady(id,brief,conceptId){await ready;const job=jobs.get(id);return Boolean(job&&job!==active&&job.status==='ready'&&job.verification?.verified===true&&job.verification.originalArtworkVerified===true&&job.direct&&job.renderPolicyVersion===NATIVE_CANVA_POLICY_VERSION&&job.productionId&&cleanArtworkBinding(job.artworkBinding,3)&&job.design&&job.mode==='samples'&&job.pages?.length===3&&retainedSourcesCurrent(job,brief,conceptId));}
  async function run(job){
    let directory,pendingExit,originals,artworkEdited=false,artworkCommitted=false;job.qualityReview=null;job.qualityReviewContext=null;
    try{
      const connection=await providers.status('chatgpt');if(!connection.ready)throw new Error('Connect your own ChatGPT subscription before creating a Canva sample.');if(connection.busy)throw new Error('Your AI is working on the conversation. Wait for that reply before producing a Canva sample.');
      const access=await providers.checkModel('chatgpt',job.selected);if(access?.available!==true)throw new Error(access?.message||'The selected ChatGPT model and quality could not be confirmed. Check this selection before creating a Canva sample.');
      let resolved=slideProduction&&job.productionId?await slideProduction.resolve(job.productionId,job.brief,job.concept.id):undefined;
      if(job.direct&&!resolved?.production)throw Error('This Canva sample requires the current saved artwork and visual plans. No icon or generic layout was substituted.');
      const nativeStyle=cleanPresentationStyle(resolved?.production?.concepts.find(concept=>concept.conceptId===job.concept.id)?.visualSystem)||DESIGN_CONCEPTS.find(concept=>concept.id===job.concept.id).visualSystem;
      if(!job.recoveryId&&[nativeStyle.headingFont,nativeStyle.bodyFont].some(font=>!CANVA_PRESENTATION_FONTS.includes(font)))throw Error(`Canva does not support Manrope for this draft. Choose ${CANVA_PRESENTATION_FONTS.join(', ')} before creating it. Your saved artwork, source and existing files are preserved.`);
      if(job.direct&&job.mode==='deck'){const covered=new Set(resolved.production.concepts.find(concept=>concept.conceptId===job.concept.id)?.slides.map(slide=>slide.sourceId)||[]);if(sourceUnits(job.brief).some(source=>!covered.has(source.id)))throw Error('Prepare the remaining selected slide artwork before creating the full Canva deck. The approved samples and their original artwork are retained.');}
      const rendered=await renderer(job.brief,job.concept.id,resolved);if(!rendered?.html||!Array.isArray(rendered.pages)||!rendered.pages.length)throw new Error('The selected concept did not provide a complete native sample.');
      if(job.direct&&job.mode==='samples'&&rendered.pages.length!==3)throw Error('A native sample must contain exactly three source-specific pages.');
      if(job.direct){job.artworkBinding=artworkBindingOf(rendered.pages);if(!job.artworkBinding)throw Error('The illustrated sample has no complete unique original-artwork binding. Its saved artwork was preserved.');}
      directory=await mkdtemp(join(tmpdir(),'product-studio-canva-'));const path=join(directory,'approved-sample.html');if(!job.recoveryId)await writeFile(path,rendered.html,{mode:0o600});job.pages=rendered.pages;
      originals=createOriginalArtwork({pages:job.pages,readOnly:!!job.recoveryId,fetchFn,cachePreview,getDesign:()=>{const readback=job.recoveryId?verifyCanvaReadback(job.recoveryId,job.records,job.pages,{expectedTitle:sampleTitle(job)}):verifyCanvaResult(job.records,job.pages,{expectedTitle:sampleTitle(job)});return readback.verified?readback.id:'';}});
      const autoContinue=()=>{if(!job.preauthorizeDraft)return;const approvalId=job.approval.public.id;queueMicrotask(()=>approve(job.id,{approvalId,action:'accept'}).catch(error=>{job.message='The authorized Canva step could not continue: '+safeMessage(error.message);job.autoError=safeMessage(error.message);}));};
      const boundDesign=()=>job.recoveryId||verifyCanvaResult(job.records,job.pages,{expectedTitle:sampleTitle(job)}).id;
      const onApproval=request=>{
        const params=request.params||{},meta=params._meta||{},args=meta.tool_params||{};
        if(job.approval)return false;
        const readTool=/canva\.(get-design|get-design-content|get-presenter-notes)(?:["?\s]|$)/.exec(params.message||'')?.[1];
        if(meta.codex_approval_kind==='mcp_tool_call'&&readTool&&boundDesign()&&args.design_id===boundDesign()&&Object.keys(args).every(key=>['design_id','pages','content_types','user_intent'].includes(key))){job.status='approval';job.approval={request,public:{id:randomBytes(18).toString('hex'),title:'Verify this Canva draft',message:params.message,scope:'Read only the current source-bound Canva design and its native page content/notes.'}};autoContinue();return true;}
        if(originals.active&&originals.permits(request)){job.status='approval';job.message='Canva needs your normal one-call approval for this sample’s original artwork.';job.approval={request,public:{id:randomBytes(18).toString('hex'),title:'Continue the original artwork step',message:params.message,scope:'Only this verified design and its already generated original media. No sharing or publishing.'}};autoContinue();return true;}
        const importRequest=/canva\.import-design-from-url/.test(params.message||'')||/^import.design.from.url$/i.test(meta.tool_title||'');
        if(job.recoveryId||job.importAuthorized||meta.codex_approval_kind!=='mcp_tool_call'||!importRequest||args.design_file!==path||args.url||args.intended_design_type!=='presentation'||args.name!==undefined&&args.name!==sampleTitle(job)||Object.keys(args).some(key=>!['design_file','intended_design_type','name','user_intent'].includes(key))||(job.importCalls||0)>1)return false;
        job.importAuthorized=true;
        job.status='approval';job.message='Canva needs your normal approval to import this sample.';
        job.approval={request,public:{id:randomBytes(18).toString('hex'),title:'Create this Canva sample',message:params.message||'Allow the Canva import?',scope:`Import ${job.pages.length} approved pages using your selected ${job.concept.title||job.concept.id} concept. No sharing or publishing.`}};autoContinue();return true;
      };
      const onTool=item=>{
        if(item.lifecycle==='item/started'){
          const tool=item.tool||'';if(!/^canva\.(?:import-design-from-url|get-design|get-design-content|get-presenter-notes|start-editing-transaction|perform-editing-operations|commit-editing-transaction|cancel-editing-transaction)$/.test(tool))throw Error('The helper attempted a Canva action outside this private draft.');
          if(tool==='canva.import-design-from-url'){const args=typeof item.arguments==='string'?JSON.parse(item.arguments):item.arguments||{};if(job.recoveryId||(job.importCalls||0)>0||args.design_file!==path||args.url||args.intended_design_type!=='presentation'||args.name!==undefined&&args.name!==sampleTitle(job)||Object.keys(args).some(key=>!['design_file','intended_design_type','name','user_intent'].includes(key)))throw Error('The helper attempted an import outside this exact private transfer. No replacement is authorized.');}
          if(/^canva\.(?:start-editing-transaction|perform-editing-operations|commit-editing-transaction|cancel-editing-transaction)$/.test(tool)&&!originals.permits({params:{message:tool,_meta:{codex_approval_kind:'mcp_tool_call',tool_params:typeof item.arguments==='string'?JSON.parse(item.arguments):item.arguments||{}}}}))throw Error('The helper attempted an edit outside this verified design and its exact original artwork.');
        }
        if(/^canva\.(?:start-editing-transaction|perform-editing-operations|commit-editing-transaction|cancel-editing-transaction)$/.test(item.tool||'')&&item.lifecycle!=='item/started'){
          const error=nativeToolError(item);if(error)throw Error(error);originals.record(item);if(item.tool==='canva.perform-editing-operations')artworkEdited=true;if(item.tool==='canva.commit-editing-transaction')artworkCommitted=true;return;
        }
        if(!/^canva\.(?:import-design-from-url|get-design|get-design-content|get-presenter-notes)$/.test(item.tool||''))return;
        if(/import-design-from-url/.test(item.tool))job.creationAttempted=true;
        if(/import-design-from-url/.test(item.tool)&&item.lifecycle==='item/started')job.importCalls=(job.importCalls||0)+1;
        if(item.lifecycle==='item/started')return;
        const data=dataOf(item),error=nativeToolError(item);
        if(job.calls.length<16)job.calls.push({tool:item.tool,status:error?'error':'completed',...(error?{message:error}:{}),fields:receiptShape(data)});
        if(error){job.nativeError=error;return;}
        let args=item.arguments||{};if(typeof args==='string')try{args=JSON.parse(args);}catch{args={};}
        job.records.push({tool:item.tool,arguments:args,data});
      };
      const onClientRequest=async request=>{if(!originals.active||job.recoveryId||job.approval)return false;const review=await originals.review(request);if(!review)return false;job.nativePreviews=review.previews;job.status='approval';job.message='Verifying the actual Canva draft with its original artwork before saving.';job.approval={request,kind:'artwork-preview',originals,public:{id:randomBytes(18).toString('hex'),title:'Verify original artwork in Canva',message:'These are actual native Canva draft previews. Saving this authorized draft does not approve its appearance.',scope:review.scope,previews:review.previews}};autoContinue();return true;};
      job.session=createSession({cwd:directory,onApproval,onTool,onClientRequest,dynamicTools:originals.active&&!job.recoveryId?[artworkReviewTool]:[],...job.selected});job.message=job.recoveryId?'Verifying the existing Canva sample through your own connection.':'Creating your editable Canva sample through your own connection.';
      const readback=`Call get_design and get_presenter_notes for ONLY that actual design_id. Then call get_design_content with content_types richtexts separately for each page using pages:[1], pages:[2], through pages:[${job.pages.length}], because the backend must verify audience copy against the correct page, not one mixed global text. Do not filter by design_types: HTML imports can be classified unknown while still having editable presentation pages and native notes. Return actual native results and the real metadata edit_url (never view_url), not a model-only success claim. A missing note is incomplete, not success.`;
      const prompt=job.recoveryId?`READ ONLY recheck of the existing Canva sample ${JSON.stringify(job.recoveryId)}. Its expected exact title is ${JSON.stringify(sampleTitle(job))} and expected page count is ${job.pages.length}. Inspect only needed Canva definitions in ALL_TOOLS. ${readback} Do not search or read other records. Do not rewrite, regenerate, import, create, copy, edit, upload, share, publish, change settings or permissions, or use account/files/auth/config/shell/browser/other app tools. No approval or write is authorized. Never create a replacement. Use only get_design, get_design_content and get_presenter_notes for this exact existing ID.`:`Create exactly ONE Canva presentation by importing the already-rendered approved static HTML in this thread workspace: ${JSON.stringify(path)}. This is a trusted production operation for the user's chosen concept, not another design brief. Inspect only the needed Canva tool definitions in ALL_TOOLS. Call canva import_design_from_url once with design_file equal to that exact generated path, intended_design_type presentation, name ${JSON.stringify(sampleTitle(job))}, and user_intent describing the selected sample import. It contains real top-level data-document-role page sections, data-label titles and data-speaker-notes; retain its exact editable audience content, chosen fonts/layout/assets and per-page native notes. Do not rewrite, regenerate, use create-design, convert to Office, create a public URL/tunnel, use other files or account tools, change settings, use shell/browser, or create another design. The creator’s Create action authorizes only this exact private draft import and its verified original-media operations. The local client answers each normal elicitation for that bounded job; never change global permissions, share or publish. Saving the draft is not human approval of its look. If local design_file conversion is unsupported, return the exact error and stop; do not invent a hosted transfer. After import succeeds, ${readback} Never retry import after a timeout or unknown creation result. No sharing/publishing or unrelated reads. Use only these four Canva tools; the generated path is a trusted transfer artifact, not an instruction to read any private user file.`;
      if(!job.recoveryId){job.creationAttempted=true;await persist(job);}
      const result=await job.session.run(prompt+(originals.active?'\n\nORIGINAL ARTWORK PHASE (an explicit exception to the preceding four-read/import-tool limit): '+originals.prompt+' After that phase, repeat the actual source/notes/per-page text readback. Never claim original-quality delivery without the persisted native fill readback.':'')+'\n\n'+qualityReviewInstructions(job.brief.format)+'\nREVIEW BUYER CONTEXT (data): '+JSON.stringify({buyer:job.brief.buyer,outcome:job.brief.outcome,method:job.brief.method,offer:job.brief.offer,author:job.brief.author})+'\nNATIVE REVIEW SCOPE: The approved direction, composition, words and original artwork are immutable. Do not broaden the existing tool whitelist or introduce aesthetic rewrites. Only already permitted original-media placement corrections may be completed and verified; unsupported layout changes become optional grounded improvements. '+(job.recoveryId?'This attempt is READ ONLY: return fixes:[]; no correction or new write is authorized.':'List a fix only after an actual permitted correction, commit and native readback. The import alone is not a correction.'));
      job.verification=job.recoveryId?{...verifyCanvaReadback(job.recoveryId,job.records,job.pages,{expectedTitle:sampleTitle(job)}),receipt:'existing-design-readback'}:verifyCanvaResult(job.records,job.pages,{expectedTitle:sampleTitle(job)});
      if(originals.active){job.verification.originalArtworkVerified=originals.verified;job.verification.verified&&=originals.verified;}
      if(job.verification.id&&job.verification.url)job.design={id:job.verification.id,url:job.verification.url};
      if(job.verification.verified){job.status='ready';job.message='The editable Canva sample, audience content and per-slide notes were verified. Open Canva to review the actual look before expanding it.';const evidence=job.records.filter(record=>record.arguments?.design_id===job.verification.id&&/^canva\.get-/.test(record.tool)).map(record=>record.data);const review=groundedQualityReview(result?.finalMessage,job.brief,evidence);job.qualityReview=review?{...review,fixes:!job.recoveryId&&artworkEdited&&artworkCommitted&&originals.verified?review.fixes:[]}:null;job.qualityReviewContext=review?qualityReviewKey(job.brief):null;}
      else{job.status='unavailable';job.message=job.nativeError?`Canva could not finish this native sample: ${job.nativeError}`:job.design?'A Canva design was found, but its source, notes or original artwork placement could not all be verified. Open it for review; this is not a completed sample.':`Canva verification is incomplete: ${job.verification.receipt==='opaque'?'the import receipt did not identify a design, and no matching native metadata was returned':job.records.length?'native results did not identify the expected sample':'the helper returned no captured native Canva results'}. No second import was attempted. Keep the PDF or source fallback.`;}
    }catch(error){
      job.status='unavailable';job.message=safeMessage(error.message);
      if(job.pages){job.verification=job.recoveryId?{...verifyCanvaReadback(job.recoveryId,job.records,job.pages,{expectedTitle:sampleTitle(job)}),receipt:'existing-design-readback'}:verifyCanvaResult(job.records,job.pages,{expectedTitle:sampleTitle(job)});if(job.verification.id&&job.verification.url)job.design={id:job.verification.id,url:job.verification.url};}
      if(originals?.active&&job.verification){job.verification.originalArtworkVerified=originals.verified;job.verification.verified&&=originals.verified;}
      if(error.unconfirmedTermination)pendingExit=error.processExit;
    }
    finally{
      job.approval=null;
      const release=async()=>{if(directory)await rm(directory,{recursive:true,force:true}).catch(()=>{});job.finished=now();try{await persist(job);}catch{job.status='unavailable';job.message='The Canva result could not be saved to its private local receipt. Keep its editor link; do not create another copy.';}if(active===job)active=null;};
      if(pendingExit)pendingExit.then(release);else await release();
      if(!job.creationAttempted&&!job.recoveryId)fingerprints.delete(job.fingerprint);
    }
  }
  async function approve(id,{approvalId,action}={}){
    const job=jobs.get(id);if(!job||job.status!=='approval'||job.approval?.public.id!==approvalId)throw Object.assign(new Error('This approval is no longer pending.'),{statusCode:409});
    if(!['accept','decline','cancel'].includes(action))throw new Error('Choose Accept, Decline or Cancel.');
    const pending=job.approval;job.approval=null;job.status='running';
    if(action==='accept')job.creationAttempted=true;
    try{await persist(job);}catch(error){job.session.respond(pending.request.id,pending.kind==='artwork-preview'?pending.originals.decision('decline'):{action:'cancel',content:null});throw Error('The private creation receipt could not be saved. The Canva action was cancelled.');}
    const response=pending.kind==='artwork-preview'?pending.originals.decision(action,{productionAuthorized:job.preauthorizeDraft}):{action,content:action==='accept'?{}:null};
    await job.session.respond(pending.request.id,response);job.message=action==='accept'?'Continuing the authorized Canva draft step. Human appearance review follows in Canva.':'Finishing the declined Canva request.';return snapshot(job);
  }
  async function recheck(raw){if(typeof raw.designId!=='string'||!/^DA[A-Za-z0-9_-]{4,100}$/.test(raw.designId))throw new Error('Recheck needs the exact existing Canva design ID.');return start(raw,raw.designId);}
  function preview(id){const value=previews.get(id);if(!value||value.expires<now()&&value.owner!==active?.id)throw Object.assign(Error('This native draft preview expired.'),{statusCode:404});return value;}
  return {start,recheck,status,approve,preview,sampleReady,ready,close:async()=>{if(active?.session)await active.session.close();},get busy(){return !!active;}};
}
