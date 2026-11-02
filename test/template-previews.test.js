import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {DESIGN_CONCEPTS} from '../public/design-concepts.js';
const previews=await import('../public/template-previews.js').catch(()=>({}));
test('three lightweight template examples have distinct native type, palettes and compositions without claiming generated artwork',()=>{
  assert.equal(typeof previews.templatePreview,'function');const svgs=DESIGN_CONCEPTS.map(concept=>previews.templatePreview(concept.id));assert.equal(new Set(svgs).size,3);
  for(let index=0;index<svgs.length;index++){const svg=svgs[index],concept=DESIGN_CONCEPTS[index];assert.match(svg,/<svg/);assert.match(svg,/viewBox="0 0 1280 720"/);assert.ok(svg.includes(concept.visualSystem.headingFont));assert.ok(svg.includes(concept.visualSystem.background));assert.match(svg,/data-template-preview=/);assert.doesNotMatch(svg,/\/slide-assets\/|data-artwork-id|canvaMediaId|<foreignObject|<script/);assert.ok(svg.length<12000);}
  assert.match(svgs[0],/data-composition="editorial-column"/);assert.match(svgs[1],/data-composition="studio-poster"/);assert.match(svgs[2],/data-composition="warm-object"/);assert.throws(()=>previews.templatePreview('unknown'));
});

test('an older local server missing the template module gives a truthful restart message without touching saved creator work',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8'),loader=app.slice(app.indexOf('const {templatePreview}='),app.indexOf('const conceptStyles=')),nodes=Object.fromEntries(['workspace-content','model-note','provider','model','quality','new-project','open-project','save-project'].map(id=>[id,{disabled:false,textContent:''}])),saved={draft:'Retain my manuscript',pendingAnswer:'Keep this unsent'},before=JSON.stringify(saved);
  const scope={loadTemplates:async()=>{throw Error('Module unavailable');},document:{getElementById:id=>nodes[id]},saved};await assert.rejects(vm.runInNewContext('(async()=>{'+loader.replace("await import('./template-previews.js')",'await loadTemplates()')+'})()',scope),/Module unavailable/);assert.match(nodes['workspace-content'].textContent,/Restart[\s\S]*retained/i);assert.equal(nodes.provider.disabled,true);assert.equal(JSON.stringify(saved),before);
});
