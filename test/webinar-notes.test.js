import {test} from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {PDFDocument} from 'pdf-lib';
import {extractText} from 'unpdf';
import {freshProject} from '../src/product.js';
import {designProduct,geometryForFormat} from '../src/page-design.js';
import {exportProduct,previewProduct} from '../src/exports.js';

const slides=[
  {title:'Slide 1: Ask about the next task',body:'A useful handoff starts with one concrete task. Ask the cafe owner what they need to change, publish or send this week. Record the task, the person doing it and any supplier requirement that is still unanswered.',notes:'Presenter-only cue ALPHA: Explain that this is a fictional teaching example. Ask participants to name one actual handoff they are preparing; give them thirty seconds to write the next task.',extra:'- If someone says everything, ask which task comes first.\n- Keep unknown supplier requirements as questions.'},
  {title:'Slide 2: Choose a file for that task',body:'For an opening-hours update, provide the agreed editable menu and a reference PDF. Identify the exact text field to change and the software needed. Preserve the original source and name the dated working copy clearly.',notes:'Presenter-only cue BRAVO: Demonstrate the opening-hours field in a sample menu. Explain why a PDF reference helps compare spacing but does not prove that an editable file works.',extra:'1. Name the editable file.\n2. Point to the opening-hours field.\n3. Save a dated copy.'},
  {title:'Slide 3: Check the recipient can use it',body:'Ask the owner to find the file and make one intended change. Watch where they hesitate, then improve the usage note and repeat the same check. A compliment or a sent attachment does not establish that the package is usable.',notes:'Presenter-only cue CHARLIE: Invite a volunteer to describe the next click before you demonstrate it. Pause if the file choice is unclear and model how to ask a narrower question.',extra:'Wait for an observable action. Do not invent time savings, customer results or production specifications.'},
  {title:'Slide 4: Plan your next handoff',body:'Write a three-line action plan: the next task, the approved file supporting it and the small action the recipient will perform. Leave one unanswered supplier question visible, assign its owner and agree when to follow up.',notes:'Presenter-only cue DELTA: Give participants two minutes to draft the action plan, then ask them to read the task aloud. Close with a question about the next real package they will prepare.',extra:'- Review what the recipient will do.\n- Ask what remains unverified.\n- Schedule the follow-up rather than guessing an answer.'}
];
function webinarProject(){
  const project=freshProject();project.stage=12;project.stageReady=true;
  Object.assign(project.brief,{title:'A usable client handoff',author:'Illustrative workshop author',format:'Webinar',outcome:'Prepare one usable handoff and check the recipient can perform the next task.',theme:'sage',productDraft:'# A usable client handoff\n\n'+slides.map(slide=>`## ${slide.title}\n\n${slide.body}\n\n### Presenter notes\n\n${slide.notes}\n\n${slide.extra}`).join('\n\n')});return project;
}
const decode=xml=>xml.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
const text=xml=>decode([...xml.matchAll(/<(?:a|w):t(?:\s[^>]*)?>([\s\S]*?)<\/(?:a|w):t>/g)].map(match=>match[1]).join(' ')).replace(/\s+/g,' ').trim();
const bytes=(result,extension)=>Buffer.from(result.files.find(file=>file.name.endsWith(extension)).blob,'base64');
async function slideNotes(deck,index){
  const relationship=await deck.file(`ppt/slides/_rels/slide${index}.xml.rels`).async('string');
  const target=relationship.match(/Target="([^"\n]+notesSlide\d+\.xml)"[^>]*Type="[^"]+notesSlide"|Type="[^"]+notesSlide"[^>]*Target="([^"\n]+)"/);
  assert.ok(target,'The slide has a native notes relationship');return text(await deck.file('ppt/'+(target[1]||target[2]).replace(/^\.\.\//,'')).async('string'));
}

test('Webinar and webinar-plus-course use the existing 16:9 presentation geometry',()=>{
  for(const format of ['Webinar','Webinar + course','Live webinar and video course'])assert.deepEqual(geometryForFormat(format),{width:960,height:540,margin:64,bottom:474});
  assert.deepEqual(geometryForFormat('Practical guide'),{width:595.28,height:841.89,margin:52,bottom:772});
});

test('presentation scenes separate presenter notes from visible content without dropping approved source',async()=>{
  const project=webinarProject();project.brief.format='Presentation';const design=await designProduct(project);
  const visible=design.pages.flatMap(page=>page.items.filter(item=>item.type==='text').map(item=>item.text)).join(' ');
  assert.equal(visible.includes('Presenter-only cue'),false,'Presenter notes must be removed from the audience-facing scene');
  assert.ok(design.blocks.some(block=>block.text.includes(slides[0].notes)),'Full editable source retains presenter text');
});

test('actual webinar PDF, PPTX and preview show slides while native per-slide notes and editable source retain the script',async()=>{
  const project=webinarProject(),design=await designProduct(project),result=await exportProduct(project),preview=await previewProduct(project);
  const pdf=await PDFDocument.load(bytes(result,'.pdf'));assert.deepEqual(pdf.getPage(0).getSize(),{width:960,height:540});
  const pdfText=(await extractText(Uint8Array.from(bytes(result,'.pdf')),{mergePages:true})).text;
  const deck=await JSZip.loadAsync(bytes(result,'.pptx')),word=await JSZip.loadAsync(bytes(result,'.docx'));
  assert.match(await deck.file('ppt/presentation.xml').async('string'),/cx="12192000" cy="6858000"/);
  const visibleXml=(await Promise.all(Object.entries(deck.files).filter(([name])=>/^ppt\/slides\/slide\d+\.xml$/.test(name)).map(([,entry])=>entry.async('string')))).join('\n');
  const wordText=text(await word.file('word/document.xml').async('string'));
  for(const slide of slides){
    const index=design.pages.findIndex(page=>page.title===slide.title);assert.ok(index>0,'The teaching slide exists after the generated cover');
    const notes=await slideNotes(deck,index+1);assert.ok(notes.includes(slide.notes));
    for(const other of slides.filter(other=>other!==slide))assert.equal(notes.includes(other.notes),false,'Notes belong to their source slide');
    for(const source of [pdfText,text(visibleXml),preview.pages.map(page=>page.svg.replace(/<[^>]+>/g,' ')).join('\n')]){
      const visible=decode(source).replace(/\s+/g,' ').trim();
      assert.equal(visible.includes(slide.notes.split(':')[0]),false,'Presenter script is not audience-facing content');assert.equal(visible.includes('Presenter notes'),false);
      assert.ok(visible.includes(slide.title),'The slide heading survives');assert.ok(visible.includes(slide.body),'The actual audience teaching survives');
    }
    assert.ok(wordText.includes(slide.notes),'Word retains the full presenter script');
  }
  assert.equal((await slideNotes(deck,1)).includes('Presenter-only cue'),false,'User notes are not dumped on the generated cover');
  assert.equal(bytes(result,'.md').toString(),project.brief.productDraft,'Approved raw Markdown remains exact');
  assert.equal(JSON.parse(bytes(result,'-project.json').toString()).project.brief.productDraft,project.brief.productDraft);
});

test('continuation slides retain only the notes for their original teaching slide',async()=>{
  const project=webinarProject();project.brief.productDraft=project.brief.productDraft.replace(slides[0].body,Array(5).fill(slides[0].body).join('\n\n'));
  const design=await designProduct(project),result=await exportProduct(project),deck=await JSZip.loadAsync(bytes(result,'.pptx'));
  const continued=design.pages.map((page,index)=>({page,index})).filter(({page})=>page.title===slides[0].title);
  assert.ok(continued.length>1,'The long teaching slide actually spans multiple output slides');assert.ok(continued.some(({page})=>page.continued));
  for(const {page,index}of continued){
    assert.ok(page.presenterNotes.includes(slides[0].notes));const notes=await slideNotes(deck,index+1);
    assert.ok(notes.includes(slides[0].notes));assert.equal(notes.includes(slides[1].notes),false);
    assert.equal(page.items.some(item=>item.type==='text'&&item.text.includes('Presenter-only cue')),false);
  }
});

test('an explicit first slide matching the product title still retains its own speaker notes',async()=>{
  const project=webinarProject();project.brief.title=slides[0].title;project.brief.productDraft=project.brief.productDraft.slice(project.brief.productDraft.indexOf('## ')).replaceAll('### Presenter notes','### Speaker notes');
  const design=await designProduct(project);assert.ok(design.pages.find(page=>page.layout!=='cover'&&page.title===slides[0].title)?.presenterNotes.includes(slides[0].notes));
});

test('unattached, empty and script-only presenter blocks fail clearly without changing the manuscript',async()=>{
  const project=webinarProject();const source=project.brief.productDraft;
  project.brief.productDraft='# A usable client handoff\n\n### Presenter notes\n\n'+slides[0].notes;
  await assert.rejects(previewProduct(project),/Place presenter notes under a slide/);
  project.brief.productDraft='## A named teaching slide\n\nVisible teaching content.\n\n### Presenter notes';
  await assert.rejects(previewProduct(project),/Add presenter notes.*or remove the empty notes heading/);
  project.brief.productDraft='## A script without audience content\n\n### Presenter notes\n\n'+slides.map(slide=>slide.notes+' '+slide.extra).join('\n\n');
  const before=project.brief.productDraft;await assert.rejects(exportProduct(project),/audience-facing slide content/);assert.equal(project.brief.productDraft,before);
  project.brief.outcome='Prepare a handoff and check that the recipient can complete the actual next task. '.repeat(12);
  await assert.rejects(exportProduct(project),/audience-facing slide content/,'A long generated outcome page cannot make a script-only source into a teaching deck');
  project.brief.productDraft=source;assert.equal(project.brief.productDraft,source);
});

test('ordinary guide notes headings remain ordinary visible manuscript content',async()=>{
  const project=webinarProject();project.brief.format='Practical guide';const design=await designProduct(project),result=await exportProduct(project);
  assert.equal(design.hasPresenterNotes,false);assert.deepEqual(design.geometry,{width:595.28,height:841.89,margin:52,bottom:772});
  const pdfText=(await extractText(Uint8Array.from(bytes(result,'.pdf')),{mergePages:true})).text.replace(/\s+/g,' ');
  assert.ok(pdfText.includes('Presenter notes'));assert.ok(pdfText.includes(slides[0].notes));
  assert.equal(bytes(result,'.md').toString(),project.brief.productDraft);
});
