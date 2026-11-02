import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createLocalHandler } from '../src/local-server.js';
import { freshProject } from '../src/product.js';
import JSZip from 'jszip';
import {withApprovedOutline} from './interview-fixtures.js';
import {sourceFingerprint} from '../public/design-concepts.js';

async function server(t, options={}) {
  const instance=createServer(createLocalHandler(options));
  await new Promise(resolve=>instance.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{instance.closeAllConnections();instance.close(resolve);}));
  return `http://127.0.0.1:${instance.address().port}`;
}
const post=(url,path,body)=>fetch(url+path,{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify(body)});

test('verified native sample readiness reaches the interview gate while unverified client IDs do not',async t=>{
  const draft='## Choose One Action\n\nChoose the website goal.\n\n### Presenter notes\nExplain the initial choice.';
  const next='\n\n## Compare The Options\n\nCompare three destinations.\n\n### Presenter notes\nExplain the differences.';
  const body=withApprovedOutline({provider:'chatgpt',model:'gpt-6.1-sol',reasoningEffort:'medium',interviewStage:10,currentInput:'Create the next slide.',messages:[{role:'user',content:'Create the next slide.'}],approvedDraft:draft,brief:{...freshProject().brief,title:'My lesson',topic:'Websites',buyer:'First-time creators',outcome:'Choose a website goal',format:'Webinar presentation',outline:'Choose One Action\nCompare The Options',productDraft:draft}});
  body.presentationDesign={conceptId:'editorial',approved:true,sourceFingerprint:sourceFingerprint(body.brief)};
  let received;
  const url=await server(t,{canvaProducer:{busy:false,sampleReady(id,brief,conceptId){received={id,brief,conceptId};return id==='verified-native';}},slideProduction:{busy:false,sampleReady:async()=>true},providers:{infer:async()=>({replyKind:'progress',message:'Here is the next slide.',stageReady:true,summary:'Next slide.',brief:{...body.brief,productDraft:draft+next}})}});
  for(const [canvaSampleId,permitted] of [['client-claim',false],['verified-native',true]]){
    const response=await post(url,'/api/interview',{...body,canvaSampleId});assert.equal(response.status,200);
    assert.equal((await response.json()).brief.productDraft,permitted?draft+next:draft);
    assert.equal(received.id,canvaSampleId);assert.equal(received.conceptId,'editorial');assert.equal(received.brief.productDraft,draft);
  }
});

test('expanded-outline rules are available as a browser module without exposing source files',async t=>{
  const url=await server(t);
  const response=await fetch(url+'/outline-plan.js');
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/javascript/);
  assert.match(await response.text(),/expandedOutlineSections/);
  assert.equal((await fetch(url+'/src/interview.js')).status,404);
});

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
  const source=(name,mimeType,content='product content')=>({name,mimeType,blob:Buffer.from(content).toString('base64')});
  const checkpoint=source('sample-project.json','application/json','private working brief');
  const exporter=async()=>({pages:1,checkpoint,files:[checkpoint,source('old.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'),source('sample.md','text/markdown'),source('old.pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation'),source('sample.pdf','application/pdf')]});
  const url=await server(t,{exporter});
  const response=await post(url,'/api/export-product',{brief:freshProject().brief,reviewed:true});
  assert.equal(response.status,200);
  const {files}=await response.json();
  assert.deepEqual(Object.keys(files).sort(),['markdown','pdf','zip']);
  const zip=await JSZip.loadAsync(await(await fetch(url+files.zip.url)).arrayBuffer());
  assert.ok(zip.file('sample.pdf'));assert.ok(zip.file('sample.md'));assert.equal(zip.file('sample-project.json'),null);
  assert.equal(zip.file('old.docx'),null);assert.equal(zip.file('old.pptx'),null);
  const directory=files.pdf.url.slice(0,files.pdf.url.lastIndexOf('/')+1);
  for(const name of ['sample-project.json','old.docx','old.pptx'])assert.equal((await fetch(url+directory+name)).status,404);
});

test('a draft sample can be downloaded for external review without claiming final approval',async t=>{
  let received;
  const exporter=async(project,options)=>{received={project,options};return {pages:1,files:[['sample.pdf','application/pdf'],['sample.md','text/markdown']].map(([name,mimeType])=>({name,mimeType,blob:Buffer.from('Draft sample').toString('base64')}))};};
  const url=await server(t,{exporter});
  const response=await post(url,'/api/export-product',{brief:{...freshProject().brief,format:'Practical guide'},draft:true});
  assert.equal(response.status,200);
  assert.equal(received.options.draft,true);assert.equal(received.project.stageReady,false);
  assert.equal((await response.json()).draft,true);
});

test('cached draft presentation clients are held before the legacy exporter while final content fallback remains available',async t=>{
  let called=0,nativeCalls=0;const exporter=async()=>{called++;return {pages:1,files:[['legacy.pdf','application/pdf'],['legacy.md','text/markdown']].map(([name,mimeType])=>({name,mimeType,blob:Buffer.from('Legacy content fallback').toString('base64')}))};};const url=await server(t,{exporter,canvaProducer:{busy:false,start:async()=>{nativeCalls++;return {id:'native-path',status:'running'};}}});const brief={...freshProject().brief,title:'Existing presentation',format:'Webinar presentation',productDraft:'## Current source\n\nRetained text.'};
  const held=await post(url,'/api/export-product',{brief,draft:true});assert.equal(held.status,409);assert.match((await held.json()).error,/Visual direction/);assert.equal(called,0);
  const final=await post(url,'/api/export-product',{brief,reviewed:true});assert.equal(final.status,200);assert.equal(called,1);const {files}=await final.json();assert.ok(files.pdf.url);assert.ok(files.markdown.url);const zip=await JSZip.loadAsync(await(await fetch(url+files.zip.url)).arrayBuffer());assert.match(await zip.file('READ-ME.txt').async('string'),/content fallback/i);const native=await post(url,'/api/create-canva',{brief});assert.equal(native.status,200);assert.equal(nativeCalls,1);assert.equal(called,1,'Native creation must not use the legacy exporter');
});
