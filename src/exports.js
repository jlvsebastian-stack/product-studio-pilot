import { readFileSync } from 'node:fs';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import pptxgen from 'pptxgenjs';
import { projectSchema } from './product.js';

const W=595.28,H=841.89,M=51;
const fonts={regular:readFileSync(new URL('../fonts/Lato-Regular.ttf',import.meta.url)),bold:readFileSync(new URL('../fonts/Lato-Bold.ttf',import.meta.url))};
const themes={clay:{accent:'97432F',pale:'F4E6DC'},sage:{accent:'345F4C',pale:'E7EFE7'},ink:{accent:'274F71',pale:'E7EDF4'}};
const color=h=>rgb(...[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255));
export function plain(text) {
  return text.replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1 ($2)')
    .replace(/\*\*([^*]+)\*\*/g,'$1').replace(/__([^_]+)__/g,'$1')
    .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g,'$1').replace(/\*([^*\n]+)\*/g,'$1')
    .replace(/`([^`]+)`/g,'$1');
}
export function parseManuscript(markdown) {
  const blocks=[];let paragraph=[],code=false;
  const flush=()=>{if(paragraph.length) {blocks.push({kind:'body',text:plain(paragraph.join(' '))});paragraph=[];}};
  for(const line of markdown.replace(/\r/g,'').split('\n')) {
    if(line.startsWith('```')) {flush();code=!code;continue;}
    if(code) {flush();blocks.push({kind:'body',text:line||' '});continue;}
    const head=/^(#{1,6})\s+(.+)$/.exec(line);
    if(head) {flush();blocks.push({kind:'heading',level:head[1].length,text:plain(head[2])});}
    else if(/^\s*[-*+]\s+/.test(line)) {flush();blocks.push({kind:'list',text:'• '+plain(line.replace(/^\s*[-*+]\s+/,''))});}
    else if(/^\s*\d+[.)]\s+/.test(line)) {flush();blocks.push({kind:'list',text:plain(line.trim())});}
    else if(!line.trim()||/^\s*([-*])\1{2,}\s*$/.test(line)) flush();
    else if(/^\s*>/.test(line)) {flush();blocks.push({kind:'quote',text:plain(line.replace(/^\s*>\s?/,''))});}
    else if(/^\s*\|/.test(line)) {flush();if(!/^\s*\|[\s:|\-]+$/.test(line))blocks.push({kind:'body',text:plain(line.trim())});}
    else paragraph.push(line.trim());
  }
  flush();return blocks;
}
function wrap(text,font,size,width) {
  const lines=[];let current='';
  for(const word of text.split(/\s+/)) {
    if(!word)continue;
    const candidate=current?`${current} ${word}`:word;
    if(font.widthOfTextAtSize(candidate,size)<=width) {current=candidate;continue;}
    if(current) {lines.push(current);current='';}
    for(const char of word) {
      if(current && font.widthOfTextAtSize(current+char,size)>width) {lines.push(current);current='';}
      current+=char;
    }
  }
  if(current)lines.push(current);
  return lines.length?lines:[''];
}
export async function exportProduct(raw) {
  const project=projectSchema.parse(raw),b=project.brief;
  const manuscript=b.productDraft.trim();
  if(manuscript.length<600 || parseManuscript(manuscript).filter(v=>v.kind==='body'||v.kind==='list').reduce((n,v)=>n+v.text.length,0)<450)
    throw new Error('Add the actual teaching, examples, templates, or exercises before exporting. An outline alone is not a finished product.');
  const blocks=parseManuscript(manuscript);
  const title=b.title.trim()||blocks.find(v=>v.kind==='heading')?.text||b.topic.trim()||'My digital product';
  if(title.length>180) throw new Error('Use a product title of 180 characters or fewer.');
  const theme=themes[b.theme]||themes.clay;
  const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
  const regular=await pdf.embedFont(fonts.regular,{subset:true}),bold=await pdf.embedFont(fonts.bold,{subset:true});
  const coverage=fontkit.create(fonts.regular);
  for(const char of new Set([title,b.author,b.outcome,manuscript].join(''))) {
    if(!/\s/.test(char)&&!coverage.hasGlyphForCodePoint(char.codePointAt(0)))
      throw new Error(`The pilot font cannot render “${char}”. Replace that symbol or choose a supported manuscript language before exporting. Your draft is unchanged.`);
  }
  const pages=[[]];let y=67;
  const newPage=()=>{pages.push([]);y=57;};
  const add=(text,size=11.5,isBold=false,fill='282E2A',gap=10)=>{
    const font=isBold?bold:regular,leading=size*1.4;
    for(const line of wrap(text,font,size,W-2*M)) {
      if(y+leading>H-66)newPage();
      pages.at(-1).push({text:line,x:M,y,size,bold:isBold,color:fill,height:leading});y+=leading;
    } y+=gap;
  };
  add((b.format||'Digital product').toUpperCase(),10,true,theme.accent,40);
  add(title,31,true,'282E2A',28);
  if(b.outcome.trim())add(b.outcome.trim(),15,false,'4A514B',32);
  if(b.author.trim())add(b.author.trim(),12,true,theme.accent,12);
  newPage();
  if(blocks[0]?.kind==='heading'&&blocks[0].text===title) blocks.shift();
  for(const block of blocks) {
    if(block.kind==='heading') {
      const size=block.level<=2?19:14;
      if(y>H-160)newPage();
      y+=14;add(block.text,size,true,theme.accent,13);
    } else add(block.text,11.5,false,block.kind==='quote'?theme.accent:'282E2A',11);
  }
  // Remove only an unused trailing page, never a page containing manuscript text.
  if(!pages.at(-1).length)pages.pop();
  pages.forEach((items,index)=>{
    const page=pdf.addPage([W,H]);
    if(index===0)page.drawRectangle({x:0,y:H-14,width:W,height:14,color:color(theme.accent)});
    else page.drawLine({start:{x:M,y:H-34},end:{x:W-M,y:H-34},thickness:0.7,color:color(theme.pale)});
    items.forEach(item=>page.drawText(item.text,{x:item.x,y:H-item.y-item.size,size:item.size,font:item.bold?bold:regular,color:color(item.color)}));
    page.drawText(String(index+1).padStart(2,'0'),{x:W-M-18,y:30,size:9,font:regular,color:color(theme.accent)});
  });
  pdf.setTitle(title);if(b.author)pdf.setAuthor(b.author);

  const paragraphs=[new Paragraph({heading:HeadingLevel.TITLE,children:[new TextRun({text:title,color:theme.accent,bold:true,size:52})]})];
  if(b.outcome)paragraphs.push(new Paragraph({text:b.outcome,spacing:{after:320}}));
  if(b.author)paragraphs.push(new Paragraph({text:b.author,spacing:{after:320}}));
  blocks.forEach((block,index)=>paragraphs.push(new Paragraph({
    ...(block.kind==='heading'?{heading:block.level<=2?HeadingLevel.HEADING_1:HeadingLevel.HEADING_2,keepNext:true}:{}),
    pageBreakBefore:index===0,
    spacing:{before:block.kind==='heading'?280:0,after:160,line:300},
    children:[new TextRun({text:block.text,bold:block.kind==='heading',color:block.kind==='heading'?theme.accent:'282E2A'})]
  })));
  const doc=new Document({
    creator:b.author||'Product Studio creator',title,
    styles:{default:{document:{run:{font:'Lato',size:23,color:'282E2A'}}}},
    sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1000,bottom:1000,left:1020,right:1020}}},children:paragraphs}]
  });
  const deck=new pptxgen();deck.defineLayout({name:'A4',width:W/72,height:H/72});deck.layout='A4';
  deck.author=b.author||'Product Studio creator';deck.subject='Editable pages for Canva import';deck.title=title;
  pages.forEach((items,index)=>{
    const slide=deck.addSlide();slide.background={color:'FFFFFF'};
    if(index===0)slide.addShape(deck.ShapeType.rect,{x:0,y:0,w:W/72,h:14/72,fill:{color:theme.accent},line:{color:theme.accent}});
    items.forEach(item=>slide.addText(item.text,{x:item.x/72,y:(item.y-2)/72,w:(W-2*M)/72,h:item.height/72+0.035,
      fontFace:'Lato',fontSize:item.size,bold:item.bold,color:item.color,margin:0,breakLine:false,paraSpaceAfterPt:0,fit:'shrink'}));
    slide.addText(String(index+1).padStart(2,'0'),{x:(W-M-20)/72,y:(H-42)/72,w:0.4,h:0.2,fontSize:9,color:theme.accent,margin:0});
  });
  const slug=title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,65)||'digital-product';
  const file=(name,mimeType,bytes)=>({name,mimeType,blob:Buffer.from(bytes).toString('base64')});
  const files=[
    file(`${slug}.pdf`,'application/pdf',await pdf.save()),
    file(`${slug}.docx`,'application/vnd.openxmlformats-officedocument.wordprocessingml.document',await Packer.toBuffer(doc)),
    file(`${slug}-canva.pptx`,'application/vnd.openxmlformats-officedocument.presentationml.presentation',await deck.write({outputType:'nodebuffer'})),
    file(`${slug}.md`,'text/markdown',Buffer.from(manuscript)),
    file(`${slug}-project.json`,'application/json',Buffer.from(JSON.stringify({version:1,project},null,2)))
  ];
  if(files.reduce((n,v)=>n+v.blob.length,0)>3500000)throw new Error('This product is too large for one pilot export. Split it into smaller volumes. Your draft is unchanged.');
  return {pages:pages.length,files};
}
