import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as outline from '../public/outline-plan.js';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
test('whole-product review exposes every section and the complete manuscript without losing content',()=>{
  const text='## Opening Section\n\nOpening teaching.\n\n## Closing Section\n\nClosing teaching.';
  const scope={...outline,state:{id:'reader',brief:{productDraft:text},approvedDraft:'',sampleApproved:false},sectionViews:{},view:'draft',working:false,currentDraftSection:()=>({text:'## Closing Section\n\nClosing teaching.'}),manuscriptHtml:value=>value,expandedOutlineMarkup:value=>value,rich:value=>value,esc:value=>String(value||''),renderSampleReview:()=>'<p>Old sample controls</p>',renderExportPreview:()=>'',renderSuggestions:()=>''};
  scope.expandedOutlineCovered=()=>true;
  vm.createContext(scope);vm.runInContext(source.slice(source.indexOf('function sectionWorkspaceData('),source.indexOf('function renderOutlineReview(')),scope);vm.runInContext(source.slice(source.indexOf('function renderDraft(){'),source.indexOf('function links(')),scope);
  const html=scope.renderDraft();assert.match(html,/Opening Section/);assert.match(html,/Closing Section/);assert.match(html,/Opening teaching/);assert.doesNotMatch(html,/Closing teaching|Old sample controls/);assert.match(html,/Read full manuscript/);assert.match(html,/Design and optional cover image/);
  scope.sectionViews.product.all=true;const whole=scope.renderDraft();assert.match(whole,/Full manuscript/);assert.match(whole,/Opening teaching/);assert.match(whole,/Closing teaching/);assert.equal(scope.state.brief.productDraft,text);
});
