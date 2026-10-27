import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadStudio,persistStudio,checkpoint,importProject} from '../public/studio-store.js';
const composer=await import('../public/composer.js').catch(()=>({}));
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};
const reference=(id,extra={})=>({id,name:`${id}.txt`,kind:'file',mimeType:'text/plain',text:'Source material',status:'ready',note:'Text extracted locally.',...extra});
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('Enter submits, Shift+Enter inserts a newline, and IME or repeated/busy Enter cannot submit',()=>{
  assert.equal(typeof composer.composerKeyAction,'function','Composer must implement plain Enter sending');
  const action=(event,options={})=>composer.composerKeyAction({key:'Enter',...event},{hasContent:true,...options});
  assert.equal(action({}),'submit');assert.equal(action({shiftKey:true}),'newline');
  assert.equal(action({isComposing:true}),'native');assert.equal(action({keyCode:229}),'native');assert.equal(action({},{composing:true}),'native');
  assert.equal(action({repeat:true}),'blocked');assert.equal(action({},{busy:true}),'blocked');assert.equal(action({},{hasContent:false}),'blocked');
});
test('processed references and unsent references survive reload and backup without raw document bytes',()=>{
  const storage=memory(),studio=loadStudio(storage),project=studio.projects[0];
  project.references=[reference('sent',{data:'DO NOT RETAIN'})];project.pendingReferences=[reference('queued')];project.pendingAnswer='Still writing';
  persistStudio(storage,studio);const restored=loadStudio(storage).projects[0];
  assert.equal(restored.references?.[0]?.text,'Source material');assert.equal(restored.pendingReferences?.[0]?.id,'queued');assert.equal(restored.pendingAnswer,'Still writing');
  assert.equal(restored.references[0].data,undefined);assert.equal(JSON.stringify(checkpoint(project)).includes('DO NOT RETAIN'),false);
  const imported=importProject(studio,checkpoint(project));assert.equal(imported.references[0].id,'sent');assert.equal(imported.pendingReferences[0].id,'queued');assert.equal(imported.profile,undefined);
});
test('attachment-only messages name sources and keep typed input separate from source text',()=>{
  assert.equal(typeof composer.referenceMessage,'function');
  const message=composer.referenceMessage('',[reference('guide',{name:'Field guide.pdf',url:'https://example.com/guide'})]);
  assert.match(message,/Field guide\.pdf/);assert.match(message,/https:\/\/example.com\/guide/);assert.doesNotMatch(message,/Source material/);
  assert.match(composer.referenceMessage('Use this for the outline',[reference('guide')]),/^Use this for the outline/);
});
test('links are recognized without including sentence punctuation or duplicate URLs',()=>{
  assert.equal(typeof composer.extractHttpLinks,'function');
  assert.deepEqual(composer.extractHttpLinks('Read https://example.com/one. Then (https://example.com/two). https://example.com/one'),['https://example.com/one','https://example.com/two']);
});
test('queued processing is visible, removable, and a removed request cannot reattach itself',async()=>{
  assert.equal(typeof composer.createReferenceComposer,'function');
  const p=loadStudio(memory()).projects[0];let finish;
  const session=composer.createReferenceComposer(p,{ingest:()=>new Promise(resolve=>{finish=resolve;})});
  const request=session.addLinks(['https://example.com']);assert.equal(session.inputs[0].status,'processing');
  session.remove(session.inputs[0].id);await Promise.resolve();finish({references:[reference('removed',{kind:'link',url:'https://example.com'})]});await request;
  assert.equal(p.pendingReferences.length,0);assert.equal(session.inputs.length,0);
});
test('failed preparation preserves typed input, reports the failure, and blocks accidental send',async()=>{
  assert.equal(typeof composer.createReferenceComposer,'function');
  const p=loadStudio(memory()).projects[0];p.pendingAnswer='My unsent thought';
  const session=composer.createReferenceComposer(p,{ingest:async()=>{throw Error('Local app unavailable');}});
  await session.addLinks(['https://example.com']);assert.equal(session.inputs[0].status,'failed');assert.match(session.inputs[0].note,/Local app unavailable/);
  assert.equal(session.ready,false);assert.equal(p.pendingAnswer,'My unsent thought');session.remove(session.inputs[0].id);assert.equal(session.ready,true);
});
test('file picker, image paste and drop share bounded preparation and keep only processed results',async()=>{
  assert.equal(typeof composer.createReferenceComposer,'function');
  const p=loadStudio(memory()).projects[0],requests=[];
  const session=composer.createReferenceComposer(p,{readFile:async()=>'eA==',ingest:async raw=>{requests.push(raw);return {references:[reference('file')]};}});
  await session.addFiles([{name:'notes.txt',type:'text/plain',size:1}]);assert.equal(requests[0].files[0].data,'eA==');assert.equal(p.pendingReferences[0].id,'file');assert.equal(session.inputs.length,0);
  await assert.rejects(session.addFiles([{name:'too-large.pdf',type:'application/pdf',size:3*1024*1024+1}]),/3 MB/);
  await assert.rejects(session.addFiles([{name:'too-large.png',type:'image/png',size:512*1024+1}]),/512 KB/);
  p.references=Array.from({length:4},(_,i)=>reference(`old-${i}`));await assert.rejects(session.addLinks(['https://example.com']),/five|5/i);
});
test('retry retains original input and references without inserting a second human message',()=>{
  const storage=memory(),studio=loadStudio(storage),p=studio.projects[0];p.messages.push({role:'user',content:'Original request'});
  p.retryRequest={text:'Original request',messageIndex:1,fromComposer:true,revisionIntent:false,completion:false,references:[reference('saved')]};
  persistStudio(storage,studio);const restored=loadStudio(storage).projects[0];assert.equal(restored.retryRequest?.text,'Original request');assert.equal(restored.retryRequest.references[0].id,'saved');assert.equal(restored.messages.filter(m=>m.role==='user').length,1);
});
test('sending queued sources once retains writing begun while preparation or a reply is pending',()=>{
  assert.equal(typeof composer.recordRequest,'function');
  const p=loadStudio(memory()).projects[0];p.pendingAnswer='A newer thought';p.pendingReferences=[reference('guide')];
  const request=composer.recordRequest(p,'Use the guide',{fromComposer:true});
  assert.equal(p.pendingAnswer,'A newer thought');assert.equal(p.pendingReferences.length,0);assert.equal(p.references[0].id,'guide');
  assert.match(p.messages.at(-1).content,/Use the guide[\s\S]*guide.txt/);assert.equal(request.text,'Use the guide');
  p.messages.push({role:'assistant',content:'Failed reply'});const messages=composer.requestMessages(p,request);
  assert.equal(messages.at(-1).content,'Use the guide\n\nReferences attached:\n- guide.txt');assert.equal(p.messages.filter(m=>m.role==='user').length,1);
});
test('bound keyboard events send once, preserve pending typing, and leave IME and Shift+Enter native',()=>{
  assert.equal(typeof composer.bindComposer,'function');let submissions=0,busy=false,typed='';
  const form={requestSubmit(){this.onsubmit({preventDefault(){}});}},answer={value:'A thought'},fileInput={},attachButton={},dropZone={classList:{add(){},remove(){}}};
  composer.bindComposer({form,answer,fileInput,attachButton,dropZone,getBusy:()=>busy,hasContent:()=>!!answer.value,onSubmit:()=>{submissions++;busy=true;},onInput:value=>{typed=value;},onFiles(){},onLinks(){}});
  const key=(extra={})=>{let prevented=false;answer.onkeydown({key:'Enter',preventDefault(){prevented=true;},...extra});return prevented;};
  assert.equal(key({shiftKey:true}),false);answer.oncompositionstart();assert.equal(key(),false);answer.oncompositionend();assert.equal(key(),false);assert.equal(submissions,0);answer.onkeyup({key:'Enter'});assert.equal(key(),true);assert.equal(submissions,1);
  answer.value='The next thought';answer.oninput();assert.equal(key(),true);assert.equal(submissions,1);assert.equal(typed,'The next thought');assert.equal(answer.value,'The next thought');
});
test('file selection, clipboard images and dropped links reach the same real reference queue',async()=>{
  const p=loadStudio(memory()).projects[0],session=composer.createReferenceComposer(p,{readFile:async()=>png,ingest:async body=>({references:body.files?body.files.map((f,i)=>reference(`image-${i}-${p.pendingReferences.length}`,{kind:'image',name:f.name,mimeType:f.mimeType,text:'',imageData:`data:image/png;base64,${png}`})):body.links.map(url=>reference('link',{kind:'link',url}))})});
  const requests=[],form={},answer={},fileInput={files:[{name:'picker.png',type:'image/png',size:1}]},attachButton={},dropZone={classList:{add(){},remove(){}}};
  composer.bindComposer({form,answer,fileInput,attachButton,dropZone,getBusy:()=>false,hasContent:()=>true,onSubmit(){},onInput(){},onFiles:files=>requests.push(session.addFiles(files)),onLinks:links=>requests.push(session.addLinks(links))});
  fileInput.onchange();await requests.at(-1);assert.equal(p.pendingReferences[0].name,'picker.png');
  answer.onpaste({preventDefault(){},clipboardData:{items:[{kind:'file',type:'image/png',getAsFile:()=>({name:'clipboard.png',type:'image/png',size:1})}]}});await requests.at(-1);assert.equal(p.pendingReferences[1].name,'clipboard.png');
  dropZone.ondrop({preventDefault(){},dataTransfer:{files:[],getData:()=> 'https://example.com/drop'}});await requests.at(-1);assert.equal(p.pendingReferences[2].url,'https://example.com/drop');
});
test('removing an active reference frees a slot and excludes it from future request context',async()=>{
  const p=loadStudio(memory()).projects[0];p.references=Array.from({length:5},(_,i)=>reference(`source-${i}`));
  const session=composer.createReferenceComposer(p,{ingest:async()=>({references:[reference('replacement',{kind:'link',url:'https://example.com/new'})]})});
  session.remove('source-0');await session.addLinks(['https://example.com/new']);
  const request=composer.recordRequest(p,'Use the new source',{fromComposer:true});assert.equal(request.references.length,5);assert.equal(request.references.some(r=>r.id==='source-0'),false);assert.equal(request.references.at(-1).id,'replacement');
});
test('background preparation stays in its original project and caps accumulated excerpts at 60,000 characters',async()=>{
  const studio=loadStudio(memory()),first=studio.projects[0],other=loadStudio(memory()).projects[0];let finish;
  first.references=Array.from({length:3},(_,i)=>reference(`long-${i}`,{text:'a'.repeat(16000)}));
  const session=composer.createReferenceComposer(first,{ingest:()=>new Promise(resolve=>{finish=resolve;})});
  const pending=session.addLinks(['https://example.com/long']);await Promise.resolve();
  studio.projects.unshift(other);studio.activeId=other.id;finish({references:[reference('last',{text:'b'.repeat(16000),kind:'link',url:'https://example.com/long'})]});await pending;
  assert.equal(other.pendingReferences.length,0);assert.equal(first.pendingReferences[0].text.length,12000);assert.equal(first.pendingReferences[0].status,'excerpt');assert.match(first.pendingReferences[0].note,/60,000/);
});
