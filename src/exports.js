import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Header, Footer, PageNumber, AlignmentType, BorderStyle } from 'docx';
import pptxgen from 'pptxgenjs';
import { projectSchema } from './product.js';
import { designProduct, pageSvg, fontBytes, geometry, parseManuscript, plain, draftLabel } from './page-design.js';
export { parseManuscript, plain };
const color=hex=>rgb(...[0,2,4].map(index=>parseInt(hex.slice(index,index+2),16)/255));

export async function previewProduct(raw,options={}){
  const project=projectSchema.parse(raw),design=await designProduct(project,options);
  return {pages:design.pages.map(page=>({svg:pageSvg(page),title:page.title,purpose:page.purpose})),pageCount:design.pages.length};
}
async function makePdf(design,brief){
  const geometry=design.geometry;
  const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
  const regular=await pdf.embedFont(fontBytes.regular,{subset:true}),bold=await pdf.embedFont(fontBytes.bold,{subset:true});
  const image=design.image?(design.image.mime==='png'?await pdf.embedPng(design.image.bytes):await pdf.embedJpg(design.image.bytes)):null;
  for(const scene of design.pages){
    const page=pdf.addPage([geometry.width,geometry.height]);
    for(const item of scene.items){
      if(item.type==='text')page.drawText(item.text,{x:item.x,y:geometry.height-item.y-item.size*0.82,size:item.size,font:item.bold?bold:regular,color:color(item.fill)});
      else if(item.type==='rect')page.drawRectangle({x:item.x,y:geometry.height-item.y-item.h,width:item.w,height:item.h,...(item.fill?{color:color(item.fill)}:{opacity:0}),...(item.stroke?{borderColor:color(item.stroke),borderWidth:1}:{})});
      else if(item.type==='ellipse')page.drawEllipse({x:item.x+item.w/2,y:geometry.height-item.y-item.h/2,xScale:item.w/2,yScale:item.h/2,color:color(item.fill)});
      else if(item.type==='line')page.drawLine({start:{x:item.x,y:geometry.height-item.y},end:{x:item.x2,y:geometry.height-item.y2},thickness:item.width,color:color(item.stroke)});
      else if(item.type==='image'&&image)page.drawImage(image,{x:item.x,y:geometry.height-item.y-item.h,width:item.w,height:item.h});
    }
  }
  pdf.setTitle(design.draft?`${draftLabel}: ${design.title}`:design.title);pdf.setAuthor(brief.author.trim()||'Product creator');pdf.setSubject(design.draft?draftLabel:brief.format||'Digital product');
  return pdf.save();
}
async function makeDeck(design,brief){
  const geometry=design.geometry;
  const deck=new pptxgen();deck.defineLayout({name:'Studio product',width:geometry.width/72,height:geometry.height/72});deck.layout='Studio product';
  deck.author=brief.author.trim()||'Product creator';deck.subject=design.draft?draftLabel:'Editable product pages';deck.title=design.draft?`${draftLabel}: ${design.title}`:design.title;deck.lang='en';
  deck.theme={headFontFace:'Lato',bodyFontFace:'Lato',lang:'en'};
  for(const scene of design.pages){
    const slide=deck.addSlide();
    for(const item of scene.items){
      if(item.type==='text')slide.addText(item.text,{x:item.x/72,y:(item.y-1.5)/72,w:(geometry.width-geometry.margin-item.x+3)/72,h:(item.h+3)/72,objectName:'studio-'+(item.role||'heading'),fontFace:'Lato',fontSize:item.size,bold:item.bold,color:item.fill,margin:0,breakLine:false,paraSpaceAfterPt:0,valign:'top',wrap:false});
      else if(item.type==='rect'||item.type==='ellipse')slide.addShape(item.type==='rect'?deck.ShapeType.rect:deck.ShapeType.ellipse,{objectName:'studio-'+(item.role||'graphic'),x:item.x/72,y:item.y/72,w:item.w/72,h:item.h/72,fill:item.fill?{color:item.fill}:{color:'FFFFFF',transparency:100},line:item.stroke?{color:item.stroke,width:1}:{transparency:100}});
      else if(item.type==='line')slide.addShape(deck.ShapeType.line,{objectName:'studio-'+(item.role||'rule'),x:Math.min(item.x,item.x2)/72,y:Math.min(item.y,item.y2)/72,w:Math.abs(item.x2-item.x)/72,h:Math.abs(item.y2-item.y)/72,line:{color:item.stroke,width:item.width},flipV:item.y2<item.y});
      else if(item.type==='image')slide.addImage({data:item.image.data,x:item.x/72,y:item.y/72,w:item.w/72,h:item.h/72});
    }
    slide.addNotes(scene.purpose);
  }
  return deck.write({outputType:'nodebuffer'});
}
async function makeWord(design,brief){
  const {theme,title,blocks,image}=design;
  const run=(text,options={})=>new TextRun({text,...options});
  const paragraphs=[new Paragraph({heading:HeadingLevel.TITLE,spacing:{before:800,after:420},children:[run(title,{bold:true,size:60,color:'25382F'})]})];
  if(design.draft)paragraphs.unshift(new Paragraph({spacing:{before:0,after:180},children:[run(draftLabel,{size:24,bold:true,color:theme.accent})]}));
  if(brief.outcome.trim())paragraphs.push(new Paragraph({spacing:{after:360},children:[run(brief.outcome,{size:28,color:theme.muted})]}));
  if(brief.author.trim())paragraphs.push(new Paragraph({spacing:{after:360},children:[run(brief.author,{size:24,bold:true,color:theme.accent})]}));
  if(image){const scale=Math.min(460/image.width,260/image.height);paragraphs.push(new Paragraph({spacing:{before:160,after:320},children:[new ImageRun({type:image.mime==='jpeg'?'jpg':'png',data:image.bytes,transformation:{width:Math.round(image.width*scale),height:Math.round(image.height*scale)},altText:{title:'Creator supplied cover image',description:'Image supplied by the product creator',name:'Cover image'}})]}));}
  let firstBody=true,wordLayout='teaching';
  for(const [index,block] of blocks.entries()){
    if(index===0&&block.kind==='heading'&&block.text.trim().toLowerCase()===title.toLowerCase())continue;
    const heading=block.kind==='heading';
    if(heading&&block.level<=2)wordLayout=design.sections.find(section=>section.title===block.text)?.layout||'teaching';
    const isPrompt=wordLayout==='exercise'&&/_{3,}\s*$/.test(block.text),displayText=isPrompt?block.text.replace(/\s*_{3,}\s*$/,''):block.text;
    paragraphs.push(new Paragraph({
      ...(heading?{heading:block.level<=2?HeadingLevel.HEADING_1:HeadingLevel.HEADING_2,keepNext:true}:{}),
      ...(block.bullet?{bullet:{level:0}}:{}),
      pageBreakBefore:firstBody||(heading&&wordLayout==='exercise'),
      spacing:{before:heading?240:0,after:heading?240:170,line:310},
      children:[run(('checked' in block?(block.checked?'[x] ':'[ ] '):'')+displayText,{bold:heading,color:heading?theme.accent:theme.ink,...(block.kind==='quote'?{italics:true}:{})})]
    }));
    if(isPrompt)for(let answer=0;answer<2;answer++)paragraphs.push(new Paragraph({spacing:{before:100,after:120,line:360},border:{bottom:{color:theme.muted,style:BorderStyle.SINGLE,size:3,space:4}},children:[run(' ')]}));
    firstBody=false;
  }
  const doc=new Document({creator:brief.author.trim()||'Product creator',title:design.draft?`${draftLabel}: ${title}`:title,description:design.draft?draftLabel:brief.format,
    styles:{default:{document:{run:{font:'Lato',size:23,color:theme.ink},paragraph:{spacing:{line:310}}}},
      paragraphStyles:[{id:'Title',name:'Title',basedOn:'Normal',next:'Normal',run:{font:'Lato',size:60,bold:true,color:theme.ink}},{id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',run:{font:'Lato',size:36,bold:true,color:theme.accent}},{id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',run:{font:'Lato',size:28,bold:true,color:theme.accent}}]},
    sections:[{properties:{page:{size:{width:Math.round(geometry.width*20),height:Math.round(geometry.height*20)},margin:{top:1040,bottom:1040,left:1040,right:1040}}},
      headers:{default:new Header({children:[new Paragraph({children:[run(title,{size:17,color:theme.muted})]})]})},
      footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[...(design.draft?[run(draftLabel+'   ',{size:18,bold:true,color:theme.accent})]:[]),new TextRun({children:[PageNumber.CURRENT],size:18,color:theme.accent})]})]})},children:paragraphs}]
  });return Packer.toBuffer(doc);
}
export async function exportProduct(raw,options={}){
  const project=projectSchema.parse(raw),brief=project.brief,manuscript=brief.productDraft;
  const blocks=parseManuscript(manuscript),draft=options.draft===true;
  const bodyLength=blocks.filter(block=>block.kind==='body'||block.kind==='list'||block.kind==='code').reduce((length,block)=>length+block.text.length,0);
  if(draft&&bodyLength<80)throw new Error('Add a substantive paragraph, worked example, template, or exercise of at least 80 characters before downloading a draft sample.');
  if(!draft&&(manuscript.trim().length<600||bodyLength<450))throw new Error('Add the actual teaching, examples, templates, or exercises before exporting. An outline alone is not a finished product.');
  const design=await designProduct(project,{...options,draft});
  const slug=design.title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,65)||'digital-product';
  const basename=slug+(draft?'-sample':'');
  const markdown=draft?`> ${draftLabel}\n\n${manuscript}`:manuscript;
  const file=(name,mimeType,bytes)=>({name,mimeType,blob:Buffer.from(bytes).toString('base64')});
  const [pdf,docx,pptx]=await Promise.all([makePdf(design,brief),makeWord(design,brief),makeDeck(design,brief)]);
  const files=[file(`${basename}.pdf`,'application/pdf',pdf),file(`${basename}.docx`,'application/vnd.openxmlformats-officedocument.wordprocessingml.document',docx),file(`${basename}-canva.pptx`,'application/vnd.openxmlformats-officedocument.presentationml.presentation',pptx),file(`${basename}.md`,'text/markdown',Buffer.from(markdown)),file(`${basename}-project.json`,'application/json',Buffer.from(JSON.stringify({version:1,...(draft?{draft:true,status:draftLabel}:{}),project,...(design.image?{coverImage:design.image.data}:{})},null,2)))];
  if(brief.listingCopy?.trim())files.push(file(`${basename}-listing.md`,'text/markdown',Buffer.from(draft?`> ${draftLabel}\n\n${brief.listingCopy}`:brief.listingCopy)));
  if(files.reduce((length,item)=>length+item.blob.length,0)>14000000)throw new Error('This product is too large for one local export. Split it into smaller volumes. Your draft is unchanged.');
  return {pages:design.pages.length,files};
}
