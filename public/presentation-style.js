export const PRESENTATION_FONTS=['DM Serif Display','DM Sans','Barlow Condensed','Manrope'];
export const CANVA_PRESENTATION_FONTS=['DM Serif Display','DM Sans','Barlow Condensed'];
export const PRESENTATION_STYLE_KEYS=['headingFont','bodyFont','background','ink','accent','secondary'];
const luminance=hex=>hex.slice(1).match(/../g).map(part=>parseInt(part,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
export function cleanPresentationStyle(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==PRESENTATION_STYLE_KEYS.length||PRESENTATION_STYLE_KEYS.some(key=>!Object.hasOwn(value,key)))return null;
  if(!PRESENTATION_FONTS.includes(value.headingFont)||!PRESENTATION_FONTS.includes(value.bodyFont)||PRESENTATION_STYLE_KEYS.slice(2).some(key=>typeof value[key]!=='string'||!/^#[0-9a-f]{6}$/i.test(value[key])))return null;
  const background=luminance(value.background),ink=luminance(value.ink);
  if((Math.max(background,ink)+.05)/(Math.min(background,ink)+.05)<4.5)return null;
  return Object.fromEntries(PRESENTATION_STYLE_KEYS.map(key=>[key,value[key]]));
}
