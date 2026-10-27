import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadStudio, persistStudio, newProject, openProject, checkpoint, importProject, learnPreferences, confirmPreference, editPreference, forgetPreference, approveDraft, undoApproval, applyReply, currentDraftSection, acceptSampleFiles, activePreferences } from '../public/studio-store.js';
import { interviewPrompt } from '../src/interview.js';

const memory = (initial={}) => { const data=new Map(Object.entries(initial)); return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),data}; };

test('new projects retain the previous conversation and unsent answer through reload',()=>{
  const storage=memory(), studio=loadStudio(storage);
  studio.projects[0].pendingAnswer='My unsent example';studio.projects[0].brief.topic='Ceramics';
  const first=studio.activeId;newProject(studio);persistStudio(storage,studio);
  const restored=loadStudio(storage);assert.equal(restored.projects.length,2);
  openProject(restored,first);assert.equal(restored.projects.find(p=>p.id===first).pendingAnswer,'My unsent example');
  assert.equal(restored.projects.find(p=>p.id===first).brief.topic,'Ceramics');
});
test('legacy migration retains the original JSON and recovers its draft and unsent answer',()=>{
  const old=JSON.stringify({brief:{topic:'Baking',productDraft:'A complete original'},messages:[{role:'user',content:'My knowledge'}],interviewStage:9,pendingAnswer:'Still typing',notes:[],summary:'',stageReady:false});
  const storage=memory({'product-studio-local-v2':old}), studio=loadStudio(storage);
  assert.equal(studio.projects[0].brief.productDraft,'A complete original');assert.equal(studio.projects[0].pendingAnswer,'Still typing');
  assert.equal(storage.getItem('product-studio-local-v2'),old);assert.equal(storage.getItem('product-studio-legacy-backup'),old);
  assert.equal(studio.projects[0].approvedDraft,'A complete original');assert.equal(studio.projects[0].sampleApproved,false);
  persistStudio(storage,studio);assert.equal(loadStudio(storage).projects.length,1);
});
test('storage failures keep usable in-memory work and report that autosave failed',()=>{
  const storage={getItem(){throw Error('Blocked');},setItem(){throw Error('Full');}};
  const studio=loadStudio(storage);studio.projects[0].pendingAnswer='Keep this';
  const result=persistStudio(storage,studio);assert.equal(result.ok,false);assert.match(result.error,/backup/i);assert.equal(studio.projects[0].pendingAnswer,'Keep this');
});
test('only grounded current explicit preferences are remembered; inferred instructions require confirmation',()=>{
  const studio=loadStudio(memory());const input='I prefer short sentences.';
  learnPreferences(studio.profile,[{text:input,category:'voice',source:'explicit',evidence:input},{text:'Use warm colors',category:'design',source:'inferred',evidence:''},{text:'I like lists',category:'voice',source:'explicit',evidence:'I like lists'}],input);
  assert.equal(studio.profile.preferences.length,1);assert.equal(studio.profile.preferences[0].text,input);
  assert.equal(studio.profile.candidates.length,1);confirmPreference(studio.profile,studio.profile.candidates[0].id);
  assert.equal(studio.profile.preferences.length,2);assert.equal(studio.profile.candidates.length,0);
});
test('editing, forgetting and pause prevent old preference evidence from being learned again',()=>{
  const {profile}=loadStudio(memory());const text='I prefer short sentences.';
  const update={text,category:'voice',source:'explicit',evidence:text};learnPreferences(profile,[update],text);
  const id=profile.preferences[0].id;editPreference(profile,id,'Use clear, complete sentences.','voice');
  learnPreferences(profile,[update],text);assert.equal(profile.preferences.length,1);
  forgetPreference(profile,id);assert.equal(profile.preferences.length,0);
  learnPreferences(profile,[{text:'Use clear, complete sentences.',category:'voice',source:'explicit',evidence:'Use clear, complete sentences.'}],'Use clear, complete sentences.');assert.equal(profile.preferences.length,0);
  profile.paused=true;learnPreferences(profile,[{text:'Use serif fonts',category:'design',source:'explicit',evidence:'Use serif fonts'}],'Use serif fonts');assert.equal(profile.preferences.length,0);
});
test('project backup and imported project isolate creator profile from the product',()=>{
  const studio=loadStudio(memory());studio.profile.preferences.push({id:'private',text:'Private workflow',category:'workflow',source:'explicit'});
  const project=studio.projects[0];project.brief.topic='Public guide';
  const portable=checkpoint(project);assert.equal(JSON.stringify(portable).includes('Private workflow'),false);
  const opened=importProject(studio,{...portable,profile:studio.profile});assert.equal(opened.brief.topic,'Public guide');assert.equal(opened.profile,undefined);assert.equal(studio.projects.length,2);
  assert.throws(()=>importProject(studio,{brief:{topic:17},interviewStage:1}),/invalid/i);
});
test('approved draft rejects implicit replacement, allows append and supports explicit revision and undo',()=>{
  const project=loadStudio(memory()).projects[0];project.interviewStage=9;project.brief.productDraft='Approved sample';approveDraft(project);
  applyReply(project,{brief:{productDraft:'Silently replaced'},message:'Changed'},false);assert.equal(project.brief.productDraft,'Approved sample');
  applyReply(project,{brief:{productDraft:'Approved sample\n\nNew section'},message:'Added'},false);assert.equal(project.brief.productDraft,'Approved sample\n\nNew section');
  approveDraft(project);assert.equal(project.sampleApproved,true);
  applyReply(project,{brief:{productDraft:'Explicit revision'},message:'Revised'},true);
  assert.equal(project.previousApprovedDraft,'Approved sample\n\nNew section');
  approveDraft(project);undoApproval(project);
  assert.equal(project.brief.productDraft,'Approved sample\n\nNew section');assert.equal(project.approvedDraft,project.brief.productDraft);
});
test('recoverable malformed project libraries keep their original JSON before saving valid projects',()=>{
  const raw=JSON.stringify({version:3,activeId:'bad',projects:[{id:'bad',brief:{topic:42}},{id:'good',brief:{topic:'Retained'},interviewStage:2}]});
  const storage=memory({'product-studio-projects-v3':raw}),studio=loadStudio(storage);
  assert.equal(studio.projects[0].brief.topic,'Retained');persistStudio(storage,studio);
  assert.equal(storage.getItem('product-studio-recovery-backup'),raw);
});
test('a newer saved library is preserved before this version creates a usable project',()=>{
  const raw=JSON.stringify({version:4,projects:[{brief:{topic:'Future version'}}]});
  const storage=memory({'product-studio-projects-v3':raw}),studio=loadStudio(storage);
  persistStudio(storage,studio);assert.equal(storage.getItem('product-studio-recovery-backup'),raw);
});
test('preferences remain separate from project JSON and remembered instructions retain edits and pause on reload',()=>{
  const storage=memory(),studio=loadStudio(storage),text='Use short sentences';
  learnPreferences(studio.profile,[{text,category:'voice',source:'explicit',evidence:text}],text);
  editPreference(studio.profile,studio.profile.preferences[0].id,'Use clear complete sentences','voice');studio.profile.paused=true;persistStudio(storage,studio);
  const restored=loadStudio(storage);assert.equal(restored.profile.preferences[0].text,'Use clear complete sentences');assert.equal(restored.profile.paused,true);
  assert.equal(storage.getItem('product-studio-projects-v3').includes('Use clear complete sentences'),false);
});
test('saved completion suggestions and companion choices survive reload without exporting preferences',()=>{
  const storage=memory(),studio=loadStudio(storage),p=studio.projects[0];
  p.suggestions=[{title:'Use a checklist',why:'An aid for the steps',basis:'The creator described a repeatable method'}];p.companions=[{title:'Pocket checklist',format:'PDF',why:'Helps the buyer use the method'}];
  persistStudio(storage,studio);const restored=loadStudio(storage).projects[0];
  assert.equal(restored.companions[0]?.title,'Pocket checklist');assert.equal(restored.suggestions[0]?.basis,'The creator described a repeatable method');
});
test('synthetic workflow messages cannot teach preferences while actual composer replies can',()=>{
  const studio=loadStudio(memory()),project=studio.projects[0],text='Use short sentences';
  const reply={message:'A reply',brief:{},preferenceUpdates:[{text,category:'voice',source:'explicit',evidence:text}]};
  applyReply(project,reply,false,{profile:studio.profile,currentInput:text,creatorInput:false});assert.equal(studio.profile.preferences.length,0);
  applyReply(project,reply,false,{profile:studio.profile,currentInput:text,creatorInput:true});assert.equal(studio.profile.preferences[0]?.text,text);
});
test('imported proposed text does not count as an approved sample and unsafe assets are rejected',()=>{
  const studio=loadStudio(memory());const imported=importProject(studio,{brief:{productDraft:'Unapproved prose'},interviewStage:10,messages:[],notes:[],summary:'',stageReady:false});
  assert.equal(imported.approvedDraft,'');assert.equal(imported.sampleApproved,false);
  assert.throws(()=>importProject(studio,{...checkpoint(imported),coverImage:'data:image/svg+xml;base64,AA=='}),/image/i);
});
test('progress shows the newly proposed section instead of repeating the approved manuscript',()=>{
  const p=loadStudio(memory()).projects[0];p.approvedDraft='# Guide\n\n## First decision\n\nAlready approved.';
  p.brief.productDraft=p.approvedDraft+'\n\n## Put it into practice\n\nDo the next useful action.\n\n### Check it\n\nWrite what happened.';
  const section=currentDraftSection(p);assert.equal(section.heading,'Put it into practice');assert.equal(section.pending,true);assert.match(section.text,/Do the next useful action/);assert.doesNotMatch(section.text,/Already approved/);
});
test('progress identifies the latest approved section and keeps revision text visibly pending',()=>{
  const p=loadStudio(memory()).projects[0];p.approvedDraft='# Guide\n\n## First decision\n\nApproved.';p.brief.productDraft=p.approvedDraft;
  assert.equal(currentDraftSection(p).heading,'First decision');assert.equal(currentDraftSection(p).pending,false);
  p.brief.productDraft='# Guide\n\n## Revised decision\n\nA requested revision.';assert.equal(currentDraftSection(p).heading,'Revised decision');assert.equal(currentDraftSection(p).pending,true);
});
test('sample downloads are separate from final approval/files and stale sample responses cannot replace them',()=>{
  const p=loadStudio(memory()).projects[0];p.reviewed=false;p.files={pdf:{url:'/downloads/final.pdf'}};
  assert.equal(acceptSampleFiles(p,{editable:{url:'/downloads/sample.docx'}},'project-A:draft-1','project-A:draft-1'),true);
  assert.equal(p.sampleFiles.editable.url,'/downloads/sample.docx');assert.equal(p.reviewed,false);assert.equal(p.files.pdf.url,'/downloads/final.pdf');
  assert.equal(acceptSampleFiles(p,{editable:{url:'/downloads/stale.docx'}},'project-A:draft-1','project-B:draft-2'),false);
  assert.equal(p.sampleFiles.editable.url,'/downloads/sample.docx');
});
test('preference capacity bounds automatic learning and retains overflow instructions through reload',()=>{
  const storage=memory(),studio=loadStudio(storage);
  for(let i=1;i<=81;i++){const text=`Use plain sentences for example ${i}.`;learnPreferences(studio.profile,[{text,category:'voice',source:'explicit',evidence:text}],text);}
  assert.equal(studio.profile.preferences.length,80);assert.equal(studio.profile.candidates[0]?.text,'Use plain sentences for example 81.');
  persistStudio(storage,studio);const restored=loadStudio(storage);assert.equal(restored.profile.preferences.length,80);assert.equal(restored.profile.candidates[0]?.text,'Use plain sentences for example 81.');
});
test('preference capacity blocks manual or inferred confirmation until the creator frees room',()=>{
  const {profile}=loadStudio(memory());profile.preferences=Array.from({length:80},(_,i)=>({id:`p-${i}`,text:`Use plain example ${i}`,category:'voice',source:'explicit'}));
  profile.candidates=[{id:'manual',text:'Use a serif font',category:'design',source:'inferred'},{id:'inferred',text:'Use clear tables',category:'design',source:'inferred'}];
  confirmPreference(profile,'manual');confirmPreference(profile,'inferred');assert.equal(profile.preferences.length,80);assert.equal(profile.candidates.length,2);
  forgetPreference(profile,'p-0');confirmPreference(profile,'manual');assert.equal(profile.preferences.length,80);assert.equal(profile.preferences.at(-1).text,'Use a serif font');assert.equal(profile.candidates.length,1);
});
test('preference capacity retains restored 81 instructions but every interview context fits after reload and new project',()=>{
  const preferences=Array.from({length:81},(_,i)=>({id:`saved-${i}`,text:`Use simple language for scenario ${i}`,category:'voice',source:'explicit'}));
  const storage=memory({'product-studio-preferences-v1':JSON.stringify({preferences,paused:false,forgotten:[]})});let studio=loadStudio(storage);
  const check=()=>{assert.equal(studio.profile.preferences.length,81);assert.equal(activePreferences(studio.profile).length,80);assert.doesNotThrow(()=>interviewPrompt({interviewStage:1,brief:studio.projects[0].brief,messages:[{role:'user',content:'I help freelance designers organize client files.'}],preferences:activePreferences(studio.profile)}));};
  check();persistStudio(storage,studio);studio=loadStudio(storage);check();newProject(studio);check();assert.equal(studio.profile.preferences[80].text,'Use simple language for scenario 80');
});
