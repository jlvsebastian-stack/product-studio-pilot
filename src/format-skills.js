import {readFileSync} from 'node:fs';
const readSkill=name=>readFileSync(new URL(`../skills/${name}/SKILL.md`,import.meta.url),'utf8');
export function formatSkillNames(format){
 const names=[],presentation=/presentation|slides?|deck|webinar/i.test(format),ebook=/e[- ]?books?/i.test(format);
 if(presentation){if(/webinar/i.test(format))names.push('course-architect','webinar-craft');names.push('slide-deck-architect');}
 else if(ebook)names.push('course-architect','ebook-formatter');
 else{const route=[[/calculator/i,'calculator-craft'],[/tracker/i,'tracker-craft'],[/spreadsheet|sheets/i,'spreadsheet-craft'],[/workbook/i,'workbook-craft'],[/checklist/i,'checklist-craft'],[/template/i,'template-craft'],[/guides?/i,'guide-writer'],[/reports?/i,'report-writer'],[/manuals?|handbook|\bsop\b|procedure/i,'manual-writer'],[/course|workshop|lesson/i,'course-architect'],[/document|google docs/i,'document-writer']].find(([pattern])=>pattern.test(format));if(route)names.push(route[1]);}
 return names;
}
export function readFormatSkills(format,{planning=false}={}){
 const names=formatSkillNames(format);
 return (planning&&names.length?'FORMAT PLANNING ONLY: Use the following format requirements to describe the approved units and deliverables concisely. Do not draft the manuscript or add scope or approvals.\n':'')+names.map(name=>{
  const skill=readSkill(name);if(!planning)return skill;
  const contract=skill.match(/^## Planning Contract\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/m);if(!contract)throw new Error('Missing planning contract for '+name);
  return skill.match(/^# .+$/m)[0]+'\n'+contract[1].trim();
 }).join('\n\n');
}
export function readFormatQuality(format){
 return formatSkillNames(format).map(name=>{const skill=readSkill(name),section=skill.match(/^## Final Quality Review\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/m);return section?name+'\n'+section[1].trim():'';}).filter(Boolean).join('\n\n');
}
export function readProductDesign(format){
 const section=(skill,heading)=>{const match=skill.match(new RegExp('^## '+heading+'\\r?\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))','m'));if(!match)throw Error('Missing product design guidance: '+heading);return match[0].trim();};
 return 'PRODUCT VISUAL DIRECTION — apply to this authorized new file only; existing approved content, design, formulas, artwork and notes remain protected. No extra question, model turn or approval step.\n'+section(readSkill('product-page-design'),'Design Direction')+'\n\n'+formatSkillNames(format).map(name=>{const skill=readSkill(name);return skill.match(/^# .+$/m)[0]+'\n'+section(skill,'Visual Design');}).join('\n\n');
}
