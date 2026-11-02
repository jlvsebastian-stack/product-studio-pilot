import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderConceptSlides,renderCanvaTransfer,readConceptSections,fullSourceFingerprint} from '../public/design-concepts.js';
import {cleanSlideProduction,slideWordCount} from '../public/slide-art.js';
import {loadStudio,persistStudio,checkpoint,importProject} from '../public/studio-store.js';
const brief={title:'Choose your website’s job',format:'Webinar presentation',outcome:'Choose a useful action before building.',productDraft:'## Choose one job\n\nYour minimum launch setup starts with the action visitors should finish. Awareness helps visitors understand the guide and follow a contact link. Lead capture lets them submit an interest form. Direct sales requires confirmed payment and a defined access route. Keep the smallest useful setup and add other features later.\n\n### Presenter notes\n\nKeep the original presenter explanation and learner question.\n\n## Compare the choices\n\n| Setup | Visitor journey | Main action |\n| --- | --- | --- |\n| Awareness | Read the guide description → contact the creator | Ask a question |\n| Lead capture | Read the guide description → submit an interest form | Join the interest list |\n| Direct sales | Read the guide description → pay → receive confirmed access | Buy the guide |\n\n### Presenter notes\n\nExplain that these are alternatives rather than mandatory stages.'};
function production(conceptId='editorial'){const sections=readConceptSections(brief),selected=[sections[0],sections[0],sections[1]],index=['editorial','studio','warm'].indexOf(conceptId);return {id:'actual-job',policyVersion:3,status:'ready',mode:'concepts',conceptId,message:'Three samples ready for review.',sourceFingerprint:fullSourceFingerprint(brief,''),complete:true,remainingSourceIds:[],concepts:[{conceptId,slides:selected.map((section,at)=>({id:conceptId+'-'+at,sourceId:section.id,purpose:['Choose a primary action.','Build only essential features.','Compare the primary actions.'][at],headline:at?'Three Journeys. One Guide.':'Choose Your Website’s Job',onSlideText:at?['Ask','Join','Pay → Access']:['Awareness','Lead Capture','Direct Sales'],notes:'Proposed delivery cue.',sourceAudience:section.audience,originalNotes:section.notes,visualAnchors:[{source:section.audience.slice(0,30),depiction:'A source-specific visitor action.'},{source:section.notes,depiction:'The exact intended completion check.'}],visualMode:at?'restrained comparison':'source-specific illustration',visualIdea:at?'Three independent endpoints for the same guide.':'A purposeful choice of visitor action.',composition:{layout:['image-left','comparison','image-top','process','statement','image-right'][(index*2+at)%6],emptySpaceMin:.4},artworkPrompt:`${conceptId}: page ${at}, a source-specific illustration; no text, no people.`,artwork:{id:conceptId+'-art-'+at,url:'/slide-assets/'+conceptId+'-art-'+at,mimeType:'image/png',width:1536,height:1024}}))}]};}

