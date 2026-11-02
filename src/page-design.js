import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import fontkit from '@pdf-lib/fontkit';

export const draftLabel='DRAFT SAMPLE — for review';
export const geometry={width:595.28,height:841.89,margin:52,bottom:772};
export function geometryForFormat(format=''){return /presentation|slides?|\bdeck\b|\bwebinars?\b/i.test(format)?{width:960,height:540,margin:64,bottom:474}:geometry;}
export const fontBytes={regular:readFileSync(new URL('../fonts/Lato-Regular.ttf',import.meta.url)),bold:readFileSync(new URL('../fonts/Lato-Bold.ttf',import.meta.url))};
const metrics={regular:fontkit.create(fontBytes.regular),bold:fontkit.create(fontBytes.bold)};
export const themes={clay:{accent:'934C37',pale:'F3E7DF',paper:'FFFCF8',ink:'292D29',muted:'62675F'},sage:{accent:'376451',pale:'E6EEE7',paper:'FCFCF8',ink:'25382F',muted:'5D6A61'},ink:{accent:'2D5575',pale:'E7EEF4',paper:'FCFCFD',ink:'233441',muted:'5D6B77'}};
const layouts=new Set(['teaching','example','exercise','checklist','summary','steps']);
export function plain(text) {
  return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'$1 ($2)')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1 ($2)')
    .replace(/\*\*([^*]+)\*\*/g,'$1').replace(/__([^_]+)__/g,'$1')
    .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g,'$1').replace(/\*([^*\n]+)\*/g,'$1')
    .replace(/`([^`]+)`/g,'$1');
}
export function parseManuscript(markdown,{writingFields=false}={}) {
  const blocks=[];let paragraph=[],code=false,tableLines=[],fieldGroup=0;
  const flush=()=>{if(paragraph.length){blocks.push({kind:'body',text:plain(paragraph.join(' '))});paragraph=[];}};
  const cells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split(/(?<!\\)\|/).map(cell=>plain(cell.trim().replace(/\\\|/g,'|')));
  const sourceLines=markdown.replace(/\r/g,'').split('\n'),hasPipe=line=>/(?<!\\)\|/.test(line||'');
  const delimiter=line=>hasPipe(line)&&cells(line).every(cell=>/^:?-{3,}:?$/.test(cell));
  const flushTable=()=>{
    if(!tableLines.length)return;
    const parsed=tableLines.map(cells);
    if(parsed.length>=2&&parsed[0].length===parsed[1].length&&parsed[1].every(cell=>/^:?-{3,}:?$/.test(cell))){const columns=parsed[0],rows=parsed.slice(2);blocks.push({kind:'table',columns,rows,text:[columns,...rows].map(row=>row.join(' | ')).join('\n')});}
    else for(const line of tableLines)blocks.push({kind:'body',text:plain(line.trim())});
    tableLines=[];
  };
  for(const [index,line]of sourceLines.entries()){
    const tableStart=hasPipe(line)&&delimiter(sourceLines[index+1])&&cells(line).length===cells(sourceLines[index+1]).length;
    if(!code&&!/^\s*(?:```|~~~)/.test(line)&&(/^\s*\|/.test(line)||tableStart||tableLines.length&&hasPipe(line))){flush();tableLines.push(line);continue;}
    flushTable();
    if(/^\s*```|^\s*~~~/.test(line)){flush();code=!code;continue;}
    if(code){flush();blocks.push({kind:'code',text:line||' '});continue;}
    // Underscore answer blanks are working space in written products. Keep the
    // default parser unchanged for presentation source and source validation.
    if(writingFields&&/_{3,}\s*$/.test(line)){
      const label=line.replace(/\s*_{3,}\s*$/,'').trim();
      if(label)flush();
      const source=label||paragraph.join(' ');paragraph=[];
      blocks.push({kind:'field',text:plain(source),group:fieldGroup,bold:/^\*\*.+\*\*$/.test(source)});
      continue;
    }
    const heading=/^(#{1,6})\s+(.+)$/.exec(line);
    const list=/^\s*[-*+]\s+(?:\[([ xX])\]\s*)?(.*)$/.exec(line);
    if(heading){flush();blocks.push({kind:'heading',level:heading[1].length,text:plain(heading[2])});}
    else if(list){flush();blocks.push({kind:'list',text:plain(list[2]),...(list[1]!==undefined?{checked:list[1].toLowerCase()==='x'}:{bullet:true})});}
    else if(/^\s*\d+[.)]\s+/.test(line)){flush();blocks.push({kind:'list',ordered:true,text:plain(line.trim())});}
    else if(!line.trim()||/^\s*([-*_])\1{2,}\s*$/.test(line)){flush();fieldGroup++;}
    else if(/^\s*>/.test(line)){flush();blocks.push({kind:'quote',text:plain(line.replace(/^\s*>\s?/,''))});}
    else paragraph.push(line.trim());
  }
  flush();flushTable();return blocks;
}
export function textWidth(text,size=11.4,bold=false){return metrics[bold?'bold':'regular'].layout(text).glyphs.reduce((n,g)=>n+g.advanceWidth,0)*size/metrics.regular.unitsPerEm;}
export function wrapText(text,size,width,bold=false){
  const lines=[];let current='';
  for(const word of text.split(/\s+/)){
    if(!word)continue;
    const candidate=current?`${current} ${word}`:word;
    if(textWidth(candidate,size,bold)<=width){current=candidate;continue;}
    if(current){lines.push(current);current='';}
    for(const character of word){if(current&&textWidth(current+character,size,bold)>width){lines.push(current);current='';}current+=character;}
  }
  if(current)lines.push(current);return lines.length?lines:[''];
}
const normalize=text=>text.trim().toLowerCase().replace(/\s+/g,' ');
export function readDesignPlan(value){
  const result=new Map();
  try{
    const plan=JSON.parse(value||'{}');
    if(!Array.isArray(plan.sections)||plan.sections.length>100)return result;
    for(const section of plan.sections){
      if(typeof section?.heading==='string'&&section.heading.length<=300&&layouts.has(section.layout))result.set(normalize(section.heading),{layout:section.layout,purpose:typeof section.purpose==='string'?section.purpose.slice(0,160):''});
    }
  }catch{}
  return result;
}
function inferredLayout(section){
  const heading=section.title.toLowerCase();
  if(/checklist|before you send|ready to/.test(heading)||section.blocks.filter(v=>'checked' in v).length>1)return 'checklist';
  if(/worksheet|exercise|practice|your turn|try it/.test(heading))return 'exercise';
  if(/example|case study|demonstration/.test(heading))return 'example';
  if(/summary|takeaway|next action|next useful|recap/.test(heading))return 'summary';
  if(/steps|process|workflow|sequence/.test(heading)&&section.blocks.filter(v=>v.ordered).length>=2)return 'steps';
  return 'teaching';
}
const purposes={cover:'Introduce the product and its intended use',teaching:'Understand the idea and its practical judgment',steps:'Follow the sequence in the manuscript',example:'See the idea in a concrete example',exercise:'Apply the method to your own situation',checklist:'Review the actual criteria before continuing',summary:'Choose the next useful action'};
function validateGlyphs(text){
  for(const character of new Set(text))if(!/\s/.test(character)&&!metrics.regular.hasGlyphForCodePoint(character.codePointAt(0)))throw new Error(`The product font cannot render “${character}”. Replace that symbol or use a supported manuscript language before exporting. Your draft is unchanged.`);
}
export async function safeCoverImage(value){
  if(value===undefined||value===null||value==='')return null;
  if(typeof value!=='string')throw new Error('Choose a PNG or JPEG cover image of 1 MB or less.');
  const match=/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if(!match||match[2].length>Math.ceil(1024*1024/3)*4)throw new Error('Choose a PNG or JPEG cover image of 1 MB or less.');
  const bytes=Buffer.from(match[2],'base64');
  if(!bytes.length||bytes.length>1024*1024||bytes.toString('base64')!==match[2])throw new Error('Choose a valid PNG or JPEG image of 1 MB or less.');
  if(match[1]==='png'){
    if(bytes.length<24||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.subarray(12,16).toString()!=='IHDR')throw new Error('Choose a genuine PNG image.');
    const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
    if(!width||!height||width>12000||height>12000||width*height>24000000)throw new Error('The cover image is too large in pixels. Choose a PNG or JPEG up to 24 megapixels and 1 MB.');
  }
  // Decode with the same library used by the PDF exporter, rather than trusting the MIME label.
  const {PDFDocument}=await import('pdf-lib');const check=await PDFDocument.create();let image;
  // pdf-lib's JPEG decoder reads the entire backing ArrayBuffer. A pooled Node
  // Buffer can have a nonzero offset, so provide an owned, exact-size byte array.
  const ownedBytes=Uint8Array.from(bytes);
  try{image=match[1]==='png'?await check.embedPng(ownedBytes):await check.embedJpg(ownedBytes);}catch{throw new Error('The cover image could not be read. Choose a valid PNG or JPEG.');}
  if(image.width>12000||image.height>12000||image.width*image.height>24000000)throw new Error('The cover image is too large in pixels. Choose a PNG or JPEG up to 24 megapixels and 1 MB.');
  return {data:value,bytes:ownedBytes,mime:match[1],width:image.width,height:image.height};
}
const rect=(page,x,y,w,h,fill,role,stroke)=>page.items.push({type:'rect',x,y,w,h,fill,role,stroke});
const line=(page,x,y,x2,y2,stroke,width=1,role)=>page.items.push({type:'line',x,y,x2,y2,stroke,width,role});
const text=(page,value,x,y,size,fill,bold=false,role)=>page.items.push({type:'text',text:value,x,y,size,fill,bold,h:size*1.48,role});
function addTextLines(page,value,x,y,size,width,fill,bold=false,leading=size*1.48){
  for(const valueLine of wrapText(value,size,width,bold)){text(page,valueLine,x,y,size,fill,bold);y+=leading;}return y;
}
function shortLabel(value,max=68){return value.length>max?value.slice(0,max-1)+'…':value;}
function coverExcerpt(value,size,width,bold,maxLines){
  const all=wrapText(value,size,width,bold);if(all.length<=maxLines)return all;
  const result=all.slice(0,maxLines);let last=result.at(-1);while(last&&textWidth(last+'…',size,bold)>width)last=last.slice(0,-1);result[result.length-1]=last+'…';return result;
}

// Presentation composition uses the same editable primitives as guides. Relationships
// come only from source tables, labeled alternatives, ordered steps or explicit arrows.
function presentationPages({brief,title,sections,theme,image,longOutcome,draft}){
  const W=960,H=540,M=64,BOTTOM=474,pages=[],G=geometryForFormat(brief.format),usable=W-2*M;
  const put=(page,value,x,y,size,w,{bold=false,fill=theme.ink,role='body'}={})=>{
    page.items.push({type:'text',text:value,x,y,size,w,h:size*1.25,bold,fill,role});
  };
  const lines=(page,values,x,y,size,w,style={},leading=size*1.3)=>{for(const value of values){put(page,value,x,y,size,w,style);y+=leading;}return y;};
  const paragraph=(value,{size=23,bold=false,role='body',width=usable,leading=30}={})=>{
    const wrapped=wrapText(value,size,width,bold),limit=Math.floor(300/leading),count=Math.ceil(wrapped.length/limit),per=Math.ceil(wrapped.length/count),units=[];
    for(let start=0;start<wrapped.length;start+=per){const part=wrapped.slice(start,start+per);units.push({h:part.length*leading+12,draw:(page,y)=>lines(page,part,M,y,size,width,{bold,role},leading)});}return units;
  };
  const arrow=(page,x,y,x2,role)=>{line(page,x,y,x2,y,theme.accent,1.7,role);line(page,x2-5,y-4,x2,y,theme.accent,1.7,role);line(page,x2-5,y+4,x2,y,theme.accent,1.7,role);};
  const journey=(page,parts,x,y,w,h)=>{
    const gap=20,nodeW=(w-gap*(parts.length-1))/parts.length;
    parts.forEach((part,index)=>{const at=x+index*(nodeW+gap),wrapped=wrapText(part,17.5,nodeW-14),top=y+(h-wrapped.length*22)/2;
      rect(page,at,y,nodeW,h,theme.pale,'journey-node');
      lines(page,wrapped,at+7,top,17.5,nodeW-14,{role:'table-cell'},22);
      if(index<parts.length-1)arrow(page,at+nodeW+3,y+h/2,at+nodeW+gap-3,'journey-connector');
    });
  };
  const compareList=blocks=>{
    const rows=blocks.map(block=>{const match=/^([^:]{1,42}:)\s+(.+)$/.exec(block.text);return match?{label:match[1],description:match[2]}:null;});
    if(rows.some(row=>!row))return null;
    if(rows.length<=3){
      const gap=28,column=(usable-gap*(rows.length-1))/rows.length,labels=rows.map(row=>wrapText(row.label,24,column-24,true)),bodies=rows.map(row=>wrapText(row.description,22,column-12));
      const labelH=Math.max(...labels.map(values=>values.length))*31+14,bodyH=Math.max(...bodies.map(values=>values.length))*28,height=48+labelH+12+bodyH+10;
      if(height<=306)return {h:height,draw(page,y){
        const center=W/2,first=M+column/2,last=W-M-column/2;
        line(page,center,y+2,center,y+18,theme.accent,1.7,'choice-connector');line(page,first,y+18,last,y+18,theme.accent,1.7,'choice-connector');
        page.items.push({type:'ellipse',x:center-3,y:y-1,w:6,h:6,fill:theme.accent,role:'choice-origin'});
        rows.forEach((row,index)=>{const x=M+index*(column+gap),at=x+column/2;line(page,at,y+18,at,y+40,theme.accent,1.7,'choice-connector');line(page,at-4,y+35,at,y+40,theme.accent,1.7,'choice-connector');line(page,at+4,y+35,at,y+40,theme.accent,1.7,'choice-connector');rect(page,x,y+48,column,labelH,undefined,'choice-node',theme.accent);lines(page,labels[index],x+12,y+55,24,column-24,{bold:true,fill:theme.accent,role:'comparison-label'},31);lines(page,bodies[index],x+6,y+48+labelH+12,22,column-12,{role:'list'},28);});
      }};
    }
    const widths={label:210,body:usable-234},rowsWithLines=rows.map(row=>({...row,labelLines:wrapText(row.label,25,widths.label,true),bodyLines:wrapText(row.description,22,widths.body)}));
    const heights=rowsWithLines.map(row=>Math.max(row.labelLines.length*31,row.bodyLines.length*28)+12);
    if(heights.reduce((sum,h)=>sum+h,0)>306)return null;
    return {h:heights.reduce((sum,h)=>sum+h,0)+4,draw(page,y){rowsWithLines.forEach((row,index)=>{line(page,M,y-6,W-M,y-6,theme.pale,1,'comparison-divider');lines(page,row.labelLines,M,y,25,widths.label,{bold:true,fill:theme.accent,role:'comparison-label'},31);lines(page,row.bodyLines,M+234,y,22,widths.body,{role:'list'},28);y+=heights[index];});}};
  };
  const tableUnits=block=>{
    const count=Math.max(block.columns.length,...block.rows.map(row=>row.length)),journeyColumn=block.columns.findIndex((_,column)=>block.rows.filter(row=>row[column]?.includes('→')).length>=Math.max(1,block.rows.length-1));
    const pathway=count===3&&journeyColumn===1;
    const widths=pathway?[154,440,198]:Array(count).fill(usable/count),gaps=pathway?[0,20,20]:Array(count).fill(0);
    const positions=[];let offset=M;for(let index=0;index<count;index++){offset+=gaps[index];positions.push(offset);offset+=widths[index];}
    const headerH=Math.max(...block.columns.map((cell,index)=>wrapText(cell,16,widths[index]-12,true).length))*21+10;
    const rowUnits=block.rows.map(row=>{
      const wrapped=row.map((cell,index)=>wrapText(cell,pathway&&index===0?22:19,widths[index]-14,pathway&&index!==1));
      const parts=pathway?(row[1]||'').split(/\s*→\s*/):[];
      const nodeW=pathway?(widths[1]-20*(parts.length-1))/parts.length:0;
      const nodeHeight=pathway?Math.max(...parts.map(part=>wrapText(part,17.5,nodeW-14).length))*22+14:0;
      const height=Math.max(42,nodeHeight,...wrapped.filter((_,index)=>!pathway||index!==1).map(values=>values.length*(pathway?25:26)+12))+10;
      if(height>280||pathway&&(parts.length>5||nodeW<72))return {fallback:true,row};
      return {h:height,draw(page,y){
        line(page,M,y-7,W-M,y-7,theme.pale,1,'comparison-divider');
        row.forEach((cell,index)=>{if(pathway&&index===1)journey(page,parts,positions[index],y,widths[index],height-12);else lines(page,wrapped[index],positions[index]+(pathway?0:7),y+3,pathway&&index===0?22:19,widths[index]-14,{bold:pathway||index===0,fill:pathway&&index!==1?theme.accent:theme.ink,role:index===0?'comparison-label':'table-cell'},pathway?25:26);});
      }};
    });
    if(rowUnits.some(row=>row.fallback||headerH+row.h>300))return block.rows.flatMap(row=>row.flatMap((cell,index)=>paragraph(`${block.columns[index]||''}${block.columns[index]?': ':''}${cell}`)));
    const header=(page,y)=>{block.columns.forEach((cell,index)=>lines(page,wrapText(cell,16,widths[index]-12,true),positions[index]+(pathway?0:7),y,16,widths[index]-12,{bold:true,fill:theme.muted,role:'table-header'},21));};
    // Keep a short comparison whole. Long tables repeat their source column labels.
    const whole=headerH+rowUnits.reduce((sum,row)=>sum+row.h,0)+4;
    if(whole<=300)return [{h:whole,draw(page,y){header(page,y);y+=headerH;for(const row of rowUnits){row.draw(page,y);y+=row.h;}}}];
    return rowUnits.map(row=>({h:headerH+row.h,draw(page,y){header(page,y);row.draw(page,y+headerH);}}));
  };
  const sequence=blocks=>{
    const descriptions=blocks.map(block=>block.text.replace(/^\d+[.)]\s*/,'')),gap=28,column=(usable-gap*(blocks.length-1))/blocks.length;
    const wrapped=descriptions.map(value=>wrapText(value,21,column-12)),height=Math.max(...wrapped.map(values=>values.length*28))+70;
    if(height>310)return null;
    return {h:height,draw(page,y){wrapped.forEach((values,index)=>{const x=M+index*(column+gap);rect(page,x,y,column,height-10,theme.pale,'process-node');put(page,blocks[index].text.match(/^\d+[.)]/)?.[0]||'',x+12,y+10,24,column-24,{bold:true,fill:theme.accent,role:'step-label'});lines(page,values,x+6,y+52,21,column-12,{role:'list'},28);if(index<wrapped.length-1)arrow(page,x+column+3,y+24,x+column+gap-3,'process-connector');});}};
  };
  const unitsFor=current=>{
    const units=[];
    if(wrapText(current.title,36,usable,true).length>2)units.push(...paragraph(current.title,{size:26,bold:true,role:'heading',leading:33}));
    for(let index=0;index<current.blocks.length;index++){
      const block=current.blocks[index];
      if(block.kind==='table'){units.push(...tableUnits(block));continue;}
      if(block.kind==='list'){
        const group=[block];while(current.blocks[index+1]?.kind==='list'&&Boolean(current.blocks[index+1].ordered)===Boolean(block.ordered)){group.push(current.blocks[++index]);}
        const special=group.length>=2&&group.length<=4?(block.ordered?sequence(group):compareList(group)):null;
        if(special){units.push(special);continue;}
        for(const item of group){const chunks=paragraph(item.text,{width:usable-34,role:'list'});chunks.forEach((unit,at)=>{const draw=unit.draw;unit.draw=(page,y)=>{const start=page.items.length;draw(page,y);for(const value of page.items.slice(start))if(value.type==='text')value.x+=34;if(at===0){if('checked' in item){rect(page,M,y+5,16,16,undefined,'check-target',theme.accent);if(item.checked){line(page,M+3,y+12,M+7,y+17,theme.accent,1.5);line(page,M+7,y+17,M+14,y+7,theme.accent,1.5);}}else page.items.push({type:'ellipse',x:M+7,y:y+10,w:6,h:6,fill:theme.accent,role:'bullet'});}};units.push(unit);});}continue;
      }
      units.push(...paragraph(block.text,{size:block.kind==='heading'?27:23,bold:block.kind==='heading'||block.kind==='quote',role:block.kind,leading:block.kind==='heading'?35:30}));
    }
    return units;
  };
  function splitUnits(units,capacity){
    const costs=Array(units.length+1).fill(0),next=[];
    for(let start=units.length-1;start>=0;start--){let used=0;costs[start]=Infinity;
      for(let end=start;end<units.length;end++){used+=units[end].h;if(used>capacity&&end>start)break;const cost=1e7+(capacity-Math.min(used,capacity))**2+costs[end+1];if(cost<costs[start]){costs[start]=cost;next[start]=end+1;}if(used>capacity)break;}
    }
    const groups=[];for(let start=0;start<units.length;start=next[start])groups.push(units.slice(start,next[start]));return groups.length?groups:[[]];
  }
  const relation=sections.map(section=>{const table=section.blocks.find(block=>block.kind==='table'),labels=table?table.rows.map(row=>row[0]):section.blocks.filter(block=>block.kind==='list'&&!block.ordered&&/^([^:]{1,42}):\s/.test(block.text)).map(block=>block.text.split(':')[0]);return {labels,origin:section.blocks.find(block=>block.kind==='body'&&block.text.length<=180)?.text||section.title};}).find(relation=>relation.labels.length>=2);
  const alternatives=[...new Set(relation?.labels||[])].slice(0,4),origin=relation?.origin;
  const branchCover=!image&&alternatives.length>=2&&origin&&title.length<=95,coverWidth=branchCover?466:usable;
  let coverSize=50;while(coverSize>26&&wrapText(title,coverSize,coverWidth,true).length*coverSize*1.18>210)coverSize-=2;
  const cover={title,layout:'cover',purpose:purposes.cover,geometry:G,items:[],continued:false};pages.push(cover);rect(cover,0,0,W,H,theme.ink,'paper');
  let y=lines(cover,wrapText(title,coverSize,coverWidth,true),M,64,coverSize,coverWidth,{bold:true,fill:'FFFFFF',role:'cover-title'},coverSize*1.18)+24;
  if(brief.outcome.trim()&&!longOutcome)y=lines(cover,wrapText(brief.outcome.trim(),branchCover?21:23,coverWidth),M,y,branchCover?21:23,coverWidth,{fill:theme.pale,role:'cover-outcome'},branchCover?28:30)+18;
  if(brief.author.trim())y=lines(cover,wrapText(brief.author.trim(),17,coverWidth),M,y,17,coverWidth,{fill:'FFFFFF',role:'author'},23)+15;
  if(image){const box={x:W-M-176,y:Math.max(y+12,322),w:176,h:Math.min(120,H-78-Math.max(y+12,322))};if(box.h>20){const scale=Math.min(box.w/image.width,box.h/image.height);cover.items.push({type:'image',x:box.x,y:box.y,w:image.width*scale,h:image.height*scale,image});}}
  else if(branchCover){
    const x=606,w=290,nodeX=x+47,nodeW=w-47,parentLines=coverExcerpt(origin,21,w,false,3),parentBottom=lines(cover,parentLines,x,72,21,w,{fill:'FFFFFF',role:'cover-choice-origin'},28),top=Math.max(218,parentBottom+28);
    let labels=alternatives.map(label=>wrapText(label,25,nodeW-24,true));
    if(labels.reduce((height,values)=>height+values.length*31+16,0)+12*(labels.length-1)>BOTTOM-top)labels=alternatives.map(label=>coverExcerpt(label,25,nodeW-24,true,1));
    const heights=labels.map(values=>values.length*31+16),gap=Math.min(alternatives.length===4?21:33,Math.max(0,(BOTTOM-top-heights.reduce((sum,height)=>sum+height,0))/(heights.length-1)));
    line(cover,x+12,parentBottom+10,x+12,top+heights.reduce((sum,height)=>sum+height,0)+gap*(heights.length-1)-heights.at(-1)/2,theme.pale,1.7,'cover-choice-connector');
    let at=top;labels.forEach((wrapped,index)=>{const nodeH=heights[index];line(cover,x+12,at+nodeH/2,nodeX-8,at+nodeH/2,theme.pale,1.7,'cover-choice-connector');line(cover,nodeX-13,at+nodeH/2-4,nodeX-8,at+nodeH/2,theme.pale,1.7,'cover-choice-connector');line(cover,nodeX-13,at+nodeH/2+4,nodeX-8,at+nodeH/2,theme.pale,1.7,'cover-choice-connector');rect(cover,nodeX,at,nodeW,nodeH,'FFFFFF','cover-choice-node');lines(cover,wrapped,nodeX+12,at+8,25,nodeW-24,{bold:true,fill:theme.accent,role:'cover-option'},31);at+=nodeH+gap;});
  }else{
    if(alternatives.length>=2&&y<350){const top=Math.max(370,y+24),column=usable/alternatives.length;rect(cover,0,top-20,W,H-top+20,'FFFFFF','cover-alternatives');alternatives.forEach((label,index)=>{const x=M+index*column;if(index)line(cover,x-15,top,x-15,H-76,theme.pale,1,'comparison-divider');lines(cover,coverExcerpt(label,27,column-24,true,2),x,top+10,27,column-24,{bold:true,fill:theme.accent,role:'cover-option'},34);});}
  }
  for(const current of sections){
    const heading=wrapText(current.title,36,usable,true),display=heading.length>2?wrapText(shortLabel(current.title,72),36,usable,true):heading,top=48+display.length*44+26;
    const units=unitsFor(current),groups=splitUnits(units,BOTTOM-top);
    groups.forEach((group,index)=>{const page={title:current.title,layout:current.layout,purpose:current.purpose,geometry:G,items:[],continued:index>0,presenterNotes:current.presenterNotes};pages.push(page);rect(page,0,0,W,H,'FFFFFF','paper');lines(page,display,M,48,36,usable,{bold:true,role:'heading'},44);line(page,M,top-14,W-M,top-14,theme.pale,1,'heading-rule');let at=top;for(const unit of group){unit.draw(page,at);at+=unit.h;}});
  }
  for(const [index,page]of pages.entries()){
    const fill=index===0&&cover.items.every(item=>item.role!=='cover-alternatives')?'FFFFFF':theme.muted;
    if(draft===true)put(page,draftLabel,M,506,9,usable-40,{fill:index===0&&cover.items.every(item=>item.role!=='cover-alternatives')?'FFFFFF':theme.accent,bold:true,role:'draft-status'});
    else if(index)put(page,shortLabel(title,90),M,506,8,usable-40,{fill:theme.muted,role:'running-title'});
    put(page,String(index+1).padStart(2,'0'),W-M-20,506,8,20,{fill,role:'page-number'});
  }
  return pages;
}
export async function designProduct(project,{coverImage,draft=false}={}){
  const brief=project.brief,selectedGeometry=geometryForFormat(brief.format),deck=selectedGeometry.width>selectedGeometry.height;
  const blocks=parseManuscript(brief.productDraft,{writingFields:!deck});
  const title=brief.title.trim()||blocks.find(v=>v.kind==='heading')?.text||brief.topic.trim()||'My digital product';
  if(title.length>180)throw new Error('Use a product title of 180 characters or fewer.');
  validateGlyphs([title,brief.author,brief.outcome,brief.format,brief.productDraft].join('\n'));
  const image=await safeCoverImage(coverImage),theme=themes[brief.theme]||themes.clay;
  if(brief.author.trim().length>300||brief.format.trim().length>180)throw new Error('Use an author name up to 300 characters and a format label up to 180 characters. Your draft is unchanged.');
  const {width:W,height:H,margin:M,bottom}=selectedGeometry,pages=[];
  const sections=[];let section={title:'Getting started',blocks:[]},inNotes=false;
  const finishSection=()=>{
    if(section.noteBlocks){
      if(!section.noteBlocks.length)throw new Error(`Add presenter notes for "${section.title}", or remove the empty notes heading. Your draft is unchanged.`);
      section.presenterNotes=section.noteBlocks.map(block=>(block.kind==='heading'?'#'.repeat(block.level)+' ':block.bullet?'• ':block.kind==='quote'?'> ':'checked' in block?(block.checked?'[x] ':'[ ] '):'')+block.text).join('\n\n');
    }
    if(section.blocks.length||section.heading)sections.push(section);
  };
  blocks.forEach((block,index)=>{
    if(index===0&&block.kind==='heading'&&block.level===1&&normalize(block.text)===normalize(title))return;
    if(block.kind==='heading'&&block.level<=2){finishSection();section={title:block.text,blocks:[],heading:block};inNotes=false;}
    else if(deck&&block.kind==='heading'&&block.level===3&&/^(?:presenter|speaker) notes:?$/i.test(block.text.trim())){
      if(section.heading?.level!==2)throw new Error('Place presenter notes under a slide headed "## Slide title". Your draft is unchanged.');
      section.noteBlocks??=[];inNotes=true;
    }else if(inNotes)section.noteBlocks.push(block);
    else section.blocks.push(block);
  });
  finishSection();
  const audienceBodyLength=sections.flatMap(section=>section.blocks).filter(block=>['body','list','code','table'].includes(block.kind)).reduce((length,block)=>length+block.text.length,0);
  const splitCover=Boolean(deck&&image&&title.length<95),coverWidth=splitCover?W*0.51-M:W-2*M;
  const titleSize=deck?(title.length>95?39:50):(title.length>105?32:39);
  const titleEnd=(deck?100:133)+wrapText(title,titleSize,coverWidth,true).length*titleSize*1.17+22;
  const authorHeight=brief.author.trim()?wrapText(brief.author.trim(),deck?14:11.5,coverWidth,true).length*(deck?20:17)+12:0;
  const outcomeLines=wrapText(brief.outcome.trim(),deck?21:15.5,coverWidth);
  const longOutcome=outcomeLines.length>(deck?4:7)||titleEnd+outcomeLines.length*(deck?29:23)+22+authorHeight>H-85;
  if(longOutcome)sections.unshift({title:'Intended outcome',blocks:[{kind:'body',text:brief.outcome.trim()}]});
  const metadata=readDesignPlan(brief.designPlan);
  for(const item of sections){const chosen=metadata.get(normalize(item.title));item.layout=chosen?.layout||inferredLayout(item);item.purpose=chosen?.purpose||purposes[item.layout];}
  if(deck)return {pages:presentationPages({brief,title,sections,theme,image,longOutcome,draft}),title,blocks,sections,theme,image,draft:draft===true,geometry:selectedGeometry,hasPresenterNotes:sections.some(section=>section.presenterNotes),audienceBodyLength};
  const newPage=(title,layout,purpose,continued=false)=>{
    const page={title,layout,purpose,items:[],continued,geometry:selectedGeometry};pages.push(page);
    rect(page,0,0,W,H,layout==='summary'?theme.pale:theme.paper,'paper');
    if(layout!=='cover'){
      const label=layout==='steps'?'THE PROCESS':layout==='exercise'?'YOUR TURN':layout==='example'?'WORKED EXAMPLE':layout==='checklist'?'FINAL CHECK':layout==='summary'?'TAKE IT FORWARD':'FIELD NOTES';
      text(page,label,M,deck?27:40,deck?10:8.5,theme.accent,true,'section-label');
      if(layout==='example')rect(page,M-16,deck?61:77,W-2*M+32,deck?70:56,theme.pale,'example-band');
      const headingY=deck?66:78;
      const displayTitle=wrapText(title,deck?32:25.5,W-2*M,true).length>3?shortLabel(title,deck?78:65):title;
      const end=addTextLines(page,displayTitle,M,headingY,deck?32:25.5,W-2*M,theme.ink,true,deck?39:32);
      if(continued)text(page,'CONTINUED',M,end+3,8,theme.muted,true);
      page.contentY=end+(continued?32:26);
      if(layout==='exercise'||layout==='checklist')line(page,M,page.contentY-15,W-M,page.contentY-15,theme.accent,1.2,'working-rule');
    }
    return page;
  };
  const cover=newPage(title,'cover',purposes.cover);
  rect(cover,0,0,15,H,theme.accent,'cover-spine');
  addTextLines(cover,(brief.format.trim()||'Digital product').toUpperCase(),M,deck?40:64,deck?11:9.5,W-2*M,theme.accent,true,14);
  let coverY=addTextLines(cover,title,M,deck?100:133,titleSize,coverWidth,theme.ink,true,titleSize*1.17)+22;
  if(brief.outcome.trim()&&!longOutcome)coverY=addTextLines(cover,brief.outcome.trim(),M,coverY,deck?21:15.5,coverWidth,theme.muted,false,deck?29:23)+22;
  if(brief.author.trim())coverY=addTextLines(cover,brief.author.trim(),M,coverY,deck?14:11.5,coverWidth,theme.accent,true,deck?20:17)+12;
  if(image){
    const box=splitCover?{x:W*0.58,y:100,w:W*0.42-M,h:H-172}:{x:M,y:Math.max(coverY+12,400),w:W-2*M,h:Math.min(250,H-88-Math.max(coverY+12,400))};
    if(box.h>=60&&coverY<H-65){const scale=Math.min(box.w/image.width,box.h/image.height);cover.items.push({type:'image',x:box.x,y:box.y,w:image.width*scale,h:image.height*scale,image});}
    else{const imagePage=newPage('Creator supplied image','example','View the image supplied by the product creator');const scale=Math.min((W-2*M)/image.width,(bottom-imagePage.contentY)/image.height);imagePage.items.push({type:'image',x:M,y:imagePage.contentY,w:image.width*scale,h:image.height*scale,image});}
  }else{
    const process=sections.find(item=>{const count=item.blocks.filter(block=>block.ordered).length;return count>=2&&count<=4;});
    const gridTop=Math.max(coverY+(deck?28:58),deck?315:445),panelHeight=deck?145:215;
    if(process&&gridTop+panelHeight-(deck?22:30)<H-80){
      const steps=process.blocks.filter(block=>block.ordered),gap=deck?28:20,column=(W-2*M-gap*(steps.length-1))/steps.length;
      rect(cover,M-16,gridTop-(deck?22:30),W-2*M+32,panelHeight,theme.pale,'cover-process-field');
      addTextLines(cover,process.title,M,gridTop-(deck?6:9),deck?15:14,W-2*M,theme.accent,true,19);
      for(const [index,step] of steps.entries()){
        const x=M+index*(column+gap),nodeY=gridTop+(deck?30:34),diameter=deck?30:28;
        if(index<steps.length-1)line(cover,x+diameter+7,nodeY+diameter/2,x+column+gap-7,nodeY+diameter/2,theme.accent,1.2,'cover-step-connector');
        cover.items.push({type:'ellipse',x,y:nodeY,w:diameter,h:diameter,fill:theme.accent,role:'cover-step-node'});
        text(cover,step.text.match(/^\d+[.)]/)?.[0]||'',x+7,nodeY+7,11,'FFFFFF',true,'cover-step-number');
        const description=step.text.replace(/^\d+[.)]\s*/,'');
        const firstSentence=description.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim()||shortLabel(description,60);
        let labelY=nodeY+diameter+17;
        const caption=wrapText(firstSentence,deck?17:14,column,true),captionLines=caption.slice(0,3);
        // Cover captions are navigational excerpts. The complete step is retained on its content page.
        if(caption.length>3){let last=captionLines[2];while(last&&textWidth(last+'…',deck?17:14,true)>column)last=last.slice(0,-1);captionLines[2]=last+'…';}
        for(const labelLine of captionLines){text(cover,labelLine,x,labelY,deck?17:14,theme.ink,true,'cover-step-title');labelY+=deck?23:19;}
      }
    }else if(sections.length&&coverY<(deck?300:550)){
      const ruleY=Math.max(coverY+24,deck?320:460);line(cover,M,ruleY,W-M,ruleY,theme.accent,0.8,'contents-rule');
      let y=ruleY+24;text(cover,'START HERE',M,y,8.5,theme.accent,true);y+=24;
      for(const [index,item] of sections.slice(0,deck?2:4).entries()){
        if(y+wrapText(shortLabel(item.title),11.5,W-2*M-34).length*17>H-90)break;
        text(cover,String(index+1).padStart(2,'0'),M,y,10,theme.accent,true);
        y=addTextLines(cover,shortLabel(item.title),M+34,y,11.5,W-2*M-34,theme.ink,false,17)+10;
      }
    }
  }
  let carry=null;
  const sectionHeight=current=>wrapText(current.title,21,W-2*M,true).length*27+48+current.blocks.reduce((height,block)=>{
    const heading=block.kind==='heading',size=heading?16:13.2,leading=heading?23:20;
    return height+wrapText(block.text,size,W-2*M-(block.kind==='list'?48:0),heading).length*leading+14;
  },0);
  const fieldHeight=block=>wrapText(block.text,13.2,W-2*M,block.bold).length*20+74;
  const tableLayout=block=>{
    const count=Math.max(block.columns.length,...block.rows.map(row=>row.length)),size=11.5,leading=16,padding=9,available=W-2*M;
    const weights=Array.from({length:count},(_,index)=>Math.sqrt(Math.max(28,...[block.columns,...block.rows].map(row=>textWidth(row[index]||'',size)))));
    const minimum=Math.min(52,available/count*.45),remaining=available-minimum*count,total=weights.reduce((sum,value)=>sum+value,0);
    const widths=weights.map(value=>minimum+remaining*value/total);
    const cellLines=(row,bold=false)=>widths.map((width,index)=>wrapText(row[index]||'',size,width-2*padding,bold));
    const header=cellLines(block.columns,true),rows=block.rows.map(row=>cellLines(row));
    const height=cells=>Math.max(...cells.map(lines=>lines.length))*leading+2*padding;
    return {size,leading,padding,widths,header,rows,height,headerHeight:height(header)};
  };
  for(const current of sections){
    const units=[];
    for(const block of current.blocks){
      const previous=units.at(-1);
      if(block.kind==='field'&&previous?.kind==='field-group'&&previous.group===block.group)previous.blocks.push(block);
      else units.push(block.kind==='field'?{kind:'field-group',group:block.group,blocks:[block]}:block);
    }
    const displayTitle=wrapText(current.title,25.5,W-2*M,true).length>3?shortLabel(current.title,65):current.title;
    const freshCapacity=bottom-(78+wrapText(displayTitle,25.5,W-2*M,true).length*32+32);
    const unitHeight=unit=>{
      if(!unit)return 0;
      if(unit.kind==='field-group')return unit.blocks.reduce((sum,block)=>sum+fieldHeight(block),0);
      if(unit.kind==='table'){const layout=tableLayout(unit),full=layout.headerHeight+layout.rows.reduce((sum,row)=>sum+layout.height(row),0);return (full<=freshCapacity?full:layout.headerHeight+(layout.rows.length?Math.min(layout.height(layout.rows[0]),freshCapacity-layout.headerHeight):0))+14;}
      const heading=unit.kind==='heading',step=current.layout==='steps'&&unit.ordered,indent=step?48:unit.kind==='list'?30:unit.kind==='quote'?16:0,leading=heading?23:20,gap=heading?13:step?22:14;
      const count=wrapText(unit.text,heading?16:13.2,W-2*M-indent,heading||unit.bold===true).length,height=count*leading+gap;
      return height<=freshCapacity?height:Math.min(2,count)*leading+gap;
    };
    const adjacentHeight=index=>{
      const nearby=units.slice(index,index+3),table=nearby.findIndex(unit=>unit.kind==='table');
      // The table moves whole when it fits a fresh page; reserve its actual
      // height with the preceding subheading/short introduction, not one row.
      if(table>0&&nearby.slice(0,table).every(unit=>['heading','body'].includes(unit.kind)))return nearby.slice(0,table+1).reduce((sum,unit)=>sum+unitHeight(unit),0);
      return unitHeight(units[index])+(units[index]?.kind==='heading'||units[index]?.kind==='body'&&units[index+1]?.kind==='field-group'?unitHeight(units[index+1]):0);
    };
    const longTitle=wrapText(current.title,deck?32:25.5,W-2*M,true).length>3;
    const openingHeight=wrapText(current.title,21,W-2*M,true).length*27+46+adjacentHeight(0);
    const compact=current.layout==='teaching'&&carry?.layout==='teaching'&&!longTitle&&(!current.blocks.some(block=>block.kind==='table'||block.kind==='field')&&carry.y+sectionHeight(current)<bottom||carry.y+openingHeight<bottom);
    let page,y;
    if(compact){
      page=carry.page;y=carry.y+26;line(page,M,y-10,W-M,y-10,theme.pale,1,'section-divider');
      for(const headingLine of wrapText(current.title,21,W-2*M,true)){text(page,headingLine,M,y,21,theme.ink,true,'heading');y+=27;}y+=20;
    }else{page=newPage(current.title,current.layout,current.purpose);page.presenterNotes=current.presenterNotes;y=page.contentY;}
    const nextPage=()=>{page=newPage(current.title,current.layout,current.purpose,true);page.presenterNotes=current.presenterNotes;y=page.contentY;};
    const addTable=block=>{
      const layout=tableLayout(block),{size,leading,padding,widths,header,rows,height,headerHeight}=layout;
      const freshSpace=bottom-page.contentY;
      if(headerHeight+leading+2*padding>freshSpace)throw new Error('This table has too much text in its column headings for one page. Shorten the headings or split the table before exporting. Your manuscript is unchanged.');
      const totalHeight=headerHeight+rows.reduce((sum,row)=>sum+height(row),0);
      const firstHeight=rows.length?Math.min(height(rows[0]),freshSpace-headerHeight):0;
      if(y+headerHeight+firstHeight>bottom||totalHeight<=freshSpace&&y+totalHeight>bottom)nextPage();
      const drawRow=(cells,headerRow=false,offset=0,length=Math.max(...cells.map(lines=>lines.length)))=>{
        const rowHeight=length*leading+2*padding,top=y;
        if(headerRow)rect(page,M,y,W-2*M,rowHeight,theme.pale,'table-header-band');
        let x=M;
        for(const [column,lines]of cells.entries()){
          for(const [index,value]of lines.slice(offset,offset+length).entries()){
            text(page,value,x+padding,top+padding+index*leading,size,headerRow?theme.accent:theme.ink,headerRow,headerRow?'table-header':'table-cell');
            page.items.at(-1).w=widths[column]-2*padding;
          }
          line(page,x,top,x,top+rowHeight,theme.muted,.45,'table-rule');x+=widths[column];
        }
        line(page,x,top,x,top+rowHeight,theme.muted,.45,'table-rule');
        line(page,M,top,W-M,top,theme.muted,.45,'table-rule');
        y+=rowHeight;line(page,M,y,W-M,y,theme.muted,.45,'table-rule');
      };
      const continueTable=()=>{nextPage();drawRow(header,true);};
      drawRow(header,true);
      for(const row of rows){
        const rowLines=Math.max(...row.map(lines=>lines.length)),rowHeight=height(row);
        if(rowHeight<=freshSpace-headerHeight&&y+rowHeight>bottom)continueTable();
        let offset=0;
        while(offset<rowLines){
          const capacity=Math.floor((bottom-y-2*padding)/leading);
          if(capacity<1){continueTable();continue;}
          const length=Math.min(capacity,rowLines-offset);drawRow(row,false,offset,length);offset+=length;
          if(offset<rowLines)continueTable();
        }
      }
      y+=14;
    };
    const addBlock=(block)=>{
      if(block.kind==='table'){addTable(block);return;}
      const heading=block.kind==='heading',size=heading?(deck?27:16):(deck?23:13.2),leading=heading?(deck?35:23):(deck?31:20);
      const isStep=current.layout==='steps'&&block.ordered,isPrompt=block.kind==='field'||current.layout==='exercise'&&/_{3,}\s*$/.test(block.text),bold=heading||block.bold===true;
      const marker=block.text.match(/^\d+[.)]/)?.[0];
      const sourceText=isPrompt?block.text.replace(/\s*_{3,}\s*$/,''):isStep?block.text.replace(/^\d+[.)]\s*/,''):block.text;
      const codeIndent=block.kind==='code'?Math.min(80,(block.text.match(/^\s*/)?.[0].replace(/\t/g,'    ').length||0)*textWidth(' ',size)):0;
      const indent=isStep?(deck?52:48):block.kind==='list'?(deck?40:30):block.kind==='quote'?16:codeIndent;
      const lines=wrapText(block.kind==='code'?sourceText.trimStart():sourceText,size,W-2*M-indent,bold);
      const answerSpace=isPrompt?(deck?64:60):0,blockHeight=lines.length*leading+answerSpace+(isStep?22:14);
      const finalParagraph=block.kind==='body'&&block===sections.at(-1)?.blocks.at(-1)&&lines.length<=2;
      const fitHeight=finalParagraph?lines.length*leading:blockHeight;
      // The final short paragraph needs no following gap. Reclaim at most 8pt
      // of the preceding 14pt paragraph gap, keeping the actual text in bounds.
      const overflow=y+fitHeight-bottom;
      if(finalParagraph&&current.blocks.at(-2)?.kind==='body'&&overflow>0&&overflow<=8)y-=overflow;
      if((fitHeight<=bottom-page.contentY&&y+fitHeight>bottom)||y+Math.min(lines.length,heading?3:2)*leading+answerSpace+(finalParagraph?0:10)>bottom)nextPage();
      if(isStep){
        rect(page,M-7,y-7,42,Math.min(blockHeight-6,bottom-y+5),theme.pale,'step-gutter');
        const markerSize=size,markerY=y;
        page.items.push({type:'ellipse',x:M,y:y+size*0.82-markerSize*0.36-14,w:28,h:28,fill:theme.accent,role:'step-number'});
        text(page,marker,M+(28-textWidth(marker,markerSize,true))/2,markerY,markerSize,'FFFFFF',true,'step-label');
        line(page,M+14,y+28,M+14,Math.min(bottom-3,y+blockHeight-8),theme.accent,1.2,'step-connector');
      }else if(block.kind==='list'){
        if('checked' in block){rect(page,M+1,y+1,11,11,undefined,'check-target',theme.accent);if(block.checked){line(page,M+3,y+7,M+5,y+10,theme.accent,1);line(page,M+5,y+10,M+10,y+3,theme.accent,1);}}
        else text(page,'•',M+3,y,11.4,theme.accent,true,'bullet');
      }
      if(block.kind==='quote')line(page,M,y,M,y+Math.min(lines.length*leading,bottom-y),theme.accent,2,'quote-rule');
      for(const value of lines){if(y+leading>bottom)nextPage();text(page,value,M+indent,y,size,heading?theme.accent:theme.ink,bold,isPrompt?'writing-prompt':block.kind);y+=leading;}
      if(isPrompt){
        if(y+answerSpace>bottom)nextPage();
        line(page,M,y+18,W-M,y+18,theme.muted,0.6,'writing-line');
        line(page,M,y+42,W-M,y+42,theme.muted,0.6,'writing-line');
        y+=answerSpace;
      }
      y+=heading?13:isStep?22:14;
    };
    if(longTitle)addBlock({kind:'heading',text:current.title});
    for(const [index,unit]of units.entries()){
      const height=unitHeight(unit);
      // A source paragraph group of adjacent fields is one exercise unit. Keep
      // it together when it fits, and keep a heading with its first usable item.
      const required=adjacentHeight(index);
      if((unit.kind==='field-group'||unit.kind==='heading'||required>height)&&required<=bottom-page.contentY&&y+required>bottom)nextPage();
      if(unit.kind==='field-group')unit.blocks.forEach(addBlock);else addBlock(unit);
    }
    carry={page,y,layout:current.layout};
  }
  for(const [index,page] of pages.entries()){
    if(draft===true)text(page,draftLabel,M,index===0?18:H-64,index===0?11:9,theme.accent,true,'draft-status');
    text(page,String(index+1).padStart(2,'0'),W-M-17,H-43,9,theme.accent,true,'page-number');
    if(index>0)text(page,shortLabel(title),M,H-43,8.3,theme.muted,false,'running-title');
  }
  return {pages,title,blocks,sections,theme,image,draft:draft===true,geometry:selectedGeometry,hasPresenterNotes:sections.some(section=>section.presenterNotes),audienceBodyLength};
}
const escape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
// Package the pinned TTF tables as WOFF so every SVG image has its actual font,
// including in an isolated browser image with no access to local system fonts.
function woff(ttf){
  const count=ttf.readUInt16BE(4),tables=[];let offset=44+count*20,totalSfnt=12+count*16;
  for(let i=0;i<count;i++){const at=12+i*16,length=ttf.readUInt32BE(at+12),source=ttf.subarray(ttf.readUInt32BE(at+8),ttf.readUInt32BE(at+8)+length),compressed=deflateSync(source),bytes=compressed.length<length?compressed:source;tables.push({tag:ttf.readUInt32BE(at),checksum:ttf.readUInt32BE(at+4),length,bytes,offset});offset+=(bytes.length+3)&~3;totalSfnt+=(length+3)&~3;}
  const result=Buffer.alloc(offset);result.write('wOFF');result.writeUInt32BE(ttf.readUInt32BE(0),4);result.writeUInt32BE(offset,8);result.writeUInt16BE(count,12);result.writeUInt32BE(totalSfnt,16);result.writeUInt16BE(1,20);
  tables.forEach((table,i)=>{const at=44+i*20;[table.tag,table.offset,table.bytes.length,table.length,table.checksum].forEach((value,n)=>result.writeUInt32BE(value,at+n*4));table.bytes.copy(result,table.offset);});return result.toString('base64');
}
const svgFonts=`<style>@font-face{font-family:StudioLato;src:url(data:font/woff;base64,${woff(fontBytes.regular)}) format('woff');font-weight:400}@font-face{font-family:StudioLato;src:url(data:font/woff;base64,${woff(fontBytes.bold)}) format('woff');font-weight:700}text{font-family:StudioLato,Lato,sans-serif}</style>`;
export function pageSvg(page){
  const {width:W,height:H}=page.geometry||geometry;
  const content=page.items.map(item=>{
    const role=item.role?` data-role="${escape(item.role)}"`:'';
    if(item.type==='text')return `<text${role} x="${item.x}" y="${item.y+item.size*0.82}" font-size="${item.size}" font-weight="${item.bold?700:400}" fill="#${item.fill}" xml:space="preserve">${escape(item.text)}</text>`;
    if(item.type==='rect')return `<rect${role} x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" fill="${item.fill?'#'+item.fill:'none'}"${item.stroke?` stroke="#${item.stroke}"`:''}/>`;
    if(item.type==='ellipse')return `<ellipse${role} cx="${item.x+item.w/2}" cy="${item.y+item.h/2}" rx="${item.w/2}" ry="${item.h/2}" fill="#${item.fill}"/>`;
    if(item.type==='line')return `<line${role} x1="${item.x}" y1="${item.y}" x2="${item.x2}" y2="${item.y2}" stroke="#${item.stroke}" stroke-width="${item.width}"/>`;
    if(item.type==='image')return `<image x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" href="${item.image.data}"/>`;
    return '';
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escape(page.title)}"><title>${escape(page.title)}</title>${svgFonts}${content}</svg>`;
}
