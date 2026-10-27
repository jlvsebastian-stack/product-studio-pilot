import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interview,interviewPrompt} from '../src/interview.js';
import {freshProject} from '../src/product.js';

const blank=()=>freshProject().brief;
const answer='A niche is a specific group with a specific problem. For a booking guide, that could be independent tutors setting up their first paid booking. That is a starting suggestion for us to refine together. Ask me whenever a term or suggestion is unclear.';
const request=(stage,brief)=>({interviewStage:stage,currentInput:'What does niche mean? I do not understand.',messages:[{role:'user',content:'What does niche mean? I do not understand.'}],brief,approvedDraft:brief.productDraft});
const run=(stage,brief)=>interview(request(stage,brief),{infer:async()=>({message:answer,stageReady:false,summary:'Explained the proposed audience focus; awaiting the creator’s decision.',brief:{...brief}})});

test('a first-time creator receives an explanation before another baseline question',async()=>{
  const result=await run(1,blank());
  assert.equal(result.message,answer);assert.equal(result.stageReady,false);
  assert.equal(result.brief.topic,'');assert.equal(result.brief.productDraft,'');
});

test('planning explanations survive the pacing rules without changing decisions',async()=>{
  for(const stage of [2,3,4,6,7,8]){
    const result=await run(stage,{...blank(),topic:'Booking websites',buyer:'Independent tutors',outcome:'Take a first paid booking',offer:'A practical setup guide',format:'Guide',outline:'Choose a booking task'});
    assert.equal(result.message,answer,`stage ${stage}`);
    assert.equal(result.brief.productDraft,'');
  }
});

test('sample and drafting explanations preserve the manuscript and do not imply approval',async()=>{
  const draft='## Choose a booking task\n\nList the details a tutor needs for one paid booking.';
  for(const stage of [9,10,11]){
    const result=await run(stage,{...blank(),topic:'Booking websites',format:'Guide',outline:'Choose a booking task',productDraft:draft});
    assert.equal(result.message,answer,`stage ${stage}`);
    assert.equal(result.brief.productDraft,draft);
    assert.deepEqual(result.preferenceUpdates,[]);
  }
});

test('an explanation during an unperformed market check retains the honest research boundary',async()=>{
  const result=await run(5,{...blank(),marketEvidence:'Research UNRUN; no offers inspected.'});
  assert.ok(result.message.startsWith(answer));
  assert.equal(result.stageReady,false);assert.match(result.message,/unverified/);
  assert.doesNotMatch(result.message,/which two|send (?:me )?(?:two |competitor )?links/i);
});

test('both providers receive collaborative guidance and permission to ask for clarification at every stage',()=>{
  for(const provider of ['chatgpt','claude'])for(let stage=1;stage<=12;stage++){
    const {prompt}=interviewPrompt({...request(stage,blank()),provider});
    assert.match(prompt,/Understand enough.*suggest.*build.*feedback.*improve/i);
    assert.match(prompt,/answer the creator.s questions first/i);
    assert.match(prompt,/invite.*ask.*unclear/i);
    assert.match(prompt,/not.*approval|does not.*approval/i);
  }
});
