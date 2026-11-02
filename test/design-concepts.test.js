import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadStudio,persistStudio,checkpoint,importProject} from '../public/studio-store.js';
const concepts=await import('../public/design-concepts.js').catch(()=>({}));
const brief={title:'Choose your website’s job',format:'Webinar presentation',outcome:'Choose a minimum website setup for your digital product.',productDraft:'## Choose one primary action\n\nYour first website needs one useful job.\n\n- Awareness: explain the guide.\n- Lead capture: collect an interest form.\n- Direct sales: confirm payment and access.\n\n### Presenter notes\n\nFirst source notes.\n\n## Compare the options\n\nOne digital guide, three possible setups.\n\n| Setup | Visitor journey | Main action |\n| --- | --- | --- |\n| Awareness | Read about the guide → follow a contact link | Ask about the guide |\n| Lead capture | Read about the guide → submit an interest form | Join the interest list |\n| Direct sales | Read about the guide → pay → receive confirmed access | Buy and access the guide |\n\nChoose the journey you need now.\n\n### Presenter notes\n\nSecond source notes.'};
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};};
test('three concepts materially vary typography, composition and imagery while retaining the same real lesson',()=>{
  assert.equal(typeof concepts.renderConceptSlides,'function');assert.deepEqual(concepts.DESIGN_CONCEPTS.map(concept=>concept.id),['editorial','studio','warm']);
  const systems=concepts.DESIGN_CONCEPTS.map(concept=>concept.visualSystem);assert.equal(new Set(systems.map(system=>system.headingFont)).size,3);assert.equal(new Set(systems.map(system=>system.composition)).size,3);
  for(const concept of concepts.DESIGN_CONCEPTS){const slides=concepts.renderConceptSlides(brief,concept.id);assert.ok(slides.length>=2);assert.match(slides[0].svg,/Choose your/);assert.ok(slides.some(slide=>slide.title==='Compare the options'));for(const slide of slides){assert.ok(slide.emptyRatio>=.4);assert.match(slide.svg,/<text/);assert.doesNotMatch(slide.svg,/<script|foreignObject|onload=/);assert.equal(slide.svg.includes('Second source notes'),false);}assert.match(slides.map(slide=>slide.visibleText).join(' '),/Ask about the guide/);}
});
test('first representative source revisions invalidate approval while appended lessons preserve the chosen look',()=>{
  assert.equal(typeof concepts.sourceFingerprint,'function');const original=concepts.sourceFingerprint(brief);
  assert.equal(concepts.sourceFingerprint({...brief,productDraft:brief.productDraft+'\n\n## A new lesson\n\nNew approved content.'}),original);
  assert.notEqual(concepts.sourceFingerprint({...brief,productDraft:brief.productDraft.replace('one useful job','a different useful job')}),original);
});
test('selection and visual approval persist per project without changing manuscript, content approvals or unsent text',()=>{
  assert.equal(typeof concepts.chooseConcept,'function');const storage=memory(),studio=loadStudio(storage),p=studio.projects[0];Object.assign(p.brief,brief);p.pendingAnswer='My saved unsent thought';p.approvedDraft=p.brief.productDraft;p.sampleApproved=true;
  concepts.chooseConcept(p,'studio');assert.equal(p.presentationDesign.approved,false);concepts.approveConcept(p);assert.equal(concepts.designApprovalCurrent(p),true);persistStudio(storage,studio);
  const restored=loadStudio(storage).projects[0];assert.equal(restored.presentationDesign.conceptId,'studio');assert.equal(concepts.designApprovalCurrent(restored),true);assert.equal(restored.pendingAnswer,p.pendingAnswer);assert.equal(restored.brief.productDraft,brief.productDraft);assert.equal(restored.approvedDraft,brief.productDraft);assert.equal(restored.sampleApproved,true);assert.equal(studio.profile.preferences.length,0);
  const imported=importProject(studio,checkpoint(restored));assert.equal(imported.presentationDesign.conceptId,'studio');concepts.chooseConcept(imported,'warm');assert.equal(imported.presentationDesign.approved,false);assert.equal(restored.presentationDesign.conceptId,'studio');
});
test('a real shared production serializer preserves source order and notes without flattening audience text',()=>{
  assert.equal(typeof concepts.renderCanvaTransfer,'function');const result=concepts.renderCanvaTransfer({brief,conceptId:'editorial'});
  assert.equal((result.html.match(/data-document-role="page"/g)||[]).length,result.pages.length);assert.ok(result.pages[0].notes.includes(brief.title));assert.ok(result.pages[1].notes.includes('First source notes'));assert.ok(result.pages.at(-1).notes.includes('Second source notes'));assert.match(result.html,/<svg/);assert.match(result.html,/<div style="position:absolute/);assert.doesNotMatch(result.html,/<canvas|<script|<text\b/);assert.match(result.html,/data-speaker-notes=/);
});

test('native verification metadata contains the text actually drawn, including the author and excluding hidden cover labels',()=>{
  const result=concepts.renderCanvaTransfer({brief:{...brief,author:'Sample author',outcome:'Choose one website purpose.'},conceptId:'warm'});
  const cover=result.pages[0];assert.match(cover.visibleText,/Sample author/);
  assert.doesNotMatch(cover.visibleText,/Lead capture/,'image-only cover labels are not drawn text');
  assert.ok(cover.visibleBlocks.includes('Sample author'));
  for(const page of result.pages){assert.ok(page.visibleBlocks.length);assert.equal(page.visibleText,page.visibleBlocks.join(' '));}
});
test('website-specific illustration is not silently reused for unrelated creator topics',()=>{
  assert.equal(typeof concepts.renderConceptSlides,'function');assert.ok(concepts.renderConceptSlides(brief,'warm').some(page=>page.svg.includes('warm-digital-products')));
  const unrelated={...brief,title:'Build a sustainable fitness habit',outcome:'Choose a comfortable, repeatable activity.',productDraft:'## Find a useful movement\n\nChoose an activity that fits your available energy and schedule.\n\n- Walking: start with a comfortable route.\n- Stretching: use a clear space.'};assert.equal(concepts.renderConceptSlides(unrelated,'warm').some(page=>page.svg.includes('warm-digital-products')),false);
  assert.equal(concepts.renderConceptSlides({...unrelated,productDraft:unrelated.productDraft+'\n\n### Presenter notes\n\nAvoid building a website in this fitness workshop.'},'warm').some(page=>page.svg.includes('warm-digital-products')),false);
});
test('embedded samples keep presentation type separate from surrounding app icon styling',()=>{
  for(const concept of concepts.DESIGN_CONCEPTS)for(const page of concepts.renderConceptSlides(brief,concept.id))assert.match(page.svg,/<svg[^>]*style="stroke:none;stroke-width:0;fill:none"/);
});
test('verified Canva editor results persist through reload and backup with an exact full-source/concept binding',()=>{
  assert.equal(typeof concepts.fullSourceFingerprint,'function');assert.equal(typeof concepts.canvaSampleCurrent,'function');const storage=memory(),studio=loadStudio(storage),p=studio.projects[0];Object.assign(p.brief,brief);concepts.chooseConcept(p,'warm');concepts.approveConcept(p);p.pendingAnswer='Keep this answer';p.canvaSample={url:'https://www.canva.com/d/verified-design',name:'Website lesson',conceptId:'warm',fullSourceFingerprint:concepts.fullSourceFingerprint(p.brief,'warm')};persistStudio(storage,studio);
  const restored=loadStudio(storage).projects[0];assert.deepEqual(restored.canvaSample,p.canvaSample);assert.equal(concepts.canvaSampleCurrent(restored),true);const imported=importProject(studio,checkpoint(restored));assert.deepEqual(imported.canvaSample,p.canvaSample);assert.equal(imported.pendingAnswer,'Keep this answer');assert.equal(concepts.canvaSampleCurrent(imported),true);imported.brief.productDraft+='\n\n## Appended source\n\nNew material.';assert.equal(concepts.designApprovalCurrent(imported),true);assert.equal(concepts.canvaSampleCurrent(imported),false);assert.equal(imported.canvaSample.url,p.canvaSample.url);concepts.chooseConcept(restored,'studio');assert.equal(concepts.canvaSampleCurrent(restored),false);
});
test('unsafe or view-only saved Canva records are omitted without losing the creator project',()=>{
  const studio=loadStudio(memory()),p=studio.projects[0];Object.assign(p.brief,brief);
  for(const url of ['http://www.canva.com/d/design','https://canva.com.evil.test/d/design','https://www.canva.com/design/id/view','/downloads/old.pptx','javascript:alert(1)']){const restored=importProject(studio,{...checkpoint(p),canvaSample:{url,name:'Unsafe',conceptId:'warm',fullSourceFingerprint:'canva-v1-12345678'}});assert.equal(restored.canvaSample,null);assert.equal(restored.brief.productDraft,brief.productDraft);}
});

const audienceText=pages=>pages.filter(page=>page.sourceId).flatMap(page=>page.visibleBlocks).join(' ').replace(/\s+/g,' ').trim();
for(const id of ['editorial','studio','warm']){
  test(`${id}: two source tables and intervening copy survive preview and actual transfer in source order`,()=>{
    const productDraft='## Compare the setup\n\nFirst approved introduction.\n\n| Option | Journey | Action |\n| --- | --- | --- |\n| Guide | First unique journey | Start |\n\nBetween tables, retain this instruction.\n\n| Constraint | Response | Owner |\n| --- | --- | --- |\n| Safety | Unique review safeguard | Creator |\n\nLast approved instruction.\n\n### Presenter notes\n\nExplain the safeguard exactly.';
    const source={...brief,productDraft},pages=concepts.renderConceptSlides(source,id,{mode:'full'}),actual=audienceText(pages),expected=['First approved introduction.','First unique journey','Between tables, retain this instruction.','Unique review safeguard','Last approved instruction.'];let previous=-1;
    for(const copy of expected){const at=actual.indexOf(copy);assert.ok(at>previous,`Source copy missing or reordered: ${copy}`);previous=at;}
    for(const page of pages.filter(page=>page.sourceId))assert.equal(page.notes,'Explain the safeguard exactly.');
    const transfer=concepts.renderCanvaTransfer({brief:source,conceptId:id});assert.match(transfer.html,/Unique review safeguard/);assert.match(transfer.pages.map(page=>page.visibleText).join(' '),/Unique review safeguard/);assert.equal(transfer.pages.length,pages.length);
  });
  test(`${id}: three labeled choices cannot consume or drop an additional ordinary list instruction`,()=>{
    const source={...brief,productDraft:'## Choose a working approach\n\nStart with your goal.\n\n- Plan: Pick a useful task.\n- Practice: Try one small example.\n- Review: Check the result.\n- Keep the original source for comparison.\n\nFinish with the approved reflection.\n\n### Presenter notes\n\nKeep these original notes.'},pages=concepts.renderConceptSlides(source,id,{mode:'full'}),actual=audienceText(pages),expected=['Start with your goal.','Plan: Pick a useful task.','Practice: Try one small example.','Review: Check the result.','Keep the original source for comparison.','Finish with the approved reflection.'];let previous=-1;
    for(const copy of expected){const at=actual.indexOf(copy);assert.ok(at>previous,`Source copy missing or reordered: ${copy}`);previous=at;}assert.match(concepts.renderCanvaTransfer({brief:source,conceptId:id}).html,/Keep the original source for comparison/);
    for(const page of pages.filter(page=>page.sourceId))assert.equal(page.notes,'Keep these original notes.');
  });
  test(`${id}: the full comparison conclusion stays inside the canvas and every native text box is space-accounted`,()=>{
    const conclusion='Before deciding, compare the action your reader should complete with the time and confidence they have available. Keep the smallest useful setup, test it with a real learner, and revise the next step after their feedback. Preserve this final safeguard.',source={...brief,productDraft:'## Compare the setup\n\nChoose a path.\n\n| Option | Journey | Action |\n| --- | --- | --- |\n| Guide | Read then act | Start |\n\n'+conclusion+'\n\n### Presenter notes\n\nExplain the safeguard.'},pages=concepts.renderConceptSlides(source,id,{mode:'full'});
    assert.ok(audienceText(pages).includes(conclusion));
    for(const page of pages){assert.ok(page.emptyRatio>=.4);for(const [,attrs,copy]of page.svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)){if(!copy)continue;const attr=name=>Number(attrs.match(new RegExp('(?:^|\\s)'+name+'="([^"]*)"'))?.[1]),x=attr('x'),y=attr('y'),size=attr('font-size'),top=y-size*.83,bottom=top+size*1.2;assert.ok(top>=0&&bottom<=720,`${copy} extends to ${bottom}`);}}
    for(const page of pages)for(const [,attrs,copy]of page.svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)){if(!copy)continue;const attr=name=>Number(attrs.match(new RegExp('(?:^|\\s)'+name+'="([^"]*)"'))?.[1]),x=attr('x'),size=attr('font-size'),top=attr('y')-size*.83,bottom=top+size*1.2;assert.ok(page.contentAreas.some(area=>area.x<=x&&area.y<=top+.001&&area.y+area.h>=bottom-.001),`${copy} must be included at its full drawn/native text extent`);}
    const transfer=concepts.renderCanvaTransfer({brief:source,conceptId:id});for(const [,style]of transfer.html.matchAll(/<div style="([^"]*)"/g)){const top=Number(style.match(/top:([\d.-]+)px/)?.[1]),size=Number(style.match(/font-size:([\d.-]+)px/)?.[1]);assert.ok(top>=0&&top+size*1.2<=720);}
  });
  test(`${id}: long source copy reflows across balanced pages with complete words and original notes`,()=>{
    const title='Keep the safeguards',closing=Array.from({length:30},(_,index)=>`Preserve safeguard ${index+1} with its approved explanation.`).join(' '),source={...brief,productDraft:`## ${title}\n\nChoose a useful task.\n\n- Plan: Begin with the source.\n- Practice: Try one example.\n- Review: Check the result.\n\n${closing}\n\n### Presenter notes\n\nOriginal notes for this entire source slide.`},pages=concepts.renderConceptSlides(source,id,{mode:'full'}).filter(page=>page.sourceId),shown=pages.map(page=>page.visibleBlocks.join(' ').replace(title,'')).join(' ').replace(/\s+/g,' ').trim();
    assert.ok(pages.length>1);assert.ok(shown.includes(closing));assert.ok(Math.max(...pages.map(page=>page.visibleBlocks.length))-Math.min(...pages.map(page=>page.visibleBlocks.length))<=1);for(const page of pages){assert.equal(page.notes,'Original notes for this entire source slide.');assert.ok(page.emptyRatio>=.4);}assert.ok(concepts.renderCanvaTransfer({brief:source,conceptId:id}).pages.map(page=>page.visibleText.replace(title,'')).join(' ').replace(/\s+/g,' ').includes(closing));
  });
}
