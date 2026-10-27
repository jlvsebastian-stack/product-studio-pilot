import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import fontkit from '@pdf-lib/fontkit';

export const draftLabel='DRAFT SAMPLE — for review';
export const geometry={width:595.28,height:841.89,margin:52,bottom:772};
export function geometryForFormat(format=''){return /presentation|slides?|\bdeck\b/i.test(format)?{width:960,height:540,margin:64,bottom:474}:geometry;}
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
export function parseManuscript(markdown) {
  const blocks=[];let paragraph=[],code=false;
  const flush=()=>{if(paragraph.length){blocks.push({kind:'body',text:plain(paragraph.join(' '))});paragraph=[];}};
  for(const line of markdown.replace(/\r/g,'').split('\n')){
    if(/^\s*```|^\s*~~~/.test(line)){flush();code=!code;continue;}
    if(code){flush();blocks.push({kind:'code',text:line||' '});continue;}
    const heading=/^(#{1,6})\s+(.+)$/.exec(line);
    const list=/^\s*[-*+]\s+(?:\[([ xX])\]\s*)?(.*)$/.exec(line);
    if(heading){flush();blocks.push({kind:'heading',level:heading[1].length,text:plain(heading[2])});}
    else if(list){flush();blocks.push({kind:'list',text:plain(list[2]),...(list[1]!==undefined?{checked:list[1].toLowerCase()==='x'}:{bullet:true})});}
    else if(/^\s*\d+[.)]\s+/.test(line)){flush();blocks.push({kind:'list',ordered:true,text:plain(line.trim())});}
    else if(!line.trim()||/^\s*([-*_])\1{2,}\s*$/.test(line))flush();
    else if(/^\s*>/.test(line)){flush();blocks.push({kind:'quote',text:plain(line.replace(/^\s*>\s?/,''))});}
    else if(/^\s*\|/.test(line)){flush();if(!/^\s*\|[\s:|\-]+$/.test(line))blocks.push({kind:'body',text:plain(line.trim())});}
    else paragraph.push(line.trim());
  }
  flush();return blocks;
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
export async function designProduct(project,{coverImage,draft=false}={}){
  const brief=project.brief,blocks=parseManuscript(brief.productDraft);
  const title=brief.title.trim()||blocks.find(v=>v.kind==='heading')?.text||brief.topic.trim()||'My digital product';
  if(title.length>180)throw new Error('Use a product title of 180 characters or fewer.');
  validateGlyphs([title,brief.author,brief.outcome,brief.format,brief.productDraft].join('\n'));
  const image=await safeCoverImage(coverImage),theme=themes[brief.theme]||themes.clay;
  if(brief.author.trim().length>300||brief.format.trim().length>180)throw new Error('Use an author name up to 300 characters and a format label up to 180 characters. Your draft is unchanged.');
  const selectedGeometry=geometryForFormat(brief.format),deck=selectedGeometry.width>selectedGeometry.height;
  const {width:W,height:H,margin:M,bottom}=selectedGeometry,pages=[];
  const sections=[];let section={title:'Getting started',blocks:[]};
  blocks.forEach((block,index)=>{
    if(index===0&&block.kind==='heading'&&normalize(block.text)===normalize(title))return;
    if(block.kind==='heading'&&block.level<=2){if(section.blocks.length||sections.length)sections.push(section);section={title:block.text,blocks:[],heading:block};}
    else section.blocks.push(block);
  });
  if(section.blocks.length||section.heading)sections.push(section);
  const splitCover=Boolean(deck&&image&&title.length<95),coverWidth=splitCover?W*0.51-M:W-2*M;
  const titleSize=deck?(title.length>95?39:50):(title.length>105?32:39);
  const titleEnd=(deck?100:133)+wrapText(title,titleSize,coverWidth,true).length*titleSize*1.17+22;
  const authorHeight=brief.author.trim()?wrapText(brief.author.trim(),deck?14:11.5,coverWidth,true).length*(deck?20:17)+12:0;
  const outcomeLines=wrapText(brief.outcome.trim(),deck?21:15.5,coverWidth);
  const longOutcome=outcomeLines.length>(deck?4:7)||titleEnd+outcomeLines.length*(deck?29:23)+22+authorHeight>H-85;
  if(longOutcome)sections.unshift({title:'Intended outcome',blocks:[{kind:'body',text:brief.outcome.trim()}]});
  const metadata=readDesignPlan(brief.designPlan);
  for(const item of sections){const chosen=metadata.get(normalize(item.title));item.layout=chosen?.layout||inferredLayout(item);item.purpose=chosen?.purpose||purposes[item.layout];}
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
  for(const current of sections){
    const longTitle=wrapText(current.title,deck?32:25.5,W-2*M,true).length>3;
    const compact=!deck&&current.layout==='teaching'&&carry?.layout==='teaching'&&!longTitle&&carry.y+sectionHeight(current)<bottom;
    let page,y;
    if(compact){
      page=carry.page;y=carry.y+26;line(page,M,y-10,W-M,y-10,theme.pale,1,'section-divider');
      for(const headingLine of wrapText(current.title,21,W-2*M,true)){text(page,headingLine,M,y,21,theme.ink,true,'heading');y+=27;}y+=20;
    }else{page=newPage(current.title,current.layout,current.purpose);y=page.contentY;}
    const nextPage=()=>{page=newPage(current.title,current.layout,current.purpose,true);y=page.contentY;};
    const addBlock=(block)=>{
      const heading=block.kind==='heading',size=heading?(deck?27:16):(deck?23:13.2),leading=heading?(deck?35:23):(deck?31:20);
      const isStep=current.layout==='steps'&&block.ordered,isPrompt=current.layout==='exercise'&&/_{3,}\s*$/.test(block.text);
      const marker=block.text.match(/^\d+[.)]/)?.[0];
      const sourceText=isPrompt?block.text.replace(/\s*_{3,}\s*$/,''):isStep?block.text.replace(/^\d+[.)]\s*/,''):block.text;
      const codeIndent=block.kind==='code'?Math.min(80,(block.text.match(/^\s*/)?.[0].replace(/\t/g,'    ').length||0)*textWidth(' ',size)):0;
      const indent=isStep?(deck?52:48):block.kind==='list'?(deck?40:30):block.kind==='quote'?16:codeIndent;
      const lines=wrapText(block.kind==='code'?sourceText.trimStart():sourceText,size,W-2*M-indent,heading);
      const answerSpace=isPrompt?(deck?64:60):0,blockHeight=lines.length*leading+answerSpace+(isStep?22:14);
      if((blockHeight<=bottom-page.contentY&&y+blockHeight>bottom)||y+Math.min(lines.length,heading?3:2)*leading+answerSpace+10>bottom)nextPage();
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
      for(const value of lines){if(y+leading>bottom)nextPage();text(page,value,M+indent,y,size,heading?theme.accent:theme.ink,heading,isPrompt?'writing-prompt':block.kind);y+=leading;}
      if(isPrompt){
        if(y+answerSpace>bottom)nextPage();
        line(page,M,y+18,W-M,y+18,theme.muted,0.6,'writing-line');
        line(page,M,y+42,W-M,y+42,theme.muted,0.6,'writing-line');
        y+=answerSpace;
      }
      y+=heading?13:isStep?22:14;
    };
    if(longTitle)addBlock({kind:'heading',text:current.title});current.blocks.forEach(addBlock);
    carry={page,y,layout:current.layout};
  }
  for(const [index,page] of pages.entries()){
    if(draft===true)text(page,draftLabel,M,index===0?18:H-64,index===0?11:9,theme.accent,true,'draft-status');
    text(page,String(index+1).padStart(2,'0'),W-M-17,H-43,9,theme.accent,true,'page-number');
    if(index>0)text(page,shortLabel(title),M,H-43,8.3,theme.muted,false,'running-title');
  }
  return {pages,title,blocks,sections,theme,image,draft:draft===true,geometry:selectedGeometry};
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
