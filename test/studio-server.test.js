import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createLocalHandler } from '../src/local-server.js';
import { freshProject } from '../src/product.js';
import JSZip from 'jszip';

async function server(t, options={}) {
  const instance=createServer(createLocalHandler(options));
  await new Promise(resolve=>instance.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{instance.closeAllConnections();instance.close(resolve);}));
  return `http://127.0.0.1:${instance.address().port}`;
}
const post=(url,path,body)=>fetch(url+path,{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify(body)});

test('model choices are available without connecting or invoking an AI account',async t=>{
  const url=await server(t,{providers:{status(){throw Error('Do not contact an account');}}});
  const response=await fetch(url+'/api/models');
  assert.equal(response.status,200);
  const catalog=await response.json();
  assert.ok(catalog.chatgpt.some(model=>model.id==='gpt-6-astra'&&model.recommended));
  assert.ok(catalog.chatgpt.some(model=>model.id==='gpt-6.1-sol'));
  assert.ok(catalog.claude.some(model=>model.id==='claude-sonnet-5-5'&&model.recommended));
});

test('preview uses the current manuscript and same optional image without requiring export approval',async t=>{
  let received;
  const previewer=async(project,options)=>{received={project,options};return {pages:[{svg:'<svg/>',title:'Example',purpose:'Teach a decision'}],pageCount:1};};
  const url=await server(t,{previewer});
  const brief={...freshProject().brief,productDraft:'The current approved example.'};
  const response=await post(url,'/api/preview-product',{brief,coverImage:'data:image/png;base64,c2FtcGxl'});
  assert.equal(response.status,200);assert.equal((await response.json()).pageCount,1);
  assert.equal(received.project.brief.productDraft,brief.productDraft);
  assert.equal(received.options.coverImage,'data:image/png;base64,c2FtcGxl');
  assert.equal((await fetch(url+'/src/providers.js')).status,404);
  const denied=await fetch(url+'/api/preview-product',{method:'POST',headers:{Origin:'https://elsewhere.example','Content-Type':'application/json'},body:JSON.stringify({brief})});
  assert.equal(denied.status,403);
});

test('export passes the selected image to the exporter and retains review gating',async t=>{
  let called=0,options;
  const exporter=async(_,received)=>{called++;options=received;throw Error('Export reached safely');};
  const url=await server(t,{exporter});
  const brief=freshProject().brief;
  const denied=await post(url,'/api/export-product',{brief,coverImage:'chosen-image'});
  assert.equal(denied.status,400);assert.equal(called,0);
  const response=await post(url,'/api/export-product',{brief,coverImage:'chosen-image',reviewed:true});
  assert.equal(response.status,400);assert.equal(called,1);assert.equal(options.coverImage,'chosen-image');
});

test('the product package excludes the private working brief checkpoint',async t=>{
  const names=['sample.pdf','sample.docx','sample.pptx','sample.md','sample-project.json'];
  const exporter=async()=>({pages:1,files:names.map((name,index)=>({name,mimeType:index===4?'application/json':'application/octet-stream',blob:Buffer.from(index===4?'private working brief':'product content').toString('base64')}))});
  const url=await server(t,{exporter});
  const response=await post(url,'/api/export-product',{brief:freshProject().brief,reviewed:true});
  assert.equal(response.status,200);
  const {files}=await response.json();
  const zip=await JSZip.loadAsync(await(await fetch(url+files.zip.url)).arrayBuffer());
  assert.ok(zip.file('sample.pdf'));assert.equal(zip.file('sample-project.json'),null);
  assert.equal(await(await fetch(url+files.project.url)).text(),'private working brief');
});

test('a draft sample can be downloaded for external review without claiming final approval',async t=>{
  let received;
  const names=['sample.pdf','sample.docx','sample.pptx','sample.md','sample-project.json'];
  const exporter=async(project,options)=>{received={project,options};return {pages:1,files:names.map(name=>({name,mimeType:'application/octet-stream',blob:Buffer.from('Draft sample').toString('base64')}))};};
  const url=await server(t,{exporter});
  const response=await post(url,'/api/export-product',{brief:freshProject().brief,draft:true});
  assert.equal(response.status,200);
  assert.equal(received.options.draft,true);assert.equal(received.project.stageReady,false);
  assert.equal((await response.json()).draft,true);
});
