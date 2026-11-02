import {MAX_SLIDE_WORDS,SLIDE_POLICY_VERSION,slideWordCount,isTitleCase} from './slide-policy.js';
export {slideWordCount} from './slide-policy.js';
const ids=['editorial','studio','warm'];
const statuses=['planning','artwork','approval','ready','unavailable','failed'];
const layouts=['image-right','image-left','image-top','statement','comparison','process'];
const text=(value,limit=1000)=>typeof value==='string'?value.slice(0,limit):'';
const numeric=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const cleanBox=(value,image=false)=>value&&numeric(value.x,0,1280)&&numeric(value.y,0,720)&&numeric(value.width,40,1280)&&(image?numeric(value.height,40,720):numeric(value.fontSize,22,120))?{x:value.x,y:value.y,width:value.width,...image?{height:value.height}:{fontSize:value.fontSize}}:undefined;
export const MIN_ARTWORK_RATIO=.12;
export function representativeSourceIds(sections){
  const first=sections[0],demanding=sections.slice(1).sort((a,b)=>((b.blocks?.some(block=>block.kind==='table')?100000:0)+(b.audience?.length||0))-((a.blocks?.some(block=>block.kind==='table')?100000:0)+(a.audience?.length||0)))[0],selected=new Set([first,demanding].filter(Boolean));
  for(const section of sections){if(selected.size>=3)break;selected.add(section);}return sections.filter(section=>selected.has(section)).map(section=>section.id);
}
export function validateSlideSourceMap(slides,sections,{sample=false,expectedIds,remainingSourceIds=[]}={}){
  const sourceIds=sections.map(section=>section.id),expected=expectedIds||(sample?representativeSourceIds(sections):sourceIds.filter(id=>!remainingSourceIds.includes(id)));
  if(sample&&slides.length!==3)throw Error('Create exactly three sample slides in the selected template.');
  if(!slides.length||new Set(slides.map(slide=>slide.id)).size!==slides.length||slides.some(slide=>!slide.id))throw Error('Every planned page needs a unique page ID.');
  if(new Set(remainingSourceIds).size!==remainingSourceIds.length||remainingSourceIds.some(id=>!sourceIds.includes(id))||new Set(expected).size!==expected.length||expected.some(id=>!sourceIds.includes(id)))throw Error('The visual source map is incomplete.');
  const order=slides.map(slide=>sourceIds.indexOf(slide.sourceId));
  if(order.some((at,index)=>at<0||index>0&&at<order[index-1]))throw Error('Keep the planned pages in canonical source order.');
  const covered=[...new Set(slides.map(slide=>slide.sourceId))];if(covered.length!==expected.length||covered.some((id,index)=>id!==expected[index]))throw Error('The planned pages must cover every selected source section.');
}

