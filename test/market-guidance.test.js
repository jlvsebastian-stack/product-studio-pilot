import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interview } from '../src/interview.js';
import { freshProject } from '../src/product.js';

const blank=()=>freshProject().brief;
const brief={...blank(),topic:'Booking websites with payment confirmations',buyer:'Independent tutors',outcome:'Complete a first paid booking',offer:'A practical booking setup course',format:'Course materials'};
const observed=`Observed comparable learning products:
Booking Basics course — https://example.com/booking-course — The inspected course page includes five setup lessons, a worked booking demonstration and a learner checklist.
Practical Scheduling workshop — https://example.org/scheduling-workshop — The inspected workshop page covers confirmation messages and includes a guided scheduling exercise.
Adjacent context: Builder App — https://example.net/builder — a software platform offering booking forms, not a comparable course.
Paid plan price UNRUN.
Current paid price/currency UNRUN.
Detailed review complaints UNRUN.
Possible improvement: let learners customize their own booking flow; this is a proposal, not proof of demand.`;
const request=(extra={})=>({interviewStage:5,messages:[{role:'user',content:'I want learners to customize their own booking flow, rather than copy a fixed template.'}],brief:{...brief},...extra});
const reply=(extra={})=>({message:'The two course pages give us useful examples: guided setup and confirmation practice. Your customization idea gives us a clear angle to explore together.',stageReady:true,summary:'Two inspected learning offers support an initial comparison; prices and demand remain unknown.',brief:{...brief,marketEvidence:observed},...extra});
const run=(input,output)=>interview(input,{infer:async()=>output});

test('inspected course facts remain usable when optional prices and review details are UNRUN',async()=>{
  const model=reply(),result=await run(request(),model);
  assert.equal(result.stageReady,true);
  assert.equal(result.brief.marketEvidence,observed);
  assert.equal(result.message,model.message);
  assert.doesNotMatch(result.message,/unverified|which two|offer links/i);
  assert.match(result.brief.marketEvidence,/price\/currency UNRUN/);
});

test('uncertain currency, demand, results and rights claims cannot erase inspected course contents',async()=>{
  const facts='Observed course A: https://example.com/course-a . Opened syllabus lists beginner lessons and a project walkthrough.\nObserved course B: https://example.org/course-b . Opened course page describes a checklist and worked examples.';
  for(const caveat of ['Current currency code was not verified.','Market demand and a unique advantage remain unverified.','Customer results and sales were not verified.','Ownership and usage rights remain unverified.','Detailed reviews were not inspected.']){
    const marketEvidence=facts+'\n'+caveat,model=reply({brief:{...brief,marketEvidence}});
    const result=await run(request(),model);
    assert.equal(result.stageReady,true,caveat);
    assert.equal(result.brief.marketEvidence,marketEvidence);
    assert.equal(result.message,model.message);
  }
});

test('an explicit unperformed whole check still rejects otherwise plausible descriptions and optional caveats',async()=>{
  for(const status of ['Research has not been performed.','Research UNRUN.','The course pages were not inspected; current currency remains unknown.','Market check remains unverified because browsing failed.','These comparisons are hypothetical and the course pages were not inspected.']){
    const marketEvidence=observed+'\n'+status;
    const result=await run(request(),reply({brief:{...brief,marketEvidence}}));
    assert.equal(result.stageReady,false,status);assert.equal(result.brief.marketEvidence,marketEvidence);
  }
});

test('an explicit retraction of prior hypothetical comparisons cannot be replaced by stored evidence for a novice',async()=>{
  const marketEvidence='Research UNRUN. The previous comparison examples were hypothetical; the course pages were not inspected.';
  const result=await run(request({brief:{...brief,marketEvidence:observed},currentInput:'This is my first product. I do not know.',messages:[{role:'user',content:'This is my first product. I do not know.'}]}),reply({message:'I need to correct the earlier comparison: those descriptions were hypothetical.',brief:{...brief,marketEvidence}}));
  assert.equal(result.stageReady,false);assert.equal(result.brief.marketEvidence,marketEvidence);
  assert.match(result.message,/correct|retract|unverified/i);
  assert.doesNotMatch(result.message,/which two|share.*links/i);
});

