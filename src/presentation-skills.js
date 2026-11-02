import {readFileSync} from 'node:fs';

export const presentationSkillNames={editorial:'presentation-editorial',studio:'presentation-studio',warm:'presentation-warm'};
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
export function loadPresentationSkill(conceptId){
  const name=presentationSkillNames[conceptId];
  if(!name)throw new Error('Choose one of the three presentation art directions.');
  return read('../skills/product-page-design/references/slide-art-direction.md')+'\n\n'+read(`../skills/${name}/SKILL.md`);
}
export function loadPresentationSkills(){return read('../skills/product-page-design/references/slide-art-direction.md')+'\n\n'+Object.values(presentationSkillNames).map(name=>read(`../skills/${name}/SKILL.md`)).join('\n\n');}