function cleanArtwork(value){if(!value||typeof value.id!=='string'||!/^\/slide-assets\/[A-Za-z0-9_-]+(?:\.(?:png|jpe?g|webp))?$/.test(value.url||'')||!['image/png','image/jpeg','image/webp'].includes(value.mimeType)||!numeric(value.width,64,16384)||!numeric(value.height,64,16384))return undefined;return {id:text(value.id,150),url:value.url,mimeType:value.mimeType,width:value.width,height:value.height,.../^[a-f0-9]{64}$/.test(value.sha256||'')?{sha256:value.sha256}:{},...['native','preview'].includes(value.quality)?{quality:value.quality}:{},...value.canvaMediaId?{canvaMediaId:text(value.canvaMediaId,200)}:{},...value.openUrl?{openUrl:text(value.openUrl,1000)}:{}};}
function cleanPlan(value){if(!value||typeof value.id!=='string'||typeof value.sourceId!=='string'||!layouts.includes(value.composition?.layout))return null;const composition={layout:value.composition.layout,emptySpaceMin:.4};if(value.composition.labelFlow==='rows')composition.labelFlow='rows';for(const key of ['headline','copy','image']){if(value.composition[key]!==undefined){const box=cleanBox(value.composition[key],key==='image');if(!box)return null;composition[key]=box;}}
  return {id:text(value.id,150),sourceId:text(value.sourceId,150),purpose:text(value.purpose,1000),headline:text(value.headline,500),onSlideText:Array.isArray(value.onSlideText)?value.onSlideText.filter(part=>typeof part==='string').slice(0,8).map(part=>part.slice(0,1500)):[],notes:text(value.notes,100000),sourceAudience:text(value.sourceAudience,100000),originalNotes:text(value.originalNotes,100000),visualAnchors:Array.isArray(value.visualAnchors)?value.visualAnchors.slice(0,4).map(anchor=>({source:text(anchor.source,2000),depiction:text(anchor.depiction,2000)})):[],visualMode:text(value.visualMode,500),visualIdea:text(value.visualIdea,1500),composition,artworkPrompt:text(value.artworkPrompt,6000),artwork:cleanArtwork(value.artwork)};
}
export function productionStyleCurrent(production,brief){return production?.style===undefined||!!production.style&&typeof production.style.design==='string'&&typeof production.style.tone==='string'&&production.style.design===(brief?.design||'')&&production.style.tone===(brief?.tone||'');}
export function cleanSlideProduction(value){
  if(!value||!statuses.includes(value.status)||typeof value.id!=='string'||value.id.length>150||!/^canva-v1-[a-f0-9]{8}$/.test(value.sourceFingerprint||''))return null;
  if(value.style!==undefined&&(!value.style||typeof value.style.design!=='string'||typeof value.style.tone!=='string'))return null;
  const concepts=[];for(const concept of Array.isArray(value.concepts)?value.concepts.slice(0,3):[]){if(!ids.includes(concept?.conceptId)||!Array.isArray(concept.slides)||concept.slides.length>150)return null;const slides=concept.slides.map(cleanPlan);if(slides.some(slide=>!slide))return null;concepts.push({conceptId:concept.conceptId,slides});}
  const result={id:value.id,policyVersion:[1,2,3].includes(value.policyVersion)?value.policyVersion:1,status:value.status,mode:value.mode==='deck'?'deck':'concepts',message:text(value.message,1500),sourceFingerprint:value.sourceFingerprint,complete:value.complete===true,remainingSourceIds:Array.isArray(value.remainingSourceIds)?value.remainingSourceIds.filter(id=>typeof id==='string').slice(0,150):[],concepts};
  if(ids.includes(value.conceptId))result.conceptId=value.conceptId;
  if(value.style!==undefined)result.style={design:value.style.design,tone:value.style.tone};
  if(value.approval&&['string','number'].includes(typeof value.approval.id))result.approval={id:value.approval.id,title:text(value.approval.title,300),message:text(value.approval.message,2000),scope:text(value.approval.scope,1000),prompt:text(value.approval.prompt,6000),aspectRatio:text(value.approval.aspectRatio,50)};
  return result;
}
export function assertProductionPlans({production,sections,conceptId,fingerprint,allowSourceAppend=false}){
  const result=cleanSlideProduction(production);if(!result||result.status!=='ready')throw Error('The visual plans and artwork are still being prepared.');
  if(result.policyVersion!==SLIDE_POLICY_VERSION)throw Error('Prepare fresh visual concepts with fewer than 15 words and content-led graphics. Your earlier source and artwork are saved.');
  if(!allowSourceAppend&&result.sourceFingerprint!==fingerprint)throw Error('The source changed. Prepare visuals for the current manuscript before reviewing this version.');
  const expected=result.mode==='concepts'?(allowSourceAppend?[...new Set(result.concepts[0]?.slides.map(slide=>slide.sourceId)||[])]:representativeSourceIds(sections)):sections.filter(section=>!result.remainingSourceIds.includes(section.id)).map(section=>section.id),seenAssets=new Set(),seenUrls=new Set(),seenHashes=new Set(),seenMedia=new Set();
  if(result.concepts.length!==1||result.mode==='concepts'&&result.conceptId!==result.concepts[0].conceptId)throw Error('Choose one template before creating its three sample slides.');
  for(const concept of result.concepts){validateSlideSourceMap(concept.slides,sections,{sample:result.mode==='concepts',expectedIds:expected,remainingSourceIds:result.remainingSourceIds});
    for(const plan of concept.slides){const section=sections.find(section=>section.id===plan.sourceId);if(!section||plan.sourceAudience!==section.audience||plan.originalNotes!==section.notes)throw Error('The visual plan does not preserve the exact original source and notes.');if(!plan.purpose.trim()||!plan.headline.trim()||!plan.visualMode.trim()||!plan.artworkPrompt.trim())throw Error('Each slide needs its own purpose, visual idea and artwork prompt.');if(slideWordCount([plan.headline,...plan.onSlideText].join(' '))>MAX_SLIDE_WORDS)throw Error('This slide needs fewer than 15 visible words, including its title and labels. The full source remains in its notes.');if(!isTitleCase(plan.headline))throw Error('Every slide title must use Title Case.');const sourceText=section.audience+'\n'+section.notes;if(plan.visualAnchors.length<2||new Set(plan.visualAnchors.map(anchor=>anchor.source)).size!==plan.visualAnchors.length||plan.visualAnchors.some(anchor=>anchor.source.length<8||!sourceText.includes(anchor.source)||!anchor.depiction.trim()))throw Error('The graphic must explain at least two specific source details through a grounded visual plan.');
      if(!plan.artwork)throw Error('A planned image is not generated artwork. Finish this slide’s artwork before review.');if(seenAssets.has(plan.artwork.id)||seenUrls.has(plan.artwork.url)||plan.artwork.sha256&&seenHashes.has(plan.artwork.sha256)||plan.artwork.canvaMediaId&&seenMedia.has(plan.artwork.canvaMediaId))throw Error('Each slide needs its own source-specific artwork; one image cannot stand in for the deck.');seenAssets.add(plan.artwork.id);seenUrls.add(plan.artwork.url);if(plan.artwork.sha256)seenHashes.add(plan.artwork.sha256);if(plan.artwork.canvaMediaId)seenMedia.add(plan.artwork.canvaMediaId);
    }
  }
  const selected=result.concepts.find(concept=>concept.conceptId===conceptId);if(!selected)throw Error('Prepare this art direction before reviewing its slides.');
  if(result.complete&&result.mode==='deck'&&result.remainingSourceIds.length)throw Error('A partial batch cannot be presented as the complete deck.');return {production:result,slides:selected.slides};
}

