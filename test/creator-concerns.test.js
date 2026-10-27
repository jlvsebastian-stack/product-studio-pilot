import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interview,interviewPrompt} from '../src/interview.js';
import {freshProject} from '../src/product.js';

const brief=()=>({...freshProject().brief,topic:'Build a simple launch page',buyer:'First-time independent creators',outcome:'Launch a working sales page',offer:'A practical launch workshop',format:'Webinar presentation with presenter notes',outline:'Define your minimum launch setup\nBuild the page\nTest the purchase flow'});
const reply=(b,message)=>({replyKind:'discussion',message,stageReady:true,summary:'Review the concern before continuing.',brief:b,suggestions:[],preferenceUpdates:[],companions:[]});
const request=(stage,input,b=brief())=>({interviewStage:stage,currentInput:input,messages:[{role:'user',content:input}],brief:b,approvedDraft:b.productDraft});
const run=(data,result)=>interview(data,{infer:async()=>result});

test('a concern and backend correction survive pacing even when the answer ends with a question',async()=>{
  const input='We need a backend to setup email, tracking, etc. It looks simple enough. But will people pay for this?';
  const message='That is a fair concern: a simple page alone may feel hard to charge for. This workshop can help a first-time creator connect the page, email and tracking, then test the purchase flow. That gives us a clearer practical result, but it does not prove people will pay. We can test interest with a small pilot before building every lesson. I added the backend connections to the proposed outline. To shape that pilot, would you rather teach the complete setup or start with the page?';
  const updated={...brief(),outline:'Define your minimum launch setup\nBuild the page\nConnect the backend for email and tracking\nTest the purchase flow'};
  const result=await run(request(8,input),reply(updated,message));
  assert.equal(result.message,message);assert.equal(result.stageReady,false);
  assert.match(result.brief.outline,/backend for email and tracking/);
  assert.equal(result.brief.productDraft,'');
});

test('insecurity without a question mark remains a discussion rather than a progress template',async()=>{
  const message='It makes sense to feel unsure about teaching this for the first time. We can keep the first workshop small: demonstrate one working launch setup, explain its limits, and invite feedback on a sample. That lets you teach what you know without claiming results you have not achieved.';
  const result=await run(request(6,'I feel insecure about teaching this. I am afraid it is too basic.'),reply(brief(),message));
  assert.equal(result.message,message);assert.equal(result.stageReady,false);
});

test('questions and concerns cannot expand or silently revise the manuscript at any drafting stage',async()=>{
  const original='## Define your minimum launch setup\n\nChoose one buyer task and identify the accounts it needs.';
  for(const stage of [9,10,11,12]){
    const b={...brief(),productDraft:original};
    const message='We can pause here. The sample is a first draft for review; it does not commit you to teaching a full technical stack. We can narrow the result together before adding material.';
    const result=await run(request(stage,'I feel overwhelmed by the technical setup.',b),reply({...b,productDraft:original+'\n\n## Extra lesson\n\nUnrequested expansion.'},message));
    assert.equal(result.message,message,`stage ${stage}`);
    assert.equal(result.brief.productDraft,original);assert.equal(result.stageReady,false);
  }
});

test('discussion at format choice does not trigger an unrelated six-format rewrite',async()=>{
  let calls=0;
  const b={...brief(),format:''},message='You can teach a small useful result without being an expert in every tool. Start with the launch task you already know, name the limits, and review a sample together before deciding its format.';
  const result=await interview(request(7,'I worry that I am not qualified to teach.',b),{infer:async()=>{calls++;return reply(b,message);}});
  assert.equal(calls,1);assert.equal(result.message,message);assert.equal(result.stageReady,false);
});

test('both providers receive concern-first guidance and a structured discussion route',()=>{
  for(const provider of ['chatgpt','claude'])for(const stage of [1,6,8,10,12]){
    const {prompt}=interviewPrompt({...request(stage,'Will anyone want this?'),provider});
    assert.match(prompt,/replyKind/);assert.match(prompt,/concerns.*insecurity|insecurity.*concerns/i);
    assert.match(prompt,/not.*(?:proof|guarantee).*pay|never.*(?:promise|guarantee).*sales/i);
  }
});
