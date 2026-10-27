import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {freshProject} from '../public/studio-store.js';

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function renderer(){
  const state=freshProject();state.interviewStage=12;state.brief.productDraft='Approved source';state.approvedDraft=state.brief.productDraft;state.reviewed=true;
  const scope={URL,esc:escape,state,working:false,runtimeReady:true,previewKey:()=> 'current',renderExportPreview:()=>'',rich:escape};
  vm.createContext(scope);
  vm.runInContext(source.slice(source.indexOf('function nativeReviewInstructions('),source.indexOf('\nfunction renderDraft(')),scope);
  vm.runInContext(source.slice(source.indexOf('function links('),source.indexOf('\nfunction render(){')),scope);
  return scope;
}
const anchors=html=>[...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(match=>({attributes:match[1],label:match[2]}));
const local={pdf:{name:'guide.pdf',url:'/downloads/package/guide.pdf'},markdown:{name:'guide.md',url:'/downloads/package/guide.md'},zip:{name:'guide.zip',url:'/downloads/package/guide.zip'}};

test('actual delivery links open Canva and Google Docs editors while PDF/text/ZIP download locally',()=>{
  const ui=renderer(),files={...local,canva:{name:'Slides and presenter notes',url:'https://www.canva.com/design/DAG123/abc_123/edit'},googleDocs:{name:'Written guide',url:'https://docs.google.com/document/d/doc_123/edit'}};
  const links=anchors(ui.links(files));assert.equal(links.length,5);
  for(const name of ['Canva','Google Docs']){const link=links.find(link=>link.label.includes(name));assert.ok(link,`${name} editor must be rendered`);assert.match(link.attributes,/target="_blank"/);assert.match(link.attributes,/rel="noopener/);assert.doesNotMatch(link.attributes,/\bdownload\b/);}
  for(const name of ['PDF','Text','Complete package'])assert.match(links.find(link=>link.label.includes(name)).attributes,/\bdownload\b/);
  const sample=anchors(ui.links(files,{sample:true}));assert.equal(sample.length,4);assert.equal(sample.some(link=>link.label.includes('Complete package')),false);
});
test('legacy local presentation/document files cannot masquerade as native cloud editor links',()=>{
  const ui=renderer(),html=ui.links({...local,canva:{name:'old.pptx',url:'/downloads/package/old.pptx'},editable:{name:'old.docx',url:'/downloads/package/old.docx'},googleDocs:{name:'old.docx',url:'/downloads/package/old.docx'}});
  assert.equal(anchors(html).length,3);assert.doesNotMatch(html,/pptx|docx|PowerPoint|Word|Open in Canva|Open in Google Docs/);
});
test('only HTTPS native editor routes on the real service hosts become editor actions',()=>{
  const ui=renderer();
  for(const url of ['http://www.canva.com/design/DAG123/edit','https://www.canva.com.evil.test/design/DAG123/edit','https://www.canva.com/design/DAG123/view','https://www.canva.com/design/DAG123/export.pptx','javascript:alert(1)'])assert.equal(ui.links({canva:{name:'Unverified design',url}}),'',url);
  for(const url of ['https://docs.google.com.evil.test/document/d/doc123/edit','https://docs.google.com/spreadsheets/d/doc123/edit','https://docs.google.com/document/d/doc123/export?format=docx','https://docs.google.com/document/d/doc123/preview','http://docs.google.com/document/d/doc123/edit'])assert.equal(ui.links({googleDocs:{name:'Unverified document',url}}),'',url);
});
test('actual sample and download rendering retain review gates and local fallback without an Office handoff',()=>{
  const ui=renderer();ui.state.files={...local,canva:{name:'old.pptx',url:'/downloads/package/old.pptx'},editable:{name:'old.docx',url:'/downloads/package/old.docx'}};
  const html=ui.renderDownloads();assert.doesNotMatch(html,/Microsoft|PowerPoint|Word|\.pptx|\.docx|import it into Canva|upload it to Google Drive/);assert.match(html,/PDF/);assert.match(html,/Google Docs/);assert.match(html,/presenter notes/);assert.match(html,/cloud file has not been confirmed/i);
  ui.state.interviewStage=9;ui.state.sampleFingerprint='current';ui.state.sampleFiles=local;assert.match(ui.renderSampleReview(),/PDF/);
  ui.state.reviewed=false;assert.match(ui.renderDownloads(),/id="export-product"[^>]*disabled/);
});
async function bootstrapRuntime(version){
  const ui=renderer(),nodes={model:{},'model-note':{}},requests=[],notices=[];
  ui.state.pendingAnswer='My unsent answer';ui.state.brief.title='My approved creator project';ui.state.files=version==='0.3.7'?{...local,editable:{url:'/downloads/old/source.docx'},canva:{url:'/downloads/old/source.pptx'},project:{url:'/downloads/old/private-project.json'}}:local;ui.state.sampleFiles=ui.state.files;ui.state.sampleFingerprint='current';
  ui.studio={projects:[ui.state],profile:{preferences:[{text:'Use short sentences',category:'voice'}]}};ui.provider='chatgpt';ui.selectedModel='gpt-6.1-sol';ui.quality='high';
  const preserved=JSON.stringify({project:ui.state,profile:ui.studio.profile,provider:ui.provider,model:ui.selectedModel,quality:ui.quality});
  Object.assign(ui,{runtimeReady:false,runtimeError:'',catalog:null,checks:0,fetch:async path=>{requests.push(path);return {ok:true,json:async()=>path==='/api/health'?{app:'product-studio-local',version}:{chatgpt:[{id:'gpt-6.1-sol',label:'Sol'}],claude:[]}};},renderModels(){},render(){ui.rendered=ui.renderDownloads();ui.sampleRendered=ui.renderSampleReview();},schedulePreview(){},checkSelectedModel(){ui.checks++;},renderChat(){},notice:message=>notices.push(message),$:id=>nodes[id]||(nodes[id]={})});
  vm.runInContext(source.slice(source.indexOf('async function bootstrap('),source.indexOf('\nasync function uploadCover(')),ui);await ui.bootstrap();
  return {ui,nodes,requests,notices,preserved,current:JSON.stringify({project:ui.state,profile:ui.studio.profile,provider:ui.provider,model:ui.selectedModel,quality:ui.quality})};
}
test('actual bootstrap rejects 0.3.7 and disables legacy package actions while preserving creator work and choices',async()=>{
  const result=await bootstrapRuntime('0.3.7'),{ui}=result;
  assert.equal(ui.runtimeReady,false);assert.deepEqual(result.requests,['/api/health']);assert.equal(ui.checks,0);assert.equal(result.nodes.model.disabled,true);assert.match(result.notices[0],/Restart[\s\S]*retained/i);
  assert.match(ui.rendered,/id="export-product"[^>]*disabled/);assert.match(ui.sampleRendered,/id="export-sample"[^>]*disabled/);assert.equal(anchors(ui.rendered).length,0);assert.equal(anchors(ui.sampleRendered).length,0);assert.equal(result.current,result.preserved);
  ui.render();assert.equal(anchors(ui.rendered).length,0,'Later re-render must not restore the legacy ZIP action');assert.equal(ui.state.files.zip.url,'/downloads/package/guide.zip');assert.equal(ui.state.sampleFiles.canva.url,'/downloads/old/source.pptx');
});
test('actual bootstrap accepts 0.3.8 and retains the valid PDF/text/ZIP delivery contract',async()=>{
  const result=await bootstrapRuntime('0.3.8'),{ui}=result;
  assert.equal(ui.runtimeReady,true);assert.deepEqual(result.requests,['/api/health','/api/models']);assert.equal(ui.checks,1);assert.equal(anchors(ui.rendered).length,3);assert.match(ui.rendered,/Complete package/);assert.equal(result.current,result.preserved);
});