const frames={
  'image-right':{headline:{x:80,y:130,width:650,fontSize:84},copy:{x:85,y:440,width:590,fontSize:30},image:{x:780,y:225,width:420,height:350}},
  'image-left':{headline:{x:620,y:150,width:575,fontSize:74},copy:{x:650,y:425,width:520,fontSize:30},image:{x:65,y:260,width:475,height:330}},
  'image-top':{headline:{x:640,y:165,width:550,fontSize:72},copy:{x:85,y:490,width:1100,fontSize:29},image:{x:70,y:65,width:500,height:300}},
  statement:{headline:{x:85,y:170,width:1050,fontSize:94},copy:{x:85,y:490,width:500,fontSize:30},image:{x:650,y:340,width:550,height:340}},
  comparison:{headline:{x:85,y:130,width:1000,fontSize:73},copy:{x:85,y:430,width:600,fontSize:27},image:{x:760,y:280,width:440,height:330}},
  process:{headline:{x:85,y:140,width:1100,fontSize:78},copy:{x:550,y:435,width:640,fontSize:27},image:{x:70,y:375,width:440,height:310}}
};
export const slideImageFrame=plan=>plan.composition?.image||frames[plan.composition?.layout]?.image;
export function containedImageFrame(frame,dimensions){const scale=Math.min(frame.width/dimensions.width,frame.height/dimensions.height),width=dimensions.width*scale,height=dimensions.height*scale;return {x:frame.x+(frame.width-width)/2,y:frame.y+(frame.height-height)/2,width,height};}
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function fullNotes(plan,section){let result=plan.notes.trim();if(!result.includes(section.audience))result+='\n\nOriginal audience copy — retained in full:\n'+section.audience;if(section.notes&&!result.includes(section.notes))result+='\n\nOriginal presenter notes:\n'+section.notes;return (`Source slide: ${section.title}\nThis page: ${plan.headline}\nPresenter focus: ${plan.purpose}\n\n`+result).trim();}
export function renderArtPages({brief,concept,sections,production,fingerprint,assetData={},allowSourceAppend=false,requireEmbedded=false},{type,svgPage,rule}){
  if(!productionStyleCurrent(production,brief))throw Error('Your design style or tone changed. Prepare fresh visuals for this direction before reviewing or reusing the artwork.');
  const checked=assertProductionPlans({production,sections,conceptId:concept.id,fingerprint,allowSourceAppend});
  // Authored boxes use top-left coordinates; SVG text and built-in defaults use baselines.
  return checked.slides.map(plan=>{const section=sections.find(section=>section.id===plan.sourceId),s=concept.visualSystem,frame={...frames[plan.composition.layout],...plan.composition},headline={...frame.headline,y:frame.headline.y+(plan.composition.headline?frame.headline.fontSize*.83:0)},copy={...frame.copy,y:frame.copy.y+(plan.composition.copy?frame.copy.fontSize*.83:0)},image=containedImageFrame(frame.image,plan.artwork),heading=type(plan.headline,headline.x,headline.y,headline.width,headline.fontSize,s.headingFont,s.ink,concept.id==='editorial'?400:650,headline.fontSize*1.08);let body=heading.html.replace(/<text\b/g,'<text data-art-role="headline"'),regions=[];
    if(image.width*image.height<1280*720*MIN_ARTWORK_RATIO)throw Error('This artwork is too small to explain the slide. Recompose it as a substantial visual, not a floating thumbnail.');
    const embedded=assetData.images?.[plan.artwork.id];if(requireEmbedded&&!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(embedded||''))throw Error('The exact generated artwork must be embedded before this Canva transfer can be created.');
    body=`<image data-artwork-id="${escape(plan.artwork.id)}" x="${image.x}" y="${image.y}" width="${image.width}" height="${image.height}" preserveAspectRatio="xMidYMid meet" href="${escape(embedded||plan.artwork.url)}" aria-label="${escape(plan.visualIdea||plan.visualMode)}"/>`+body;regions.push({x:image.x,y:image.y,w:image.width,h:image.height});
    if(plan.composition.labelFlow==='rows'){plan.onSlideText.forEach((value,index)=>{const y=image.y+image.height*(index+.5)/plan.onSlideText.length+copy.fontSize*.35;body+=type(value,copy.x,y,copy.width,copy.fontSize,s.bodyFont,s.ink,700,copy.fontSize*1.35).html.replace(/<text\b/g,`<text data-art-role="copy-${index}"`);});}
    else if(plan.onSlideText.length>1&&plan.onSlideText.length<=3){const count=plan.onSlideText.length,gap=40,w=(copy.width-gap*(count-1))/count;plan.onSlideText.forEach((value,index)=>{const x=copy.x+index*(w+gap);body+=rule(x,copy.y-40,w,index===1?s.secondary:s.accent,2)+type(value,x,copy.y,w,copy.fontSize,s.bodyFont,s.ink,500,copy.fontSize*1.35).html.replace(/<text\b/g,`<text data-art-role="copy-${index}"`);});}
    else {let y=copy.y;plan.onSlideText.forEach((value,index)=>{const paragraph=type(value,copy.x,y,copy.width,copy.fontSize,s.bodyFont,s.ink,450,copy.fontSize*1.35);body+=paragraph.html.replace(/<text\b/g,`<text data-art-role="copy-${index}"`);y+=paragraph.height+18;});}
    const notes=fullNotes(plan,section);if(!notes.includes(section.audience)||section.notes&&!notes.includes(section.notes))throw Error('The complete source must remain available in this slide’s notes.');
    const page=svgPage({title:plan.headline,notes,body,concept,regions,kind:plan.composition.layout,sourceId:section.id}),roles=[...body.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].filter(match=>match[2]).map(match=>match[1].match(/data-art-role="([^"]+)"/)?.[1]),textAreas=page.contentAreas.slice(regions.length),overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1;
    if(textAreas.some((area,index)=>overlap(area,regions[0])||textAreas.some((other,at)=>at<index&&roles[at]!==roles[index]&&overlap(area,other))))throw Error('This visual plan needs reflow: audience text overlaps artwork or another text block.');
    return {...page,planId:plan.id,purpose:plan.purpose,visualIdea:plan.visualIdea||plan.visualMode,artwork:plan.artwork,imageFrame:{left:image.x,top:image.y,width:image.width,height:image.height},sourceTitle:section.title};
  });
}