test('an optional research-detail gap cannot force a first-time creator to find competitor links',async()=>{
  const result=await run(request({messages:[{role:'user',content:'This is my first time creating a product. I do not know competitors.'}]}),reply({stageReady:false,message:'Which two actual offer links can you share before we continue?'}));
  assert.equal(result.stageReady,true);
  assert.doesNotMatch(result.message,/which two|share.*links|before we continue/i);
  assert.match(result.message,/we|together|already|comparison/i);
});

test('optional competitor price checks stay with the AI rather than blocking the creator',async()=>{
  const result=await run(request(),reply({stageReady:false,message:'Please find the current prices for these courses before we can move on.'}));
  assert.equal(result.stageReady,true);
  assert.doesNotMatch(result.message,/please find|before we can move on/i);
  assert.match(result.message,/prices.*stay open|reviews.*stay open/i);
});

test('repeated uncertainty reuses inspected offers and the creator improvement without assigning research homework',async()=>{
  let input=request({brief:{...brief,marketEvidence:observed},messages:[{role:'user',content:'I want learners to customize their own booking flow.'},{role:'assistant',content:'Which two actual offer links can you share?'},{role:'user',content:'This is my first product. I do not know.'}]});
  const stalled=reply({stageReady:false,message:'Which two actual offer links can you share?',brief:{...brief,marketEvidence:'Research UNRUN because the creator did not supply links.'}});
  for(let turn=0;turn<2;turn++){
    const result=await run(input,stalled);
    assert.equal(result.stageReady,true);
    assert.equal(result.brief.marketEvidence,observed);
    assert.doesNotMatch(result.message,/which two|share.*links|supply.*links/i);
    input={...input,brief:result.brief,messages:[...input.messages,{role:'assistant',content:result.message},{role:'user',content:'I still do not know competitor names.'}]};
  }
});

test('whole-check UNRUN, invented examples and empty URL lists stay unverified without compulsory user links',async()=>{
  for(const marketEvidence of [
    'Research UNRUN. https://example.com/a https://example.org/b',
    'Observed offers: https://example.com/a https://example.org/b',
    'Observed offers for independent tutors creating booking websites and payment confirmations: https://example.com/a https://example.org/b',
    'Hypothetical examples, not inspected: Course A https://example.com/a includes five lessons. Course B https://example.org/b covers setup exercises.',
    'The pages could not be inspected. https://example.com/a https://example.org/b'
  ]){
    const result=await run(request({messages:[{role:'user',content:'I am new to this. I do not know any competitors.'}]}),reply({brief:{...brief,marketEvidence}}));
    assert.equal(result.stageReady,false,marketEvidence);
    assert.equal(result.brief.marketEvidence,marketEvidence);
    assert.match(result.message,/unverified/i);
    assert.match(result.message,/I.*(?:retry|research|search)|we.*(?:retry|research|search)/i);
    assert.doesNotMatch(result.message,/which two|share two|required links|send (?:me )?(?:(?:two|2) )?(?:actual )?(?:offer |competitor )?links/i);
  }
});