const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};};
test('fifteen words, sentence-case titles and generic ungrounded visual plans cannot be approved',()=>{
  for(const mutate of [value=>value.concepts[0].slides[0].onSlideText=['one two three four five six seven eight nine ten eleven'],value=>value.concepts[0].slides[0].headline='Choose your website’s job',value=>value.concepts[0].slides[0].visualAnchors=[{source:'invented source claim',depiction:'A generic object'}],value=>value.policyVersion=1]){
    const planned=production();mutate(planned);assert.throws(()=>renderConceptSlides(brief,'editorial',{production:planned}));
  }
});
test('real per-slide production replaces the old cover/template with concise unique planned content',()=>{
  const planned=production(),source=brief.productDraft;
  for(const conceptId of ['editorial','studio','warm']){const pages=renderConceptSlides(brief,conceptId,{production:production(conceptId)});assert.equal(pages.length,3);assert.equal(pages.some(page=>page.kind==='cover'),false);assert.equal(new Set(pages.map(page=>page.artwork.id)).size,3);for(const page of pages){assert.ok(slideWordCount(page.visibleText)<=14);assert.ok(page.emptyRatio>=.4);assert.equal(page.visibleText,page.visibleBlocks.join(' '));const section=readConceptSections(brief).find(section=>section.id===page.sourceId);assert.ok(page.notes.includes(section.audience));assert.ok(page.notes.includes(section.notes));assert.equal(page.visibleText.includes(section.notes),false);}assert.notEqual(pages[0].kind,pages[1].kind);}
  assert.equal(brief.productDraft,source);
});
test('a planned prompt, repeated image or stale/missing source cannot masquerade as generated concept artwork',()=>{
  const variants=[value=>delete value.concepts[0].slides[0].artwork,value=>value.concepts[0].slides[1].artwork=value.concepts[0].slides[0].artwork,value=>value.sourceFingerprint='canva-v1-00000000',value=>value.concepts[0].slides[2].sourceAudience='Shortened source'];
  for(const change of variants){const value=production();change(value);assert.throws(()=>renderConceptSlides(brief,'editorial',{production:value}));}
});
test('native transfer uses the exact production and separates editable text/geometry from embedded artwork',()=>{
  const planned=production();assert.throws(()=>renderCanvaTransfer({brief,conceptId:'editorial',production:planned}),/artwork.*embedded/i);
  const images=Object.fromEntries(planned.concepts.flatMap(concept=>concept.slides.map(slide=>[slide.artwork.id,'data:image/png;base64,aGVsbG8=']))),result=renderCanvaTransfer({brief,conceptId:'editorial',production:planned,assetData:{images}});
  assert.equal(result.pages.length,3);assert.match(result.html,/data:image\/png;base64,aGVsbG8=/);assert.doesNotMatch(result.html,/warm-digital-products|\/slide-assets\/|<text\b/);assert.match(result.html,/<div style="position:absolute/);assert.match(result.html,/Original audience copy/);
});
test('current plans and their source binding survive project reload and backup without rewriting approvals or input',()=>{
  const storage=memory(),studio=loadStudio(storage),project=studio.projects[0];Object.assign(project.brief,brief);project.pendingAnswer='Keep my unsent thought';project.approvedDraft=brief.productDraft;project.slideProduction=production();project.slideConcepts=production();persistStudio(storage,studio);const restored=loadStudio(storage).projects[0];assert.deepEqual(restored.slideProduction,cleanSlideProduction(project.slideProduction));assert.deepEqual(restored.slideConcepts,cleanSlideProduction(project.slideConcepts));const imported=importProject(studio,checkpoint(restored));assert.equal(imported.slideProduction.id,'actual-job');assert.equal(imported.pendingAnswer,'Keep my unsent thought');assert.equal(imported.approvedDraft,brief.productDraft);assert.equal(imported.brief.productDraft,brief.productDraft);
});
test('oversized visible copy and off-canvas authored composition are held instead of silently trimmed',()=>{
  const tooMuch=production();tooMuch.concepts[0].slides[0].onSlideText=['Keep every word. '.repeat(30)];assert.throws(()=>renderConceptSlides(brief,'editorial',{production:tooMuch}),/fewer than 15/);
  const outside=production();outside.concepts[0].slides[0].composition.image={x:1100,y:600,width:400,height:300};assert.throws(()=>renderConceptSlides(brief,'editorial',{production:outside}),/reflow|too small/);
});

test('each selected template transfers three unique original images with exact frames and source order',()=>{
  for(const conceptId of ['editorial','studio','warm']){
    const planned=production(conceptId);planned.concepts[0].slides.forEach((slide,i)=>Object.assign(slide.artwork,{sha256:(i+1).toString(16).padStart(64,'0'),quality:'preview',canvaMediaId:'MEDIA-'+i}));
    const pages=renderConceptSlides(brief,conceptId,{production:planned}),images=Object.fromEntries(pages.map(page=>[page.artwork.id,'data:image/png;base64,aGVsbG8='])),native=renderCanvaTransfer({brief,conceptId,production:planned,assetData:{images}});
    assert.deepEqual(native.pages.map(p=>p.sourceId),['source-1','source-1','source-2']);assert.equal(native.pages.length,3);assert.equal((native.html.match(/<img data-artwork-id=/g)||[]).length,3);
    pages.forEach((page,i)=>{assert.deepEqual(native.pages[i].artwork,page.artwork);assert.deepEqual(native.pages[i].imageFrame,page.imageFrame);assert.ok(page.emptyRatio>=.4);assert.ok(page.contentAreas.every(box=>box.x>=0&&box.y>=0&&box.x+box.w<=1280&&box.y+box.h<=720));});
    for(const field of ['sha256','canvaMediaId']){const repeated=structuredClone(planned);repeated.concepts[0].slides[2].artwork[field]=repeated.concepts[0].slides[0].artwork[field];assert.throws(()=>renderConceptSlides(brief,conceptId,{production:repeated}),/own source-specific artwork/);}
  }
});

test('actual text-image overlap and crowded authored rectangles are rejected despite a forty-percent metadata claim',()=>{
  const overlapping=production();overlapping.concepts[0].slides[0].composition.image={x:620,y:100,width:570,height:300};assert.throws(()=>renderConceptSlides(brief,'editorial',{production:overlapping}),/overlaps/);
  const crowded=production();crowded.concepts[0].slides[0].composition.image={x:0,y:0,width:1280,height:500};assert.throws(()=>renderConceptSlides(brief,'editorial',{production:crowded}),/reflow/);
});
test('partial deck batches remain explicit and retain every completed source with its full original notes',()=>{
  const original=production(),planned={...original,mode:'deck',complete:false,remainingSourceIds:['source-2'],concepts:[{conceptId:'editorial',slides:original.concepts[0].slides.slice(0,1)}]};const pages=renderConceptSlides(brief,'editorial',{production:planned});assert.equal(pages.length,1);assert.ok(pages[0].notes.includes(readConceptSections(brief)[0].audience));planned.complete=true;assert.throws(()=>renderConceptSlides(brief,'editorial',{production:planned}),/partial batch/);
});

test('explicit style and tone binding survives Save/Open and invalidates artwork without changing the live source fingerprint',()=>{
  const styled={...brief,design:'Fine ink with restrained red washes',tone:'Calm and precise'},planned={...production(),style:{design:'Fine ink with restrained red washes',tone:'Calm and precise'}};
  const originalFingerprint=fullSourceFingerprint(styled,'');assert.equal(originalFingerprint,planned.sourceFingerprint);assert.equal(renderConceptSlides(styled,'editorial',{production:planned}).length,3);
  const changed={...styled,design:'Use tactile cut-paper art instead'};assert.equal(fullSourceFingerprint(changed,''),originalFingerprint);assert.throws(()=>renderConceptSlides(changed,'editorial',{production:planned}),/style|tone/i);assert.throws(()=>renderConceptSlides({...styled,tone:'Playful and conversational'},'editorial',{production:planned}),/style|tone/i);
  const images=Object.fromEntries(planned.concepts.flatMap(concept=>concept.slides.map(slide=>[slide.artwork.id,'data:image/png;base64,aGVsbG8='])));assert.throws(()=>renderCanvaTransfer({brief:changed,conceptId:'editorial',production:planned,assetData:{images}}),/style|tone/i);
  const storage=memory(),studio=loadStudio(storage),project=studio.projects[0];Object.assign(project.brief,styled);project.slideProduction=planned;project.slideConcepts=planned;project.pendingAnswer='Keep this thought';persistStudio(storage,studio);const restored=loadStudio(storage).projects[0];assert.deepEqual(restored.slideProduction.style,planned.style);assert.deepEqual(restored.slideConcepts.style,planned.style);const imported=importProject(studio,checkpoint(restored));assert.deepEqual(imported.slideProduction.style,planned.style);assert.equal(imported.pendingAnswer,'Keep this thought');
  assert.equal(cleanSlideProduction({...planned,style:{design:42,tone:'Calm'}}),null,'Malformed binding must not be silently dropped');
});

test('authored text rectangles start at their top edge and three labels form a row for every layout',()=>{
  const planned=production(),slide=planned.concepts[0].slides[0];
  slide.composition={layout:'image-top',emptySpaceMin:.4,headline:{x:80,y:486,width:1050,fontSize:66},copy:{x:80,y:386,width:1120,fontSize:25},image:{x:80,y:80,width:1120,height:280}};
  slide.artwork.width=1600;slide.artwork.height=900;
  const page=renderConceptSlides(brief,'editorial',{production:planned})[0],labels=[...page.svg.matchAll(/<text data-art-role="copy-\d"[^>]* x="([\d.]+)" y="([\d.]+)"/g)];
  assert.equal(labels.length,3);assert.equal(new Set(labels.map(match=>match[2])).size,1);assert.equal(new Set(labels.map(match=>match[1])).size,3);
  assert.equal(page.contentAreas[1].y,486);assert.ok(page.emptyRatio>=.4);
});
