import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as outline from '../public/outline-plan.js';
import {currentAction} from '../public/current-action.js';

const plan=['Choose A Goal','Build The Page','Test The Journey'].map(heading=>`## ${heading}\n### Purpose\nTeach the practical task with a useful example and result.`).join('\n\n');
const first='## Choose A Goal\n\nChoose one action.';
function project(){return {brief:{outline:'Choose A Goal\nBuild The Page\nTest The Journey',productDraft:first},approvedOutline:'Choose A Goal\nBuild The Page\nTest The Journey',expandedOutline:plan,approvedExpandedOutline:plan,approvedDraft:first};}
test('the finish path counts real approvals and names only the next exact planned unit',()=>{
  const p=project(),progress=outline.creationProgress(p);assert.equal(progress.total,3);assert.equal(progress.approved,1);assert.equal(progress.next,'Build The Page');assert.equal(progress.pending,false);
  p.brief.productDraft+='\n\n## Build The Page\n\nWrite a useful page.';const pending=outline.creationProgress(p);assert.equal(pending.approved,1);assert.equal(pending.drafted,2);assert.equal(pending.pending,true);assert.equal(pending.next,'');
  p.approvedDraft=p.brief.productDraft;assert.equal(outline.creationProgress(p).next,'Test The Journey');
});
test('changed plans, out-of-order source and revised approved text cannot offer blind continuation',()=>{
  for(const change of [p=>p.brief.outline+='\nNew Work',p=>p.brief.productDraft+='\n\n## Test The Journey\n\nSkipped work.',p=>p.brief.productDraft=p.brief.productDraft.replace('one','another')]){const p=project();change(p);assert.equal(outline.creationProgress(p).next,'');}
});
test('remaining content is built in one action before whole-product review',()=>{
  const action=currentAction({stage:10,plan:{basicApproved:true,expandedApproved:true,covered:false,total:3,approved:1,next:'Build The Page'},sample:{presentation:true,choice:'editorial',current:true,approved:true},draft:{hasSource:true,pending:false,sampleApproved:true}});
  assert.equal(action.primary.id,'build-full-draft');assert.equal(action.primary.label,'Build full draft');assert.match(action.detail,/review the whole product/);const pending=currentAction({stage:10,plan:{basicApproved:true,expandedApproved:true,covered:false,total:3,drafted:2},sample:{presentation:true,choice:'editorial',current:true,approved:true},draft:{hasSource:true,pending:true,sampleApproved:true}});assert.equal(pending.primary.id,'build-full-draft');
});
