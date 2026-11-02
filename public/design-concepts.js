import {renderArtPages,productionStyleCurrent,representativeSourceIds,validateSlideSourceMap} from './slide-art.js';
import {MAX_SLIDE_WORDS,slideWordCount,titleCase} from './slide-policy.js';
export {SLIDE_POLICY_VERSION} from './slide-policy.js';
export {cleanSlideProduction,representativeSourceIds,slideWordCount,productionStyleCurrent} from './slide-art.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const plain=value=>String(value??'').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/__([^_]+)__/g,'$1').replace(/`([^`]+)`/g,'$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1 ($2)').replace(/^[-*+]\s+/gm,'');
export const DESIGN_CONCEPTS=[
  {id:'editorial',title:'Quiet editorial',description:'Expressive serif type, restrained vermilion and an open, publication-like rhythm.',fit:'For thoughtful teaching that should feel considered and authoritative.',visualSystem:{headingFont:'DM Serif Display',bodyFont:'DM Sans',composition:'Source-led editorial compositions with deliberate asymmetry',background:'#F8F5ED',ink:'#202A29',accent:'#C9422F',secondary:'#E7DFCE',imagery:'Unique fine-ink illustration with restrained washes for each source slide'}},
  {id:'studio',title:'Signal studio',description:'Condensed headlines, deep midnight and sharp, luminous information graphics.',fit:'For practical technology lessons with energy and technical precision.',visualSystem:{headingFont:'Barlow Condensed',bodyFont:'DM Sans',composition:'Poster-scale type with slide-specific mechanism-led compositions',background:'#102B36',ink:'#F4FBF7',accent:'#B9F267',secondary:'#62D2D5',imagery:'Unique conceptual mechanism imagery with editable audience text'}},
  {id:'warm',title:'Warm dimension',description:'Generous rounded type, warm whites and tactile, sculptural imagery.',fit:'For approachable workshops that make a complex idea feel inviting.',visualSystem:{headingFont:'Manrope',bodyFont:'Manrope',composition:'Source-specific tactile scenes balanced with soft editorial type',background:'#FFF9F2',ink:'#192C56',accent:'#2855D9',secondary:'#F2B28E',imagery:'Unique tactile objects and material scenes derived from each lesson'}}
];
export const isPresentation=brief=>/presentation|slides?|\bdeck\b|\bwebinars?\b/i.test(brief?.format||'');
export const NATIVE_CANVA_POLICY_VERSION=3;
export function sourceFingerprint(brief){
  const source=String(brief?.productDraft||''),headings=[...source.matchAll(/^##\s+.+$/gm)],representative=headings.length?source.slice(headings[0].index,headings[1]?.index??source.length).trim():source.trim();
  let hash=2166136261;for(const char of String(brief?.title||'')+'\u0000'+representative){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619);}return 'sample-v1-'+(hash>>>0).toString(16).padStart(8,'0');
}
export function fullSourceFingerprint(brief,conceptId){let hash=2166136261;for(const char of JSON.stringify([brief?.title||'',brief?.outcome||'',brief?.author||'',brief?.productDraft||'',conceptId])){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619);}return 'canva-v1-'+(hash>>>0).toString(16).padStart(8,'0');}
export const nativeMetadataFingerprint=(brief,conceptId,renderPolicyVersion=NATIVE_CANVA_POLICY_VERSION)=>fullSourceFingerprint({...brief,productDraft:JSON.stringify([brief?.format||'',renderPolicyVersion])},conceptId);
export const nativeSourceBindings=brief=>readConceptSections(brief).filter(section=>section.audience.trim()).map(section=>({id:section.id,signature:fullSourceFingerprint({productDraft:JSON.stringify([section.title,section.audience,section.notes])},'')}));
export function cleanArtworkBinding(value,pageCount){return Array.isArray(value)&&value.length===pageCount&&value.every(item=>typeof item.planId==='string'&&item.planId.length>0&&item.planId.length<=150&&typeof item.sourceId==='string'&&item.sourceId.length>0&&item.sourceId.length<=150&&typeof item.id==='string'&&item.id.length>0&&item.id.length<=150&&/^MA[A-Za-z0-9_-]+$/.test(item.canvaMediaId||'')&&/^[a-f0-9]{64}$/.test(item.sha256||''))&&['planId','id','canvaMediaId','sha256'].every(key=>new Set(value.map(item=>item[key])).size===value.length)?value.map(({planId,sourceId,id,canvaMediaId,sha256})=>({planId,sourceId,id,canvaMediaId,sha256})):null;}
export function artworkBindingOf(pages){return cleanArtworkBinding(pages.map(page=>({planId:page.planId,sourceId:page.sourceId,id:page.artwork?.id,canvaMediaId:page.artwork?.canvaMediaId,sha256:page.artwork?.sha256})),pages.length);}
export function canvaEditorUrl(value){try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port||!['canva.com','www.canva.com'].includes(url.hostname))return null;return /^\/d\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)||/^\/design\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?\/edit\/?$/.test(url.pathname)?url.href:null;}catch{return null;}}
export function cleanCanvaSample(sample){const url=canvaEditorUrl(sample?.url);if(!url||typeof sample.name!=='string'||!sample.name.length||sample.name.length>240||!DESIGN_CONCEPTS.some(concept=>concept.id===sample.conceptId)||!/^canva-v1-[a-f0-9]{8}$/.test(sample.fullSourceFingerprint||''))return null;const clean={url,name:sample.name,conceptId:sample.conceptId,fullSourceFingerprint:sample.fullSourceFingerprint};if(typeof sample.productionId==='string'&&sample.productionId.length>0&&sample.productionId.length<=150)clean.productionId=sample.productionId;if(sample.mode!==undefined){if(!['samples','deck'].includes(sample.mode)||sample.verified!==true||typeof sample.jobId!=='string'||!sample.jobId.length||sample.jobId.length>150||!Number.isInteger(sample.pageCount)||sample.pageCount<1||sample.pageCount>150||sample.mode==='samples'&&sample.pageCount!==3||typeof sample.style?.design!=='string'||typeof sample.style?.tone!=='string')return null;Object.assign(clean,{mode:sample.mode,jobId:sample.jobId,pageCount:sample.pageCount,verified:true,style:{design:sample.style.design,tone:sample.style.tone}});if(typeof sample.sampleFingerprint==='string')clean.sampleFingerprint=sample.sampleFingerprint;if(Number.isInteger(sample.renderPolicyVersion)&&sample.renderPolicyVersion>0)clean.renderPolicyVersion=sample.renderPolicyVersion;const binding=cleanArtworkBinding(sample.artworkBinding,sample.pageCount);if(binding)clean.artworkBinding=binding;if(/^canva-v1-[a-f0-9]{8}$/.test(sample.metadataFingerprint||'')&&Array.isArray(sample.sourceBindings)&&sample.sourceBindings.length>0&&sample.sourceBindings.length<=150&&sample.sourceBindings.every((binding,index)=>binding?.id==='source-'+(index+1)&&/^canva-v1-[a-f0-9]{8}$/.test(binding.signature||''))){clean.metadataFingerprint=sample.metadataFingerprint;clean.sourceBindings=sample.sourceBindings.map(({id,signature})=>({id,signature}));}}return clean;}
export function nativeSampleCurrent(project){const sample=cleanCanvaSample(project.canvaSample);if(!sample?.verified||sample.renderPolicyVersion!==NATIVE_CANVA_POLICY_VERSION||!sample.productionId||!sample.artworkBinding||sample.conceptId!==project.presentationDesign?.conceptId||sample.style.design!==(project.brief?.design||'')||sample.style.tone!==(project.brief?.tone||''))return false;const currentArt=project.slideProduction?.status==='ready'&&productionStyleCurrent(project.slideProduction,project.brief)?project.slideProduction.concepts?.find(concept=>concept.conceptId===sample.conceptId)?.slides:undefined;if(currentArt&&sample.artworkBinding.some(binding=>!currentArt.some(plan=>plan.id===binding.planId&&plan.sourceId===binding.sourceId&&plan.artwork?.id===binding.id&&plan.artwork?.canvaMediaId===binding.canvaMediaId&&plan.artwork?.sha256===binding.sha256)))return false;if(sample.metadataFingerprint&&sample.metadataFingerprint!==nativeMetadataFingerprint(project.brief,sample.conceptId))return false;if(sample.fullSourceFingerprint===fullSourceFingerprint(project.brief,sample.conceptId))return true;const current=nativeSourceBindings(project.brief);return sample.mode==='samples'&&sample.metadataFingerprint===nativeMetadataFingerprint(project.brief,sample.conceptId)&&sample.sourceBindings?.length<=current.length&&sample.sourceBindings.every((binding,index)=>current[index]?.id===binding.id&&current[index]?.signature===binding.signature);}
export function canvaSampleCurrent(project){const sample=cleanCanvaSample(project.canvaSample);return Boolean(sample&&sample.conceptId===project.presentationDesign?.conceptId&&sample.fullSourceFingerprint===fullSourceFingerprint(project.brief,sample.conceptId)&&(!sample.productionId||sample.productionId===project.slideProduction?.id&&productionStyleCurrent(project.slideProduction,project.brief)));}
export function designApprovalCurrent(project){return Boolean(project.presentationDesign?.approved&&DESIGN_CONCEPTS.some(concept=>concept.id===project.presentationDesign.conceptId)&&project.presentationDesign.sourceFingerprint===sourceFingerprint(project.brief));}
export function chooseConcept(project,id){if(!DESIGN_CONCEPTS.some(concept=>concept.id===id))throw Error('Choose one of the three visual directions.');project.presentationDesign={conceptId:id,approved:false,sourceFingerprint:sourceFingerprint(project.brief)};return project.presentationDesign;}
export function approveConcept(project){if(!project.presentationDesign?.conceptId)throw Error('Choose a visual direction first.');project.presentationDesign={...project.presentationDesign,approved:true,sourceFingerprint:sourceFingerprint(project.brief)};return project.presentationDesign;}
export function readConceptSections(brief){
  const manuscript=String(brief?.productDraft||''),starts=[...manuscript.matchAll(/^##\s+(.+)$/gm)];
  const raw=starts.length?starts.map((match,index)=>({id:'source-'+(index+1),title:plain(match[1].trim()),text:manuscript.slice(match.index+match[0].length,starts[index+1]?.index??manuscript.length).trim()})):[{id:'source-1',title:brief?.title||'Your lesson',text:manuscript.replace(/^#\s+[^\n]+\n?/,'').trim()}];
  return raw.map(section=>{const note=/^###\s+(?:Presenter|Speaker) notes:?\s*$/im.exec(section.text),audience=(note?section.text.slice(0,note.index):section.text).trim(),notes=note?section.text.slice(note.index+note[0].length).trim():'';
    const blocks=[];let paragraph=[],table=[];const cells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split(/(?<!\\)\|/).map(cell=>plain(cell.trim()));
    const flush=()=>{if(paragraph.length){blocks.push({kind:'body',text:plain(paragraph.join(' '))});paragraph=[];}if(table.length){const data=table.map(cells);blocks.push({kind:'table',columns:data[0],rows:data.slice(2),text:data.filter((_,index)=>index!==1).flat().join(' ')});table=[];}};
    const lines=audience.split(/\r?\n/);for(let index=0;index<lines.length;index++){const line=lines[index];if(line.includes('|')&&(table.length||lines[index+1]?.includes('|')&&cells(lines[index+1]).every(cell=>/^:?-{3,}:?$/.test(cell)))){if(paragraph.length){blocks.push({kind:'body',text:plain(paragraph.join(' '))});paragraph=[];}table.push(line);continue;}flushTableIfNeeded();if(!line.trim()){flush();continue;}const list=/^\s*(?:[-*+]|\d+[.)])\s+(.+)$/.exec(line);if(list){flush();blocks.push({kind:'list',text:plain(list[1])});}else paragraph.push(line.trim());function flushTableIfNeeded(){if(table.length)flush();}}
    flush();return {...section,audience,notes,blocks};});
}
function measure(text,size){return [...text].reduce((total,char)=>total+( /[ilI.,'’!:;]/.test(char)?.25:/[MW@%]/.test(char)?.85:/\s/.test(char)?.28:.52)*size,0);}
function wrap(text,width,size){const result=[];let line='';for(const word of String(text).split(/\s+/)){if(!word)continue;const candidate=line?line+' '+word:word;if(measure(candidate,size)<=width){line=candidate;continue;}if(line)result.push(line);line='';for(const char of word){if(line&&measure(line+char,size)>width){result.push(line);line='';}line+=char;}}if(line)result.push(line);return result.length?result:[''];}
function type(text,x,y,width,size,font,fill,weight=400,leading=size*1.28){const values=wrap(text,width,size);return {html:values.map((value,index)=>`<text x="${x}" y="${y+index*leading}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(value)}</text>`).join(''),height:values.length*leading};}
const rule=(x,y,w,color,width=1)=>`<line x1="${x}" y1="${y}" x2="${x+w}" y2="${y}" stroke="${color}" stroke-width="${width}"/>`;
function occupiedArea(regions){const xs=[...new Set(regions.flatMap(region=>[region.x,region.x+region.w]))].sort((a,b)=>a-b);let area=0;for(let index=1;index<xs.length;index++){const a=xs[index-1],b=xs[index],ys=regions.filter(region=>region.x<b&&region.x+region.w>a).map(region=>[region.y,region.y+region.h]).sort((a,b)=>a[0]-b[0]);let sum=0,end=-Infinity;for(const [top,bottom]of ys){sum+=Math.max(0,bottom-Math.max(top,end));end=Math.max(end,bottom);}area+=(b-a)*sum;}return area;}
class LayoutOverflow extends Error {}
function svgPage({title,notes='',body,concept,regions,kind,sourceId}){
  const decode=value=>value.replace(/&(?:amp|lt|gt|quot|apos|#39);/g,entity=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'"}[entity]));
  const textRuns=[...body.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].filter(match=>match[2]);
  // Account for the same positioned line boxes emitted by the native HTML transfer.
  const textAreas=textRuns.map(([,attributes,value])=>{const attr=name=>Number(attributes.match(new RegExp('(?:^|\\s)'+name+'="([^"]*)"'))?.[1]),size=attr('font-size');return {x:attr('x'),y:attr('y')-size*.83,w:measure(decode(value),size),h:size*1.2};});
  const contentAreas=[...regions,...textAreas],emptyRatio=1-occupiedArea(contentAreas)/(1280*720);
  if(emptyRatio<.4||contentAreas.some(({x,y,w,h})=>![x,y,w,h].every(Number.isFinite)||x<0||y<0||x+w>1280||y+h>720))throw new LayoutOverflow('This page needs reflow before it can be exported.');
  const visibleBlocks=textRuns.map(match=>decode(match[2]));
  return {title,notes,visibleText:visibleBlocks.join(' '),visibleBlocks,kind,sourceId,emptyRatio,contentAreas,svg:`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" style="stroke:none;stroke-width:0;fill:none" role="img" aria-label="${esc(title)}" data-concept="${concept.id}" data-empty-ratio="${emptyRatio.toFixed(3)}"><rect width="1280" height="720" fill="${concept.visualSystem.background}"/>${body}</svg>`};}
function choiceMark(text,x,y,color){
  const frame=`<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">`;
  if(/submit|details|form/i.test(text))return frame+'<path d="M 1 0 h 66 v 61 h -66 Z M 13 17 h 39 M 13 29 h 25 M 13 43 h 39"/><circle cx="86" cy="31" r="17"/><path d="M 79 31 h 14 m -5 -5 l 5 5 -5 5"/></g>';
  if(/pay|payment|purchase/i.test(text))return frame+'<circle cx="28" cy="30" r="27"/><path d="M 17 24 h 22 M 17 36 h 22 M 68 3 v 54 h 35 V 3 Z M 79 30 h 12"/></g>';
  if(/link|contact/i.test(text))return frame+'<circle cx="29" cy="31" r="27"/><path d="M 29 31 L 77 5 M 62 5 h 15 v 15"/><circle cx="87" cy="49" r="11"/></g>';
  return frame+'<circle cx="28" cy="31" r="27"/><path d="M 55 31 h 29 M 73 21 l 11 10 -11 10"/><circle cx="100" cy="31" r="6"/></g>';
}
function cover(brief,concept,sections,assets){
  const s=concept.visualSystem,title=brief.title||sections[0]?.title||'Your presentation',description=brief.outcome?.length<=300?brief.outcome:plain(sections[0]?.blocks.find(block=>block.kind==='body')?.text||''),rows=sections.find(section=>section.blocks.some(block=>block.kind==='table'))?.blocks.find(block=>block.kind==='table')?.rows,labels=(rows?.map(row=>row[0])||sections[0]?.blocks.filter(block=>block.kind==='list').map(block=>block.text.split(':')[0])||[]).slice(0,3),website=assets.websiteTopic;
  let body='',regions=[],font=s.headingFont,size=concept.id==='studio'?112:concept.id==='warm'?83:91,x=82,y=148,w=concept.id==='editorial'?670:640;
  while(wrap(title,w,size).length*size*1.12>270&&size>48)size-=2;
  const heading=type(title,x,y,w,size,font,s.ink,concept.id==='warm'?650:concept.id==='studio'?600:400,size*1.1);body+=heading.html;regions.push({x,y:y-size,w,h:heading.height+size*.15});
  const subY=Math.max(410,y+heading.height+42),subtitle=type(description||'',86,subY,566,23,s.bodyFont,s.ink,400,31);body+=subtitle.html;regions.push({x:82,y:subY-25,w:570,h:subtitle.height+16});
  if(concept.id==='editorial'){
    const centers=[[970,260],[1100,366],[940,440]];body+=centers.map(([cx,cy],index)=>`<circle cx="${cx}" cy="${cy}" r="100" fill="none" stroke="${index===0?s.accent:s.ink}" stroke-width="${index===0?3:1}"/>`).join('');labels.forEach((label,index)=>{const [cx,cy]=centers[index];body+=type(label,cx-78,cy+7,156,23,s.bodyFont,s.ink,500,28).html;});regions.push({x:830,y:155,w:375,h:390});
    body+=rule(85,625,68,s.accent,3);
  }else if(concept.id==='studio'){
    body+=`<g fill="none" stroke="${s.secondary}" stroke-width="1.5"><ellipse cx="995" cy="350" rx="170" ry="90" transform="rotate(-32 995 350)"/><ellipse cx="995" cy="350" rx="110" ry="168" transform="rotate(-32 995 350)"/><circle cx="995" cy="350" r="48"/></g><circle cx="995" cy="350" r="9" fill="${s.accent}"/>`;
    [[855,240],[1114,315],[931,512]].forEach(([cx,cy],index)=>{body+=`<circle cx="${cx}" cy="${cy}" r="5" fill="${s.accent}"/>`+type(labels[index]||'',cx-52,cy-22,174,21,s.bodyFont,s.ink,500,28).html;});regions.push({x:790,y:170,w:420,h:390});
    body+=rule(86,625,95,s.accent,3);
  }else if(website){
    body+=`<image x="700" y="230" width="510" height="340" href="${esc(assets.warmIllustration||'/assets/warm-digital-products.png')}"/>`;regions.push({x:700,y:230,w:510,h:340});
    body+=`<path d="M 85 626 Q 125 644 181 626" fill="none" stroke="${s.accent}" stroke-width="4"/>`;
  }else{labels.forEach((label,index)=>{const cx=930+index*62,cy=260+index*90;body+=`<circle cx="${cx}" cy="${cy}" r="91" fill="${index===1?s.secondary:'none'}" stroke="${s.accent}" stroke-width="2"/>`+type(label,cx-70,cy,146,24,s.bodyFont,s.ink,650,31).html;});regions.push({x:824,y:160,w:360,h:390});}
  if(brief.author)body+=type(brief.author,86,664,600,17,s.bodyFont,s.ink,500).html;
  return svgPage({title,notes:`Introduce “${title}”.${brief.outcome?' '+brief.outcome:''}`,copy:[title,description,...labels],body,concept,regions,kind:'cover'});
}
function choiceSlide(section,rows,concept,assets){
  const s=concept.visualSystem,editorial=concept.id==='editorial',studio=concept.id==='studio',bodies=section.blocks.filter(block=>block.kind==='body'),intro=bodies[0]?.text||'',closing=bodies.slice(1).map(block=>block.text).join(' '),size=editorial?68:studio?78:58;
  let body=type(section.title,82,114,1080,size,s.headingFont,s.ink,editorial?400:650,size*1.08).html,regions=[{x:80,y:44,w:1080,h:100}],copy=[section.title,intro,...rows.flat(),closing];
  const website=assets.websiteTopic;
  if(editorial){
    body+=type(intro,85,200,1100,23,s.bodyFont,s.ink,400,31).html;regions.push({x:82,y:174,w:1110,h:42});
    rows.forEach(([label,text],index)=>{const x=85+index*400;body+=choiceMark(text,x,270,s.accent)+type(label,x,384,304,43,s.headingFont,s.accent,400,48).html+type(text,x,443,304,24,s.bodyFont,s.ink,400,32).html;regions.push({x:x-2,y:268,w:310,h:312});});
  }else if(studio){
    body+=type(intro,85,305,370,31,s.bodyFont,s.ink,500,41).html;regions.push({x:80,y:250,w:390,h:235});
    rows.forEach(([label,text],index)=>{const y=275+index*125;body+=`<path d="M 495 414 C 555 414 545 ${y-12} 600 ${y-12}" fill="none" stroke="${index===1?s.accent:s.secondary}" stroke-width="1.8"/><circle cx="600" cy="${y-12}" r="4" fill="${s.accent}"/>`+type(label,636,y,550,31,s.headingFont,s.accent,600,38).html+type(text,636,y+39,550,22,s.bodyFont,s.ink,400,29).html;regions.push({x:490,y:y-28,w:700,h:112});});
  }else{
    body+=type(intro,85,201,1110,23,s.bodyFont,s.ink,500,31).html;regions.push({x:82,y:174,w:1110,h:42});
    rows.forEach(([label,text],index)=>{const y=280+index*113;body+=type(label,85,y,650,27,s.bodyFont,s.accent,750,34).html+type(text,85,y+36,650,22,s.bodyFont,s.ink,400,29).html;regions.push({x:82,y:y-30,w:680,h:104});});
    if(website){body+=`<image x="840" y="300" width="370" height="247" href="${esc(assets.warmIllustration||'/assets/warm-digital-products.png')}"/>`;regions.push({x:840,y:300,w:370,h:247});}
  }
  if(closing)body+=type(closing,85,653,1110,23,s.bodyFont,s.ink,500,31).html;
  return svgPage({title:section.title,notes:section.notes,sourceId:section.id,copy,body,concept,regions,kind:'choices'});
}
function compareSlide(section,table,concept,assets){
  const s=concept.visualSystem,editorial=concept.id==='editorial',studio=concept.id==='studio',titleSize=editorial?67:studio?79:57,heading=type(section.title,82,114,960,titleSize,s.headingFont,s.ink,editorial?400:650,titleSize*1.08);
  const bodyBlocks=section.blocks.filter(block=>block.kind!=='table'),intro=bodyBlocks[0]?.text||'',closing=bodyBlocks.slice(1).map(block=>block.text).join(' '),widths=[205,610,235],xs=[82,318,963],copy=[section.title,intro,...table.columns,...table.rows.flat(),closing];
  let body=heading.html+type(intro,85,195,1110,22,s.bodyFont,s.ink,400,29).html;
  if(editorial){
    const regions=[{x:80,y:44,w:1020,h:96},{x:82,y:168,w:1120,h:42}];
    table.rows.forEach((row,index)=>{const x=84+index*400;body+=type(table.columns[0]||'',x,268,295,14,s.bodyFont,s.ink,500).html+type(row[0]||'',x,322,295,40,s.headingFont,s.accent,400,48).html+rule(x,350,64,s.accent,2)+type(table.columns[1]||'',x,386,295,14,s.bodyFont,s.ink,500).html;let y=423;
      String(row[1]||'').split(/\s*→\s*/).forEach((part,at,parts)=>{body+=type(part,x+22,y,273,22,s.bodyFont,s.ink,400,28).html;const h=wrap(part,273,22).length*28;if(at<parts.length-1)body+=`<path d="M ${x+3} ${y-6} v ${h+7}" fill="none" stroke="${s.accent}" stroke-width="1.4"/><circle cx="${x+3}" cy="${y-12}" r="3" fill="${s.accent}"/>`;y+=h+8;});
      body+=type(table.columns[2]||'',x,598,295,14,s.bodyFont,s.ink,500).html+type(row[2]||'',x,632,295,23,s.bodyFont,s.accent,600,29).html;regions.push({x:x-2,y:250,w:302,h:406});});
    if(closing)body+=type(closing,85,692,1110,21,s.bodyFont,s.ink,400,27).html;
    return svgPage({title:section.title,notes:section.notes,sourceId:section.id,copy,body,concept,regions,kind:'comparison'});
  }
  if(concept.id==='warm'){
    const regions=[{x:80,y:44,w:1020,h:96},{x:82,y:168,w:1120,h:42},{x:82,y:240,w:720,h:372}];body+=type(table.columns.join(' · '),85,240,720,14,s.bodyFont,s.ink,500,19).html;
    table.rows.forEach((row,index)=>{const y=286+index*117;body+=type(row[0]||'',85,y,285,27,s.bodyFont,s.ink,750,34).html+type(row[2]||'',386,y,410,22,s.bodyFont,s.accent,700,28).html+type(row[1]||'',85,y+41,710,21,s.bodyFont,s.ink,400,28).html;});
    if(assets.websiteTopic){body+=`<image x="850" y="296" width="355" height="237" href="${esc(assets.warmIllustration||'/assets/warm-digital-products.png')}"/>`;regions.push({x:850,y:296,w:355,h:237});}
    if(closing)body+=type(closing,85,692,1110,21,s.bodyFont,s.ink,400,27).html;
    return svgPage({title:section.title,notes:section.notes,sourceId:section.id,copy,body,concept,regions,kind:'comparison'});
  }
  const regions=[{x:80,y:44,w:1020,h:96},{x:82,y:166,w:1120,h:60},{x:80,y:282,w:1120,h:255},{x:82,y:594,w:1110,h:66}];
  table.columns.forEach((label,index)=>{body+=type(label,xs[index],274,widths[index],15,s.bodyFont,studio?s.secondary:s.ink,600,20).html;});
  table.rows.slice(0,3).forEach((row,index)=>{
    const y=320+index*87,color=studio?(index===1?s.secondary:s.accent):s.accent;
    body+=rule(82,y-31,1114,studio?'#34505B':concept.id==='warm'?'#E5DCD3':'#D6CEBF');
    body+=type(row[0]||'',82,y,205,editorial?29:25,editorial?s.headingFont:s.bodyFont,s.ink,studio||!editorial?650:400,32).html;
    const cells=String(row[1]||'').split(/\s*→\s*/),gap=29,nodeW=(610-gap*(cells.length-1))/cells.length;
    cells.forEach((cell,at)=>{const x=318+at*(nodeW+gap);if(studio){body+=`<circle cx="${x+3}" cy="${y-18}" r="3" fill="${color}"/>`+rule(x+3,y-18,nodeW+18,color,1);}else if(concept.id==='warm'){body+=`<path d="M ${x} ${y+38} Q ${x+nodeW/2} ${y+44} ${x+nodeW} ${y+38}" fill="none" stroke="${s.secondary}" stroke-width="3"/>`;}else body+=rule(x,y+41,nodeW-8,s.accent,1);
      body+=type(cell,x,y,nodeW-10,21,s.bodyFont,s.ink,400,27).html;
      if(at<cells.length-1)body+=`<path d="M ${x+nodeW-2} ${y+11} l 17 0 m -5 -4 l 5 4 -5 4" fill="none" stroke="${color}" stroke-width="1.5"/>`;
    });
    body+=type(row[2]||'',963,y,235,21,s.bodyFont,color,600,27).html;
  });
  if(closing)body+=type(closing,85,623,1100,23,s.bodyFont,s.ink,500,31).html;
  return svgPage({title:section.title,notes:section.notes,sourceId:section.id,copy,body,concept,regions,kind:'comparison'});
}
function contentSlides(section,concept){
  const s=concept.visualSystem,all=section.blocks.flatMap(block=>block.kind==='table'?[block.columns.join(' · '),...block.rows.map(row=>row.join(' — '))]:[block.text]),wrapped=all.flatMap(text=>wrap(text,1080,26));
  const count=Math.max(1,Math.ceil(wrapped.length/9)),per=Math.ceil(wrapped.length/count),pages=[];
  for(let index=0;index<count;index++){const lines=wrapped.slice(index*per,(index+1)*per),title=section.title,heading=type(title,83,120,1000,concept.id==='studio'?77:concept.id==='editorial'?66:56,s.headingFont,s.ink,concept.id==='editorial'?400:650,79);let body=heading.html;
    lines.forEach((line,index)=>{body+=type(line,88,290+index*36,1080,26,s.bodyFont,s.ink,400,36).html;});body+=rule(88,228,concept.id==='editorial'?1100:90,s.accent,concept.id==='studio'?3:1);
    pages.push(svgPage({title,notes:section.notes,sourceId:section.id,copy:[title,...lines],body,concept,regions:[{x:80,y:44,w:1080,h:115},{x:85,y:250,w:1100,h:Math.max(52,lines.length*36+28)}],kind:'teaching'}));
  }return pages;
}
function sectionPages(section,concept,assets){
  const blocks=section.blocks||[],table=blocks[1],lists=blocks.slice(1,4),choices=lists.map(block=>block.kind==='list'&&/^([^:]{1,42}):\s+(.+)$/.exec(block.text));
  const framed=blocks[0]?.kind==='body'&&(blocks.length===2||blocks.length===3&&blocks[2].kind==='body');
  try{
    if(framed&&table?.kind==='table'&&table.columns.length===3&&table.rows.length>0&&table.rows.length<=3&&table.rows.every(row=>row.length===3&&row.every(cell=>cell.length<=115)))return [compareSlide(section,table,concept,assets)];
    if(blocks[0]?.kind==='body'&&(blocks.length===4||blocks.length===5&&blocks[4].kind==='body')&&choices.length===3&&choices.every(Boolean))return [choiceSlide(section,choices.map(match=>[match[1]+':',match[2]]),concept,assets)];
  }catch(error){if(!(error instanceof LayoutOverflow))throw error;}
  return contentSlides(section,concept);
}
function assertSourceComplete(section,pages){
  // Check the source before drawn runs become the native readback's expected copy.
  const normalize=value=>String(value).replace(/[\s→]/g,''),headline=normalize(section.title);
  const drawn=normalize(pages.flatMap(page=>{const runs=[...page.visibleBlocks];let heading='';while(runs.length&&heading.length<headline.length)heading+=normalize(runs.shift());if(heading!==headline||page.notes!==section.notes)throw Error('The source heading or presenter notes were not preserved.');return runs;}).join(' '));
  let cursor=0;for(const block of section.blocks){const atoms=block.kind==='table'?[...block.columns,...block.rows.flat()]:[block.text],ends=atoms.map(atom=>{const text=normalize(atom),at=drawn.indexOf(text,cursor);if(at<0)throw Error('The rendered pages do not contain every approved source block.');return at+text.length;});cursor=Math.max(cursor,...ends);}
}
export function artDirectedProduction(production){return {...production,concepts:production.concepts.map(concept=>({...concept,slides:concept.slides.map(plan=>plan.composition?.layout==='comparison'&&plan.onSlideText?.length===3&&/(?:three|3)\s+(?:separate\s+)?(?:horizontal\s+)?(?:rows|lanes)|(?:rows|lanes)\s+stacked\s+vertically/i.test([plan.artworkPrompt,...(plan.visualAnchors||[]).map(anchor=>anchor.depiction)].join(' '))?{...plan,composition:{...plan.composition,labelFlow:'rows',copy:{x:130,y:170,width:240,height:450,fontSize:Math.max(32,plan.composition.copy?.fontSize||24)},image:{x:360,y:170,width:840,height:450}}}:plan)}))};}
export function renderConceptSlides(brief,conceptId,{mode='sample',assetData={},slides,production,allowSourceAppend=false,requireEmbedded=false}={}){
  const concept=DESIGN_CONCEPTS.find(concept=>concept.id===conceptId);if(!concept)throw Error('Choose a valid visual direction.');const sections=slides||readConceptSections(brief),assets={...(typeof assetData==='string'?{warmIllustration:assetData}:assetData),websiteTopic:/website|web\s*(?:site|page)|landing page/i.test([brief.title,brief.topic,brief.outcome,sections[0]?.title,sections[0]?.audience].join(' '))};
  if(production)return renderArtPages({brief,concept,sections,production:artDirectedProduction(production),fingerprint:fullSourceFingerprint(brief,''),assetData:assets,allowSourceAppend,requireEmbedded},{type,svgPage,rule});
  const demanding=sections.find(section=>section.blocks?.some(block=>block.kind==='table')),selected=mode==='full'?sections:[...new Set([sections[0],demanding].filter(Boolean))],result=[cover(brief,concept,sections,assets)];
  for(const section of selected){const pages=sectionPages(section,concept,assets);assertSourceComplete(section,pages);result.push(...pages);}return result;
}
export function fontCss(assetData={}){const data=typeof assetData==='object'?assetData:{},fonts=data.fonts||{};return [['DM Serif Display','DMSerifDisplay'],['DM Sans','DMSans'],['Barlow Condensed','BarlowCondensed'],['Manrope','Manrope']].map(([family,file])=>`@font-face{font-family:'${family}';src:url('${fonts[file]||'/assets/fonts/'+file+'.ttf'}') format('truetype');font-weight:${file==='DMSerifDisplay'?'400':file==='BarlowCondensed'?'600':'100 900'};font-style:normal;font-display:swap}`).join('');}
export const NATIVE_GRAPHIC_SYMBOLS=['person','document','screen','form','payment','check','package','decision'];
export const NATIVE_GRAPHIC_KINDS=['process','comparison','relationship','decision','statement'];
export function bindNativeCanvaPlans(raw,brief,conceptId,{sample=true,sources=readConceptSections(brief).filter(section=>section.audience.trim())}={}){
  if(!Array.isArray(raw?.slides)||!raw.slides.length||raw.slides.length>150)throw Error('Return a complete source-specific native slide plan.');
  const plans=raw.slides.map((slide,index)=>{
    const source=sources.find(source=>source.id===slide?.sourceId);
    if(!source||typeof slide.purpose!=='string'||slide.purpose.length<12||slide.purpose.length>600||typeof slide.headline!=='string'||!slide.headline.trim()||slide.headline.length>100||!NATIVE_GRAPHIC_KINDS.includes(slide.kind)||!Array.isArray(slide.nodes)||slide.nodes.length<2||slide.nodes.length>4||slide.nodes.some(node=>typeof node.label!=='string'||!node.label.trim()||node.label.length>50||!NATIVE_GRAPHIC_SYMBOLS.includes(node.symbol)))throw Error('Each native slide needs a grounded purpose, concise title and two to four labeled explanatory elements.');
    const headline=titleCase(slide.headline),nodes=slide.nodes.map(node=>({label:node.label,symbol:node.symbol}));
    if(slideWordCount(headline+' '+nodes.map(node=>node.label).join(' '))>MAX_SLIDE_WORDS)throw Error('Keep the title and every diagram label to at most14 visible words in total.');
    const text=source.audience+'\n'+source.notes,anchors=slide.visualAnchors;
    if(nodes.some(node=>node.symbol==='package')&&/digital|download|website|online access|access the guide/i.test(text)&&!/physical|parcel|shipping|shipment|shipped|courier|warehouse|printed|tangible/i.test(text))throw Error('Use a document or screen for digital access; a package icon requires explicit physical delivery in the source.');
    if(!Array.isArray(anchors)||anchors.length<2||anchors.length>4||anchors.some(anchor=>typeof anchor.source!=='string'||anchor.source.length<8||anchor.source.length>200||!text.includes(anchor.source)||typeof anchor.depiction!=='string'||anchor.depiction.length<12||anchor.depiction.length>300)||new Set(anchors.map(anchor=>anchor.source)).size!==anchors.length)throw Error('Each native graphic needs two distinct exact source anchors and a concrete explanation of their visual representation.');
    if(!Array.isArray(slide.links)||slide.links.length>6||slide.links.some(link=>!Number.isInteger(link.from)||!Number.isInteger(link.to)||link.from<0||link.to<0||link.from>=nodes.length||link.to>=nodes.length||link.from===link.to))throw Error('Native graphic relationships must connect actual elements on this page.');
    validateNativeRelationships(slide);
    return {id:`${conceptId}-native-${source.id}-${index+1}`,sourceId:source.id,sourceTitle:source.title,sourceAudience:source.audience,originalNotes:source.notes,purpose:slide.purpose,headline,kind:slide.kind,nodes,links:slide.links.map(({from,to})=>({from,to})),visualAnchors:anchors.map(({source,depiction})=>({source,depiction}))};
  });
  const expected=sample?representativeSourceIds(sources):sources.map(source=>source.id);validateSlideSourceMap(plans,sources,{sample,expectedIds:expected});
  if(new Set(plans.map(plan=>plan.sourceId+'|'+plan.purpose)).size!==plans.length)throw Error('Sample pages from one source need distinct teaching purposes.');
  renderNativeCanvaPages(brief,conceptId,plans);return plans;
}
function validateNativeRelationships(plan){
  if(['comparison','statement'].includes(plan.kind)&&plan.links.length)throw Error('Comparison alternatives and statement elements must not be linked as sequential stages. Use no links.');
  if(plan.kind==='decision'&&(plan.nodes.length<3||plan.links.length!==plan.nodes.length-1||plan.links.some(link=>link.from!==0||link.to===0)||new Set(plan.links.map(link=>link.to)).size!==plan.nodes.length-1))throw Error('A decision needs one hub at node0, branching directly to every alternative. Never chain the alternatives.');
  if(plan.kind==='process'&&(plan.links.length!==plan.nodes.length-1||plan.links.some((link,index)=>link.from!==index||link.to!==index+1)))throw Error('Only a true process uses chronological arrows, connecting each adjacent step in order.');
}
function nativeSymbol(symbol,x,y,color,accent){
  const parts={person:'<circle cx="60" cy="30" r="22"/><path d="M18 110v-13a42 42 0 0 1 84 0v13"/>',document:'<path d="M24 8h53l23 24v80H24z M77 8v24h23 M39 54h45 M39 72h45 M39 90h28"/>',screen:'<rect x="5" y="13" width="110" height="77" rx="7"/><path d="M60 90v20 M35 111h50"/>',form:'<rect x="17" y="5" width="86" height="110" rx="7"/><path d="M32 29h57 M32 49h57 M32 69h33"/><rect x="32" y="87" width="57" height="14" rx="5"/>',payment:'<rect x="5" y="24" width="110" height="72" rx="10"/><path d="M5 45h110 M22 77h26"/>',check:'<circle cx="60" cy="60" r="49"/><path d="m32 60 19 20 38-42"/>',package:'<path d="m11 33 49-25 49 25v58l-49 25-49-25z M11 33l49 25 49-25 M60 58v58 M36 20l49 25"/>',decision:'<path d="m60 4 56 56-56 56L4 60z M40 60h40 M60 40v40"/>'};
  return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${parts[symbol]}</g><circle cx="${x+114}" cy="${y+9}" r="5" fill="${accent}"/>`;
}
export function renderNativeCanvaPages(brief,conceptId,plans){
  const concept=DESIGN_CONCEPTS.find(concept=>concept.id===conceptId);if(!concept)throw Error('Choose one visual direction.');const s=concept.visualSystem;
  return plans.map(plan=>{
    validateNativeRelationships(plan);
    const heading=type(plan.headline,80,120,1120,62,s.headingFont,s.ink,600);if(heading.height>170)throw Error('Shorten the native title so its editable text fits above the graphic.');
    const spacing=1020/plan.nodes.length,decision=plan.kind==='decision',y=plan.kind==='comparison'?350:330,positions=decision?plan.nodes.map((_,index)=>index===0?{x:640,y:245}:{x:250+(index-1)*780/(plan.nodes.length-2),y:450}):plan.nodes.map((_,index)=>({x:130+spacing*(index+.5),y})),regions=[decision?{x:160,y:245,w:1000,h:400}:{x:130,y:y-20,w:1020,h:240}];
    let body=rule(80,190,64,s.accent,4)+heading.html;
    for(const link of plan.links){const from=positions[link.from],to=positions[link.to];if(decision){body+=`<path data-native-relationship="decision" d="M${from.x} ${from.y+120} V420 H${to.x} V438 M${to.x-8} 426 L${to.x} 438 L${to.x+8} 426" fill="none" stroke="${s.accent}" stroke-width="3"/>`;}else{const direction=Math.sign(to.x-from.x),end=to.x-direction*78;body+=`<path data-native-relationship="${esc(plan.kind)}" d="M${from.x+direction*74} ${y+60} H${end}${plan.kind==='process'?` M${end-direction*12} ${y+52} L${end} ${y+60} L${end-direction*12} ${y+68}`:''}" fill="none" stroke="${s.accent}" stroke-width="3"/>`;}}
    for(const [index,node]of plan.nodes.entries()){const position=positions[index],labelWidth=decision?(index===0?270:330):spacing*.86;body+=nativeSymbol(node.symbol,position.x-60,position.y,s.ink,s.accent);const label=type(node.label,decision&&index===0?position.x+90:position.x-labelWidth/2,decision&&index===0?position.y+68:position.y+158,labelWidth,27,s.bodyFont,s.ink,500);if(label.height>82)throw Error('Shorten each native diagram label so it stays readable and separate.');body+=label.html;}
    const notes=`${plan.sourceTitle}\n\nOriginal audience source:\n${plan.sourceAudience}\n\nOriginal presenter notes:\n${plan.originalNotes}`;
    return {...svgPage({title:plan.headline,notes,body,concept,regions,kind:'native-'+plan.kind,sourceId:plan.sourceId}),planId:plan.id};
  });
}
export function renderCanvaTransfer({brief,conceptId,slides,assetData={},production,nativePlans}){const pages=nativePlans?renderNativeCanvaPages(brief,conceptId,nativePlans):renderConceptSlides(brief,conceptId,{mode:'full',assetData,slides,production,requireEmbedded:!!production});const html=pages.map(page=>{const texts=[],images=[];const graphic=page.svg.replace(/<text\b([^>]*)>([\s\S]*?)<\/text>/g,(_,attrs,value)=>{const attr=name=>attrs.match(new RegExp('(?:^|\\s)'+name+'="([^"]*)"'))?.[1]||'',size=Number(attr('font-size')),x=Number(attr('x')),y=Number(attr('y'));texts.push(`<div style="position:absolute;left:${x}px;top:${y-size*.83}px;${nativePlans||production?`height:${size*1.2}px;margin:0;padding:0;`:''}white-space:pre;font-family:'${attr('font-family')}';font-size:${size}px;font-weight:${attr('font-weight')};line-height:1.2;color:${attr('fill')}">${value}</div>`);return '';}).replace(/<image\b([^>]*)\/>/g,(_,attrs)=>{const attr=name=>attrs.match(new RegExp('(?:^|\\s)'+name+'="([^"]*)"'))?.[1]||'';images.push(`<img data-artwork-id="${attr('data-artwork-id')}" alt="${attr('aria-label')}" src="${attr('href')}" style="position:absolute;left:${attr('x')}px;top:${attr('y')}px;width:${attr('width')}px;height:${attr('height')}px;object-fit:contain">`);return '';});return `<section data-document-role="page" data-label="${esc(page.title)}" data-speaker-notes="${esc(page.notes)}">${graphic}${images.join('')}${texts.join('')}</section>`;}).join('');return {html:`<!doctype html><html><head><meta charset="utf-8"><style>${fontCss(assetData)}*{box-sizing:border-box}body{margin:0}section{width:1280px;height:720px;position:relative;overflow:hidden;break-after:page}svg{display:block;width:1280px;height:720px;position:absolute;inset:0}</style></head><body>${html}</body></html>`,pages:pages.map(({title,visibleText,visibleBlocks,notes,sourceId,planId,artwork,imageFrame})=>({title,visibleText,visibleBlocks,notes,...sourceId?{sourceId}:{},...artwork?{planId,artwork,imageFrame}:{}}))};}
export const canvaConceptHtml=options=>renderCanvaTransfer(options).html;
