
const {loadStudio,persistStudio,mergeSavedProjects,newProject,openProject,checkpoint,importProject,confirmPreference,editPreference,forgetPreference,approveDraft,undoApproval,applyReply,currentDraftSection,acceptSampleFiles,activePreferences,PREFERENCE_LIMIT,cleanCanvaJob}=await import('./studio-store.js').catch(error=>{
  document.getElementById('workspace-content').textContent='Restart the app to finish this update. Your earlier browser project is retained.';
  document.getElementById('model-note').textContent='Restart the app to finish this update.';
  for(const id of ['provider','model','quality','new-project','open-project','save-project'])document.getElementById(id).disabled=true;
  throw error;
});
const {expandedOutlineSections,expandedOutlineValid,outlineApprovalCurrent,expandedOutlineApprovalCurrent,expandedOutlineCovered,creationProgress,manuscriptHeadings}=await import('./outline-plan.js').catch(error=>{
  document.getElementById('workspace-content').textContent='Restart the app to finish this update. Your saved projects and unsent answer are retained.';
  document.getElementById('model-note').textContent='Restart the app to load the product-plan review.';
  for(const id of ['provider','model','quality','new-project','open-project','save-project'])document.getElementById(id).disabled=true;
  throw error;
});
const {createProjectLibrary}=await import('./project-library.js');
const {googleSourceKey,googleDestination,googleLabel,googleEditorUrl,cleanGoogleDelivery,nativeGoogleAction}=await import('./google-delivery.js');
const {qualityReviewKey,renderQualityReview}=await import('./quality-review.js');
const {namedSectionEditRequest}=await import('./scoped-edit-request.js');
const {BACKUP_LIMIT,bindComposer,createReferenceComposer,extractHttpLinks,recordRequest,requestMessages,referenceStatus}=await import('./composer.js');
const {DESIGN_CONCEPTS,renderConceptSlides,readConceptSections,fontCss,isPresentation,sourceFingerprint,chooseConcept,approveConcept,designApprovalCurrent,fullSourceFingerprint,canvaEditorUrl,cleanCanvaSample,canvaSampleCurrent,nativeSampleCurrent,cleanSlideProduction,productionStyleCurrent,SLIDE_POLICY_VERSION,NATIVE_CANVA_POLICY_VERSION}=await import('./design-concepts.js');
const {templatePreview}=await import('./template-previews.js').catch(error=>{
  document.getElementById('workspace-content').textContent='Restart the app to finish this update. Your saved projects and unsent answer are retained.';
  document.getElementById('model-note').textContent='Restart the app to load the presentation templates.';
  for(const id of ['provider','model','quality','new-project','open-project','save-project'])document.getElementById(id).disabled=true;
  throw error;
});
const {currentAction}=await import('./current-action.js').catch(error=>{document.getElementById('workspace-content').textContent='Restart the app to finish this update. Your saved projects and unsent answer are retained.';throw error;});
const conceptFonts=document.createElement('style');conceptFonts.textContent=fontCss();document.head.append(conceptFonts);
const {createModelAccess,modelAccessKey,modelSelection}=await import('./model-access.js').catch(error=>{
  document.getElementById('workspace-content').textContent='Restart the app to finish this update. Your saved projects and unsent answer are retained.';
  document.getElementById('model-note').textContent='Restart the app to check model access.';
  for(const id of ['provider','model','quality','new-project','open-project','save-project'])document.getElementById(id).disabled=true;
  throw error;
});
const STAGES=[['Discover what you know','Your experience, natural strengths, decisions, and stories.'],['Find a useful problem','A real problem your knowledge can help someone solve.'],['Find your target market','Who has that problem, and what is their situation?'],['Niche down','One specific person, problem, situation, and outcome.'],['Check the market','John Connor finds comparable products and helps you spot useful improvements.'],['Design a better offer','Combine your expertise and useful improvements into a clear solution.'],['Choose the format','Choose how the buyer will use the solution.'],['Refine the outline','Decide what belongs, what is missing, and the right order.'],['Set the voice and design','Agree on language, design, and one representative sample.'],['Build your first draft','Create the complete product, then review it together.'],['Review and improve','Check the substance, accuracy, usability, and package.'],['Download your product','Create and check the actual files.']];
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rich=text=>esc(text).replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/\n/g,'<br>');
let storage;try{storage=window.localStorage;}catch{storage={getItem(){throw Error('Unavailable');},setItem(){throw Error('Unavailable');}};}
const studio=loadStudio(storage);
let state=studio.projects.find(p=>p.id===studio.activeId),working=false,accountReady=false,runtimeReady=false,runtimeError='',view='brief',noticeTimer,loginPoll,previewTimer,previewAbort,previewVersion=0,revisionMode=false,previewOpen=false;
let preview={key:'',status:'empty',pages:[],message:''},catalog=null,autosaveOK=!studio.storageWarning;
let diskSaveStatus='loading';
const sectionViews={};
const projectLibrary=createProjectLibrary({studio,checkpoint,merge:mergeSavedProjects,request:async(method,body)=>{const response=await fetch('/api/projects',method==='POST'?{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const data=await response.json();if(!response.ok)throw Error(data.error||'Local project saving is unavailable.');return data;},onStatus:status=>{diskSaveStatus=status;if($('autosave'))$('autosave').textContent=status==='saved'?'Saved on this computer':status==='saving'?'Saving on this computer…':'Local save unavailable · browser copy retained';}});
let conceptFocus=state.presentationDesign?.conceptId||'editorial',reviewSlide=0;const canvaJobs=new Map(),slidePolling=new Set(),illustrationEdits=new Map(),outlineJobs=new Map();let actionResizeObserver;const googleChecked=new Set(),googlePolling=new Set(),googleRefreshing=new Set(),googleResumeUrls=new Map();
const hasConcepts=()=>isPresentation(state.brief)&&!!state.brief.productDraft.trim()&&state.interviewStage>=9;
if(hasConcepts()&&!designApprovalCurrent(state))view='design';
for(const project of studio.projects)if(project.canvaJob)canvaJobs.set(project.id,{...project.canvaJob,needsRefresh:true});
const productionKey=project=>fullSourceFingerprint(project.brief,project.presentationDesign?.conceptId)+(project.slideProduction?.id?':'+project.slideProduction.id:'');
const referenceComposers=new Map();
function referenceComposer(project=state){if(!referenceComposers.has(project.id))referenceComposers.set(project.id,createReferenceComposer(project,{ingest:body=>post('/api/references',body),onChange:()=>{project.updatedAt=Date.now();save();if(state.id===project.id)renderChat();}}));return referenceComposers.get(project.id);}
function queueReferences(type,items,project=state){if(!runtimeReady){notice('Restart the app to attach references. Your answer is retained.',true);return;}const session=referenceComposer(project);session[type](items).catch(error=>notice(error.message,true));}
function referenceChip(reference,{pending=false}={}){return `<li class="reference-chip"><div><strong>${esc(reference.name)}</strong><span class="reference-state">${pending?'Waiting to send · ':''}${esc(referenceStatus(reference))}</span><small>${esc(reference.note)}</small></div><button type="button" class="quiet" data-remove-reference="${esc(reference.id)}" aria-label="Remove reference ${esc(reference.name)}">Remove</button></li>`;}
const readSetting=(key,fallback)=>{try{return storage.getItem(key)||fallback;}catch{return fallback;}};
const setting=(key,value)=>{try{storage.setItem(key,value);}catch{notice('This browser could not save your AI selection.',true);}};
let autoApproveArtwork=readSetting('product-studio-auto-artwork','true')!=='false';
let provider=readSetting('product-studio-provider','chatgpt')==='claude'?'claude':'chatgpt',selectedModel='',quality=readSetting('product-studio-quality','medium');if(!['medium','high','xhigh'].includes(quality))quality='medium';
let accountCheckVersion=0;
const selectedCombination=()=>({provider,model:selectedModel,reasoningEffort:quality});
const modelAccess=createModelAccess({request:selection=>post('/api/check-model',selection),onChange:()=>{updateModelNote();if(view==='design'||view==='brief'&&state.interviewStage>=8)render();else renderChat();refreshExpiredModelAccess();}});
const canUseModel=()=>runtimeReady&&accountReady&&!!selectedModel&&modelAccess.ready&&modelAccessKey(modelAccess.state.selection)===modelAccessKey(selectedCombination());
function checkSelectedModel(force=false){if(!runtimeReady||!accountReady||!selectedModel){modelAccess.clear();return;}if(working)return;return modelAccess.check(selectedCombination(),{force});}
function refreshExpiredModelAccess(){if(!document.hidden&&!working&&runtimeReady&&accountReady&&selectedModel&&modelAccess.state.status==='expired')return checkSelectedModel();}
function title(p=state){return p.brief.title||p.brief.topic||'Untitled project';}
function save(){state.updatedAt=Date.now();const result=persistStudio(storage,studio);autosaveOK=result.ok;if($('autosave'))$('autosave').textContent=result.ok?'Saved in this browser on this computer':'Autosave unavailable · save a backup';if(!result.ok)notice(result.error,true);projectLibrary.schedule();return result.ok;}
function notice(text,error=false){$('notice').textContent=text;$('notice').className=error?'error':'';$('notice').style.display='block';clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').style.display='none',error?16000:6500);}
function invalidate(){document.querySelector('.final-quality-review')?.remove();state.reviewed=false;state.files=null;state.sampleFiles=null;state.sampleFingerprint='';if($('sample-links'))$('sample-links').innerHTML='';if($('download-links'))$('download-links').innerHTML='';if($('reviewed'))$('reviewed').checked=false;if($('export-product'))$('export-product').disabled=true;}
function toggleSettings(show,restoreFocus=false){
  $('settings-panel').hidden=!show;$('settings-toggle').setAttribute('aria-expanded',String(show));
  if(show){$('projects-panel').hidden=true;$('open-project').setAttribute('aria-expanded','false');}
  if(!show)for(const name of ['account','preferences']){$(name+'-panel').hidden=true;$(name+'-toggle').setAttribute('aria-expanded','false');}
  if(restoreFocus)$('settings-toggle').focus();
}
function panel(id,show){
  if(id==='settings-panel')return toggleSettings(show);
  if(show)toggleSettings(id!=='projects-panel');
  const controls={'account-panel':'account-toggle','preferences-panel':'preferences-toggle','projects-panel':'open-project'};
  for(const [name,control] of Object.entries(controls))if(name===id||show){const open=name===id&&show;$(name).hidden=!open;$(control).setAttribute('aria-expanded',String(open));}
}
function nativeSamplesApproved(project=state){return Boolean(nativeSampleCurrent(project)&&project.canvaSample?.mode==='samples'&&project.approvedCanvaSampleId===project.canvaSample.jobId&&designApprovalCurrent(project));}
function nativeDeckCurrent(project=state){return Boolean(project.canvaDeck?.mode==='deck'&&nativeSampleCurrent({...project,canvaSample:project.canvaDeck}));}
function localCompleteNonpresentation(project=state){
  const draft=project.brief.productDraft;
  if(!runtimeReady||working||isPresentation(project.brief)||project.interviewStage<10||!draft.trim()||!expandedOutlineCovered(project))return false;
  const sections=expandedOutlineSections(draft.replace(/^#[ \t]+/gm,'## '));
  return expandedOutlineSections(project.approvedExpandedOutline).every(planned=>sections.some(section=>section.heading===planned.heading&&/[\p{L}\p{N}]/u.test(section.body.replace(/^ {0,3}#{1,6}[ \t]+.*$/gm,''))));
}
function localFilesReady(project=state){return localCompleteNonpresentation(project)&&project.approvedDraft===project.brief.productDraft;}
const nativeKey=project=>JSON.stringify([fullSourceFingerprint(project.brief,project.presentationDesign?.conceptId),project.brief.design||'',project.brief.tone||'']);
function currentActionState(){
  const google=nativeGoogleAction({project:state,runtime:runtimeReady,connected:accountReady,modelReady:canUseModel(),provider,complete:localFilesReady(),working,serverChecked:googleChecked.has(state.googleDelivery?.id)});
  if(!isPresentation(state.brief)&&google&&(view!=='files'||state.interviewStage===12||['google-create','google-ready','google-refresh','google-resume','google-recheck','google-progress'].includes(google.kind))&&!(google.kind==='google-create'&&state.interviewStage===11&&state.stageReady))return google;
  const sampleCurrent=nativeSampleCurrent(state)&&state.canvaSample?.mode==='samples',job=canvaJobs.get(state.id),native=job?{...job,current:job.renderPolicyVersion===NATIVE_CANVA_POLICY_VERSION&&job.key===(job.direct?nativeKey(state):productionKey(state))}:null;
  const action=currentAction({runtime:runtimeReady,connected:accountReady,modelReady:canUseModel(),working,stage:state.interviewStage,stageReady:state.stageReady,plan:{...creationProgress(state),hasBasic:!!state.brief.outline.trim(),basicApproved:outlineApprovalCurrent(state),hasExpanded:!!state.expandedOutline,expandedApproved:expandedOutlineApprovalCurrent(state),valid:expandedOutlineValid(state.expandedOutline||''),covered:expandedOutlineCovered(state),error:outlineJobs.get(state.id)?.status==='error'},sample:{presentation:isPresentation(state.brief),choice:state.presentationDesign?.conceptId,current:sampleCurrent,approved:nativeSamplesApproved(state),url:sampleCurrent?state.canvaSample.url:undefined,deckCurrent:nativeDeckCurrent(state),deckUrl:state.canvaDeck?.url,artworkRetry:canResumeSlides(state)},draft:{hasSource:!!state.brief.productDraft.trim(),pending:state.approvedDraft!==state.brief.productDraft,sampleApproved:state.sampleApproved},nativeJob:native,slideJob:state.slideProduction,reviewed:state.reviewed,filesView:view==='files'});
  const localReady=localFilesReady();
  if(localCompleteNonpresentation()&&!localReady&&!['canva-approval','slide-approval','canva-progress','slide-progress'].includes(action.kind))return {kind:'approve-manuscript',title:'Review the complete first draft',detail:'Read the whole product and request any focused changes before approving it.',primary:{id:'approve-draft',label:'Approve full draft'},secondary:{id:'view-draft',label:'Review full draft'}};
  if(!isPresentation(state.brief)&&action.kind==='export'&&!localReady)return {kind:'review-written',title:'Finish reviewing the complete manuscript',detail:'Final files need every approved plan section and approval of the current manuscript.',primary:{id:'view-draft',label:'Review full draft'}};
  if(runtimeReady&&!working&&localReady&&!['canva-approval','slide-approval','canva-progress','slide-progress'].includes(action.kind))return view==='files'?{kind:'export',title:'Create your reviewed files',detail:'Review the content, examples, author details and usage rights. Listing copy and companion ideas are optional.',primary:{id:'export',label:'Create download package',disabled:!state.reviewed},reviewCheckbox:true}:{kind:'local-files',title:'Your complete manuscript is approved',detail:'Review and download the PDF and text copy. Listing copy and companion ideas can wait.',primary:{id:'view-files',label:'Review & download files'},secondary:action.kind==='advance'?action.primary:undefined};
  return action;
}
function actionToken(action){const native=canvaJobs.get(state.id),slide=state.slideProduction;return JSON.stringify([state.id,action.kind,native?.id,native?.approval?.id,slide?.id,slide?.approval?.id,state.presentationDesign?.conceptId,fullSourceFingerprint(state.brief,''),state.googleDelivery?.id,state.googleDelivery?.status]);}
function renderCurrentAction(){
  const bar=$('current-action');if(!bar)return;const previous=document.activeElement?.closest?.('#current-action')?document.activeElement.dataset.currentAction:null,resumeFocus=document.activeElement?.id==='google-resume-url',action=currentActionState(),token=actionToken(action),resumeUrl=googleResumeUrls.get(state.googleDelivery?.id)||'',button=(item,primary=false)=>!item?'':item.href&&(canvaEditorUrl(item.href)||googleEditorUrl(item.href,'docs')||googleEditorUrl(item.href,'sheets'))?`<a href="${esc(item.href)}" target="_blank" rel="noopener noreferrer" class="${primary?'primary':''}">${esc(item.label)}</a>`:`<button type="button" data-current-action="${esc(item.id)}" class="${primary?'primary':''}" ${item.disabled||item.id==='resume-google'&&!googleEditorUrl(resumeUrl,'docs')?'disabled':''}>${esc(item.label)}</button>`;
  bar.innerHTML=action.kind==='conversation'?'<span id="current-action-title" class="current-action-idle sr-only">Continue the conversation</span>':action.kind==='working'?`<p class="workspace-status" role="status"><span class="spinner" aria-hidden="true"></span><span><strong id="current-action-title">${esc($('busy-title')?.textContent||action.title)}</strong><span id="current-action-detail">You can keep typing while your AI works.</span></span></p>`:`<div class="current-action-copy"><h2 id="current-action-title">${esc(action.title)}</h2><p id="current-action-detail" role="status">${esc(action.detail||'')}</p>${action.kind==='google-resume'?`<label for="google-resume-url">Exact existing Google Doc link</label><input id="google-resume-url" type="url" maxlength="500" autocomplete="off" aria-describedby="current-action-detail" value="${esc(resumeUrl)}" placeholder="https://docs.google.com/document/d/…/edit">`:''}${action.reviewCheckbox?`<label><input id="current-files-reviewed" type="checkbox" ${state.reviewed?'checked':''}><span>I reviewed the content and usage rights.</span></label>`:''}</div><div class="current-action-buttons">${button(action.primary,true)}${button(action.secondary)}${['canva-approval','slide-approval'].includes(action.kind)&&view!=='design'?button({id:'view-design',label:'Review request details'}):''}</div>`;
  bar.querySelectorAll('[data-current-action]').forEach(control=>control.onclick=()=>runCurrentAction(control.dataset.currentAction,token));if($('current-files-reviewed'))$('current-files-reviewed').onchange=event=>{state.reviewed=event.target.checked;save();renderCurrentAction();};
  if($('google-resume-url')){const jobId=state.googleDelivery.id;$('google-resume-url').oninput=event=>{googleResumeUrls.set(jobId,event.target.value);const control=bar.querySelector('[data-current-action="resume-google"]');if(control)control.disabled=!googleEditorUrl(event.target.value,'docs');};if(resumeFocus)$('google-resume-url').focus({preventScroll:true});}
  if(previous){const target=bar.querySelector(`[data-current-action="${previous}"]`);if(target&&!target.disabled)target.focus({preventScroll:true});else bar.focus({preventScroll:true});}
  const resize=()=>document.documentElement.style.setProperty('--current-action-height',bar.getBoundingClientRect().height+'px');resize();if(!actionResizeObserver&&typeof ResizeObserver==='function'){actionResizeObserver=new ResizeObserver(resize);actionResizeObserver.observe(bar);}
  restoreCanvaJob(state);continueCanvaHandoff(state);restoreGoogleDelivery(state);
}
function showWorkspace(target,wholePlan=false){const chatTop=$('messages')?.scrollTop;if(target==='brief'&&wholePlan)sectionViews.plan={projectId:state.id,heading:'',all:true};view=target;render();if(chatTop!==undefined&&$('messages'))$('messages').scrollTop=chatTop;const workspace=document.querySelector('.workspace');if(workspace)workspace.scrollTop=0;const heading=document.querySelector('#workspace-content h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
async function runCurrentAction(id,token){
  const action=currentActionState();if(token!==actionToken(action))return renderCurrentAction();const offered=[action.primary,action.secondary,...(['canva-approval','slide-approval'].includes(action.kind)?[{id:'view-design'}]:[])].find(item=>item?.id===id);if(!offered||offered.disabled)return;
  if(id==='view-design')return showWorkspace('design');if(id==='view-plan')return showWorkspace('brief',true);if(id==='view-draft')return showWorkspace('draft');if(id==='view-files')return showWorkspace('files');if(id==='focus-chat'){$('answer').focus();$('sidebar').scrollIntoView({behavior:'smooth',block:'start'});return;}
  if(id==='build-full-draft')return buildFullDraft();
  if(id==='create-google')return createNativeGoogle();if(id==='resume-google')return resumeNativeGoogle();if(id==='recheck-google')return recheckNativeGoogle();if(id==='google-settings'){panel('settings-panel',true);$('provider')?.focus();return;}
  if(id==='connect'){panel('account-panel',true);return;}if(id==='check-model'){panel('settings-panel',true);$('model')?.focus();return checkSelectedModel(true);}if(id==='approve-basic')return approveBasicOutline();if(id==='expand-outline')return expandOutline();if(id==='approve-expanded')return approveExpandedOutline();
  if(id==='approve-canva'||id==='decline-canva')return resolveCanvaApproval(id==='approve-canva'?'accept':'decline');if(id==='approve-slide'||id==='decline-slide')return resolveSlideApproval(id==='approve-slide'?'accept':'decline');
  if(id==='approve-native-samples')return approveNativeSamples();if(id==='create-canva-samples')return createNativeCanva('samples');if(id==='create-canva-deck')return createNativeCanva('deck');if(id==='recheck-canva')return recheckCanva();
  if(id==='approve-draft'){if(hasConcepts()&&!nativeSamplesApproved(state))return showWorkspace('design');approveDraft(state);if(expandedOutlineCovered(state))state.stageReady=true;invalidate();save();render();return;}if(id==='advance')return advance();if(id==='export')return exportFiles();
}
function approveNativeSamples(){if(working||['running','approval'].includes(canvaJobs.get(state.id)?.status)||!nativeSampleCurrent(state)||state.canvaSample?.mode!=='samples')return;approveConcept(state);state.approvedCanvaSampleId=state.canvaSample.jobId;state.changeNote='You approved the actual Canva sample slides and presenter notes.';save();render();}
async function buildFullDraft(){
  if(working||state.interviewStage<9||!expandedOutlineApprovalCurrent(state)||expandedOutlineCovered(state))return;
  if(isPresentation(state.brief)&&!nativeSamplesApproved(state))return showWorkspace('design');
  if(state.retryRequest?.fullDraft)return send('',false,{retry:true});
  if(state.retryRequest){notice('Resolve Retry last message first. Your draft is retained.');return;}
  state.interviewStage=10;state.stageReady=false;save();
  await send('Build the complete first draft from our approved outline and design. Keep the existing content; I’ll review the whole product afterward.',false,{fullDraft:true});
}
function renderCreationPath(){
  const progress=creationProgress(state);if(!progress.total||state.interviewStage<9)return '';
  return '<p class="creation-path" role="status"><strong>'+progress.drafted+' of '+progress.total+' sections drafted</strong>'+ (progress.pending?' · Ready for your review':'')+'</p>';
}
function palette(){const color={clay:['#9a432e','#f5e7dd'],sage:['#345f4c','#e7efe7'],ink:['#274f71','#e7edf4']}[state.brief.theme]||['#9a432e','#f5e7dd'];document.documentElement.style.setProperty('--accent',color[0]);document.documentElement.style.setProperty('--pale',color[1]);}
function renderProgress(){const phase=state.interviewStage>=8&&state.brief.outline&&!expandedOutlineApprovalCurrent(state)?1:localFilesReady()?3:state.interviewStage<8?0:state.interviewStage<10?1:state.interviewStage===10?2:3,phases=['Discover your product','Approve plan and sample','Build the full draft','Review and finish'];document.querySelector('nav').innerHTML='<div class="progress-label">Phase '+(phase+1)+' of 4<strong>'+phases[phase]+'</strong></div><div class="stage-dots" aria-label="Four creation phases">'+phases.map((label,index)=>'<span class="'+(index===phase?'current':index<phase?'done':'')+'" title="'+label+'" aria-label="'+label+'" '+(index===phase?'aria-current="step"':'')+'>'+(index+1)+'</span>').join('')+'</div>';}

function renderChat(){
  const keepFocus=document.activeElement?.id==='answer',selection=keepFocus?[$('answer').selectionStart,$('answer').selectionEnd]:null;
  const session=referenceComposer(),queued=[...state.pendingReferences,...session.inputs],project=state;
  $('sidebar').innerHTML=`<div class="conversation-head"><h3>Let’s work this out together</h3><p class="fine">${esc(STAGES[state.interviewStage-1][1])}</p><a class="mobile-return" href="#current-action">View your product</a></div><div class="messages" id="messages" aria-label="Your conversation">${state.messages.map(m=>`<div class="message ${m.role}"><span class="speaker">${m.role==='user'?'You':'John Connor'}</span><div>${rich(m.content)}</div></div>`).join('')}</div><div class="conversation-controls" id="composer-zone">${stageDecisionMarkup()}${revisionMode?'<p class="answer-note">Your next instruction may revise approved text. An undo checkpoint will be kept. <button id="cancel-revision" class="quiet">Cancel revision</button></p>':''}${state.retryRequest?`<div class="retry-request"><p>Your original message and references are saved. Retry with the same selected model when it is ready.</p><button id="retry-message" type="button" ${working||!runtimeReady?'disabled':''}>Retry last message</button></div>`:''}${state.references.length?`<details class="project-references"><summary>Project references (${state.references.length})</summary><ul class="reference-list">${state.references.map(r=>referenceChip(r)).join('')}</ul><p class="reference-help">Private project context. These sources are kept out of your product downloads.</p></details>`:''}<form id="chat-form"><label class="sr-only" for="answer">Your answer or question</label><textarea id="answer" rows="3" placeholder="Tell me what you’re thinking…" aria-describedby="composer-hint reference-hint">${esc(state.pendingAnswer)}</textarea>${queued.length?`<ul class="reference-list pending-references" aria-label="References waiting to send" aria-live="polite">${queued.map(r=>referenceChip(r,{pending:true})).join('')}</ul>`:''}<div class="composer-bottom"><button id="attach-reference" type="button" ${!runtimeReady?'disabled':''} aria-describedby="reference-hint">Attach</button><span id="composer-hint">${working?'You can keep writing while your AI replies.':session.processing?'Preparing references locally…':!session.ready?'Remove failed references and attach them again.':!runtimeReady?esc(runtimeError||'Checking the app version…'):'Enter to send · Shift+Enter for a new line'}</span><button id="send" type="submit" class="primary" ${working||!runtimeReady||!session.ready?'disabled':''}>${revisionMode?'Send revision':'Send'}</button></div><details class="reference-options"><summary>Files, images and links</summary><p id="reference-hint" class="reference-help">Attach or drop files, paste an image, or include public links. Up to 5 sources; files 3 MB each / 6 MB total; PNG/JPEG 512 KB each, up to 2. References are local context until your AI reviews them.</p></details><input id="reference-files" type="file" accept=".txt,.md,.markdown,.csv,.tsv,.json,.pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg,text/plain,text/markdown,text/csv,application/json,application/pdf,image/png,image/jpeg" multiple hidden></form></div>`;
  for(const id of ['send','retry-message','continue-stage'])if($(id))$(id).disabled=working||!canUseModel()||(id==='send'&&!session.ready);
  bindComposer({form:$('chat-form'),answer:$('answer'),fileInput:$('reference-files'),attachButton:$('attach-reference'),dropZone:$('composer-zone'),getBusy:()=>working||!canUseModel()||!session.ready,hasContent:()=>!!$('answer').value.trim()||project.pendingReferences.length>0,onSubmit:()=>send($('answer').value.trim(),true),onInput:value=>{project.pendingAnswer=value;save();},onFiles:files=>queueReferences('addFiles',files,project),onLinks:links=>queueReferences('addLinks',links,project)});
  document.querySelectorAll('[data-remove-reference]').forEach(button=>button.onclick=()=>{session.remove(button.dataset.removeReference);$('answer').focus({preventScroll:true});});
  if($('retry-message'))$('retry-message').onclick=()=>send('',false,{retry:true});
  if($('review-outline'))$('review-outline').onclick=()=>{view='brief';render();};if($('continue-stage'))$('continue-stage').onclick=advance;if($('cancel-revision'))$('cancel-revision').onclick=()=>{revisionMode=false;renderChat();$('answer').focus();};$('messages').scrollTop=$('messages').scrollHeight;
  renderCurrentAction();
  if(keepFocus){$('answer').focus({preventScroll:true});$('answer').setSelectionRange(...selection);}
}
function outlineRequestKey(project){return JSON.stringify([project.brief,project.approvedOutline||'',project.expandedOutline||'',project.approvedExpandedOutline||'']);}
function expandedOutlineMarkup(text){
  const lines=[];let fence;
  for(const line of String(text||'').replace(/\r/g,'').split('\n')){
    const marker=/^ {0,3}(`{3,}|~{3,})/.exec(line);
    if(marker){if(!fence)fence={character:marker[1][0],length:marker[1].length};else if(marker[1][0]===fence.character&&marker[1].length>=fence.length)fence=undefined;lines.push(line);continue;}
    if(!fence&&/^ {0,3}#{1,3}[ \t]+\S/.test(line))lines.push('',line.trimStart(),'');else lines.push(line);
  }
  return manuscriptHtml(lines.join('\n').trim());
}
function outlineNextStep(project=state){if(project.interviewStage<8)return '';if(!project.brief.outline.trim())return 'Ask John Connor to propose a basic outline for this product.';if(!outlineApprovalCurrent(project))return 'Review and approve the basic outline. Your existing product stays available.';if(!expandedOutlineApprovalCurrent(project))return project.expandedOutline?'Review the whole expanded outline, edit anything needed, then approve it.':'The next step is a full expanded outline for your review.';return '';}
function stageDecisionMarkup(){return '';}
function sectionWorkspaceData(mode){
  const parsedDraft=expandedOutlineSections((state.brief.productDraft||'').replace(/^#[ \t]+/gm,'## ')),draft=parsedDraft.slice(parsedDraft.length-manuscriptHeadings(state.brief).length);
  const text=mode==='product'?state.brief.productDraft:state.expandedOutline||state.brief.outline,parsed=mode==='product'?draft:expandedOutlineSections(state.expandedOutline||'');
  const sections=parsed.length?parsed:mode==='plan'?state.brief.outline.split(/\r?\n/).filter(line=>line.trim()).map(heading=>({heading:heading.replace(/^\s*(?:\d+[.)]|[-*])\s+/,''),body:''})):[];
  const unique=new Set(sections.map(section=>section.heading)).size===sections.length;
  let selection=sectionViews[mode];
  if(!selection||selection.projectId!==state.id)selection=sectionViews[mode]={projectId:state.id,heading:sections[0]?.heading||'',all:false};
  if(!sections.some(section=>section.heading===selection.heading))selection.heading=sections[0]?.heading||'';
  return {text,sections,unique,selection,draft};
}
function sectionDetailMarkup(text){
  return String(text||'').split(/\n\s*\n/).map(block=>{
    const lines=block.split('\n').filter(line=>line.trim());
    if(lines.length&&lines.every(line=>/^\s*[-*+]\s+/.test(line)))return '<ul>'+lines.map(line=>'<li>'+rich(line.replace(/^\s*[-*+]\s+/,''))+'</li>').join('')+'</ul>';
    return expandedOutlineMarkup(block);
  }).join('');
}
function renderSectionWorkspace(mode){
  const {text,sections,unique,selection,draft}=sectionWorkspaceData(mode);if(!sections.length)return text?`<article class="section-fallback">${expandedOutlineMarkup(text)}</article>`:'';
  if(!unique||mode==='plan'&&state.expandedOutline&&!expandedOutlineValid(text))return `<article class="section-fallback"><h3>Review the complete plan</h3><p class="fine">${!unique?'Some section titles repeat.':'This expanded plan needs section headings and usable detail.'} The complete source stays available below.</p>${expandedOutlineMarkup(text)}</article>`;
  const selected=sections.find(section=>section.heading===selection.heading)||sections[0],product=mode==='product';
  const status=section=>draft.some(item=>item.heading===section.heading&&item.body.trim())?'Draft exists':'Not drafted';
  const firstHeading=/^ {0,3}##[ \t]+/m.exec(text),preface=firstHeading?text.slice(0,firstHeading.index).trim():'';
  const detail=selection.all?`<article class="section-inspector section-whole"><h2 tabindex="-1">${product?'Full manuscript':'Whole product plan'}</h2>${sectionDetailMarkup(text)}</article>`:`<article class="section-inspector"><div class="section-detail-heading"><span class="section-position">Section ${sections.indexOf(selected)+1} of ${sections.length}</span><span class="section-status">${status(selected)}</span></div><h2 tabindex="-1">${esc(selected.heading)}</h2>${selected.body?sectionDetailMarkup(selected.body):`<p class="fine">${product?'This section has not been drafted yet.':'The expanded plan will add the purpose and detail for this section after the basic outline is approved.'}</p>`}</article>`;
  return `<section id="${mode}-section-workspace" class="section-workspace" aria-label="${product?'Product sections':'Product plan sections'}"><div class="section-workspace-head">${product?'':'<div class="section-workspace-title"><h1>Product plan</h1>'}<p>${sections.length} sections<span>${product?'Your current manuscript':expandedOutlineApprovalCurrent(state)?'Expanded plan approved':state.expandedOutline?'Expanded plan awaiting approval':'Basic outline'}</span></p>${product?'':'</div>'}<button type="button" data-section-mode="${mode}" data-section-all="true" class="quiet">${product?'Read full manuscript':'Read whole plan'}</button></div>${!selection.all&&preface?`<details class="section-plan-notes"><summary>About this ${product?'manuscript':'plan'}</summary>${sectionDetailMarkup(preface)}</details>`:''}<div class="section-workspace-grid"><nav class="section-index" aria-label="${product?'Manuscript sections':'Outline sections'}"><ol>${sections.map((section,index)=>`<li><button type="button" id="${mode}-section-${index}" data-section-mode="${mode}" data-section-index="${index}" ${!selection.all&&selected===section?'aria-current="true"':''}><span class="section-number">${index+1}</span><span><strong>${esc(section.heading)}</strong><small>${status(section)}</small></span></button></li>`).join('')}</ol></nav><div class="section-mobile-picker"><label for="${mode}-section-picker">Choose a section</label><select id="${mode}-section-picker" data-section-picker="${mode}">${selection.all?`<option value="all" selected>${product?'Full manuscript':'Whole plan'}</option>`:''}${sections.map((section,index)=>`<option value="${index}" ${!selection.all&&selected===section?'selected':''}>${index+1}. ${esc(section.heading)}</option>`).join('')}</select></div>${detail}</div></section>`;
}
function selectWorkspaceSection(mode,index,focusId){
  if(!['plan','product'].includes(mode))return;const {sections,selection}=sectionWorkspaceData(mode);
  if(index==='all')selection.all=true;else{if(!Number.isInteger(index)||!sections[index])return;selection.heading=sections[index].heading;selection.all=false;}
  const board=$(`${mode}-section-workspace`);if(!board)return;const scroll=board.querySelector?.('.section-index')?.scrollTop||0;board.outerHTML=renderSectionWorkspace(mode);bindSectionNavigation();const indexList=$(`${mode}-section-workspace`)?.querySelector?.('.section-index');if(indexList)indexList.scrollTop=scroll;
  if(focusId)$(focusId)?.focus({preventScroll:true});else $(`${mode}-section-workspace`)?.querySelector('.section-inspector h2')?.focus({preventScroll:true});
}
function bindSectionNavigation(){
  document.querySelectorAll('[data-section-mode]').forEach(button=>button.onclick=()=>selectWorkspaceSection(button.dataset.sectionMode,button.dataset.sectionAll?'all':Number(button.dataset.sectionIndex),button.dataset.sectionAll?null:button.id));
  document.querySelectorAll('[data-section-picker]').forEach(select=>select.onchange=()=>selectWorkspaceSection(select.dataset.sectionPicker,select.value==='all'?'all':Number(select.value),select.id));
}
function renderOutlineReview(){
  if(!state.brief.outline)return '';const approved=expandedOutlineApprovalCurrent(state),job=outlineJobs.get(state.id),pending=job?.status==='running',error=job?.status==='error'?job.message:'',valid=expandedOutlineValid(state.expandedOutline||'');
  const basic=`<h2>Basic outline</h2><p class="outline-progress">${rich(state.brief.outline)}</p><details><summary>Edit basic outline</summary><label class="sr-only" for="outline">Basic product outline</label><textarea id="outline" rows="8" maxlength="12000" ${working?'disabled':''}>${esc(state.brief.outline)}</textarea></details>`;
  return `<section class="outline-review">${pending?'<p role="status">Preparing the full product plan. Your unsent answer is retained.</p>':''}${error?`<p class="outline-error" role="status">${esc(error)} Your outline and product are retained.</p>`:''}${renderSectionWorkspace('plan')}<details class="plan-editing"><summary>Edit the plan</summary>${basic}${state.expandedOutline?`<h3>Edit expanded outline</h3><p class="fine" id="expanded-outline-status">${approved?'You approved this full product plan.':'Review what the buyer will receive and do before approving the plan.'}</p><label for="expanded-outline">Whole expanded product outline</label><textarea id="expanded-outline" rows="18" maxlength="60000" ${working?'disabled':''}>${esc(state.expandedOutline)}</textarea>${!valid?'<p class="fine">Give every section a unique heading and detailed teaching notes.</p>':''}`:''}</details></section>`;
}
function updateOutlineControls(){
  const basic=outlineApprovalCurrent(state),approved=expandedOutlineApprovalCurrent(state);
  if($('approve-basic-outline')){$('approve-basic-outline').disabled=working||!runtimeReady||!canUseModel()||basic||!state.brief.outline.trim();$('approve-basic-outline').textContent=basic?'Basic outline approved':'Approve basic outline';}
  if($('create-expanded-outline'))$('create-expanded-outline').disabled=working||!runtimeReady||!canUseModel()||!basic;
  if($('approve-expanded-outline')){$('approve-expanded-outline').disabled=working||!runtimeReady||!basic||!expandedOutlineValid(state.expandedOutline)||approved;$('approve-expanded-outline').textContent=approved?'Expanded outline approved':state.interviewStage===8?'Approve expanded outline & continue':'Approve expanded outline';}
  if($('expanded-outline-status'))$('expanded-outline-status').textContent=approved?'You approved this full product plan.':'Review the sequence, teaching detail, examples and exercises before content creation continues.';
  if($('next-step-copy')&&outlineNextStep())$('next-step-copy').textContent=outlineNextStep();
}
function bindOutlineActions(){
  bindSectionNavigation();
  if($('review-outline'))$('review-outline').onclick=()=>{view='brief';render();};
  if($('approve-basic-outline'))$('approve-basic-outline').onclick=approveBasicOutline;
  if($('create-expanded-outline'))$('create-expanded-outline').onclick=expandOutline;
  if($('approve-expanded-outline'))$('approve-expanded-outline').onclick=approveExpandedOutline;
  if($('outline'))$('outline').oninput=event=>{state.brief.outline=event.target.value;state.approvedExpandedOutline='';if(state.interviewStage>=8)state.stageReady=false;state.changeNote='You edited the basic outline. Review and approve the updated plan.';save();renderChat();updateOutlineControls();};
  if($('expanded-outline'))$('expanded-outline').oninput=event=>{state.expandedOutline=event.target.value;if(state.interviewStage>=8)state.stageReady=false;state.changeNote='You edited the expanded product plan. Approve it when ready.';save();renderChat();updateOutlineControls();};
}
async function approveBasicOutline(){
  if(working||!runtimeReady||!canUseModel()||state.interviewStage<8||!state.brief.outline.trim()||outlineApprovalCurrent(state))return;
  state.approvedOutline=state.brief.outline;state.approvedExpandedOutline='';state.stageReady=false;state.changeNote='You approved the basic outline. Preparing the expanded product plan.';save();view='brief';render();await expandOutline();
}
async function expandOutline(){
  if(working||!runtimeReady||!canUseModel()||!outlineApprovalCurrent(state)||outlineJobs.get(state.id)?.status==='running')return;
  const project=state,key=outlineRequestKey(project),job={key,status:'running',message:''},body={mode:'expand-outline',interviewStage:project.interviewStage,brief:{...project.brief},notes:project.notes.map(note=>({...note})),messages:project.messages.map(({role,content})=>({role,content})),references:project.references,currentInput:'',provider,model:selectedModel,reasoningEffort:quality,preferences:activePreferences(studio.profile),approvedDraft:project.approvedDraft,revisionIntent:false,presentationDesign:project.presentationDesign||undefined,canvaSampleId:project.canvaSample?.jobId||undefined,slideProductionId:project.slideProduction?.id||undefined,approvedOutline:project.approvedOutline||'',expandedOutline:project.expandedOutline||'',approvedExpandedOutline:project.approvedExpandedOutline||''};
  outlineJobs.set(project.id,job);view='brief';busy(true,'Preparing your expanded product plan');
  try{const reply=await post('/api/interview',body);if(state.id!==project.id||outlineRequestKey(project)!==key){job.status='stale';job.message='The outline changed before this proposal finished.';return;}if(typeof reply.expandedOutline!=='string'||reply.expandedOutline.length>60000||!expandedOutlineValid(reply.expandedOutline))throw Error('The full expanded plan could not be read. Retry the expanded outline.');project.expandedOutline=reply.expandedOutline;project.approvedExpandedOutline='';project.messages.push({role:'assistant',content:reply.message||'Your expanded product plan is ready for review.'});project.stageReady=false;project.changeNote='Review the whole expanded outline before approving content creation.';job.status='ready';save();}
  catch(error){const timeout=error.status!==409&&![401,403].includes(error.status)&&!/\b(?:model_not_found|invalid_model|unsupported_model|model_not_supported|unsupported_reasoning_effort|invalid_reasoning_effort|authentication_error|invalid_api_key|unauthorized|not_authenticated|token_expired)\b/i.test(error.message||'')&&/timed?\s*out|timeout|took too long|deadline (?:exceeded|expired)|ETIMEDOUT/i.test(error.message||'');const outputLimit=error.status!==409&&![401,403].includes(error.status)&&!/\b(?:model_not_found|invalid_model|unsupported_model|model_not_supported|unsupported_reasoning_effort|invalid_reasoning_effort|authentication_error|invalid_api_key|unauthorized|not_authenticated|token_expired)\b/i.test(error.message||'')&&/\[(?:output_limit|max_output_tokens_exceeded|output_limit_exceeded|response_too_large|max_tokens_exceeded)(?:;\s*HTTP\s+\d+)?\]\s*$/i.test(error.message||'');job.status='error';job.message=outputLimit?'The expanded-plan reply reached its output limit. Your plan is retained. Retry the expanded outline; the app will request a compact whole-product plan with the same selected model.':timeout?'The expanded-plan request timed out. Your plan and request are retained. Retry the expanded outline with the same selected model.':error.message;if(!timeout&&!outputLimit)modelAccess.invalidate('The expanded outline could not finish. Check the selected model, then retry the expanded outline.');if(state.id===project.id)save();}finally{busy(false);}
}
async function approveExpandedOutline(){
  if(working||!runtimeReady||!outlineApprovalCurrent(state)||!expandedOutlineValid(state.expandedOutline||''))return;state.approvedExpandedOutline=state.expandedOutline;state.changeNote='You approved the whole expanded product plan.';if(state.interviewStage===8)state.stageReady=true;save();render();if(state.interviewStage===8&&canUseModel())await advance();
}
const facts=[['topic','What you can help with'],['niche','Your specific niche'],['buyer','Who it helps'],['outcome','The useful outcome'],['method','Your method and judgment'],['example','Your real examples'],['limits','Limits and exceptions'],['marketEvidence','Market observations'],['offer','Your offer'],['format','The chosen format'],['tone','Language and voice'],['design','Design direction']];
function manuscriptHtml(text){
  const inline=value=>rich(value).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  const cells=line=>line.trim().replace(/^\|/,'').replace(/(?<!\\)\|$/,'').split(/(?<!\\)\|/).map(value=>value.trim().replace(/\\\|/g,'|'));
  return text.split(/\n\s*\n/).map(block=>{
    const heading=block.match(/^(#{1,3})\s+([^\n]+)$/);if(heading)return `<h${heading[1].length<3?3:4}>${esc(heading[2])}</h${heading[1].length<3?3:4}>`;
    const lines=block.replace(/\r/g,'').split('\n'),rows=lines.map(cells),columns=rows[0].length;
    if(lines.length>=2&&/(?<!\\)\|/.test(lines[0])&&rows[1].length===columns&&rows[1].every(value=>/^:?-{3,}:?$/.test(value))&&rows.slice(2).every(row=>row.length===columns))return `<div class="manuscript-table" role="region" aria-label="Product table" tabindex="0"><table><thead><tr>${rows[0].map(value=>`<th scope="col">${inline(value)}</th>`).join('')}</tr></thead><tbody>${rows.slice(2).map(row=>`<tr>${row.map(value=>`<td>${inline(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    return `<p>${inline(block)}</p>`;
  }).join('');
}
function renderPlanHistory(){
  const content=`<h2>Approved decisions</h2>${state.notes.length?`<ul class="approved-decisions">${state.notes.map(n=>`<li><strong>${esc(n.title)}</strong><br>${rich(n.summary)}</li>`).join('')}</ul>`:`<p class="fine">${state.approvedDraft?'The current manuscript is approved. This project has no earlier stage notes.':'Your decisions appear here after you approve a direction.'}</p>`}${renderOutlineReview()}`;
  return state.interviewStage>=9&&expandedOutlineApprovalCurrent(state)?`<details class="plan-history"><summary>Approved decisions and outline</summary>${content}</details>`:content;
}
function renderBrief(){
  const b=state.brief,known=facts.filter(([key])=>b[key]),current=currentDraftSection(state);
  if(!known.length&&!b.productDraft&&!b.outline)return `<div class="conversation-empty"><h1>Let’s turn what you know<br>into something useful.</h1><p>Start with something you help people do. Together, we’ll shape a useful product, build a sample, then finish your first draft.</p><p class="fine">Your product takes shape here as we talk.</p><details><summary>See an example first</summary><p class="fine">An illustrative product with fictional examples.</p><button id="try-example">Open the example project</button></details></div>`;
    return `<div class="brief-content">${b.outline?renderOutlineReview():'<h1>Your product is taking shape</h1><p class="plan-introduction">Your outline will appear here as we shape the product.</p>'}${current.text?`<section class="draft-summary"><h2>${expandedOutlineCovered(state)?'Your full draft is ready':'Your existing draft'}</h2><p>Read the actual content in Your product. Ask for a focused change in the conversation whenever something needs improving.</p><button id="review-current">${expandedOutlineCovered(state)?'Read full draft':'Read your product'}</button></section>`:''}<details class="project-details"><summary>Working brief and creator details</summary><label for="product-title">Product title</label><input id="product-title" value="${esc(b.title)}" placeholder="A title can come later" ${working?'disabled':''}><label for="author">Creator / author</label><input id="author" value="${esc(b.author)}" placeholder="Your name as it should appear on the product" ${working?'disabled':''}><dl>${known.map(([key,label])=>`<dt>${esc(label)}</dt><dd>${rich(b[key])}</dd>`).join('')}</dl>${state.notes.length?`<h3>Earlier decisions</h3><ul class="approved-decisions">${state.notes.map(n=>`<li><strong>${esc(n.title)}</strong><br>${rich(n.summary)}</li>`).join('')}</ul>`:''}</details>${renderSuggestions()}</div>`;
}
function renderFinalQuality(){
  if(!['draft','files'].includes(view))return '';
  const google=state.googleDelivery,canva=canvaJobs.get(state.id);
  if(google?.status==='ready'&&google.verified&&googleChecked.has(google.id)&&google.sourceKey===googleSourceKey(state.brief)&&google.qualityReviewContext===qualityReviewKey(state.brief)&&google.qualityReview)return renderQualityReview(google.qualityReview,'Actual '+googleLabel(google.destination));
  if(canva?.status==='ready'&&!canva.needsRefresh&&!canva.refreshing&&canva.mode==='deck'&&canva.key===nativeKey(state)&&canva.qualityReviewContext===qualityReviewKey(state.brief)&&canva.qualityReview)return renderQualityReview(canva.qualityReview,'Actual Canva presentation');
  return state.qualityReview?.sourceKey===qualityReviewKey(state.brief)?renderQualityReview(state.qualityReview.review,'Draft source · native layout and calculations need checking'):'';
}
function renderSuggestions(){return state.suggestions?.length?`<section class="suggestions"><h3>Ideas to consider</h3>${state.suggestions.map((s,i)=>`<div class="suggestion"><button data-suggestion="${i}" ${working?'disabled':''}>Explore: ${esc(s.title)}</button><p>${esc(s.why)}</p><p>Based on: ${esc(s.basis)}</p></div>`).join('')}</section>`:'';}
function previewKey(){return JSON.stringify([state.id,state.brief,state.coverImage]);}
function previewMarkup(){
  if(!runtimeReady)return '<p class="preview-status">Restart the app to finish this update. Your project is retained.</p>';
  if(preview.key!==previewKey()||preview.status==='loading')return '<p class="preview-status" role="status">Updating the designed preview…</p>';
  if(preview.status==='error')return `<div class="preview-status" role="status">${esc(preview.message)} <button id="retry-preview">Retry preview</button><p class="fine">Your manuscript is retained. Use Edit manuscript to read or change the source.</p></div>`;
  return `<div class="designed-pages">${preview.pages.map((p,i)=>`<figure class="designed-page"><img src="data:image/svg+xml;charset=utf-8,${esc(encodeURIComponent(p.svg))}" alt="Page ${i+1}: ${esc(p.title||'Product page')}" ${i?'loading="lazy"':''}><figcaption>Page ${i+1} of ${preview.pages.length}${p.purpose?` · ${esc(p.purpose)}`:''}</figcaption></figure>`).join('')}</div>`;
}
function renderExportPreview(){if(isPresentation(state.brief))return '';return `<details id="export-preview" class="export-preview" ${previewOpen?'open':''}><summary>Preview exported pages</summary><div id="designed-preview">${previewOpen?previewMarkup():''}</div></details>`;}
function slideBusy(project=state){return ['planning','artwork','approval'].includes(project.slideProduction?.status);}
function visualData(project,focus){
  if(!focus)return {pages:[],production:null,current:false,error:''};
  const latest=project.slideProduction,prototype=project.slideConcepts||(latest?.mode==='concepts'?latest:null),fingerprint=fullSourceFingerprint(project.brief,''),matches=production=>production?.conceptId===focus&&production.concepts?.length===1&&production.concepts[0].conceptId===focus,candidate=latest?.status==='ready'&&latest.sourceFingerprint===fingerprint&&matches(latest)?latest:matches(prototype)?prototype:null;
  if(!candidate||candidate.status!=='ready')return {pages:[],production:null,current:false,error:''};
  try{return {pages:renderConceptSlides(project.brief,focus,{production:candidate,allowSourceAppend:candidate.sourceFingerprint!==fingerprint}),production:candidate,current:candidate.sourceFingerprint===fingerprint,error:''};}catch(error){return {pages:[],production:candidate,current:false,error:error.message};}
}
function approvedArt(project=state){return nativeSamplesApproved(project);}
function canResumeSlides(project=state){const job=project.slideProduction;return job?.policyVersion===SLIDE_POLICY_VERSION&&job.conceptId===project.presentationDesign?.conceptId&&!!job?.id&&job.concepts?.some(concept=>concept.slides?.some(slide=>!slide.artwork))&&['failed','unavailable'].includes(job.status)&&job.sourceFingerprint===fullSourceFingerprint(project.brief,'')&&productionStyleCurrent(job,project.brief);}
function canPrepareSlides(){return runtimeReady&&canUseModel()&&!working&&!slideBusy()&&!['running','approval'].includes(canvaJobs.get(state.id)?.status);}
function artworkOptionsLocked(){return working||slideBusy()||['running','approval'].includes(canvaJobs.get(state.id)?.status);}
function renderArtworkOptions(){return `<div class="automatic-artwork-options"><p class="fine">${autoApproveArtwork?'Illustrations are created automatically; review the finished samples.':'Review each illustration request before it is created.'}</p><details><summary>Illustration options</summary><label><input id="auto-artwork" type="checkbox" ${autoApproveArtwork?'checked':''} ${artworkOptionsLocked()?'disabled':''}><span>Create illustrations automatically</span></label></details></div>`;}
async function useTemplate(id){if(working||slideBusy()||['running','approval'].includes(canvaJobs.get(state.id)?.status)||!DESIGN_CONCEPTS.some(item=>item.id===id))return;chooseConcept(state,id);state.canvaHandoff=null;state.approvedCanvaSampleId='';conceptFocus=id;reviewSlide=0;save();render();}
function illustrationTarget(project=state){
  if(!runtimeReady||working||slideBusy(project)||['running','approval'].includes(canvaJobs.get(project.id)?.status))return null;
  const selected=project.presentationDesign?.conceptId,data=visualData(project,selected),sample=project.slideProduction;
  if(sample?.status!=='ready'||sample.mode!=='concepts'||sample.policyVersion!==SLIDE_POLICY_VERSION||sample.conceptId!==selected||!data.current||data.production?.id!==sample.id||data.pages.length!==3)return null;
  const page=data.pages[Math.min(Math.max(0,Number(reviewSlide)||0),2)];return page?.planId?{sample,page,key:project.id+':'+sample.id+':'+page.planId}:null;
}
function illustrationMarkup(){
  const target=illustrationTarget();if(!target)return '';const edit=illustrationEdits.get(target.key)||{feedback:'',open:false};
  return `<details id="illustration-refinement" class="illustration-refinement" ${edit.open?'open':''}><summary>Improve this illustration</summary><label for="illustration-feedback">What should change in this illustration?</label><textarea id="illustration-feedback" rows="3" maxlength="1500" placeholder="Describe what to improve in this illustration.">${esc(edit.feedback)}</textarea><p class="fine">Updates the illustration on this slide. Review the new artwork before approving it.</p><button type="button" id="update-illustration" ${!canPrepareSlides()||!edit.feedback.trim()?'disabled':''}>Update this illustration</button></details>`;
}
async function refineIllustration(){
  if(!canPrepareSlides())return;const project=state,target=illustrationTarget(project);if(!target)return;const feedback=String($('illustration-feedback')?.value??illustrationEdits.get(target.key)?.feedback??'').trim();if(!feedback||feedback.length>1500)return;
  illustrationEdits.set(target.key,{feedback,open:true});
  const body={brief:{...project.brief},provider,model:selectedModel,reasoningEffort:quality,autoApproveArtwork,mode:'concepts',conceptId:project.presentationDesign.conceptId,productionId:target.sample.id,refineSlideId:target.page.planId,feedback},job={id:'',policyVersion:SLIDE_POLICY_VERSION,conceptId:body.conceptId,status:'artwork',mode:'concepts',sourceFingerprint:fullSourceFingerprint(project.brief,''),concepts:[],complete:false,remainingSourceIds:[],message:'Updating this illustration. Your other sample slides are retained.'};
  project.slideConcepts=cleanSlideProduction(target.sample);project.slideProduction=job;project.presentationDesign={...project.presentationDesign,approved:false};save();render();
  try{acceptSlideResult(project,job,await post('/api/slide-production',body));if(['planning','artwork'].includes(job.status))pollSlides(project,job);}catch(error){project.slideProduction=cleanSlideProduction(target.sample);save();if(state.id===project.id){render();notice(error.message,true);}}
}
function visualProgress(job,valid){const phase=job?.status==='planning'?0:['artwork','approval'].includes(job?.status)?1:job?.status==='ready'?(valid?3:2):0;return `<ol class="visual-progress" aria-label="Visual production progress">${['Plan','Artwork','Draft','Review'].map((name,index)=>`<li class="${index<phase?'done':index===phase&&job?'current':''}" ${index===phase&&job?'aria-current="step"':''}>${name}</li>`).join('')}</ol>`;}
function approvalMarkup(approval,kind){if(!approval)return '';const previews=(approval.previews||[]).filter(image=>/^\/canva-previews\/[a-f0-9]{40}$/.test(image.url||''));return `<section class="canva-approval"><strong>${esc(approval.title||'Review this action')}</strong><p>${esc(approval.message)} ${esc(approval.scope||'')}</p>${previews.length?`<div class="native-review-previews">${previews.map(image=>`<img src="${esc(image.url)}" alt="Actual Canva draft for your review" width="${Number(image.width)||1280}" height="${Number(image.height)||720}">`).join('')}</div>`:''}${approval.prompt?`<details><summary>Artwork request${approval.aspectRatio?' · '+esc(approval.aspectRatio):''}</summary><p>${esc(approval.prompt)}</p></details>`:''}</section>`;}
function renderDesignChooser(){
  const chosen=state.presentationDesign?.conceptId,concept=DESIGN_CONCEPTS.find(item=>item.id===chosen),job=canvaJobs.get(state.id),busy=working||slideBusy()||['running','approval'].includes(job?.status),sample=cleanCanvaSample(state.canvaSample),current=nativeSampleCurrent(state)&&sample?.mode==='samples',deck=nativeDeckCurrent(state)?state.canvaDeck:null;
  const cards=DESIGN_CONCEPTS.map(item=>`<article class="template-option ${chosen===item.id?'template-selected':''}"><div class="concept-thumbnail">${templatePreview(item.id)}</div><p class="template-caption">Template preview</p><h2>${esc(item.title)}${chosen===item.id?'<span>Selected</span>':''}</h2><p class="template-description">${esc(item.description)}</p><button type="button" data-use-template="${item.id}" ${busy?'disabled':''}>Use this template</button></article>`).join('');
  const nativeUrl=deck?.url||(current?sample.url:null),oldUrl=!nativeUrl?sample?.url:null;
  let history='';const saved=visualData(state,chosen);if(saved.pages.length){const page=saved.pages[Math.min(reviewSlide,saved.pages.length-1)];history=`<details class="saved-artwork"><summary>Saved slide illustrations</summary><p>These are final-slide artwork assets. Review and approve the actual editable samples in Canva.</p><div class="slide-montage">${saved.pages.map((item,index)=>`<button data-review-slide="${index}" aria-pressed="${item===page}">${item.svg}<span>Saved illustration ${index+1}</span></button>`).join('')}</div><figure class="concept-page">${page.svg}<details class="concept-notes"><summary>Source and presenter notes</summary><p>${esc(page.notes)}</p></details></figure>${illustrationMarkup()}</details>`;}
  return `<section class="design-workspace"><h1>${chosen?'Your Canva presentation':'Choose a template.'}</h1><p class="design-intro">Choose one look, create three editable Canva slides with full presenter notes, then review the actual design before expanding.</p>${chosen?`<div class="selected-template"><strong>${esc(concept?.title||chosen)}</strong><details class="template-switcher"><summary>Change template</summary><div class="concept-options template-options">${cards}</div></details></div>`:`<div class="concept-options template-options" aria-label="Choose one presentation template">${cards}</div>`}${chosen?renderArtworkOptions():''}${job?`<p class="visual-job-message" role="status">${esc(job.message||'Preparing the actual Canva design.')}</p>${job.status==='approval'?`<div id="pending-canva-details">${approvalMarkup(job.approval,'canva')}</div>`:''}`:''}${slideBusy()?`<p class="visual-job-message">${esc(state.slideProduction.message||'An existing illustration request is finishing.')}</p>${state.slideProduction.status==='approval'?approvalMarkup(state.slideProduction.approval,'slide'):''}`:''}<section class="native-sample">${nativeUrl?`<h2>${deck?'Your editable presentation':'Your three editable Canva samples'}</h2><p>Open the actual Canva file to review the layout, edit the slides and read the full presenter notes. Approval is a separate action above.</p><a href="${esc(nativeUrl)}" target="_blank" rel="noopener noreferrer">Open in Canva</a>`:oldUrl?`<h2>Earlier Canva draft</h2><p>This saved draft is retained. Current source and template approval are checked separately.</p><a href="${esc(oldUrl)}" target="_blank" rel="noopener noreferrer">Open earlier draft in Canva</a>`:'<p>The editable sample link appears after Canva creates the three slides and the app verifies their text and notes. Existing illustrations are reused; missing final-slide artwork is prepared before Canva creation.</p>'}</section>${history}</section>`;
}
function renderCanvaPanel(){return '';}
function bindDesignActions(){
  if($('auto-artwork'))$('auto-artwork').onchange=event=>{if(artworkOptionsLocked())return;autoApproveArtwork=event.target.checked===true;setting('product-studio-auto-artwork',String(autoApproveArtwork));render();};
  document.querySelectorAll('[data-use-template]').forEach(button=>button.onclick=()=>useTemplate(button.dataset.useTemplate));
  document.querySelectorAll('[data-review-slide]').forEach(button=>button.onclick=()=>{reviewSlide=Number(button.dataset.reviewSlide);render();document.querySelector(`[data-review-slide="${reviewSlide}"]`)?.focus({preventScroll:true});});
  if($('illustration-feedback')){const target=illustrationTarget(),edit=illustrationEdits.get(target.key)||{feedback:'',open:false};$('illustration-feedback').oninput=event=>{edit.feedback=event.target.value;illustrationEdits.set(target.key,edit);$('update-illustration').disabled=!canPrepareSlides()||!edit.feedback.trim();};$('illustration-refinement').ontoggle=event=>{edit.open=event.target.open;illustrationEdits.set(target.key,edit);};$('update-illustration').onclick=refineIllustration;}
  if($('approve-concept'))$('approve-concept').onclick=()=>{const data=visualData(state,state.presentationDesign?.conceptId);if(!data.current||data.pages.length!==3||data.production.mode!=='concepts'||data.production.id!==state.slideProduction?.id||slideBusy())return;approveConcept(state);state.slideProduction=cleanSlideProduction(data.production);save();render();};
  if($('create-selected-samples'))$('create-selected-samples').onclick=()=>prepareSlides('concepts');
  if($('resume-slide-artwork'))$('resume-slide-artwork').onclick=()=>prepareSlides(state.slideProduction.mode,true);if($('build-slide-deck'))$('build-slide-deck').onclick=()=>prepareSlides('deck');
  if($('create-concept-canva'))$('create-concept-canva').onclick=createConceptCanva;
  document.querySelectorAll('[data-slide-approval]').forEach(button=>button.onclick=()=>resolveSlideApproval(button.dataset.slideApproval));
  document.querySelectorAll('.concept-page image[data-artwork-id]').forEach(image=>image.addEventListener('error',()=>{const target=document.querySelector('.artwork-problem');if(target){target.hidden=false;target.textContent='This saved artwork could not be loaded. Prepare its visuals again before approving this version.';}if($('approve-concept'))$('approve-concept').disabled=true;},{once:true}));
  if(slideBusy()&&state.slideProduction.id)pollSlides(state,state.slideProduction);
}
function recoverModelAfterProduction(project,job){if(state.id!==project.id||!job.id||job.modelRechecked||!['ready','unavailable','failed'].includes(job.status)||modelAccess.state.status!=='busy')return;job.modelRechecked=true;Promise.resolve(checkSelectedModel(true)).then(()=>{if(state.id===project.id){if(view==='design')render();continueCanvaHandoff(project);}});}
function acceptSlideResult(project,job,result){const clean=cleanSlideProduction({...job,...result,approval:result.approval});if(!clean)throw Error('The visual response could not be read. Your manuscript and chosen AI are retained.');Object.assign(job,clean);if(!clean.approval)delete job.approval;if(typeof result.autoApproveArtwork==='boolean')job.autoApproveArtwork=result.autoApproveArtwork;if(job.autoApproveArtwork===true&&job.status==='approval'){job.status='artwork';delete job.approval;}project.slideProduction=job;if(project.canvaHandoff?.key===nativeKey(project)&&job.id)project.canvaHandoff.productionId=job.id;if(job.status==='ready'&&job.mode==='concepts')project.slideConcepts=cleanSlideProduction(job);save();if(state.id===project.id){if(view==='design')render();else renderCurrentAction();}recoverModelAfterProduction(project,job);}
async function prepareSlides(mode='concepts',resume=false){
  if(!canPrepareSlides()||!DESIGN_CONCEPTS.some(item=>item.id===state.presentationDesign?.conceptId)||resume&&!canResumeSlides())return;const project=state,unfinished=resume?project.slideProduction:null,conceptId=project.presentationDesign?.conceptId,base=project.slideProduction?.status==='ready'?project.slideProduction:project.slideConcepts;
  if(mode==='deck'&&(!approvedArt(project)||project.approvedDraft!==project.brief.productDraft||!resume&&!base?.id))return;
  const body={brief:{...project.brief},provider,model:selectedModel,reasoningEffort:quality,autoApproveArtwork,mode,conceptId,...mode==='deck'?{productionId:resume?unfinished.id:base.id,approved:true}:{},...resume?{resume:true,productionId:unfinished.id}:{}},job={...unfinished,id:unfinished?.id||'',policyVersion:SLIDE_POLICY_VERSION,conceptId,status:'planning',mode,sourceFingerprint:fullSourceFingerprint(project.brief,''),concepts:unfinished?.concepts||[],complete:unfinished?.complete||false,remainingSourceIds:unfinished?.remainingSourceIds||[],message:resume?'Resuming the saved plans and unfinished artwork requests…':'Planning a purpose and visual idea for each slide…'};
  if(resume)job.modelRechecked=false;
  project.slideProduction=job;if(!resume&&mode==='concepts'&&project.presentationDesign)project.presentationDesign={...project.presentationDesign,approved:false};save();render();
  try{acceptSlideResult(project,job,await post('/api/slide-production',body));if(['planning','artwork'].includes(job.status))pollSlides(project,job);}catch(error){job.status='failed';job.message=error.message;save();if(state.id===project.id)render();}
}
async function pollSlides(project,job){if(!job.id||slidePolling.has(job.id))return;slidePolling.add(job.id);try{let initial=true;while(initial||['planning','artwork'].includes(job.status)){if(!initial)await new Promise(resolve=>setTimeout(resolve,1800));initial=false;const response=await fetch('/api/slide-production/'+encodeURIComponent(job.id)),result=await response.json();if(!response.ok)throw Error(result.message||result.error||'The visual progress could not be read.');acceptSlideResult(project,job,result);}}catch(error){job.status='failed';job.message=error.message;save();if(state.id===project.id)render();}finally{slidePolling.delete(job.id);}}
async function resolveSlideApproval(action){const project=state,job=project.slideProduction;if(!job?.approval||job.resolving)return;job.resolving=true;document.querySelectorAll('[data-slide-approval]').forEach(button=>button.disabled=true);try{acceptSlideResult(project,job,await post(`/api/slide-production/${encodeURIComponent(job.id)}/approval`,{approvalId:job.approval.id,action}));if(['planning','artwork'].includes(job.status))pollSlides(project,job);}catch(error){job.message=error.message;if(state.id===project.id)render();}finally{job.resolving=false;}}
function persistCanvaJob(project,job){project.canvaJob=cleanCanvaJob(job);project.updatedAt=Date.now();save();}
function acceptCanvaSnapshot(project,job,result){
  if(!result||!['running','approval','ready','unavailable','failed'].includes(result.status))throw Error('The saved Canva request could not be read. Your source is retained.');
  Object.assign(job,result);if(!result.approval)delete job.approval;job.needsRefresh=false;rememberCanvaResult(project,job);persistCanvaJob(project,job);if(state.id===project.id)render();
}
function restoreCanvaJob(project){const saved=project.canvaJob;if(!canvaJobs.has(project.id)&&saved)canvaJobs.set(project.id,{...saved,needsRefresh:true});const job=canvaJobs.get(project.id);if(job?.needsRefresh&&!job.refreshing)refreshCanvaJob(project,job);}
async function refreshCanvaJob(project,job){
  if(!job?.id||job.refreshing)return;job.refreshing=true;job.needsRefresh=false;
  try{const response=await fetch('/api/canva-production/'+encodeURIComponent(job.id)),result=await response.json();if(!response.ok)throw Error(result.error||result.message||'This saved Canva request is no longer available.');acceptCanvaSnapshot(project,job,result);if(job.status==='running')pollCanva(project,job);}
  catch(error){job.status='unavailable';job.message=error.message;delete job.approval;persistCanvaJob(project,job);if(state.id===project.id)render();}finally{job.refreshing=false;}
}
async function pollCanva(project,job){if(!job?.id||job.polling)return;job.polling=true;try{let initial=true;while(initial||job.status==='running'){if(!initial)await new Promise(resolve=>setTimeout(resolve,1800));initial=false;const response=await fetch('/api/canva-production/'+encodeURIComponent(job.id)),result=await response.json();if(!response.ok)throw Error(result.error||result.message||'The Canva draft status could not be read.');acceptCanvaSnapshot(project,job,result);}}catch(error){job.status='unavailable';job.message=error.message;delete job.approval;persistCanvaJob(project,job);if(state.id===project.id)render();}finally{job.polling=false;}}
async function resolveCanvaApproval(action){
  const project=state,job=canvaJobs.get(project.id);if(!job?.approval||job.resolving||!['accept','decline'].includes(action))return;const oldApproval=job.approval.id;job.resolving=true;renderCurrentAction();
  try{acceptCanvaSnapshot(project,job,await post(`/api/canva-production/${encodeURIComponent(job.id)}/approval`,{approvalId:oldApproval,action}));if(job.status==='running')pollCanva(project,job);}
  catch(error){if(error.status===409){await refreshCanvaJob(project,job);if(job.status==='approval'&&job.approval?.id===oldApproval){job.status='unavailable';delete job.approval;job.message='This approval is no longer pending. Check the existing Canva draft before continuing.';persistCanvaJob(project,job);}}else{job.message=error.message;persistCanvaJob(project,job);}if(state.id===project.id)render();}finally{job.resolving=false;if(state.id===project.id)renderCurrentAction();}
}
function illustratedCanvaProduction(project,mode){
  const conceptId=project.presentationDesign?.conceptId,seen=new Set();
  for(const candidate of [project.slideProduction,project.slideConcepts]){if(!candidate?.id||seen.has(candidate.id))continue;seen.add(candidate.id);if(candidate.status!=='ready'||candidate.sourceFingerprint!==fullSourceFingerprint(project.brief,'')||candidate.conceptId!==conceptId||!productionStyleCurrent(candidate,project.brief)||mode==='samples'&&candidate.mode!=='concepts')continue;
    try{const pages=renderConceptSlides(project.brief,conceptId,{production:candidate});if(mode==='samples'&&pages.length!==3||mode==='deck'&&(!candidate.complete||new Set(pages.map(page=>page.sourceId)).size!==readConceptSections(project.brief).length))continue;return candidate;}catch{}
  }return null;
}
function continueCanvaHandoff(project){
  const intent=project.canvaHandoff;if(state.id!==project.id||!intent)return;
  if(intent.key!==nativeKey(project)||intent.conceptId!==project.presentationDesign?.conceptId){project.canvaHandoff=null;save();return;}
  if(intent.provider!==provider||intent.model!==selectedModel||intent.reasoningEffort!==quality||!canUseModel()||working||slideBusy(project)||['running','approval'].includes(canvaJobs.get(project.id)?.status))return;
  const production=illustratedCanvaProduction(project,intent.mode);if(!production||intent.productionId&&intent.productionId!==production.id)return;
  createNativeCanva(intent.mode,true);
}
async function createNativeCanva(mode='samples',continuing=false){
  if(!runtimeReady||!canUseModel()||working||slideBusy()||!isPresentation(state.brief)||!state.presentationDesign?.conceptId||['running','approval'].includes(canvaJobs.get(state.id)?.status))return;
  if(mode==='deck'&&(!nativeSamplesApproved(state)||state.approvedDraft!==state.brief.productDraft||!expandedOutlineCovered(state)))return;
  const project=state,concept=DESIGN_CONCEPTS.find(item=>item.id===project.presentationDesign.conceptId);if(!concept)return;
  const production=illustratedCanvaProduction(project,mode);
  if(!production){if(continuing)return;project.canvaHandoff={mode,conceptId:concept.id,key:nativeKey(project),provider,model:selectedModel,reasoningEffort:quality};if(mode==='samples'){project.presentationDesign={...project.presentationDesign,approved:false};project.approvedCanvaSampleId='';}save();view='design';return prepareSlides(mode==='samples'?'concepts':'deck',canResumeSlides(project)&&project.slideProduction.mode===(mode==='samples'?'concepts':'deck'));}
  const body={brief:{...project.brief},approvedSource:project.brief.productDraft,concept:{id:concept.id,title:concept.title,version:1,styleNotes:JSON.stringify(concept.visualSystem)},provider,model:selectedModel,reasoningEffort:quality,direct:true,mode,productionId:production.id,preauthorizeDraft:true,...mode==='deck'?{sampleJobId:project.canvaSample.jobId,approvedSamples:true}:{}},job={id:'',key:nativeKey(project),sourceFingerprint:fullSourceFingerprint(project.brief,concept.id),sourceTitle:project.brief.title,conceptId:concept.id,mode,direct:true,productionId:production.id,status:'running',message:mode==='samples'?'Creating three illustrated Canva samples and their presenter notes.':'Building the approved illustrated presentation in Canva.'};
  project.canvaHandoff=null;if(mode==='samples'){project.presentationDesign={...project.presentationDesign,approved:false};project.approvedCanvaSampleId='';}canvaJobs.set(project.id,job);view='design';save();render();
  try{acceptCanvaSnapshot(project,job,await post('/api/create-canva',body));if(job.status==='running')pollCanva(project,job);}catch(error){job.status='unavailable';job.message=error.message;persistCanvaJob(project,job);if(state.id===project.id)render();}
}
async function recheckCanva(){
  const project=state,old=canvaJobs.get(project.id);if(!canPrepareSlides()||!old?.design?.id)return;
  const concept=DESIGN_CONCEPTS.find(item=>item.id===project.presentationDesign?.conceptId);if(!concept)return;const job={...old,id:'',status:'running',approval:undefined,modelRechecked:false,message:'Checking the existing Canva design without importing another copy.'};canvaJobs.set(project.id,job);render();
  try{acceptCanvaSnapshot(project,job,await post('/api/recheck-canva',{brief:{...project.brief},approvedSource:project.brief.productDraft,concept:{id:concept.id,version:1,title:concept.title},provider,model:selectedModel,reasoningEffort:quality,direct:old.direct===true,mode:old.mode||'samples',productionId:old.productionId,sampleJobId:old.sampleJobId,designId:old.design.id,preauthorizeDraft:true}));if(job.status==='running')pollCanva(project,job);}catch(error){job.status='unavailable';job.message=error.message;persistCanvaJob(project,job);render();}
}
function rememberCanvaResult(project,job){
  recoverModelAfterProduction(project,job);if(job.status!=='ready'||!canvaEditorUrl(job.design?.url))return;
  const sample=cleanCanvaSample({url:job.design.url,name:(job.sourceTitle||job.design.id||'Canva draft').slice(0,240),conceptId:job.conceptId,fullSourceFingerprint:job.fullSourceFingerprint||job.sourceFingerprint,productionId:job.productionId,...job.direct?{jobId:job.id,mode:job.mode,pageCount:job.pageCount,verified:job.verified,renderPolicyVersion:job.renderPolicyVersion,artworkBinding:job.artworkBinding,style:job.style,sampleFingerprint:job.sampleFingerprint,metadataFingerprint:job.metadataFingerprint,sourceBindings:job.sourceBindings}:{}});if(!sample)return;
  if(sample.mode==='deck')project.canvaDeck=sample;else project.canvaSample=sample;save();
}
async function createConceptCanva(){return createNativeCanva('samples');}

function nativeReviewInstructions(){return '<h3>Review your product</h3><ol class="native-review"><li>For presentations, open an available Canva link and review the slides and presenter notes.</li><li>For written products or calculators, open an available Google Docs or Google Sheets link and review the content.</li><li>Use the PDF or text download to review locally. Bring specific feedback back here before approving or expanding.</li></ol><p class="fine">Editor links appear only after a cloud file has been created and checked. If no editor link is shown, a cloud file has not been confirmed; PDF and text remain available.</p>';}
function renderSampleReview(){
  if(!state.brief.productDraft||state.interviewStage<9)return '';
  if(isPresentation(state.brief)){const current=nativeSampleCurrent(state);return `<section class="sample-review"><h3>Review slide samples</h3><p class="fine">${current?'Open the editable Canva samples and presenter notes in Visual direction before approving or expanding.':'Choose a template and prepare current slide samples in Visual direction.'}</p><button id="export-sample" ${working||!runtimeReady?'disabled':''}>${current?'Review slide samples':'Choose a template'}</button></section>`;}
  const files=state.sampleFingerprint===previewKey()?state.sampleFiles:null;
  return `<section class="sample-review"><h3>Review a draft sample</h3><p class="fine">Create a PDF and text sample before approving or expanding this section. Samples are labeled DRAFT SAMPLE.</p><button id="export-sample" ${working||!runtimeReady?'disabled':''}>Create sample for review</button><div id="sample-links" class="download-links">${files?links(files,{sample:true}):''}</div><details><summary>Review in Canva, Google Docs or local files</summary>${nativeReviewInstructions()}</details></section>`;
}
function renderDraft(){
  if(!state.brief.productDraft)return '<div class="brief-content"><h1>Your manuscript is still ahead</h1><p>The project progress tab shows the brief, outline and decisions as we prepare a representative sample.</p></div>';
  const approved=state.approvedDraft===state.brief.productDraft,current=currentDraftSection(state),whole=expandedOutlineCovered(state);
  const content=view==='edit'?`<label class="sr-only" for="manuscript">Product manuscript</label><textarea id="manuscript" class="manuscript" ${working?'disabled':''}>${esc(state.brief.productDraft)}</textarea>`:renderSectionWorkspace('product');
  return `<div class="draft-tools"><button id="toggle-editor">${view==='edit'?(whole?'Read full draft':'Read current section'):'Edit manuscript'}</button></div>${content}${whole?'':renderSampleReview()}<details><summary>Editing and approval options</summary><p class="approval-note">${whole?(approved?'This full draft is approved. Request a focused change whenever needed.':'Review the whole product and bring back focused changes before approving the draft.'):!state.sampleApproved?'Review the sample, then bring back feedback or approve it before expanding.':'Approved text is kept as we add sections. Request a revision when you want that text to change.'}</p><div class="panel-actions">${state.approvedDraft?`<button id="revise-draft" ${working?'disabled':''}>Revise approved text</button>`:''}${state.previousApprovedDraft?`<button id="undo-draft" ${working?'disabled':''}>Undo last approval</button>`:''}</div></details>${renderExportPreview()}<div class="product-options"><details><summary>Design and optional cover image</summary><label for="design-direction">Design instructions</label><textarea id="design-direction" rows="3" placeholder="Describe the layout, typography or feeling you want" ${working?'disabled':''}>${esc(state.brief.design)}</textarea><label for="cover-image">Your own PNG or JPEG · up to 1 MB</label><input id="cover-image" type="file" accept="image/png,image/jpeg" ${working?'disabled':''}>${state.coverImage?`<img class="cover-thumb" src="${esc(state.coverImage)}" alt="Your uploaded cover image"><div><button id="remove-cover" ${working?'disabled':''}>Remove image</button></div>`:''}</details>${renderSuggestions()}</div>`;
}
function links(files,{sample=false}={}){
  if(!runtimeReady)return '';
  const result=[];
  for(const key of ['canva','googleDocs','googleSheets']){
    try{
      const url=new URL(files[key]?.url);if(url.protocol!=='https:'||url.username||url.password||url.port)continue;
      const editor=key==='canva'?['canva.com','www.canva.com'].includes(url.hostname)&&(/^\/d\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)||/^\/design\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?\/edit\/?$/.test(url.pathname)):!!googleEditorUrl(url.href,key==='googleSheets'?'sheets':'docs');
      if(editor)result.push(`<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">Open ${sample?'draft ':''}in ${key==='canva'?'Canva':key==='googleSheets'?'Google Sheets':'Google Docs'}</a>`);
    }catch{}
  }
  for(const key of sample?['pdf','markdown']:['pdf','markdown','zip']){
    const url=files[key]?.url,extension={pdf:/\.pdf$/i,markdown:/\.(?:md|markdown|txt)$/i,zip:/\.zip$/i}[key];
    try{if(typeof url==='string'&&/^\/downloads\/[^?#\\]+$/.test(url)&&extension.test(decodeURIComponent(url)))result.push(`<a href="${esc(url)}" download>${sample?'Draft ':''}${{pdf:'PDF',markdown:'Text (Markdown)',zip:'Complete package'}[key]}</a>`);}catch{}
  }
  return result.join('');
}
function renderDownloads(){
  return `<section class="download-panel"><h2>${isPresentation(state.brief)?'Your content fallback files':'Your actual files'}</h2><p class="fine">${isPresentation(state.brief)?'PDF and text are content fallbacks with their own layout. Review the selected slide design in Visual direction or Canva.':'Create the actual Google Docs or Google Sheets file using the current action, then open its verified editor link. PDF and text copies are optional fallbacks.'} Save project backs up the interview and your unsent answer.</p>${state.approvedDraft!==state.brief.productDraft?'<p class="fine">Approve the current sample or section in Your product before exporting.</p>':''}${state.interviewStage===12&&(!state.brief.listingCopy||!state.companions?.length)?`<p><button id="prepare-completion" ${working||!runtimeReady?'disabled':''}>Prepare listing & companion ideas</button></p>`:''}<div id="download-links" class="download-links">${state.files?links(state.files):''}${googleChecked.has(state.googleDelivery?.id)&&state.googleDelivery?.sourceKey===googleSourceKey(state.brief)&&state.googleDelivery?.status==='ready'?links({[state.googleDelivery.destination==='sheets'?'googleSheets':'googleDocs']:state.googleDelivery.file}):''}</div>${nativeReviewInstructions()}<details><summary>Optional PDF and text copies</summary><label><input id="reviewed" type="checkbox" ${state.reviewed?'checked':''} ${working?'disabled':''}><span>I reviewed the content and usage rights.</span></label><button id="export-product" ${working||!runtimeReady||!state.reviewed||state.approvedDraft!==state.brief.productDraft?'disabled':''}>Create PDF and text copies</button><p class="fine">These copies do not replace the native Google product or its formulas.</p></details><p class="fine"><button class="quiet" id="optional-apps">Connected app settings</button></p>${state.brief.listingCopy?`<h3>Your listing copy</h3><p class="fine">A draft for you to review against the finished product.</p><div class="listing-copy">${esc(state.brief.listingCopy)}</div>`:''}${state.companions?.length?`<h3>Useful companion products</h3><p class="fine">Only create an extra product if it helps your buyer. Each choice starts a separate project.</p><ul class="companion-list">${state.companions.map((c,i)=>`<li><strong>${esc(c.title)}</strong> · ${esc(c.format)}<p>${esc(c.why)}</p><button data-companion="${i}" ${working?'disabled':''}>Start this companion</button></li>`).join('')}</ul>`:''}</section>${renderExportPreview()}`;
}
function render(){
  palette();renderProgress();renderChat();updateModelNote();for(const id of ['new-project','open-project','provider','model','quality'])$(id).disabled=working||['model','quality'].includes(id)&&!runtimeReady||id==='model'&&!catalog;
  const draft=!!state.brief.productDraft;
  $('workspace-content').innerHTML=`<div class="project-line"><strong>${esc(title())}</strong><span id="autosave" class="autosave" role="status">${diskSaveStatus==='saved'?'Saved on this computer':diskSaveStatus==='saving'?'Saving on this computer…':'Browser copy retained · checking local save'}</span></div><div class="workspace-tabs"><button id="brief-tab" class="${view==='brief'?'selected':''}">Project plan</button><button id="draft-tab" class="${['draft','edit'].includes(view)?'selected':''}">Your product${draft?'':' · upcoming'}</button>${hasConcepts()?`<button id="design-tab" class="${view==='design'?'selected':''}">Visual direction${nativeSampleCurrent(state)?(nativeSamplesApproved(state)?'':' · review'):state.presentationDesign?.conceptId?' · create samples':' · choose'}</button>`:''}<button id="files-tab" class="${view==='files'?'selected':''}" ${!draft||(!state.demo&&state.interviewStage<11&&!localFilesReady())?'disabled':''}>Files</button></div>${state.demo?'<p class="demo-note">Illustrative product with fictional examples.</p>':''}${['brief','draft','edit'].includes(view)?'':renderCreationPath()}${renderFinalQuality()}${view==='design'&&hasConcepts()?renderDesignChooser():view==='brief'?renderBrief():view==='files'?renderDownloads():renderDraft()}`;
  $('brief-tab').onclick=()=>showWorkspace('brief');$('draft-tab').onclick=()=>{showWorkspace('draft');schedulePreview();};if($('design-tab'))$('design-tab').onclick=()=>{view='design';render();};$('files-tab').onclick=()=>{view='files';render();schedulePreview();};if($('try-example'))$('try-example').onclick=loadDemo;
  for(const [id,key] of [['product-title','title'],['author','author'],['outline','outline'],['design-direction','design'],['manuscript','productDraft']])if($(id))$(id).oninput=e=>{state.brief[key]=e.target.value;state.changeNote=key==='productDraft'?'You edited the proposed manuscript. Approve it when ready.':'You updated the product details.';invalidate();save();schedulePreview();if(key==='title'){const label=document.querySelector('.project-line strong');if(label)label.textContent=title();renderCurrentAction();}};
  if($('review-current'))$('review-current').onclick=()=>{view='draft';render();};
  if($('export-sample'))$('export-sample').onclick=exportSample;
  if($('toggle-editor'))$('toggle-editor').onclick=()=>{view=view==='edit'?'draft':'edit';render();schedulePreview();};
  if($('approve-draft'))$('approve-draft').onclick=()=>{if(hasConcepts()&&!approvedArt(state)){view='design';render();notice('Choose and approve the visual sample before approving this presentation section.');return;}approveDraft(state);invalidate();save();render();};
  if($('revise-draft'))$('revise-draft').onclick=()=>{revisionMode=true;renderChat();$('answer').focus();$('sidebar').scrollIntoView({behavior:'smooth',block:'start'});};
  if($('undo-draft'))$('undo-draft').onclick=()=>{undoApproval(state);save();render();schedulePreview();};
  if($('reviewed'))$('reviewed').onchange=e=>{state.reviewed=e.target.checked;save();$('export-product').disabled=!runtimeReady||!state.reviewed||working||state.approvedDraft!==state.brief.productDraft;};
  if($('prepare-completion'))$('prepare-completion').onclick=prepareCompletion;if($('export-product'))$('export-product').onclick=exportFiles;if($('optional-apps'))$('optional-apps').onclick=()=>{panel('account-panel',true);$('account-panel').scrollIntoView({behavior:'smooth'});};
  if($('cover-image'))$('cover-image').onchange=uploadCover;if($('remove-cover'))$('remove-cover').onclick=()=>{state.coverImage='';invalidate();save();render();schedulePreview();};bindProductActions();bindDesignActions();bindOutlineActions();renderCurrentAction();
}
function bindProductActions(){
  if($('export-preview'))$('export-preview').ontoggle=e=>{previewOpen=e.target.open;if(previewOpen){$('designed-preview').innerHTML=previewMarkup();schedulePreview();}};
  if($('retry-preview'))$('retry-preview').onclick=()=>schedulePreview(true);
  document.querySelectorAll('[data-suggestion]').forEach(button=>button.onclick=()=>{const s=state.suggestions[Number(button.dataset.suggestion)];send(`Let’s explore this suggestion: ${s.title}. ${s.why} Please keep it grounded in what I have shared.`);});
  document.querySelectorAll('[data-companion]').forEach(button=>button.onclick=()=>{const c=state.companions[Number(button.dataset.companion)],source=title();save();state=newProject(studio);state.pendingAnswer=`I want to explore a companion to ${source}: ${c.title} (${c.format}). The idea is ${c.why} Ask me what you need to confirm before we choose it.`;view='brief';revisionMode=false;resetPreview();save();render();notice('A separate companion project is ready. Review the starter message, then send it.');});
}
function resetPreview(){previewOpen=false;clearTimeout(previewTimer);previewAbort?.abort();previewVersion++;preview={key:'',status:'empty',pages:[],message:''};}
function schedulePreview(force=false){
  if(!runtimeReady||!previewOpen)return;if(!state.brief.productDraft){resetPreview();return;}
  const key=previewKey();if(!force&&preview.key===key&&['loading','ready'].includes(preview.status))return;
  clearTimeout(previewTimer);
  previewAbort?.abort();const version=++previewVersion,projectId=state.id;preview={key,status:'loading',pages:[],message:''};if($('designed-preview'))$('designed-preview').innerHTML=previewMarkup();
  previewTimer=setTimeout(async()=>{
    previewAbort=new AbortController();
    try{const result=await post('/api/preview-product',{brief:{...state.brief},coverImage:state.coverImage||undefined},previewAbort.signal);if(version!==previewVersion||state.id!==projectId||key!==previewKey())return;if(!Array.isArray(result.pages)||!result.pages.length||result.pages.some(p=>typeof p.svg!=='string'))throw Error('The designed preview could not be read.');preview={key,status:'ready',pages:result.pages,message:''};}
    catch(error){if(error.name==='AbortError'||version!==previewVersion)return;preview={key,status:'error',pages:[],message:error.message};}
    if(state.id===projectId&&key===previewKey()&&$('designed-preview')){$('designed-preview').innerHTML=previewMarkup();bindProductActions();}
  },350);
}
async function post(path,payload,signal){const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});let data;try{data=await response.json();}catch{throw Error('The local app could not read the reply. Your project is retained.');}if(!response.ok)throw Object.assign(Error(data.error||data.message||'The request could not finish.'),{status:response.status,retryable:data.retryable===true});return data;}
function busy(value,text='John Connor is thinking'){working=value;$('busy').style.display='none';$('busy-title').textContent=text;render();if(!value)refreshExpiredModelAccess();}
function acceptGoogleSnapshot(project,result,sourceKey,id,destination){
  const job=cleanGoogleDelivery(result);
  if(!job||job.sourceKey!==sourceKey||id&&job.id!==id||destination&&job.destination!==destination)throw Error('The Google production reply did not match this reviewed source. Your draft is retained.');
  project.googleDelivery=job;googleChecked.add(job.id);save();if(state.id===project.id)render();return job;
}
async function pollGoogleDelivery(project,sourceKey){
  let job=project.googleDelivery;
  while(job?.status==='running'){
    await new Promise(resolve=>setTimeout(resolve,1000));
    job=acceptGoogleSnapshot(project,await fetch('/api/google-production/'+encodeURIComponent(job.id)).then(async response=>{const value=await response.json();if(!response.ok)throw Error(value.error||'The Google production could not be checked.');return value;}),sourceKey,job.id,job.destination);
  }
  if(state.id===project.id&&job?.status==='ready'&&sourceKey===googleSourceKey(project.brief))notice(`${googleLabel(job.destination)} created and read back. Open the real file to review it.`);
  return job;
}
async function createNativeGoogle(){
  const project=state;if(working||!canUseModel()||!localFilesReady()||provider!=='chatgpt')return;
  const sourceKey=googleSourceKey(project.brief),destination=googleDestination(project.brief),selection={...selectedCombination()};
  googlePolling.add(project.id);busy(true,`Creating in ${googleLabel(destination)}`);
  try{
    acceptGoogleSnapshot(project,await post('/api/create-google',{brief:{...project.brief},approvedSource:project.approvedDraft,destination,...selection}),sourceKey,undefined,destination);
    await pollGoogleDelivery(project,sourceKey);
  }catch(error){notice(error.message,true);}
  finally{googlePolling.delete(project.id);busy(false);}
}
async function resumeNativeGoogle(){
  const project=state,receipt=project.googleDelivery,job=cleanGoogleDelivery(receipt),sourceKey=googleSourceKey(project.brief);
  if(working||!runtimeReady||!accountReady||!canUseModel()||provider!=='chatgpt'||!job||!googleChecked.has(job.id)||job.destination!=='docs'||googleDestination(project.brief)!=='docs'||job.status!=='unavailable'||!job.creationAttempted||job.sourceKey!==sourceKey||project.approvedDraft!==project.brief.productDraft||!project.brief.productDraft.trim())return;
  const url=googleEditorUrl((googleResumeUrls.get(job.id)||'').trim(),'docs');if(!url){notice('Paste the exact existing Google Doc editor link before continuing.',true);return;}
  const selection={...selectedCombination()};googlePolling.add(project.id);busy(true,'Checking and finishing your existing Google Doc');
  try{
    const result=await post('/api/resume-google',{id:job.id,url,brief:{...project.brief},approvedSource:project.approvedDraft,...selection});
    if(project.googleDelivery!==receipt||googleSourceKey(project.brief)!==sourceKey||project.approvedDraft!==project.brief.productDraft)return;
    acceptGoogleSnapshot(project,result,sourceKey,job.id,'docs');
    const completed=await pollGoogleDelivery(project,sourceKey);if(completed?.status==='ready')googleResumeUrls.delete(job.id);
  }catch(error){notice(error.message,true);}
  finally{googlePolling.delete(project.id);busy(false);}
}
async function recheckNativeGoogle(){
  const project=state,receipt=project.googleDelivery,job=cleanGoogleDelivery(receipt),sourceKey=googleSourceKey(project.brief);
  if(working||!runtimeReady||!accountReady||!canUseModel()||provider!=='chatgpt'||!job||!googleChecked.has(job.id)||job.destination!=='sheets'||googleDestination(project.brief)!=='sheets'||job.status!=='unavailable'||!job.creationAttempted||!job.file||job.sourceKey!==sourceKey||project.approvedDraft!==project.brief.productDraft||!project.brief.productDraft.trim())return;
  const selection={...selectedCombination()};googlePolling.add(project.id);busy(true,'Rechecking your existing Google Sheet');
  try{
    const result=await post('/api/recheck-google',{id:job.id,brief:{...project.brief},approvedSource:project.approvedDraft,...selection});
    if(project.googleDelivery!==receipt||googleSourceKey(project.brief)!==sourceKey||project.approvedDraft!==project.brief.productDraft)return;
    acceptGoogleSnapshot(project,result,sourceKey,job.id,'sheets');await pollGoogleDelivery(project,sourceKey);
  }catch(error){notice(error.message,true);}
  finally{googlePolling.delete(project.id);busy(false);}
}
function restoreGoogleDelivery(project){
  const receipt=project.googleDelivery,job=cleanGoogleDelivery(receipt),source=googleSourceKey(project.brief);
  if(!runtimeReady||!job||googleChecked.has(job.id)||googleRefreshing.has(job.id)||googlePolling.has(project.id)||working)return;
  const ownsReceipt=()=>project.googleDelivery===receipt&&googleSourceKey(project.brief)===source;
  googleRefreshing.add(job.id);
  fetch('/api/google-production/'+encodeURIComponent(job.id)).then(async response=>{const result=await response.json();if(!response.ok)throw Error(result.error||'This saved Google delivery could not be confirmed.');return result;}).then(async result=>{
    if(!ownsReceipt())return;
    const current=acceptGoogleSnapshot(project,result,job.sourceKey,job.id,job.destination);
    if(current.status==='running'){googlePolling.add(project.id);busy(true,`Checking ${googleLabel(job.destination)} production`);try{await pollGoogleDelivery(project,job.sourceKey);}finally{googlePolling.delete(project.id);busy(false);}}
  }).catch(error=>{if(!ownsReceipt())return;project.googleDelivery={...job,status:'unavailable',verified:false,message:error.message};googleChecked.add(job.id);save();if(state.id===project.id)render();}).finally(()=>googleRefreshing.delete(job.id));
}
async function send(text,fromComposer=false,{completion=false,retry=false,fullDraft=false}={}){
  fullDraft=fullDraft||Boolean(fromComposer&&/^(?:continue|go ahead|build (?:the )?(?:full|complete) draft)[.!]?$/i.test(text.trim())&&state.interviewStage>=9&&expandedOutlineApprovalCurrent(state)&&!expandedOutlineCovered(state)&&(!isPresentation(state.brief)||nativeSamplesApproved(state)));
  if(working)return;if(!runtimeReady){notice('Restart the app to finish this update. Your project is retained.',true);return;}if(!accountReady){panel('account-panel',true);notice('Connect your selected AI account to continue.',true);return;}if(!canUseModel()){notice(modelAccess.state.message||'Check access for your selected model and quality before sending.',true);return;}
  const project=state,projectId=state.id,requestProvider=provider,requestModel=selectedModel,requestQuality=quality,session=referenceComposer(project),previous=retry?project.retryRequest:null;
  if(retry&&!previous)return;if(fromComposer&&(!session.ready||(!text.trim()&&!project.pendingReferences.length)))return;
  function planPassageEdit(input){return /^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+(?:please\s+)?)?(?:change|replace|rewrite|simplify|shorten)\s+(?:(?:the|this|that|my|our|first|second|third|last|current|following)\s+){0,5}(?:paragraph|sentence|section|passage|notes|wording)\b[^.!?\n]{0,100}\b(?:in|of|from)\s+(?:(?:the|my|our|approved|current|expanded|full)\s+){0,5}(?:scope\s+breakdown|expanded\s+outline|product\s+plan)\b/i.test(String(input).trim());}
  function typedPassageEdit(input){
    if(namedSectionEditRequest(project.brief.productDraft||'',String(input)))return true;
    const manuscript=project.brief.productDraft||'',raw=String(input).trim().replace(/^(?:I|We)\s+(?:reviewed|checked|read)\s+(?:(?:the|this|your|our)\s+)?(?:PDF|sample|draft|preview|presentation|slides|product)[.!]\s+/i,''),prefix=/^(?:in|within|for)\s+([^\r\n,:]{1,240})\s*[,:]\s*(.+)$/i.exec(raw);let instruction=raw,scopeText=manuscript;
    if(prefix){
      const locator=prefix[1].replace(/^(?:the|this|that|my|our)\s+/i,'').trim(),quoted=/^(?:"([^"]+)"|“([^”]+)”|‘([^’]+)’|'([^']+)'|`([^`]+)`)(?:\s+(?:exercise|section|unit|slide|chapter|lesson))?$/i.exec(locator),names=quoted?[quoted.slice(1).find(value=>value!==undefined)]:[locator,locator.replace(/\s+(?:exercise|section|unit|slide|chapter|lesson)$/i,'')],units=[...manuscript.matchAll(/^ {0,3}#{1,2}[ \t]+([^\r\n]+)/gm)],matches=units.filter(unit=>names.some(name=>name.toLocaleLowerCase()===unit[1].trim().toLocaleLowerCase()));
      if(matches.length!==1)return false;const unit=matches[0],next=units[units.indexOf(unit)+1];scopeText=manuscript.slice(unit.index,next?.index??manuscript.length);instruction=prefix[2].trim();
    }
    const action=/^(?:please\s+)?(?:(can|could|would|will)\s+you\s+(?:please\s+)?)?(?:change|replace|rewrite|simplify|shorten)\s+/i.exec(instruction);
    if(!manuscript.trim()||!action||planPassageEdit(instruction))return false;
    const target=instruction.slice(action[0].length).replace(/^(?:(?:only|just)\s+)+/i,''),unquoted=target.replace(/"[^"]*"|“[^”]*”|'[^']*'|‘[^’]*’|`[^`]*`/g,' ').replace(/\s+/g,' ').trim();
    if((action[1]?unquoted.replace(/\?$/,''):unquoted).includes('?')||/\b(?:if|unless|not (?:now|yet)|for reference only|hypothetically)\b/i.test(unquoted))return false;
    const named=/^(?:(?:the|this|that|these|those|my|our|first|second|third|fourth|last|final|current|selected|highlighted|following|above|previous)\s+){1,6}((?:(?:presenter|speaker)\s+)?notes|paragraph|sentence|section|passage|line|bullet|question)\b/i.exec(unquoted)||/^(paragraph|sentence|section|passage|line|bullet)\s+\d+\b/i.exec(unquoted)||/^((?:presenter|speaker)\s+notes)\b/i.exec(unquoted);
    if(named)return !/notes/i.test(named[1])||/^###\s+(?:presenter|speaker) notes\b/im.test(manuscript);
    for(const [open,close]of [['"','"'],['“','”'],["'","'"],['‘','’'],['`','`']])if(target.startsWith(open)){const end=target.indexOf(close,open.length),selected=end<0?'':target.slice(open.length,end);if(!selected||/^\s*(?:and|or|,|&|\/)\s*["“‘'`]/i.test(target.slice(end+close.length)))return false;const headings=[...scopeText.matchAll(/^ {0,3}##[ \t]+([^\r\n]+)/gm)].filter(match=>match[1].trim()===selected);if(headings.length)return headings.length===1;return selected!==project.brief.title&&scopeText.indexOf(selected)>=0&&scopeText.indexOf(selected)===scopeText.lastIndexOf(selected);}
    return false;
  }
  // A saved retry keeps its original authorization. Only a new typed edit can
  // infer passage permission; generated and whole-draft actions cannot inherit it.
  const allowRevision=previous?previous.revisionIntent===true:fromComposer&&!completion&&!fullDraft&&(revisionMode||typedPassageEdit(text)),creatorInput=previous?.fromComposer??fromComposer;
  let request,providerStarted=false,requestMode='interview';
  busy(true,fullDraft||previous?.fullDraft?'Building your complete first draft':fromComposer&&extractHttpLinks(text).length?'Preparing your references locally':project.interviewStage===5?'Checking real market sources':'John Connor is thinking');
  try{
    if(previous)request=previous;
    else{
      if(fromComposer){await session.addLinks(extractHttpLinks(text));if(!session.ready)throw Error('A reference could not be prepared. Your answer is retained. Remove the failed reference and attach it again.');}
      request=recordRequest(project,text,{fromComposer,revisionIntent:allowRevision,completion,fullDraft});if(fromComposer)revisionMode=false;save();renderChat();
    }
    // Match an instruction whose direct object is the plan, not a manuscript
    // rewrite that merely mentions it. Retry uses the retained original text.
    const planRewrite=creatorInput&&(/(?:^|[.!?;\n])\s*(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+(?:please\s+)?|i\s+(?:want|need)\s+(?:you\s+)?to\s+|i(?:['’]d| would)\s+like\s+(?:you\s+)?to\s+)?(?:rewrite|rephrase|simplify|update|revise|rework)\s+(?:(?:the|my|our|this|that|full|whole|entire|complete|approved|current|existing|detailed|saved|previous|latest|original)\s+){0,8}(?:scope\s+(?:breakdown|plan)|expanded\s+(?:outline|plan)|product\s+plan)\b/i.test(request.text)||planPassageEdit(request.text));
    requestMode=request.fullDraft?'full-draft':outlineApprovalCurrent(project)&&(!expandedOutlineApprovalCurrent(project)||planRewrite)?'expand-outline':'interview';
    providerStarted=true;
    const reply=await post('/api/interview',{mode:requestMode,interviewStage:project.interviewStage,brief:project.brief,notes:project.notes,messages:requestMessages(project,request),references:request.references,currentInput:creatorInput?request.text:'',provider:requestProvider,model:requestModel,reasoningEffort:requestQuality,preferences:activePreferences(studio.profile),approvedDraft:project.approvedDraft,revisionIntent:allowRevision,presentationDesign:project.presentationDesign||undefined,canvaSampleId:project.canvaSample?.jobId||undefined,slideProductionId:project.slideProduction?.id||undefined,approvedOutline:project.approvedOutline||'',expandedOutline:project.expandedOutline||'',approvedExpandedOutline:project.approvedExpandedOutline||''});
    project.retryRequest=null;applyReply(project,reply,allowRevision,{profile:studio.profile,currentInput:request.text,creatorInput});save();renderPreferences();updateModelNote();if(state.id===projectId){if(request.completion)view='files';else if(request.fullDraft)view='draft';else if(project.brief.productDraft)view='brief';schedulePreview();}
  }catch(error){
    const accessFailure=[401,403].includes(error.status)||/\b(?:model_not_found|invalid_model|unsupported_model|model_not_supported|unsupported_reasoning_effort|invalid_reasoning_effort|authentication_error|invalid_api_key|unauthorized|not_authenticated|token_expired)\b/i.test(error.message||'');
    const timeout=providerStarted&&error.status!==409&&!accessFailure&&/timed?\s*out|timeout|took too long|deadline (?:exceeded|expired)|ETIMEDOUT/i.test(error.message||'');
    // These structured transport codes are returned after the native process
    // closes. A held termination or an unconfirmed/different choice stays held.
    const transport=providerStarted&&Number.isInteger(error.status)&&error.status>=400&&error.status!==409&&!accessFailure&&!/did not confirm that it stopped|no new request will start/i.test(error.message||'')&&/\[(?:runtime|connection_error|stream_error|econnreset|epipe|server_error|internal_server_error|service_unavailable|overloaded_error)(?:;\s*HTTP\s+\d+)?\]\s*$/i.test(error.message||'')&&canUseModel()&&provider===requestProvider&&selectedModel===requestModel&&quality===requestQuality;
    const outputLimit=providerStarted&&error.status!==409&&!accessFailure&&/\[(?:output_limit|max_output_tokens_exceeded|output_limit_exceeded|response_too_large|max_tokens_exceeded)(?:;\s*HTTP\s+\d+)?\]\s*$/i.test(error.message||''),recoverable=timeout||outputLimit||transport;
    const message=outputLimit?`The reply reached its output limit. Your original request is saved. Use Retry last message${requestMode==='expand-outline'?'; the app will request a compact whole-product plan with the same selected model.':' with the same selected model.'}`:timeout?'The request timed out. Your original request is saved. Use Retry last message with the same selected model.':error.message;
    if(providerStarted){project.retryRequest=request;if(!previous)project.messages.push({role:'assistant',content:`I couldn’t finish that reply. Your conversation, references and draft are retained. ${recoverable?message:error.status===409?`${error.message} Wait for the current AI request to finish before retrying.`:`${error.message} Check access for your selected model, then use Retry last message.`}`});save();if(!recoverable)modelAccess.invalidate(error.status===409?'Your AI is still working. Wait for that request to finish before checking access again.':'The last reply failed. Check access for your selected model and quality before retrying.');}notice(message,true);
  }finally{busy(false);}
}
async function advance(){
  if(working||!canUseModel()||state.interviewStage>=12)return;
  if(state.interviewStage>=8&&!expandedOutlineApprovalCurrent(state)){view='brief';render();notice('Review and approve the whole expanded product plan before continuing.');return;}
  if(state.interviewStage>=10&&!expandedOutlineCovered(state)){view='brief';render();notice('Some approved plan sections are still missing. Continue developing them in the conversation before moving to completion.');return;}
  if(!state.stageReady)return;
  if(hasConcepts()&&!approvedArt(state)){view='design';render();notice('Choose and approve the current visual sample before continuing.');return;}
  if(state.interviewStage===8&&!state.brief.outline.trim()){notice('Refine and approve a concrete outline first.',true);return;}
  if(state.interviewStage===9&&(!state.sampleApproved||state.approvedDraft!==state.brief.productDraft)){view='draft';render();schedulePreview();notice('Review and approve the representative sample in Your product first.',true);return;}
  if(state.interviewStage>=10&&(!state.brief.productDraft.trim()||state.approvedDraft!==state.brief.productDraft)){view='draft';render();schedulePreview();notice('Review and approve the current section before continuing.',true);return;}
  const baselineKnown=key=>{
    const value=String(state.brief[key]||'').trim();return value&&!/^(?:unknown|unsure|tbd|not (?:yet )?(?:known|decided|sure)|unrun|everyone|anyone|people|business owners)[.!]?$/i.test(value)&&!/\b(?:not (?:yet )?(?:known|decided|chosen|sure)|needs? to be (?:decided|chosen)|to be determined|still (?:unknown|undecided|unclear)|(?:haven['’]t|don['’]t|do not) (?:yet )?(?:know|decided|chosen))\b/i.test(value);
  },niche=String(state.brief.niche||'').trim(),buyer=String(state.brief.buyer||'').trim();
  const baselineComplete=['topic','buyer','outcome'].every(baselineKnown)&&(niche?baselineKnown('niche')&&niche.split(/\s+/).length>=4:buyer.split(/\s+/).length>=6&&!/^(?:everyone|anyone|people)\b/i.test(buyer));
  state.notes.push({stage:state.interviewStage,title:STAGES[state.interviewStage-1][0],summary:state.summary});state.interviewStage=state.interviewStage<5&&baselineComplete?5:state.interviewStage+1;state.stageReady=false;state.summary='';save();
  if(state.interviewStage===10){view='brief';render();return;}
  if(state.interviewStage===12){view='files';render();schedulePreview();await prepareCompletion();return;}
  await send(state.interviewStage===9&&!state.brief.productDraft.trim()?'Draft one representative sample from the first section of the approved expanded product plan. Use the agreed format, voice and design, and keep the content within that planned section.':'I approve this direction. Let’s continue.');
}
async function prepareCompletion(){await send('We have reached the file stage. Keep the approved manuscript exactly unchanged. Prepare grounded listing copy and relevant optional companion product ideas based on this product and its buyer. Do not create an extra product or invent market evidence or results.',false,{completion:true});}
async function exportSample(){
  if(working||!runtimeReady||!state.brief.productDraft||state.interviewStage<9)return;
  if(isPresentation(state.brief)){view='design';render();return;}
  const project=state,key=previewKey();busy(true,'Creating a draft sample for review');
  try{const result=await post('/api/export-product',{brief:project.brief,coverImage:project.coverImage||undefined,draft:true,reviewed:false});if(!acceptSampleFiles(project,result.files,key,previewKey()))throw Error('The project changed. Create a new sample for the current section.');notice('Your review files are ready. Open an available Canva or Google Docs link, or review the PDF or text copy.');}
  catch(error){notice(error.message,true);}finally{busy(false);}
}
async function exportFiles(){
  if(working||!runtimeReady||!state.reviewed||state.approvedDraft!==state.brief.productDraft||!isPresentation(state.brief)&&!localFilesReady())return;const project=state,key=previewKey();busy(true,'Creating the actual files');
  try{const result=await post('/api/export-product',{brief:project.brief,reviewed:true,coverImage:project.coverImage||undefined});if(state.id!==project.id||key!==previewKey())throw Error('The project changed. Create a fresh package for the current product.');project.files=result.files;save();notice(isPresentation(project.brief)?'Your content fallback files are ready. Review the selected slide design in Visual direction or Canva.':`${result.pages} designed pages exported. Your files are ready.`);}catch(error){notice(error.message,true);}finally{busy(false);}
}
function downloadProject(){save();const blob=new Blob([JSON.stringify(checkpoint(state),null,2)],{type:'application/json'});if(blob.size>BACKUP_LIMIT){notice('This backup exceeds 8 MB. Your project is still open. Copy the manuscript and unsent answer before reducing large project content, then save again.',true);return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${title().replace(/[^a-z0-9-]+/gi,'-').slice(0,65)}-project.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);notice('Project backup downloaded. It includes the interview, unsent answer and processed references.');}
async function initializeProjectLibrary(){
  await projectLibrary.initialize();state=studio.projects.find(project=>project.id===studio.activeId)||state;
  for(const project of studio.projects)if(project.canvaJob&&!canvaJobs.has(project.id))canvaJobs.set(project.id,{...project.canvaJob,needsRefresh:true});
  persistStudio(storage,studio);render();renderProjects();
}
function renderProjects(){
  $('project-list').innerHTML=studio.projects.map(p=>`<li><button data-project="${esc(p.id)}" ${p.id===state.id?'aria-current="true"':''}>${esc(title(p))}${p.id===state.id?' · open':''}</button><span>${p.brief.productDraft?'Draft saved':'Project saved'} · ${esc(new Date(p.updatedAt).toLocaleString())}${p.pendingAnswer?' · unsent answer retained':''}</span></li>`).join('');
  document.querySelectorAll('[data-project]').forEach(button=>button.onclick=()=>{if(working)return;save();state=openProject(studio,button.dataset.project);conceptFocus=state.presentationDesign?.conceptId||'editorial';view=hasConcepts()&&!designApprovalCurrent(state)?'design':'brief';revisionMode=false;resetPreview();save();render();schedulePreview();panel('projects-panel',false);});
}
function renderPreferences(){
  const count=studio.profile.preferences.length,full=count>=PREFERENCE_LIMIT;
  $('pause-learning').checked=studio.profile.paused;
  $('preferences-toggle').textContent=`Your preferences${count?count>PREFERENCE_LIMIT?` (${PREFERENCE_LIMIT} active / ${count} saved)`:full?` (${count}/${PREFERENCE_LIMIT})`:` (${count})`:''}${studio.profile.candidates.length?' · waiting instructions':''}`;
  $('preference-capacity').textContent=count>PREFERENCE_LIMIT?`${count} instructions are retained. The first ${PREFERENCE_LIMIT} in this list are supplied to your AI; later entries remain editable below. Forget an active instruction to include a later entry.`:full?`${PREFERENCE_LIMIT} of ${PREFERENCE_LIMIT} instructions are active. New instructions wait below; forget an active instruction, then choose Remember this to include another.`:`${count} of ${PREFERENCE_LIMIT} instructions are active. Inferred ideas need confirmation before they are included.`;
  $('preference-list').innerHTML=count?studio.profile.preferences.map((p,index)=>`<div class="preference-row"><label for="pref-${esc(p.id)}">${esc(p.category[0].toUpperCase()+p.category.slice(1))} instruction</label>${index>=PREFERENCE_LIMIT?'<p class="fine">Retained; outside the active AI context.</p>':''}<textarea id="pref-${esc(p.id)}" maxlength="1000">${esc(p.text)}</textarea><div class="panel-actions"><button data-edit-pref="${esc(p.id)}">Save change</button><button data-forget-pref="${esc(p.id)}">Forget</button></div></div>`).join(''):'<p class="fine">No preferences remembered yet. Your projects keep their own facts.</p>';
  $('preference-candidates').innerHTML=studio.profile.candidates.length?`<h3 style="margin-top:25px">Instructions waiting to be included</h3>${studio.profile.candidates.map(p=>`<div class="candidate"><p>${esc(p.text)} <span class="fine">(${esc(p.category)} · ${p.source==='explicit'?'explicit instruction':'inferred; needs confirmation'})</span></p><div class="panel-actions"><button data-confirm-pref="${esc(p.id)}" ${full?'disabled':''}>Remember this</button><button data-forget-pref="${esc(p.id)}">Dismiss</button></div></div>`).join('')}`:'';
  document.querySelectorAll('[data-edit-pref]').forEach(button=>button.onclick=()=>{const p=studio.profile.preferences.find(p=>p.id===button.dataset.editPref),text=$(`pref-${p.id}`).value;if(!text.trim()){notice('Enter an instruction, or choose Forget.',true);return;}editPreference(studio.profile,p.id,text,p.category);save();renderPreferences();});
  document.querySelectorAll('[data-forget-pref]').forEach(button=>button.onclick=()=>{forgetPreference(studio.profile,button.dataset.forgetPref);save();renderPreferences();});
  document.querySelectorAll('[data-confirm-pref]').forEach(button=>button.onclick=()=>{if(!confirmPreference(studio.profile,button.dataset.confirmPref)){notice('All 80 instruction slots are active. Forget one to include this waiting instruction.',true);return;}save();renderPreferences();});
}
function updateModelNote(){
  if(!$('model-access-status'))$('model-note').innerHTML='<span id="model-access-status" role="status" aria-live="polite"></span> <button id="check-model-access" type="button" class="quiet">Check access</button>';
  const access=modelAccess.state;
  const ownedBusy=access.status==='busy'&&(slideBusy()||['running','approval'].includes(canvaJobs.get(state.id)?.status));
  const quiet=runtimeReady&&accountReady&&(access.status==='ready'||ownedBusy);$('model-note').hidden=quiet;
  $('model-access-status').textContent=!runtimeReady?runtimeError||'Checking the app version…':!accountReady?'Connect your AI account to check the selected model.':ownedBusy?'Your current slide or Canva request is in progress.':access.status==='ready'?'':access.status==='unavailable'?`Unavailable on this subscription. ${access.message}`:access.status==='busy'?`Model access is not confirmed: ${access.message}`:access.status==='error'?`Could not check model access: ${access.message}`:access.message;
  $('check-model-access').hidden=!runtimeReady||!accountReady||quiet||access.status==='checking';$('check-model-access').disabled=working||access.status==='checking';$('check-model-access').textContent=access.status==='idle'||access.status==='checking'?'Check access':'Check again';$('check-model-access').onclick=()=>checkSelectedModel(true);
  for(const option of $('model').options){const outcome=modelAccess.results.get(modelAccessKey({provider,model:option.value,reasoningEffort:quality}));if(option.dataset.label)option.textContent=option.dataset.label+(outcome?.status==='unavailable'?' · unavailable':'');}
}
function renderModels(){const selection=modelSelection(catalog?.[provider]||[],readSetting(`product-studio-model-${provider}`,''));selectedModel=selection.selected;$('model').innerHTML=selection.options.map(m=>{const label=`${m.label}${m.recommended?' · recommended':''}`;return `<option value="${esc(m.id)}" data-label="${esc(label)}">${esc(label)}</option>`;}).join('')||'<option value="">Model list unavailable</option>';$('model').value=selectedModel;$('model').disabled=!selectedModel||working||!runtimeReady;$('quality').value=quality;updateModelNote();}
async function bootstrap(){
  try{const response=await fetch('/api/health'),health=await response.json();const [major,minor,patch]=String(health.version||'0.0.0').split('.').map(Number);if(!response.ok||health.app!=='product-studio-local'||!(major>0||minor>3||minor===3&&patch>=21))throw Error('Restart the app to finish this update. Your project is retained.');runtimeReady=true;const modelResponse=await fetch('/api/models');if(!modelResponse.ok)throw Error('The model list could not be loaded. Reload the local app.');const data=await modelResponse.json();if(!Array.isArray(data.chatgpt)||!Array.isArray(data.claude))throw Error('The model list could not be read.');catalog=data;renderModels();render();schedulePreview();checkSelectedModel();}
  catch(error){runtimeReady=false;runtimeError=error.message;$('model').innerHTML='<option value="">Restart the app</option>';$('model').disabled=true;$('model-note').textContent=error.message;notice(error.message,true);render();}
}
async function uploadCover(event){const file=event.target.files[0];if(!file||working)return;const projectId=state.id;try{if(!['image/png','image/jpeg'].includes(file.type)||file.size>1048576)throw Error('Choose a PNG or JPEG image up to 1 MB.');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('The image could not be read.'));reader.readAsDataURL(file);});if(projectId!==state.id)return;state.coverImage=data;invalidate();save();render();schedulePreview();}catch(error){notice(error.message,true);event.target.value='';}}
async function loadDemo(){
  if(working)return;const projectId=state.id;
  try{const response=await fetch('/example-project.json');if(!response.ok)throw Error('The illustrative product could not be opened. Your current project is retained.');const sample=await response.json();if(working||state.id!==projectId)return;save();state=importProject(studio,sample);view='brief';revisionMode=false;resetPreview();save();render();schedulePreview();}
  catch(error){notice(error.message,true);}
}
async function checkAccount(){const requested=provider,version=++accountCheckVersion;try{const response=await fetch('/api/status?provider='+encodeURIComponent(requested));if(!response.ok)throw Error('Could not check the local AI tool.');const result=await response.json();if(requested!==provider||version!==accountCheckVersion)return;accountReady=!!result.ready;const name=provider==='claude'?'Claude':'ChatGPT';$('connection').textContent=accountReady?`${name} connected`:`Connect ${name}`;$('dot').classList.toggle('ready',accountReady);$('account-message').textContent=result.message;$('sign-in').disabled=!result.installed||accountReady;$('sign-in').textContent=accountReady?'Connected':`Sign in with ${name}`;clearTimeout(loginPoll);if(result.loginRunning&&!accountReady)loginPoll=setTimeout(checkAccount,4000);checkSelectedModel();updateModelNote();renderChat();}catch(error){if(requested!==provider||version!==accountCheckVersion)return;accountReady=false;modelAccess.clear();$('dot').classList.remove('ready');$('connection').textContent='Check AI connection';$('account-message').textContent=error.message;}}
$('settings-toggle').onclick=()=>toggleSettings($('settings-panel').hidden);$('close-settings').onclick=()=>toggleSettings(false,true);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('settings-panel').hidden)toggleSettings(false,true);});
$('new-project').onclick=()=>{if(working)return;save();state=newProject(studio);conceptFocus='editorial';view='brief';revisionMode=false;resetPreview();save();render();notice('New project started. Your earlier projects are in Open project.');};
$('save-project').onclick=async()=>{save();if(await projectLibrary.save())notice('Project saved on this computer. Find it in Open project.');else notice('Local saving could not finish. Your browser copy is retained; try Save project again.',true);};$('download-backup').onclick=downloadProject;$('open-project').onclick=()=>{renderProjects();panel('projects-panel',$('projects-panel').hidden);};$('close-projects').onclick=()=>{panel('projects-panel',false);$('open-project').focus();};$('import-project').onclick=()=>$('import-file').click();
$('import-file').onchange=async event=>{const file=event.target.files[0];if(!file||working)return;try{if(file.size>BACKUP_LIMIT)throw Error('This backup exceeds 8 MB. Your current project is retained. Open the original project and save a smaller backup.');const raw=JSON.parse(await file.text());if(working)throw Error('Wait for the current reply, then open the backup.');save();state=importProject(studio,raw);conceptFocus=state.presentationDesign?.conceptId||'editorial';view=hasConcepts()?'design':'brief';revisionMode=false;resetPreview();save();render();schedulePreview();panel('projects-panel',false);notice('Project backup opened. Your other projects were retained.');}catch(error){notice(error.message,true);}event.target.value='';};
$('preferences-toggle').onclick=()=>{renderPreferences();panel('preferences-panel',$('preferences-panel').hidden);};$('close-preferences').onclick=()=>{panel('preferences-panel',false);$('preferences-toggle').focus();};$('pause-learning').onchange=event=>{studio.profile.paused=event.target.checked;save();};
$('preference-add').onsubmit=event=>{event.preventDefault();const text=$('preference-text').value.trim(),category=$('preference-category').value;if(!text)return;let candidate=studio.profile.candidates.find(p=>p.text===text&&p.category===category);if(!candidate){candidate={id:crypto.randomUUID(),text,category,source:'explicit'};studio.profile.candidates.push(candidate);}else candidate.source='explicit';const remembered=confirmPreference(studio.profile,candidate.id),persisted=save();if(remembered||persisted)$('preference-text').value='';if(!remembered&&persisted)notice('This instruction is waiting below. Forget an active instruction, then choose Remember this.');renderPreferences();};
$('provider').value=provider;$('provider').onchange=()=>{if(working)return;provider=$('provider').value;setting('product-studio-provider',provider);accountReady=false;modelAccess.clear();$('dot').classList.remove('ready');$('connection').textContent='Checking connection';clearTimeout(loginPoll);renderModels();renderChat();checkAccount();};$('model').onchange=()=>{if(working)return;selectedModel=$('model').value;setting(`product-studio-model-${provider}`,selectedModel);checkSelectedModel();updateModelNote();renderChat();};$('quality').value=quality;$('quality').onchange=()=>{if(working)return;quality=$('quality').value;setting('product-studio-quality',quality);checkSelectedModel();updateModelNote();renderChat();};
$('account-toggle').onclick=()=>{panel('account-panel',$('account-panel').hidden);if(!$('account-panel').hidden)checkAccount();};$('close-account').onclick=()=>{panel('account-panel',false);$('account-toggle').focus();};$('check-account').onclick=checkAccount;
$('sign-in').onclick=async()=>{$('sign-in').disabled=true;try{const result=await post('/api/login',{provider});$('account-message').textContent=result.message||'Complete provider sign-in in your browser, then check the connection.';clearTimeout(loginPoll);loginPoll=setTimeout(checkAccount,3000);}catch(error){$('account-message').textContent=error.message;$('sign-in').disabled=false;}};
document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshExpiredModelAccess();updateModelNote();renderChat();}});
async function startStudio(){
  for(const id of ['new-project','save-project','open-project','preferences-toggle','provider'])$(id).disabled=true;
  await initializeProjectLibrary();
  render();renderPreferences();
  for(const id of ['new-project','save-project','open-project','preferences-toggle','provider'])$(id).disabled=working;
  bootstrap();checkAccount().then(()=>{if(!accountReady)panel('account-panel',true);});
  if(studio.storageWarning)notice(studio.storageWarning,true);
}
startStudio();
