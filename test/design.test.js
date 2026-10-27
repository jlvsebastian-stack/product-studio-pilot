import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import * as exports from '../src/exports.js';
import { designProject } from './fixtures/design-project.js';
const normalized=value=>value.replace(/\s+/g,' ').trim();
const decode=xml=>xml.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
test('designed preview has real pages, varied purposes, native graphics and bounded geometry',async()=>{
  assert.equal(typeof exports.previewProduct,'function','a real designed preview is required');
  const preview=await exports.previewProduct(designProject());
  assert.equal(preview.pageCount,preview.pages.length);assert.ok(preview.pageCount>=6);
  assert.ok(new Set(preview.pages.map(v=>v.purpose)).size>=5);
  for(const page of preview.pages){assert.match(page.svg,/<svg[^>]+viewBox="0 0 595.28 841.89"/);assert.match(page.svg,/<text/);assert.doesNotMatch(page.svg,/<foreignObject|<script|onload=|javascript:/);}
  assert.ok(preview.pages.some(v=>v.svg.includes('data-role="step-connector"')),'steps become a useful editable diagram');
});
test('all source paragraphs survive long wrapping in the internal Canva source, and Markdown remains exact',async()=>{
  const project=designProject({long:true});const result=await exports.exportProduct(project);
  const file=extension=>result.files.find(v=>v.name.endsWith(extension));
  assert.equal(Buffer.from(file('.md').blob,'base64').toString(),project.brief.productDraft);
  assert.equal((await PDFDocument.load(Buffer.from(file('.pdf').blob,'base64'))).getPageCount(),result.pages);
  const canvaSource=await exports.exportCanvaSource(project),pptx=await JSZip.loadAsync(canvaSource.bytes);
  assert.equal(canvaSource.pages,result.pages);
  const slides=await Promise.all(Object.entries(pptx.files).filter(([name])=>/^ppt\/slides\/slide\d+\.xml$/.test(name)).map(async([,v])=>v.async('string')));
  const manuscriptShapes=slides.flatMap(xml=>[...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match=>match[0])).filter(xml=>/name="studio-(body|list|quote|code|step-label|writing-prompt)"/.test(xml));
  const manuscriptText=normalized(decode(manuscriptShapes.map(v=>[...v.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(m=>m[1]).join(' ')).join(' ')));
  const pptxText=normalized(decode(slides.map(v=>[...v.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(m=>m[1]).join(' ')).join(' ')));
  for(const block of exports.parseManuscript(project.brief.productDraft)){
    assert.ok((block.kind==='heading'?pptxText:manuscriptText).includes(normalized(block.text.replace(/\s*_{3,}\s*$/,''))), 'Internal Canva source retains '+block.text.slice(0,60));
  }
  assert.match(slides.join(''),/<a:bodyPr[^>]*anchor="t"/,'native text boxes use the actual top anchor rather than default centering');
  assert.match(slides.join(''),/<p:sp>/,'graphics are native editable shapes');assert.doesNotMatch(slides.join(''),/<p:pic>/,'without an uploaded cover the pages remain text and native shapes');
  assert.match(await pptx.file('docProps/core.xml').async('string'),/Illustrative author/);
});
test('optional cover permits only bounded genuine PNG or JPEG, escaped source cannot execute',async()=>{
  assert.equal(typeof exports.previewProduct,'function');
  const project=designProject();project.brief.productDraft+='\n\n<script>alert("hello")</script> & literal <tag> text.';
  for(const coverImage of ['data:image/svg+xml;base64,PHN2Zy8+', 'https://example.com/a.png','data:image/png;base64,YWJj', 'data:image/png;base64,'+'A'.repeat(1400000)])await assert.rejects(exports.previewProduct(project,{coverImage}),/PNG|JPEG|image|1 MB/i);
  const safe=await exports.previewProduct(project);assert.match(safe.pages.map(v=>v.svg).join(''),/&lt;script&gt;/);assert.doesNotMatch(safe.pages.map(v=>v.svg).join(''),/<script/);
});
test('invalid design metadata cannot omit source and short preview is available before export',async()=>{
  const project=designProject();project.brief.designPlan='{"sections":[{"heading":"Exercise","layout":"delete"}]}';
  const preview=await exports.previewProduct(project);assert.ok(preview.pageCount>1);
  project.brief.productDraft='# Early idea\n\nA useful first paragraph.';const early=await exports.previewProduct(project);assert.ok(early.pageCount>=1);
  await assert.rejects(exports.exportProduct(project),/actual teaching|outline/i);
});

test('landscape slide format shares geometry across preview, PDF and internal Canva source',async()=>{
  const project=designProject();project.brief.format='Workshop slide deck';
  const preview=await exports.previewProduct(project);assert.match(preview.pages[0].svg,/viewBox="0 0 960 540"/);
  const result=await exports.exportProduct(project),pdf=await PDFDocument.load(Buffer.from(result.files[0].blob,'base64'));
  assert.deepEqual(pdf.getPage(0).getSize(),{width:960,height:540});
  assert.equal(result.pages,preview.pageCount);
  const canvaSource=await exports.exportCanvaSource(project),deck=await JSZip.loadAsync(canvaSource.bytes);
  assert.equal(canvaSource.mimeType,'application/vnd.openxmlformats-officedocument.presentationml.presentation');assert.equal(canvaSource.pages,result.pages);assert.ok(Buffer.isBuffer(canvaSource.bytes));
  assert.match(await deck.file('ppt/presentation.xml').async('string'),/cx="12192000" cy="6858000"/);
});

test('native scene bounds survive very long headings, paragraphs, code and metadata',async()=>{
  const { designProduct, textWidth }=await import('../src/page-design.js');
  for(const format of ['Practical guide','Presentation slides']){
    const project=designProject();project.brief.format=format;project.brief.title='A complete guide to planning a useful client handoff and checking whether the recipient can use the package without inventing results or supplier requirements';
    project.brief.author='Illustrative author with an intentionally long author credit for layout verification';project.brief.outcome='Complete the next useful task. '.repeat(60);
    project.brief.productDraft+='\n\n## '+ 'A very long section heading with actual information '.repeat(12)+'\n\n'+ 'Keep all of this unusually long paragraph in the export and continue it when the page fills. '.repeat(80)+'\n\n```python\n    print("keep_indent_and_literal_symbols")\n```';
    const design=await designProduct(project);
    for(const page of design.pages)for(const item of page.items){
      if(item.type==='text'){
        assert.ok(item.y>=0&&item.y+item.size<=design.geometry.height-24,`${format}: text vertical bounds ${item.y}: ${item.text}`);
        assert.ok(item.x>=0&&item.x+textWidth(item.text,item.size,item.bold)<=design.geometry.width-30,`${format}: text horizontal bounds: ${item.text}`);
      }
    }
    const sourceText=design.pages.flatMap(page=>page.items.filter(item=>item.type==='text'&&['body','code','heading'].includes(item.role)).map(item=>item.text)).join(' ');
    assert.equal((sourceText.match(/Keep all of this/g)||[]).length,80,'long overflow text remains complete');
  }
});

test('genuine creator image survives preview, PDF, internal Canva source and private checkpoint',async()=>{
  const coverImage='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const project=designProject(),preview=await exports.previewProduct(project,{coverImage});
  const jpeg='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDk6KKKk8w//9k=';
  assert.match((await exports.previewProduct(project,{coverImage:jpeg})).pages[0].svg,/<image /);
  const jpegExport=await exports.exportProduct(project,{coverImage:jpeg});
  assert.ok((await PDFDocument.load(Buffer.from(jpegExport.files[0].blob,'base64'))).getPageCount()>1);
  const malformed=Buffer.from(coverImage.split(',')[1],'base64');malformed.writeUInt32BE(20000,16);
  await assert.rejects(exports.previewProduct(project,{coverImage:'data:image/png;base64,'+malformed.toString('base64')}),/too large in pixels/);
  assert.match(preview.pages[0].svg,/<image /);assert.match(preview.pages[0].svg,/data:image\/png;base64,/);
  const result=await exports.exportProduct(project,{coverImage});
  assert.ok((await PDFDocument.load(Buffer.from(result.files[0].blob,'base64'))).getPageCount()>1);
  const deck=await JSZip.loadAsync((await exports.exportCanvaSource(project,{coverImage})).bytes);
  assert.ok(Object.keys(deck.files).some(name=>name.startsWith('ppt/media/')&&name.endsWith('.png')));
  assert.equal(JSON.parse(Buffer.from(result.checkpoint.blob,'base64').toString()).coverImage,coverImage);
});

test('short adjacent teaching sections share a guide page with all headings and text',async()=>{
  const {designProduct}=await import('../src/page-design.js');const project=designProject();
  const design=await designProduct(project);
  const intro=design.pages.find(page=>page.layout!=='cover'&&page.items.some(item=>item.type==='text'&&item.text==='Getting started'));
  assert.ok(intro.items.some(item=>item.type==='text'&&item.text==='What a usable handoff means'),'a short introduction should share the teaching page instead of consuming a whole page');
  assert.ok(intro.items.map(item=>item.text||'').join(' ').includes('fictional examples'));
  assert.ok(intro.items.some(item=>item.text?.includes('supplier')));
});

test('worksheet prompts get generous native full-width writing areas in the actual scene',async()=>{
  const {designProduct}=await import('../src/page-design.js');const design=await designProduct(designProject());
  const worksheets=design.pages.filter(page=>page.layout==='exercise');
  const rules=worksheets.flatMap(page=>page.items.filter(item=>item.role==='writing-line'));
  assert.equal(rules.length,10,'each of the five actual prompts gets two ruled answer lines');
  for(const rule of rules)assert.ok(rule.type==='line'&&rule.x2-rule.x>=design.geometry.width-2*design.geometry.margin-2,'writing lines span the usable page width');
  for(const page of worksheets){const prompts=page.items.filter(item=>item.role==='writing-prompt');for(const prompt of prompts){const following=page.items.filter(item=>item.role==='writing-line'&&item.y>prompt.y);assert.ok(following.some(item=>item.y>=prompt.y+45),'there is useful handwriting space below the prompt');}}
  assert.ok(worksheets.every(page=>page.items.every(item=>item.type!=='text'||!/_{3}/.test(item.text))),'inline blank runs become actual writing space');
  const source=await exports.exportCanvaSource(designProject()),deck=await JSZip.loadAsync(source.bytes);
  const slideXml=(await Promise.all(Object.entries(deck.files).filter(([name])=>/^ppt\/slides\/slide\d+\.xml$/.test(name)).map(([,entry])=>entry.async('string')))).join('');
  assert.equal((slideXml.match(/name="studio-writing-line"/g)||[]).length,10,'writing rules remain editable native lines in the internal Canva source');
});

test('the cover uses the actual manuscript process as editable native composition',async()=>{
  const {designProduct}=await import('../src/page-design.js');const design=await designProduct(designProject());const cover=design.pages[0];
  assert.equal(cover.items.filter(item=>item.role==='cover-step-node').length,3);
  assert.equal(cover.items.filter(item=>item.role==='cover-step-connector').length,2);
  const labels=cover.items.filter(item=>item.role==='cover-step-title').map(item=>item.text).join(' ');
  for(const phrase of ['Identify the next task.','Prepare the relevant files.','Check understanding.'])assert.ok(labels.includes(phrase),'the cover labels come from the actual steps');
});

test('a meaningful short draft can be downloaded for external review while final export stays gated',async()=>{
  const project=designProject();project.brief.title='Client handoff review sample';
  project.brief.productDraft='# Client handoff review sample\n\n## Start with the next real task\n\nAsk the café owner which file they need to change this week. Record the action, the person doing it, and any supplier question that remains unanswered. Choose the file from that real task rather than sending a large unlabelled folder.\n';
  await assert.rejects(exports.exportProduct(project),/actual teaching|outline/i);
  const sample=await exports.exportProduct(project,{draft:true});
  assert.equal(sample.files.length,2);assert.ok(sample.files.every(file=>file.name.includes('-sample')));
  const pdf=await PDFDocument.load(Buffer.from(sample.files[0].blob,'base64'));
  assert.match(pdf.getTitle(),/DRAFT SAMPLE/);assert.match(pdf.getSubject(),/for review/);
  const deck=await JSZip.loadAsync((await exports.exportCanvaSource(project,{draft:true})).bytes);
  const slideXml=(await Promise.all(Object.entries(deck.files).filter(([name])=>/^ppt\/slides\/slide\d+\.xml$/.test(name)).map(([,entry])=>entry.async('string')))).join('');
  assert.ok(slideXml.includes('DRAFT SAMPLE — for review'));
  assert.ok(Buffer.from(sample.files[1].blob,'base64').toString().startsWith('> DRAFT SAMPLE — for review'));
  assert.ok(Buffer.from(sample.files[1].blob,'base64').toString().endsWith(project.brief.productDraft));
  assert.equal(JSON.parse(Buffer.from(sample.checkpoint.blob,'base64').toString()).draft,true);
  assert.equal(JSON.parse(Buffer.from(sample.checkpoint.blob,'base64').toString()).project.brief.productDraft,project.brief.productDraft);
  const {designProduct}=await import('../src/page-design.js');
  const design=await designProduct(project,{draft:true});assert.ok(design.pages.every(page=>page.items.some(item=>item.role==='draft-status'&&item.text==='DRAFT SAMPLE — for review'&&item.y>=15&&item.y+item.size<=design.geometry.height-20)));
  await assert.rejects(exports.exportProduct(project,{draft:'true'}),/actual teaching|outline/i);
  project.brief.productDraft='# An outline\n\n## One\n\n## Two';
  await assert.rejects(exports.exportProduct(project,{draft:true}),/substantive|sample/i);
});
