import {DESIGN_CONCEPTS} from './design-concepts.js';
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
// Static style examples only. These never enter a production plan or native transfer.
export function templatePreview(conceptId){
  const concept=DESIGN_CONCEPTS.find(item=>item.id===conceptId);if(!concept)throw Error('Choose an available template.');const s=concept.visualSystem;
  const text=(value,x,y,size,font=s.headingFont,weight=400,color=s.ink)=>`<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(value)}</text>`;
  let composition,body='';
  if(conceptId==='editorial'){
    composition='editorial-column';body=`<path d="M820 160V550M820 160H1120" fill="none" stroke="${s.ink}" stroke-width="2"/>${text('An Idea,',88,240,112)}${text('Made Useful.',88,365,112)}${text('A Clearer Way To Teach',94,550,25,s.bodyFont,400)}<circle cx="820" cy="260" r="11" fill="${s.accent}"/><circle cx="820" cy="415" r="11" fill="${s.accent}"/>${text('Know',870,274,49)}${text('Apply',870,429,49)}<path d="M94 132H200" stroke="${s.accent}" stroke-width="5"/>`;
  }else if(conceptId==='studio'){
    composition='studio-poster';body=`${text('MAKE IT',80,238,184,s.headingFont,600)}${text('WORK.',80,411,184,s.headingFont,600,s.accent)}<path d="M825 205H1185M825 355H1185M825 505H1185" fill="none" stroke="${s.secondary}" stroke-width="2"/><circle cx="850" cy="205" r="14" fill="${s.accent}"/><circle cx="1000" cy="355" r="14" fill="${s.accent}"/><circle cx="1160" cy="505" r="14" fill="${s.accent}"/>${text('IDEA',825,170,23,s.bodyFont,600)}${text('BUILD',825,320,23,s.bodyFont,600)}${text('ACTION',825,470,23,s.bodyFont,600)}${text('Clear Lessons. Real Progress.',88,594,27,s.bodyFont,400)}`;
  }else{
    composition='warm-object';body=`<image href="/assets/warm-digital-products.png" x="545" y="185" width="665" height="443" preserveAspectRatio="xMidYMid meet" aria-label="Illustrative template artwork"/>${text('One Useful',86,215,86,s.headingFont,650)}${text('Next Step.',86,319,86,s.headingFont,650)}${text('A Little Clarity Goes A Long Way',92,492,24,s.bodyFont,450)}<circle cx="105" cy="572" r="12" fill="${s.secondary}"/><path d="M137 572H220" stroke="${s.accent}" stroke-width="3"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-label="${esc(concept.title)} template example" data-template-preview="${conceptId}" data-composition="${composition}" style="stroke:none;stroke-width:0;fill:none"><rect width="1280" height="720" fill="${s.background}"/>${body}</svg>`;
}
