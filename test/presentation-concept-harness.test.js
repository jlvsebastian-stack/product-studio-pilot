import {withApprovedOutline} from './interview-fixtures.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interview,interviewPrompt} from '../src/interview.js';
import {freshProject} from '../src/product.js';
import {sourceFingerprint} from '../public/design-concepts.js';

const sample='## Choose the website’s job\n\nChoose awareness, lead capture or direct sales.\n\n### Presenter notes\n\nExplain the three visitor actions.';
const next='\n\n## Compare the options\n\nCompare the visitor action before choosing features.\n\n### Presenter notes\n\nKeep the same digital product in every example.';
const request=()=>withApprovedOutline({interviewStage:10,currentInput:'Create the next slide.',messages:[{role:'user',content:'Create the next slide.'}],approvedDraft:sample,brief:{...freshProject().brief,title:'A useful launch',topic:'Digital product websites',buyer:'First-time digital creators',outcome:'Choose a useful website setup',format:'Webinar presentation with presenter notes',outline:'Choose the website’s job\nCompare the options',productDraft:sample}});
const infer=(data,kind='progress')=>({infer:async()=>({replyKind:kind,message:kind==='discussion'?'We can use warmer colors without changing your lesson.':'Here is the next slide.',stageReady:true,summary:'Next slide for review.',brief:{...data.brief,productDraft:data.brief.productDraft+next}})});

test('ebook and workbook authoring keep their own density and do not load the slide checkpoint',async()=>{
  for(const format of ['Ebook guide','Workbook']){
    const data=request();data.brief.format=format;
    const {prompt}=interviewPrompt(data);assert.doesNotMatch(prompt,/PRESENTATION CONCEPT CHECKPOINT/);assert.doesNotMatch(prompt,/# Quiet Editorial/);
    const result=await interview(data,infer(data));assert.equal(result.brief.productDraft,sample+next);
  }
});

test('presentation expansion waits for a chosen and approved rendered concept, preserving the approved manuscript',async()=>{
  for(const choice of [undefined,null,{conceptId:'warm',approved:false,sourceFingerprint:'sample'},{conceptId:'studio',approved:true,sourceFingerprint:'an-old-sample'}]){
    const data={...request(),...(choice!==undefined?{presentationDesign:choice}:{})},result=await interview(data,infer(data));
    assert.equal(result.brief.productDraft,sample);
    assert.equal(result.stageReady,false);
    assert.match(result.message,/three|3/);
    assert.match(result.message,/template.*three generated sample slides/);
  }
});

test('runtime design instructions require template choice before three samples and retain the 40% empty-space rule',()=>{
  const {prompt}=interviewPrompt(request());
  assert.match(prompt,/chooses ONE template before any custom slide generation/);assert.match(prompt,/exactly three sample slides/);
  assert.match(prompt,/at least 40% empty space/i);
  assert.match(prompt,/native per-slide presenter notes/i);
});

test('an approved rendered concept permits the next slide and remains current when a new lesson is appended',async()=>{
  const data=request();data.presentationDesign={conceptId:'studio',approved:true,sourceFingerprint:sourceFingerprint(data.brief)};
  const result=await interview(data,infer(data),{presentationArtReady:true});
  assert.equal(result.brief.productDraft,sample+next);
  assert.equal(sourceFingerprint(result.brief),data.presentationDesign.sourceFingerprint);
});

test('an old style approval or a client flag cannot substitute for actual saved artwork',async()=>{
  const data=request();data.presentationDesign={conceptId:'studio',approved:true,sourceFingerprint:sourceFingerprint(data.brief)};
  data.presentationArtReady=true;data.slideProductionId='unverified-client-id';
  const result=await interview(data,infer(data));
  assert.equal(result.brief.productDraft,sample);assert.equal(result.stageReady,false);
});

test('the live interview loads all three art skills, then the selected variation, and requests less visible text',()=>{
  const data=request(),all=interviewPrompt(data).prompt;
  for(const title of ['Quiet editorial','Signal studio','Warm dimension'])assert.match(all,new RegExp(title,'i'));
  assert.match(all,/14 TOTAL visible words/);assert.match(all,/artwork prompt/i);
  data.presentationDesign={conceptId:'studio',approved:false,sourceFingerprint:sourceFingerprint(data.brief)};
  const selected=interviewPrompt(data).prompt;
  assert.match(selected,/Signal studio/i);assert.doesNotMatch(selected,/# Quiet editorial/);
});

test('changing the representative sample requires visual review again without losing the revision',async()=>{
  const data=request();data.revisionIntent=true;data.presentationDesign={conceptId:'warm',approved:true,sourceFingerprint:sourceFingerprint(data.brief)};
  const revised=sample.replace('Choose awareness, lead capture or direct sales.','Choose the first action a visitor should finish.');
  const result=await interview(data,{infer:async()=>({replyKind:'progress',message:'Here is the revised sample.',stageReady:true,summary:'Revised for review.',brief:{...data.brief,productDraft:revised}})});
  assert.equal(result.brief.productDraft,revised);assert.equal(result.stageReady,false);
  assert.notEqual(sourceFingerprint(result.brief),data.presentationDesign.sourceFingerprint);
});

test('design questions still receive a conversational answer while the chooser is awaiting approval',async()=>{
  const data=request();data.currentInput='Could we make the slides warmer?';
  const result=await interview(data,infer(data,'discussion'));
  assert.match(result.message,/warmer colors/);
  assert.equal(result.brief.productDraft,sample);
  assert.equal(result.stageReady,false);
});
