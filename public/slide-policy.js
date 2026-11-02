export const MAX_SLIDE_WORDS=14;
export const SLIDE_POLICY_VERSION=3;
const wordPattern=/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu;
export const slideWordCount=value=>(String(value??'').match(wordPattern)||[]).length;
const acronyms=new Set(['AI','API','APIs','PDF','PNG','JPEG','SVG','NASA','URL','URLs','GHL','CRM','CTA','SEO','HTML','CSS','UI','UX','MCP','SQL','CSV','FAQ','FAQs']);
const brands=new Map(['ChatGPT','YouTube','PayMongo','Canva','Xendit','Resend','iPhone','eBay','JavaScript','TypeScript'].map(value=>[value.toLowerCase(),value]));
export function titleCase(value){
  return String(value??'').trim().replace(/[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)*/gu,word=>{
    const possessive=word.match(/([’']s)$/i),core=possessive?word.slice(0,-2):word;
    const brand=brands.get(core.toLowerCase());
    const meaningfulCase=acronyms.has(core)||/^[\p{Lu}\d]{2,}$/u.test(core)||/[\p{Ll}][\p{Lu}]/u.test(core);
    const normalized=brand||(meaningfulCase?core:core.split(/([’'])/).map(part=>/^[’']$/.test(part)?part:part.slice(0,1).toLocaleUpperCase()+part.slice(1).toLocaleLowerCase()).join(''));
    return normalized+(possessive?possessive[1].slice(0,1)+'s':'');
  });
}
export const isTitleCase=value=>typeof value==='string'&&value.trim().length>0&&value===titleCase(value);
