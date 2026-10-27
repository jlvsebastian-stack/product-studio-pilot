import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { interview, interviewPrompt } from '../src/interview.js';
import { freshProject } from '../src/product.js';

const blank=()=>freshProject().brief;
const request=(extra={})=>({interviewStage:1,messages:[{role:'user',content:'I build booking websites with payment confirmations and reminder email.'}],brief:blank(),...extra});
const reply=(brief={},extra={})=>({message:'What was the exact opening hook, and what childhood memory inspired it?',stageReady:false,summary:'More personal detail needed.',brief:{...blank(),...brief},...extra});
const run=(input,output)=>interview(input,{infer:async()=>output});
const topic='Booking websites with payment confirmations';
const sample='## Choose a booking task\n\nStart with the next booking action. List the information needed to complete it, then remove any field that does not change the next action.';

test('a repeated discovery conversation with an existing baseline stops optional probing and offers the next decision',async()=>{
  const messages=[
    {role:'user',content:'I build booking websites, reminder bots and short training videos.'},
    {role:'assistant',content:'What have you built?'},
    {role:'user',content:'A booking website with payments, confirmation email and a calendar. I check the booking path on a phone before adding decoration.'},
    {role:'assistant',content:'What were the exact words in the first reminder?'},
    {role:'user',content:'We already have enough to start. Please move to a useful product direction.'}
  ];
  const result=await run(request({messages,brief:{...blank(),topic}}),reply({topic}));
  assert.equal(result.stageReady,true);
  assert.match(result.message,/booking websites/i);
  assert.match(result.message,/propos|suggest|starting direction|let[’']s start/i);
  assert.match(result.message,/practical result|next/i);
  assert.doesNotMatch(result.message,/opening hook|childhood|exact words|\?/i);
  assert.equal(result.brief.example,'');assert.equal(result.brief.method,'');assert.equal(result.brief.limits,'');
  assert.equal(result.brief.productDraft,'');
});

test('a grounded practical topic is enough for discovery without a personal case, detailed method or limits',async()=>{
  const result=await run(request(),reply({topic}));
  assert.equal(result.stageReady,true);
  assert.equal(result.brief.topic,topic);
  assert.equal(result.brief.example,'');assert.equal(result.brief.method,'');assert.equal(result.brief.limits,'');
});

test('a useful teaching baseline proceeds equally with paraphrased and literal model topics',async()=>{
  const content='I can teach beginners how to use Excel to manage a home budget.';
  for(const proposed of ['Household budgeting spreadsheets','Excel home budget']){
    const result=await run(request({currentInput:content,messages:[{role:'user',content}]}),reply({topic:proposed},{stageReady:true}));
    assert.equal(result.stageReady,true,proposed);
    assert.doesNotMatch(result.message,/what practical task|what.*teach|\?/i);
    assert.match(result.brief.topic,/Excel|budget/i);
    assert.equal(result.brief.example,'');assert.equal(result.brief.method,'');
  }
});

test('ready copy is short and decision-specific without repeated UI instructions or double punctuation',async()=>{
  const result=await run(request(),reply({topic:topic+'.'}));
  assert.equal(result.stageReady,true);
  assert.match(result.message,/booking websites/i);
  assert.ok(result.message.split(/\s+/).length<=40);
  assert.ok(result.summary.split(/\s+/).length<=15);
  assert.notEqual(result.summary,result.message);
  assert.doesNotMatch(result.message+' '+result.summary,/optional details|approve direction|continue when|\.\./i);
});

test('a specific one-word strength also works when the creator explains the practical help they can give',async()=>{
  const result=await run(request({messages:[{role:'user',content:'I crochet small blankets and can show a beginner a basic stitch.'}]}),reply({topic:'Crochet'}));
  assert.equal(result.stageReady,true);assert.equal(result.brief.topic,'Crochet');
});

test('vague or empty creator context stays unready and receives one easy question with a concrete product purpose',async()=>{
  for(const [content,proposed] of [['I know marketing.','Marketing'],['','']]){
    const result=await run(request({messages:[{role:'user',content}]}),reply({topic:proposed},{stageReady:true,message:'What did your childhood teach you? What was your hardest failure?'}));
    assert.equal(result.stageReady,false);
    assert.equal((result.message.match(/\?/g)||[]).length,1);
    assert.match(result.message,/product topic|what.*teach|practical task/i);
    assert.match(result.message,/helps?|so (?:we|I)|to choose/i);
    assert.doesNotMatch(result.message,/childhood|hardest failure/i);
  }
});

test('a source-only topic and client claim cannot substitute for a creator baseline',async()=>{
  const source={id:'source',name:'Booking experience.txt',kind:'file',mimeType:'text/plain',text:'I built booking websites with payment confirmations for thirty clients.',status:'ready',note:'Supplied text.'};
  const result=await run(request({messages:[{role:'user',content:'Go on.'}],currentInput:'Go on.',references:[source]}),reply({topic,example:source.text},{stageReady:true}));
  assert.equal(result.stageReady,false);assert.equal(result.brief.example,'');
  assert.match(result.message,/product topic|what.*teach|practical task/i);
  const later=await run(request({brief:result.brief,messages:[{role:'user',content:'References attached:\n- Booking experience.txt'},{role:'assistant',content:result.message},{role:'user',content:'Go on.'}],currentInput:'Go on.',references:[source]}),reply({topic},{stageReady:true}));
  assert.equal(later.stageReady,false,'persisting a proposed source topic must not turn it into a creator baseline');
});

test('a valid baseline may proceed while a matching source client claim stays out of creator history',async()=>{
  const source={id:'source',name:'Booking experience.txt',kind:'file',mimeType:'text/plain',text:'I built booking websites with payment confirmations for thirty clients.',status:'ready',note:'Supplied text.'};
  const result=await run(request({currentInput:'I build booking websites with payment confirmations and reminder email.',references:[source]}),reply({topic,example:source.text}));
  assert.equal(result.stageReady,true);assert.equal(result.brief.example,'');
  assert.doesNotMatch(result.message,/thirty clients/);
});

test('early stages stop optional interviewing when the minimum next-decision fields exist',async()=>{
  const cases=[
    [2,{outcome:'Complete a first paid booking'}],
    [3,{buyer:'Independent tutors setting up their first booking page'}],
    [4,{buyer:'Independent tutors',outcome:'Complete a first paid booking'}],
    [6,{buyer:'Independent tutors',outcome:'Complete a first paid booking',offer:'A practical booking setup guide'}],
    [7,{format:'Checklist'}],
    [8,{outline:'Choose a booking task\nCheck the confirmation'}]
  ];
  for(const [interviewStage,fields] of cases){
    const result=await run(request({interviewStage,brief:{...blank(),topic,...fields}}),reply(fields));
    assert.equal(result.stageReady,true,`stage ${interviewStage}`);
    assert.match(result.message,/next|propos|start|outline/i);
    assert.notEqual(result.message,result.summary);
    assert.doesNotMatch(result.message,/opening hook|childhood|\?/i);
    assert.equal(result.brief.method,'');assert.equal(result.brief.limits,'');
    if(interviewStage===7){assert.match(result.message,/checklist/i);assert.doesNotMatch(result.message,/course/i);}
  }
});

test('missing core decisions ask one purposeful question instead of a personal questionnaire',async()=>{
  for(const interviewStage of [2,3,4,6,7,8]){
    const result=await run(request({interviewStage,brief:{...blank(),topic}}),reply({}, {stageReady:true,message:'What was your childhood like? What were your biggest mistakes?'}));
    assert.equal(result.stageReady,false,`stage ${interviewStage}`);
    assert.equal((result.message.match(/\?/g)||[]).length,1,`stage ${interviewStage}`);
    assert.match(result.message,/helps?|so (?:we|I)|to (?:choose|shape|build|draft|focus)/i);
    assert.doesNotMatch(result.message,/childhood|biggest mistakes/i);
  }
});

test('design uses approved preferences and proposed defaults then presents a sample for review',async()=>{
  let supplied;
  const brief={...blank(),topic,format:'Guide',outline:'Choose a booking task\nCheck the confirmation'};
  const result=await interview(request({interviewStage:9,brief,approvedDraft:'',preferences:[{id:'voice',text:'Use warm, direct English.',category:'voice',source:'explicit'}]}),{infer:async(_,prompt)=>{supplied=prompt;return reply({...brief,productDraft:sample},{message:'Which childhood phrase shaped your voice? Which fonts do you remember liking?'});}});
  assert.equal(result.stageReady,true);
  assert.match(result.brief.tone,/warm, direct English/i);
  assert.match(result.brief.design,/readab|clear|proposed/i);
  assert.equal(result.brief.productDraft,sample);
  assert.doesNotMatch(result.message,/childhood|fonts do you remember|\?/i);
  assert.match(result.message,/sample.*review|review.*sample/i);
  assert.deepEqual(result.preferenceUpdates,[]);
  assert.match(supplied,/Use warm, direct English/);
});

test('drafting presents newly written material for approval instead of demanding another personal anecdote',async()=>{
  const draft=sample+'\n\n## Check the confirmation\n\nMake one test booking. Confirm that its time, amount and next action agree across the page and message.';
  const brief={...blank(),topic,format:'Guide',outline:'Choose a booking task\nCheck the confirmation',productDraft:sample};
  const result=await run(request({interviewStage:10,brief,approvedDraft:sample}),reply({...brief,productDraft:draft},{message:'What childhood memory changed your approach?'}));
  assert.equal(result.brief.productDraft,draft);
  assert.ok(result.brief.productDraft.startsWith(sample));
  assert.doesNotMatch(result.message,/childhood|\?/i);
  assert.match(result.message,/review|approv/i);
});

test('a genuine drafting gap explains which current section the answer will help write',async()=>{
  const brief={...blank(),topic,outline:'Choose a booking task\nCheck the confirmation',productDraft:sample};
  const result=await run(request({interviewStage:10,brief,approvedDraft:sample}),reply(brief,{message:'Which confirmation details should the reader check?'}));
  assert.equal(result.stageReady,false);
  assert.equal((result.message.match(/\?/g)||[]).length,1);
  assert.match(result.message,/Check the confirmation/);
  assert.match(result.message,/write|draft|section/i);
});

test('an unchanged draft does not turn an unrelated personal tangent into a product requirement',async()=>{
  const brief={...blank(),topic,format:'Guide',outline:'Choose a booking task\nCheck the confirmation',productDraft:sample};
  for(const message of ['Which childhood memory shaped your approach to friendship?','To write the confirmation lesson, which childhood memory shaped your approach to friendship?']){
    const result=await run(request({interviewStage:10,brief,approvedDraft:sample}),reply(brief,{message}));
    assert.equal(result.stageReady,false);assert.equal(result.brief.productDraft,sample);
    assert.doesNotMatch(result.message,/childhood|friendship|this answer will|\?/i);
    assert.match(result.message,/Check the confirmation|review|draft/i);
  }
});

test('a purposeful factual clarification survives alongside an allowed review correction',async()=>{
  const brief={...blank(),topic,format:'Guide',outline:'Choose a booking task\nCheck the confirmation',productDraft:sample};
  const corrected=sample+'\n\nKeep the cancellation notice marked for confirmation before publishing the lesson.';
  for(const question of ['To make the cancellation lesson factually accurate, which notice period should the policy use?','To finish the policy accurately, how many days of advance warning are required?']){
    const result=await run(request({interviewStage:11,brief,approvedDraft:sample,revisionIntent:true}),reply({...brief,productDraft:corrected},{message:'I clarified the booking exercise. '+question}));
    assert.equal(result.stageReady,false);assert.equal(result.brief.productDraft,corrected);
    assert.ok(result.message.includes(question),question);
    assert.equal((result.message.match(/\?/g)||[]).length,1);
    assert.doesNotMatch(result.message,/ready for your review/);
  }
});

test('actual stage advancement displays a natural approval while the global prompt retains pacing policy',async()=>{
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const advance=source.slice(source.indexOf('async function advance('),source.indexOf('\nasync function prepareCompletion('));
  const state={interviewStage:1,stageReady:true,summary:'Booking websites',brief:blank(),notes:[]};
  let displayed;
  const scope={working:false,canUseModel:()=>true,state,STAGES:[['Discover',''],['Find a useful problem','']],save(){},send:async text=>{displayed=text;}};
  vm.createContext(scope);vm.runInContext(advance,scope);await scope.advance();
  assert.equal(state.interviewStage,2);assert.equal(state.stageReady,false);assert.equal(state.notes[0].summary,'Booking websites');
  assert.match(displayed,/approve.*continue/i);assert.ok(displayed.length<100);
  assert.doesNotMatch(displayed,/reuse|indispensable|explain|most useful next question|step 2|output/i);
  const {prompt}=interviewPrompt(request({interviewStage:state.interviewStage,messages:[...request().messages,{role:'user',content:displayed}]}));
  assert.match(prompt,/Remain at selected stage 2/);
  assert.match(prompt,/reuse earlier answers/i);assert.match(prompt,/indispensable question/i);assert.match(prompt,/EVERY question.*help choose, write or improve/i);
});

test('a representative sample can retain its factual question without being marked ready',async()=>{
  const brief={...blank(),topic,format:'Guide',outline:'Choose a booking task\nCheck the confirmation'};
  const draft=sample+'\n\nKeep the cancellation notice marked for confirmation.';
  const question='To make the cancellation example accurate, which notice period should the policy use?';
  const result=await run(request({interviewStage:9,brief,approvedDraft:''}),reply({...brief,productDraft:draft},{message:question}));
  assert.equal(result.stageReady,false);assert.equal(result.brief.productDraft,draft);
  assert.ok(result.message.includes(question));
});

test('pacing cannot bypass sample/section approvals, protected text or market uncertainty',async()=>{
  const before={...blank(),topic,outline:'Choose a booking task\nCheck the confirmation',tone:'Plain English',design:'Readable ink'};
  const tooMuch=sample+'\n\n## Check the confirmation\n\nA second unreviewed section.';
  const rejected=await run(request({interviewStage:9,brief:before,approvedDraft:''}),reply({...before,productDraft:tooMuch},{stageReady:true}));
  assert.equal(rejected.stageReady,false);assert.equal(rejected.brief.productDraft,'');
  const protectedResult=await run(request({interviewStage:10,brief:{...before,productDraft:sample},approvedDraft:sample}),reply({...before,productDraft:'A silent rewrite.'},{stageReady:true}));
  assert.equal(protectedResult.stageReady,false);assert.equal(protectedResult.brief.productDraft,sample);
  const market=await run(request({interviewStage:5,brief:{...before,marketEvidence:'UNRUN'}}),reply({marketEvidence:'UNRUN'},{stageReady:true}));
  assert.equal(market.stageReady,false);assert.match(market.message,/unverified/i);
});
