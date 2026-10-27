import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import pptxgen from 'pptxgenjs';
import { projectSchema } from './product.js';
import { designProduct, pageSvg, fontBytes, parseManuscript, plain, draftLabel } from './page-design.js';
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
    slide.addNotes(scene.presenterNotes||scene.purpose);
  }
  return deck.write({outputType:'nodebuffer'});
}
async function exportDesign(raw,options={}){
  const project=projectSchema.parse(raw),brief=project.brief,manuscript=brief.productDraft;
  const blocks=parseManuscript(manuscript),draft=options.draft===true;
  const bodyLength=blocks.filter(block=>block.kind==='body'||block.kind==='list'||block.kind==='code').reduce((length,block)=>length+block.text.length,0);
  if(draft&&bodyLength<80)throw new Error('Add a substantive paragraph, worked example, template, or exercise of at least 80 characters before downloading a draft sample.');
  if(!draft&&(manuscript.trim().length<600||bodyLength<450))throw new Error('Add the actual teaching, examples, templates, or exercises before exporting. An outline alone is not a finished product.');
  const design=await designProduct(project,{...options,draft});
  if(design.hasPresenterNotes&&design.audienceBodyLength<80)throw new Error('Add actual audience-facing slide content before exporting. Presenter notes alone are not a presentation. Your draft is unchanged.');
  const slug=design.title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,65)||'digital-product';
  const basename=slug+(draft?'-sample':'');
  return {project,brief,manuscript,design,basename,draft};
}
// Internal upload source for a verified Canva connection; never a local download.
export async function exportCanvaSource(raw,options={}){
  const {brief,design,basename}=await exportDesign(raw,options),bytes=Buffer.from(await makeDeck(design,brief));
  if(bytes.length>10500000)throw new Error('This presentation is too large for one Canva transfer. Split it into smaller volumes. Your draft is unchanged.');
  return {name:`${basename}-canva-source.pptx`,mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation',bytes,pages:design.pages.length};
}
export async function exportProduct(raw,options={}){
  const {project,brief,manuscript,design,basename,draft}=await exportDesign(raw,options);
  const markdown=draft?`> ${draftLabel}\n\n${manuscript}`:manuscript;
  const file=(name,mimeType,bytes)=>({name,mimeType,blob:Buffer.from(bytes).toString('base64')});
  const pdf=await makePdf(design,brief);
  const files=[file(`${basename}.pdf`,'application/pdf',pdf),file(`${basename}.md`,'text/markdown',Buffer.from(markdown))];
  const checkpoint=file(`${basename}-project.json`,'application/json',Buffer.from(JSON.stringify({version:1,...(draft?{draft:true,status:draftLabel}:{}),project,...(design.image?{coverImage:design.image.data}:{})},null,2)));
  if(brief.listingCopy?.trim())files.push(file(`${basename}-listing.md`,'text/markdown',Buffer.from(draft?`> ${draftLabel}\n\n${brief.listingCopy}`:brief.listingCopy)));
  if(files.reduce((length,item)=>length+item.blob.length,checkpoint.blob.length)>14000000)throw new Error('This product is too large for one local export. Split it into smaller volumes. Your draft is unchanged.');
  return {pages:design.pages.length,files,checkpoint};
}
