import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interview} from '../src/interview.js';
import {freshProject} from '../src/product.js';
const brief={...freshProject().brief,topic:'Preparing price labels for a craft fair',buyer:'First-time craft-fair sellers',outcome:'Prepare readable price labels before the fair'};
const input={interviewStage:7,brief,messages:[{role:'user',content:'Help me choose the format.'}]};
const descriptions='Here is how your price-label product could work:\n\nGuide: a readable set of instructions covering label size, legibility and where to place labels at the stall, with examples.\n\nChecklist: a compact set of checks to complete before packing for the fair, so sellers can spot missing labels.\n\nTemplate kit: reusable label text and layout instructions, with filled examples for adapting them to different products.\n\nWorkbook: short exercises that help sellers list their products, choose the wording and plan label placement.\n\nCourse: a sequence of lessons with demonstrations, practice and a final label review; we create the teaching materials here.\n\nWebinar: one live teaching session with a label demonstration and question time; we prepare the plan and script, while hosting and recording happen separately.\n\nWhich format would you like to develop?';
const run=(message,extra={})=>interview(input,{infer:async()=>({message,stageReady:false,summary:'Choose a format.',brief:{...brief},...extra})});

test('one bounded rewrite replaces a bare list with actual product contents for every option',async()=>{
  let calls=0;
  const result=await interview(input,{infer:async(provider,prompt,schema,options)=>{
    calls++;assert.equal(provider,'chatgpt');assert.equal(options.model,'gpt-6-astra');
    if(calls===2){assert.match(prompt,/FORMAT CORRECTION/);assert.match(prompt,/Preparing price labels/);}
    return {message:calls===1?'Which format: guide, checklist, templates, workbook or course materials?':descriptions,stageReady:false,summary:'Choose a format.',brief:{...brief}};
  }});
  assert.equal(calls,2);
  for(const name of ['Guide','Checklist','Template kit','Workbook','Course','Webinar'])assert.match(result.message,new RegExp(name,'i'));
  for(const section of result.message.split('\n\n').filter(text=>/^(?:Guide|Checklist|Template kit|Workbook|Course|Webinar):/.test(text)))assert.match(section,/label|fair/i);
  assert.match(result.message,/instructions/i);assert.match(result.message,/checks/i);
  assert.match(result.message,/adapt|fill.in/i);assert.match(result.message,/exercises/i);
  assert.match(result.message,/lessons/i);assert.match(result.message,/session/i);
  assert.match(result.message,/record|host/i);
  assert.equal((result.message.match(/\?/g)||[]).length,1);
  assert.equal(result.stageReady,false);assert.equal(result.brief.format,'');assert.equal(result.brief.productDraft,'');
});

test('format descriptions cannot retain an unrelated personal question',async()=>{
  const result=await run(descriptions.replace('Which format would you like to develop?','Before we choose, which childhood memory shaped your friendships?'));
  assert.ok(result.message.includes('reusable label text'));
  assert.doesNotMatch(result.message,/childhood|friendships/);
  assert.equal((result.message.match(/\?/g)||[]).length,1);assert.match(result.message,/which format/i);
});

test('a failed bounded rewrite stays honest instead of showing generic option placeholders',async()=>{
  let calls=0;
  const result=await interview(input,{infer:async()=>{calls++;return {message:'Which format would you like?',stageReady:false,summary:'Choose.',brief:{...brief}};}});
  assert.equal(calls,2);assert.equal(result.stageReady,false);assert.equal(result.brief.format,'');
  assert.match(result.message,/couldn.t finish|try again/i);assert.doesNotMatch(result.message,/relevant templates|important steps|\?/i);
});

test('a different topic receives different concrete option bodies from the bounded rewrite',async()=>{
  const bread={...brief,topic:'Baking a first sourdough loaf',outcome:'Plan starter timing, dough handling, proofing and baking',offer:'Sourdough practice for beginners'};
  const bodies=[
    'Guide: chapters on starter timing, mixing dough and checking proofing before baking a sourdough loaf.',
    'Checklist: observable starter and proofing checks to use before mixing dough and before baking the loaf.',
    'Template kit: reusable starter-feeding and dough-timing logs, with a filled sourdough example and adaptation notes.',
    'Workbook: exercises to plan starter feeding, record dough behavior and compare proofing notes after baking.',
    'Course: lessons demonstrating starter feeding, dough handling, proofing and baking, with practice checks between lessons.',
    'Webinar: one sourdough demonstration covering starter timing and dough handling; hosting and recording happen separately.'
  ];
  let calls=0;
  const result=await interview({...input,brief:bread},{infer:async()=>{calls++;return {message:calls===1?'Choose a format?':bodies.join('\n\n')+'\n\nWhich format would you like to develop?',stageReady:false,summary:'Choose.',brief:{...bread}};}});
  assert.equal(calls,2);assert.doesNotMatch(result.message,/label|fair/);
  for(const body of bodies)assert.ok(result.message.includes(body));
  assert.equal(result.brief.format,'');assert.equal(result.brief.productDraft,'');
});

test('useful tailored format descriptions from the AI survive instead of becoming a bare list',async()=>{

  const result=await run(descriptions);
  assert.equal(result.message,descriptions);assert.equal(result.stageReady,false);
});

test('webinar is a supported chosen format and its production guidance stays honest',async()=>{
  let prompt;
  const result=await interview({...input,brief:{...brief,format:'Webinar'},messages:[{role:'user',content:'Let’s make a webinar.'}]},{infer:async(_,value)=>{prompt=value;return {message:'What childhood memory should we use?',stageReady:false,summary:'Choose format.',brief:{...brief,format:'Webinar'}};}});
  assert.equal(result.stageReady,true);assert.equal(result.brief.format,'Webinar');assert.equal(result.brief.productDraft,'');
  assert.match(prompt,/webinar/i);assert.match(prompt,/hosting.*recording|recording.*hosting/i);
  assert.doesNotMatch(result.message,/childhood/);
});

test('a chosen webinar is inherited when the AI omits the format, without reopening the comparison',async()=>{
  const message='Your webinar would include a demonstration of preparing readable labels, a short practice activity and question time. We can prepare the speaker script and follow-up checklist; hosting and recording happen separately.';
  let calls=0;
  const result=await interview({...input,brief:{...brief,format:'Webinar'},currentInput:'What would my webinar include?',messages:[{role:'user',content:'What would my webinar include?'}]},{infer:async()=>{calls++;return {message,stageReady:false,summary:'Explained the chosen webinar.',brief:{...brief,format:''}};}});
  assert.equal(calls,1);assert.equal(result.message,message);assert.equal(result.brief.format,'Webinar');
  assert.equal(result.brief.productDraft,'');
});
