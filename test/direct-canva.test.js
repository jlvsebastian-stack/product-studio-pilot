import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProject} from '../src/product.js';
import * as designs from '../public/design-concepts.js';

const brief={...freshProject().brief,title:'A Useful Handoff',format:'Webinar presentation',design:'Editorial',tone:'Supportive',productDraft:'## Choose The Task\n\nAsk the recipient which approved file needs changing. Demonstrate the next task before handing over the editable document.\n\n### Presenter notes\n\nKeep the source ALPHA unchanged.\n\n## Test The Result\n\nTry the intended change in the actual document. Confirm the recipient can repeat the change without assistance.\n\n### Presenter notes\n\nKeep the source BRAVO unchanged.'};
const raw=()=>({brief:{...brief},approvedSource:brief.productDraft,concept:{id:'editorial',title:'Quiet editorial'},provider:'chatgpt',model:'gpt-6.1-sol',reasoningEffort:'medium',direct:true,mode:'samples'});
const plan=(sourceId,headline,labels)=>({sourceId,purpose:'Teach '+headline+' through a source-specific editable relationship diagram.',headline,kind:'process',nodes:labels.map((label,index)=>({label,symbol:index?'document':'person'})),links:[{from:0,to:1}],visualAnchors:sourceId==='source-1'?[{source:'recipient',depiction:'A person starts the handoff.'},{source:'approved file',depiction:'The document is the object of the task.'}]:[{source:'intended change',depiction:'The document displays the requested change.'},{source:'without assistance',depiction:'The recipient repeats the task independently.'}]});
const proposal=()=>({slides:[plan('source-1','Choose The Task',['Recipient','Document']),plan('source-1','Demonstrate The Change',['Task','Demonstration']),plan('source-2','Test The Result',['Change','Repeat'])]});

test('native plan binding preserves canonical source, validates order/grounding/visible words and emits separate editable text',()=>{
  const saved=structuredClone(brief),plans=designs.bindNativeCanvaPlans(proposal(),brief,'editorial');
  const transfer=designs.renderCanvaTransfer({brief,conceptId:'editorial',nativePlans:plans});
  assert.deepEqual(plans.map(plan=>plan.sourceId),['source-1','source-1','source-2']);assert.deepEqual(brief,saved);
  for(const [index,page]of transfer.pages.entries()){assert.equal(page.notes.includes(plans[index].sourceAudience),true);assert.equal(page.notes.includes(plans[index].originalNotes),true);assert.equal(page.visibleText.includes('Original audience'),false);assert.ok(page.visibleBlocks.length>=3);assert.ok(transfer.html.includes('<div style="position:absolute'));assert.ok(!transfer.html.includes('<text '));}
  for(const change of [value=>value.slides.reverse(),value=>value.slides.pop(),value=>value.slides[0].visualAnchors[0].source='Unsupported source',value=>value.slides[0].headline='A Very Long Headline With More Than Fourteen Visible Words Before We Even Add Any Labels',value=>value.slides[0].nodes[0].symbol='<script>']){const invalid=proposal();change(invalid);assert.throws(()=>designs.bindNativeCanvaPlans(invalid,brief,'editorial'));}
});

test('comparison and decision alternatives cannot be planned as a misleading sequential chain',()=>{
  const comparison=proposal();comparison.slides[0]={...comparison.slides[0],kind:'comparison'};
  assert.throws(()=>designs.bindNativeCanvaPlans(comparison,brief,'editorial'),/comparison|alternatives/i);
  const decision=proposal();decision.slides[0]={...decision.slides[0],kind:'decision',nodes:[{label:'Choose',symbol:'decision'},{label:'Ask',symbol:'person'},{label:'Join',symbol:'form'}],links:[{from:0,to:1},{from:1,to:2}]};
  assert.throws(()=>designs.bindNativeCanvaPlans(decision,brief,'editorial'),/branch|hub|decision/i);
});

test('comparisons stay unlinked, decisions branch visibly and only chronological processes use sequential arrows',()=>{
  const value=proposal();value.slides[0]={...value.slides[0],kind:'comparison',links:[]};value.slides[1]={...value.slides[1],kind:'decision',nodes:[{label:'Choose',symbol:'decision'},{label:'Ask',symbol:'person'},{label:'Join',symbol:'form'}],links:[{from:0,to:1},{from:0,to:2}]};
  const bound=designs.bindNativeCanvaPlans(value,brief,'editorial'),pages=designs.renderNativeCanvaPages(brief,'editorial',bound),transfer=designs.renderCanvaTransfer({brief,conceptId:'editorial',nativePlans:bound});
  assert.doesNotMatch(pages[0].svg,/data-native-relationship/);assert.equal([...pages[1].svg.matchAll(/data-native-relationship="decision"/g)].length,2);assert.match(pages[1].svg,/M640 365 V420 H250 V438/);assert.match(pages[1].svg,/M640 365 V420 H1030 V438/);assert.match(pages[2].svg,/data-native-relationship="process"/);
  for(const [index,page]of pages.entries()){assert.ok(page.emptyRatio>=.4);assert.ok(designs.slideWordCount(page.visibleText)<=14);assert.ok(page.notes.includes(bound[index].sourceAudience));assert.ok(page.notes.includes(bound[index].originalNotes));assert.ok(page.contentAreas.every(area=>area.x>=0&&area.y>=0&&area.x+area.w<=1280&&area.y+area.h<=720));}
  const headers=[...transfer.html.matchAll(/<div style="([^"]*)">([^<]*)<\/div>/g)].filter(([,style])=>style.includes('font-size:62px'));assert.equal(headers.length,3);for(const [,style]of headers){assert.ok(Math.abs(Number(/top:([\d.]+)px/.exec(style)[1])-68.54)<.01);assert.ok(Math.abs(Number(/height:([\d.]+)px/.exec(style)[1])-74.4)<.01);assert.match(style,/line-height:1.2/);assert.match(style,/margin:0;padding:0/);}
  const digital={...brief,productDraft:brief.productDraft.replace('approved file','digital guide')},packagePlan=proposal();for(const slide of packagePlan.slides)if(slide.sourceId==='source-1')slide.visualAnchors[1].source='digital guide';packagePlan.slides[0].nodes[1].symbol='package';assert.throws(()=>designs.bindNativeCanvaPlans(packagePlan,digital,'editorial'),/digital access|physical delivery/);
});
