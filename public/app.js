const STAGES = [
  ['Discover what you know','Your experience, natural strengths, decisions, and stories.'],
  ['Find a useful problem','A real problem your knowledge can help someone solve.'],
  ['Find your target market','Who has that problem, and what is their situation?'],
  ['Niche down','One specific person, problem, situation, and outcome.'],
  ['Check the market','Inspect existing offers and find meaningful improvements.'],
  ['Design a better offer','Combine your expertise and useful improvements into a clear solution.'],
  ['Choose the format','Choose how the buyer will use the solution.'],
  ['Refine the outline','Decide what belongs, what is missing, and the right order.'],
  ['Set the voice and design','Agree on language, tone, feeling, and a representative sample.'],
  ['Create step by step','Develop one meaningful section together, then refine it.'],
  ['Review and improve','Check the substance, accuracy, usability, and package.'],
  ['Download your product','Create and check the actual files.']
];
const STORAGE = 'product-studio-local-v2';
const FIRST = 'We’ll find something useful in your experience and build it together, one decision at a time. What do people come to you for help with, or what could you talk about for hours?';
const blankBrief = () => Object.fromEntries(['topic','buyer','outcome','method','example','limits','author','tone','theme','niche','marketEvidence','offer','format','outline','design','productDraft'].map(k=>[k,k==='theme'?'clay':'']));
const fresh = () => ({brief:blankBrief(),interviewStage:1,messages:[{role:'assistant',content:FIRST}],notes:[],stageReady:false,summary:'',reviewed:false,files:null,demo:false,pendingAnswer:''});
let state = fresh(), working = false, accountReady = false, view = 'brief', timer;
let provider = localStorage.getItem('product-studio-provider')==='claude'?'claude':'chatgpt', loginPoll;
try { const s=JSON.parse(localStorage.getItem(STORAGE)); if(s?.brief&&Array.isArray(s.messages)&&Number.isInteger(s.interviewStage)&&s.interviewStage>=1&&s.interviewStage<=12&&Object.values(s.brief).every(v=>typeof v==='string')) state={...fresh(),...s,files:null,reviewed:false}; } catch {}
const $ = id => document.getElementById(id);
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function rich(text) { return esc(text).replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/\n/g,'<br>'); }
function save() { try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch{notice('Browser storage is full. Save a project copy to keep your work.',true);} }
function notice(text,error=false) { $('notice').textContent=text;$('notice').className=error?'error':'';$('notice').style.display='block';clearTimeout(timer);timer=setTimeout(()=>$('notice').style.display='none',error?16000:6000); }
function invalidate() { state.reviewed=false;state.files=null;if($('download-links'))$('download-links').innerHTML='';if($('reviewed'))$('reviewed').checked=false;if($('export-product'))$('export-product').disabled=true; }
function palette() {const c={clay:['#9a432e','#f5e7dd'],sage:['#345f4c','#e7efe7'],ink:['#274f71','#e7edf4']}[state.brief.theme]||['#9a432e','#f5e7dd'];document.documentElement.style.setProperty('--accent',c[0]);document.documentElement.style.setProperty('--pale',c[1]);}
function renderProgress() {
  const i=state.interviewStage;
  document.querySelector('nav').innerHTML=`<div class="progress-label">${state.demo?'Example output':`Step ${i} of 12`}<strong>${esc(STAGES[i-1][0])}</strong></div><div class="stage-dots" aria-label="Twelve creation stages">${STAGES.map((s,j)=>`<span class="${j+1===i?'current':j+1<i?'done':''}" title="${esc(s[0])}" aria-label="Step ${j+1}: ${esc(s[0])}" ${j+1===i?'aria-current="step"':''}>${j+1}</span>`).join('')}</div>`;
}
function renderChat() {
  $('sidebar').innerHTML=`<div class="conversation-head"><h3>Let’s work this out together</h3><p class="fine">${esc(STAGES[state.interviewStage-1][1])}</p></div><div class="messages" id="messages" aria-label="Your conversation">${state.messages.map(m=>`<div class="message ${m.role}"><span class="speaker">${m.role==='user'?'You':'Your creation partner'}</span><div>${rich(m.content)}</div></div>`).join('')}</div><div class="conversation-controls">${state.stageReady&&state.interviewStage<12?`<div class="decision"><p>${rich(state.summary)}</p><button id="continue-stage" ${working?'disabled':''}>Approve and continue</button></div>`:''}<form id="chat-form"><label class="sr-only" for="answer">Your answer or question</label><textarea id="answer" rows="3" placeholder="Tell me what actually happened…" ${working?'disabled':''}>${esc(state.pendingAnswer)}</textarea><div class="composer-bottom"><span>${working?'Your AI is thinking…':'Your knowledge leads the conversation'}</span><button id="send" type="submit" class="primary" ${working?'disabled':''}>Send</button></div></form><div class="conversation-files"><button class="quiet" id="save-project">Save project</button><button class="quiet" id="open-project">Open project</button></div></div>`;
  $('chat-form').onsubmit=e=>{e.preventDefault();const answer=$('answer').value.trim();if(answer)send(answer,true);};
  $('answer').oninput=e=>{state.pendingAnswer=e.target.value;save();};
  $('answer').onkeydown=e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();$('chat-form').requestSubmit();}};
  if($('continue-stage'))$('continue-stage').onclick=advance;
  $('save-project').onclick=downloadProject;$('open-project').onclick=()=>$('import-file').click();
  $('messages').scrollTop=$('messages').scrollHeight;
}
const facts=[['topic','What you can help with'],['niche','Your specific niche'],['buyer','Who it helps'],['outcome','The useful outcome'],['method','Your method and judgment'],['example','Your real examples'],['limits','Limits and exceptions'],['marketEvidence','Market observations'],['offer','Your offer'],['format','The chosen format'],['tone','Language and voice'],['design','Design direction']];
function renderBrief() {
  const b=state.brief,known=facts.filter(([key])=>b[key]);
  if(!known.length)return `<div class="conversation-empty"><h1>The useful part is<br>what only you know.</h1><p>Your methods, your judgment, your experience. We’ll draw them out through a conversation, then turn them into a product for a specific audience.</p><p class="fine">We choose the product format after understanding the problem and the offer. A workbook is one possible output.</p><p class="fine">This app runs on your computer. Your replies go to your selected AI provider using your own account.</p></div>`;
  return `<div class="brief-content"><h1>Your working brief</h1><p class="fine">This develops as we talk. Decisions stay open until you approve them.</p><dl>${known.map(([key,label])=>`<dt>${esc(label)}</dt><dd>${rich(b[key])}</dd>`).join('')}</dl>${b.outline?`<h2>Your product outline</h2><p class="fine">Refine this together in the conversation, or edit it here.</p><label class="sr-only" for="outline">Product outline</label><textarea id="outline" rows="8" ${working?'disabled':''}>${esc(b.outline)}</textarea>`:''}</div>`;
}
function markdown(text) {
  return text.split(/\n\s*\n/).map(block=>{
    const h=block.match(/^(#{1,3})\s+([^\n]+)$/);if(h)return `<h${Math.min(h[1].length+1,4)}>${esc(h[2])}</h${Math.min(h[1].length+1,4)}>`;
    return `<p>${rich(block).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')}</p>`;
  }).join('');
}
function renderDraft() {
  if(!state.brief.productDraft)return '<div class="brief-content"><h1>Your product takes shape here</h1><p>We’ll first understand your knowledge, the buyer, and the useful outcome. Your outline and manuscript will appear as we create them together.</p></div>';
  return `<div class="draft-tools"><p>${state.demo?'Demonstration output':'Your accumulated manuscript — created and refined through the conversation'}</p><button id="toggle-editor">${view==='edit'?'Read preview':'Edit text directly'}</button></div>${view==='edit'?`<label class="sr-only" for="manuscript">Product manuscript</label><textarea id="manuscript" class="manuscript" ${working?'disabled':''}>${esc(state.brief.productDraft)}</textarea>`:`<article class="page product-page">${markdown(state.brief.productDraft)}</article>`}`;
}
function links(files) {return ['pdf','markdown','zip'].filter(k=>files[k]).map(k=>`<a href="${esc(files[k].url)}" download>${{zip:'Complete package',pdf:'PDF',markdown:'Text (Markdown)'}[k]}</a>`).join('')+`<details><summary>Other editable formats</summary>${['editable','canva'].filter(k=>files[k]).map(k=>`<a href="${esc(files[k].url)}" download>${k==='editable'?'Editable document (.docx)':'Canva-compatible pages (.pptx)'}</a>`).join('')}</details>`;}
function renderDownloads() {
  return `<section class="download-panel"><h2>Your actual files</h2><p class="fine">PDF and editable text work without Canva or Google Workspace. Use Save project to retain your full interview.</p><label class="review-check"><input id="reviewed" type="checkbox" ${state.reviewed?'checked':''} ${working?'disabled':''}><span>I have reviewed the content, examples, author details, and usage rights.</span></label><button id="export-product" class="primary" ${!state.reviewed||working||!state.brief.productDraft?'disabled':''}>Create download package</button><div id="download-links" class="download-links">${state.files?links(state.files):''}</div><p class="fine" style="margin-top:16px">Canva and Google Workspace are optional. <button class="quiet" id="optional-apps">View setup instructions</button><br>The extra Canva-compatible file contains editable text; check its import before sale. A document export does not create a native design or working spreadsheet.</p></section>${renderDraft()}`;
}
function render() {
  palette();renderProgress();renderChat();$('new-project').disabled=working;$('provider').disabled=working;
  const draft=!!state.brief.productDraft;
  $('workspace-content').innerHTML=`<div class="workspace-tabs"><button id="brief-tab" class="${view==='brief'?'selected':''}">Working brief</button><button id="draft-tab" class="${['draft','edit'].includes(view)?'selected':''}">Your product${draft?'':' · not written yet'}</button><button id="files-tab" class="${view==='files'?'selected':''}" ${!draft||(!state.demo&&state.interviewStage<11)?'disabled':''}>Files</button></div>${state.demo?'<p class="demo-note">Example output from the earlier export test. Start a new conversation to create your own product.</p>':''}${view==='brief'?renderBrief():view==='files'?renderDownloads():renderDraft()}`;
  $('brief-tab').onclick=()=>{view='brief';render();};$('draft-tab').onclick=()=>{view='draft';render();};$('files-tab').onclick=()=>{view='files';render();};
  if($('try-example'))$('try-example').onclick=loadDemo;
  if($('outline'))$('outline').oninput=e=>{state.brief.outline=e.target.value;invalidate();save();};
  if($('toggle-editor'))$('toggle-editor').onclick=()=>{view=view==='edit'?'draft':'edit';render();};
  if($('manuscript'))$('manuscript').oninput=e=>{state.brief.productDraft=e.target.value;invalidate();save();};
  if($('reviewed'))$('reviewed').onchange=e=>{state.reviewed=e.target.checked;save();$('export-product').disabled=!state.reviewed||working;};
  if($('export-product'))$('export-product').onclick=exportFiles;
  if($('optional-apps'))$('optional-apps').onclick=()=>{$('account-panel').hidden=false;$('account-panel').scrollIntoView({behavior:'smooth'});};
}
async function post(path,payload) {const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw Error(d.error||'The request could not finish.');return d;}
function busy(value,text='Your creation partner is thinking') {working=value;$('busy').style.display=value?'flex':'none';$('busy-title').textContent=text;render();}
async function send(text,fromComposer=false) {
  if(working)return;if(!accountReady){$('account-panel').hidden=false;notice('Connect your selected AI account to continue.',true);return;}
  if(fromComposer)state.pendingAnswer='';state.messages.push({role:'user',content:text});state.stageReady=false;save();busy(true,state.interviewStage===5?'Checking real market sources':'Your creation partner is thinking');
  try {const r=await post('/api/interview',{interviewStage:state.interviewStage,brief:state.brief,notes:state.notes,messages:state.messages.slice(-48),provider});
    state.messages.push({role:'assistant',content:r.message});state.brief={...state.brief,...r.brief};state.stageReady=r.stageReady;state.summary=r.summary;invalidate();save();
    if(state.interviewStage>=9&&state.brief.productDraft)view='draft';
  }catch(e){state.messages.push({role:'assistant',content:`I couldn’t finish that reply. Your conversation is saved. ${e.message} Send “Please retry my last question” to try again.`});save();notice(e.message,true);}finally{busy(false);}
}
async function advance() {
  if(working||!state.stageReady||state.interviewStage>=12)return;
  if(state.interviewStage===8&&!state.brief.outline.trim()){notice('Refine and approve a concrete outline first.',true);return;}
  if(state.interviewStage>=10&&!state.brief.productDraft.trim()){notice('Create the actual product with your AI before moving to review and downloads.',true);return;}
  state.notes.push({stage:state.interviewStage,title:STAGES[state.interviewStage-1][0],summary:state.summary});state.interviewStage++;state.stageReady=false;state.summary='';save();
  if(state.interviewStage===12){view='files';state.messages.push({role:'assistant',content:'We’ve reached the file stage. Review the manuscript for accuracy and rights, then create the actual download package. You can still ask for improvements here.'});save();render();return;}
  await send(`I approve that direction. Let’s work on step ${state.interviewStage}: ${STAGES[state.interviewStage-1][0]}. Ask me the most useful next question, using what you already know.`);
}
async function exportFiles() {if(working)return;busy(true,'Creating the actual files');try{const r=await post('/api/export-product',{brief:state.brief,reviewed:state.reviewed});state.files=r.files;save();notice(`${r.pages} designed pages exported. Your files are ready.`);}catch(e){notice(e.message,true);}finally{busy(false);}}
function downloadProject() {const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});if(blob.size>2000000){notice('This checkpoint exceeds the 2 MB pilot limit. Keep a text copy and split the product into volumes.',true);return;}const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='my-product-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function bookToDraft(book) {return `# ${book.title}\n\n${book.subtitle}\n\n${book.intro}\n\n## How to use this workbook\n\n${book.useInstructions}\n\n`+book.sections.map(s=>`## ${s.title}\n\n${s.lesson}\n\n### Work through the method\n\n${s.steps.map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\n### Worked example\n\n${s.example}\n\n### Try it yourself\n\n${s.exercise}\n\n${s.prompts.map(x=>x+'\n\n________________________________________________').join('\n\n')}\n\n### Check your work\n\n${s.check}\n\n### Before you move on\n\n${s.reflection}`).join('\n\n')+`\n\n## Put your work to use\n\n${book.closing}`;}
async function loadDemo() {if(working)return;try{const [brief,book]=await Promise.all([fetch('/example-brief.json').then(r=>r.json()),fetch('/example-workbook.json').then(r=>{if(!r.ok)throw Error('The example is not available yet.');return r.json();})]);state=fresh();state.brief={...blankBrief(),...brief,format:'Workbook',productDraft:bookToDraft(book)};state.interviewStage=12;state.demo=true;state.messages=[{role:'assistant',content:'This is the complete workbook used to test the export path. It is an example output, not the interview process. Start a new conversation to create a product from your own knowledge.'}];view='draft';save();render();}catch(e){notice(e.message,true);}}
$('new-project').onclick=()=>{if(working)return;if(state.messages.length>1&&!confirm('Start a new conversation? Save a project copy first if you want to keep this one.'))return;state=fresh();view='brief';save();render();};
$('import-file').onchange=async e=>{
  const f=e.target.files[0];if(!f||working)return;
  try{
    if(f.size>2000000)throw Error('This checkpoint exceeds the 2 MB pilot limit. Your current project is unchanged.');
    const raw=JSON.parse(await f.text());
    const p=raw.project?{...fresh(),brief:raw.project.brief,interviewStage:raw.project.stage,stageReady:raw.project.stageReady,summary:raw.project.summary,messages:[{role:'assistant',content:'Your product brief and draft are open. This checkpoint does not contain the original interview; tell me what you want to refine next.'}]}:raw;
    if(!p.brief||typeof p.brief!=='object'||Array.isArray(p.brief))throw Error('Choose a saved product project.');
    const candidate={...fresh(),...p,brief:{...blankBrief(),...p.brief},files:null,reviewed:false};
    if(Object.values(candidate.brief).some(v=>typeof v!=='string'))throw Error('This project has invalid brief fields. Your current conversation is unchanged.');
    if(!Array.isArray(candidate.messages)||candidate.messages.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'))throw Error('This conversation is invalid.');
    if(!Number.isInteger(candidate.interviewStage)||candidate.interviewStage<1||candidate.interviewStage>12)throw Error('This project has an invalid creation stage.');
    if(!Array.isArray(candidate.notes)||typeof candidate.summary!=='string'||typeof candidate.stageReady!=='boolean')throw Error('This project has invalid stage notes.');
    if(typeof candidate.pendingAnswer!=='string')throw Error('This project has an invalid unsent answer.');
    state=candidate;view='brief';save();render();notice('Your project is open.');
  }catch(error){notice(error.message,true);}
  e.target.value='';
};
async function checkAccount(){
  const requested=provider;
  try{
    const response=await fetch('/api/status?provider='+encodeURIComponent(provider));if(!response.ok)throw Error('Could not check the local AI tool.');const s=await response.json();if(requested!==provider)return;
    accountReady=!!s.ready;const name=provider==='claude'?'Claude':'ChatGPT';$('connection').textContent=accountReady?name+' connected':'Connect '+name;$('dot').classList.toggle('ready',accountReady);$('account-message').textContent=s.message;$('sign-in').disabled=!s.installed||accountReady;$('sign-in').textContent=accountReady?'Connected':'Sign in with '+name;
    clearTimeout(loginPoll);if(s.loginRunning&&!accountReady)loginPoll=setTimeout(checkAccount,4000);
  }catch(error){accountReady=false;$('connection').textContent='Check AI connection';$('account-message').textContent=error.message;}
}
$('provider').value=provider;
$('provider').onchange=()=>{provider=$('provider').value;localStorage.setItem('product-studio-provider',provider);accountReady=false;$('dot').classList.remove('ready');$('connection').textContent='Checking '+(provider==='claude'?'Claude':'ChatGPT');$('account-message').textContent='Checking your selected provider…';clearTimeout(loginPoll);checkAccount();};
$('account-toggle').onclick=()=>{$('account-panel').hidden=!$('account-panel').hidden;if(!$('account-panel').hidden)checkAccount();};
$('close-account').onclick=()=>{$('account-panel').hidden=true;$('account-toggle').focus();};
$('check-account').onclick=checkAccount;
$('sign-in').onclick=async()=>{
  $('sign-in').disabled=true;
  try{const s=await post('/api/login',{provider});$('account-message').textContent=s.message||'Complete the provider’s sign-in in your browser, then check the connection.';clearTimeout(loginPoll);loginPoll=setTimeout(checkAccount,3000);}
  catch(error){$('account-message').textContent=error.message;$('sign-in').disabled=false;}
};
render();checkAccount().then(()=>{if(!accountReady)$('account-panel').hidden=false;});