test('unavailable research offers a truthful user-triggered retry through the existing search call',async()=>{
  let calls=0;
  const providers={infer:async(_,__,___,options)=>{calls++;assert.equal(options.search,true);return calls===1?reply({brief:{...brief,marketEvidence:'Research UNRUN; browsing unavailable.'}}):reply();}};
  const first=await interview(request(),providers);
  assert.equal(calls,1);assert.equal(first.stageReady,false);
  assert.match(first.message,/try again/i);
  assert.doesNotMatch(first.message+' '+first.summary,/I[’']ll retry|AI will retry|retrying|background/i);
  const second=await interview(request({brief:first.brief,messages:[{role:'user',content:'Try again.'}]}),providers);
  assert.equal(calls,2);assert.equal(second.stageReady,true);
});

test('the AI receives research ownership and a comparable-learning-product target through the normal search-enabled call',async()=>{
  let emitted;
  const result=await interview(request(),{infer:async(_,prompt,__,options)=>{emitted={prompt,options};return reply();}});
  assert.equal(emitted.options.search,true);assert.equal(result.stageReady,true);
  assert.match(emitted.prompt,/comparable (?:learning )?products.*courses|courses.*comparable/i);
  assert.match(emitted.prompt,/adjacent software|software platforms/i);
  assert.match(emitted.prompt,/you.*(?:research|search)|take.*research|lead.*research/i);
  assert.doesNotMatch(emitted.prompt,/mark research UNRUN and ask for actual offer links/i);
});

test('a useful concise natural model proposal survives instead of being replaced by a uniform recap',async()=>{
  for(const message of ['This is coming together: a short guide that gets a tutor from a blank page to a working booking. I’d start there, then choose the first reader.','A booking guide for independent tutors could work well. The confirmation workflow gives it a practical thread.']){
    const result=await run(request({interviewStage:2,brief:{...brief,format:'Guide'}}),reply({message,summary:'Start with the first paid booking.',brief:{...brief,format:'Guide'}}));
    assert.equal(result.stageReady,true);assert.equal(result.message,message);
    assert.equal(result.summary,'Start with the first paid booking.');
  }
});

test('preserving natural voice cannot retain a rejected source customer claim',async()=>{
  const source={id:'source',name:'Booking notes.txt',kind:'file',mimeType:'text/plain',text:'I built booking websites with payment confirmations for thirty clients.',status:'ready',note:'Supplied text.'};
  const message='Your thirty clients give you a strong starting point for booking websites. I’d start with a payment confirmation guide.';
  const content='I build booking websites with payment confirmations.';
  for(const example of [source.text,'']){
    const result=await run(request({interviewStage:1,currentInput:content,references:[source],messages:[{role:'user',content}]}),reply({message,brief:{...brief,example}}));
    assert.equal(result.stageReady,true);assert.equal(result.brief.example,'');assert.doesNotMatch(result.message,/thirty clients/);
  }
});

test('natural source discussion and actual typed customer history stay available',async()=>{
  const source={id:'source',name:'Outside booking notes.txt',kind:'file',mimeType:'text/plain',text:'I built booking websites with payment confirmations for thirty clients.',status:'ready',note:'Supplied text.'};
  for(const [content,message] of [
    ['I build booking websites with payment confirmations.','The author of Outside booking notes.txt describes thirty clients; that is a source claim. A booking guide for independent tutors could start with a payment confirmation exercise.'],
    ['I build booking websites with payment confirmations for thirty clients.','Your thirty clients give you a starting point for booking websites. I would start with a payment confirmation guide.']
  ]){
    const result=await run(request({interviewStage:1,currentInput:content,references:[source],messages:[{role:'user',content}]}),reply({message,brief:{...brief,example:''}}));
    assert.equal(result.stageReady,true);assert.equal(result.message,message);assert.equal(result.brief.example,'');
  }
});

test('creator judgment stays visible as an offer decision rather than missing research homework',async()=>{
  const result=await run(request(),reply({message:'Which approach would best help your learners customize their booking flow?'}));
  assert.equal(result.stageReady,true);
  assert.match(result.message,/Which approach/);assert.match(result.message,/shape your offer/i);
  assert.doesNotMatch(result.message,/missing market evidence|bring.*links/i);
});

test('fallback guidance reassures a beginner and removes stacked backstage labels',async()=>{
  const result=await run(request({interviewStage:3,brief:{...brief,buyer:'Proposed for approval: Approved: Independent tutors.'},messages:[{role:'user',content:'This is my first product. I am not sure.'}]}),reply({message:'Describe your childhood friendships before we continue?',brief:{...brief,buyer:'Proposed for approval: Approved: Independent tutors.'}}));
  assert.equal(result.stageReady,true);
  assert.match(result.message,/no worries|together|we can|let[’']s/i);
  assert.match(result.message,/Independent tutors/);
  assert.doesNotMatch(result.message+' '+result.summary,/Proposed for approval:|Approved:|childhood|friendship|\.\./i);
});

test('a fallback uses a coherent first sentence rather than clipping a long labeled brief field',async()=>{
  const buyer='Proposed for approval: Approved: Independent tutors planning their first booking website. '+('Additional background can remain in the brief for later. '.repeat(8));
  const result=await run(request({interviewStage:3,brief:{...brief,buyer}}),reply({message:'Describe your childhood first?',brief:{...brief,buyer}}));
  assert.equal(result.stageReady,true);
  assert.match(result.message,/Independent tutors planning their first booking website/);
  assert.doesNotMatch(result.message+' '+result.summary,/Additional|Proposed for approval|Approved:|…|\.\./i);
});
