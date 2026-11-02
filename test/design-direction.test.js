import {withApprovedOutline} from './interview-fixtures.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interview,interviewPrompt} from '../src/interview.js';
import {freshProject} from '../src/product.js';

const sample='## Choose the website’s job\n\nChoose the primary action before building: awareness, lead capture or direct sales. Keep optional features for later.\n\n### Presenter notes\n\nExplain how the visitor action changes the required setup.';
const request=(extra={})=>withApprovedOutline({interviewStage:9,messages:[{role:'user',content:'Create the first sample.'}],approvedDraft:'',brief:{...freshProject().brief,topic:'AI-assisted launch websites',format:'Practical guide',outline:'Choose the website’s job'},...extra});
const response=b=>({replyKind:'progress',message:'Here is the sample.',stageReady:true,summary:'Sample for review.',brief:{...b,productDraft:sample}});

test('the first sample visibly proposes its design direction and invites changes before approval',async()=>{
  const data=request(),result=await interview(data,{infer:async()=>response(data.brief)});
  assert.match(result.message,/visual direction/i);assert.match(result.message,/proposed/i);
  assert.match(result.message,/colors|colours/);assert.match(result.message,/reference/);
  assert.match(result.message,/before approving/i);
  assert.match(result.brief.design,/modern|diagram|visual/i);
  assert.equal(result.brief.productDraft,sample);
});

test('the proposed design reuses explicit creator preferences instead of imposing a fixed house style',async()=>{
  const data=request({preferences:[{id:'design',text:'Use a warm white background with deep green and clear diagrams.',category:'design',source:'explicit'}]});
  const result=await interview(data,{infer:async()=>response(data.brief)});
  assert.match(result.brief.design,/deep green/);assert.match(result.message,/deep green/);
  assert.equal(result.brief.productDraft,sample);assert.deepEqual(result.preferenceUpdates,[]);
});

test('presentation guidance requires meaningful visual compositions rather than pasted paragraphs',()=>{
  const {prompt}=interviewPrompt(request());
  assert.match(prompt,/visual direction/i);assert.match(prompt,/comparison|journey|diagram/i);
  assert.match(prompt,/raw Markdown|raw pipe/i);assert.match(prompt,/approval|approving/i);
  assert.match(prompt,/generated images.*available|available.*generated images/i);
});
