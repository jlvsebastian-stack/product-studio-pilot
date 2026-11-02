import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanQualityReview,qualityReviewKey,renderQualityReview} from '../public/quality-review.js';
import {parseQualityReview,qualityReviewInstructions,groundedQualityReview} from '../src/final-quality.js';
import {interview} from '../src/interview.js';
import {freshProject,applyReply,loadStudio,persistStudio} from '../public/studio-store.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {googleSourceKey,cleanGoogleDelivery} from '../public/google-delivery.js';

const report={summary:'Checked the buyer’s first booking.',fixes:['Aligned the new blank fields.'],improvements:[{title:'Separate reusable forms',why:'Find the visit checklist faster.',basis:'Copyable visit checklist'}]};
const unit=h=>'## '+h+'\n\nA complete practical example and a usable checklist help the buyer record clear owner instructions and check the visit.';
function request(){const p=freshProject();Object.assign(p.brief,{title:'Weekend Cat Care',format:'Template kit',buyer:'First-time weekend cat sitters',method:'Confirm the owner instructions',outline:'Start Here\nCopyable visit checklist',productDraft:unit('Start Here')});const plan=['Start Here','Copyable visit checklist'].map(h=>'## '+h+'\n\n### Purpose\nHelp the buyer complete a weekend booking using a usable checklist and clearly labelled example.\n\n### Key points and practice\nRecord the owner instructions, show a filled example and provide matching blank fields for the buyer to use.').join('\n\n');return {mode:'full-draft',provider:'chatgpt',model:'gpt-6.1-sol',reasoningEffort:'medium',interviewStage:10,brief:p.brief,approvedDraft:p.brief.productDraft,approvedOutline:p.brief.outline,expandedOutline:plan,approvedExpandedOutline:plan,messages:[{role:'user',content:'Build the full draft.'}]};}

test('one full-draft request includes grounded final review without granting approval or rewriting retained source',async()=>{
 const data=request();let calls=0;
 const result=await interview(data,{infer:async(_provider,prompt,schema)=>{calls++;assert.match(prompt,/FINAL QUALITY REVIEW/);assert.match(prompt,/no extra|same.*turn|same.*request/i);assert.ok(schema.properties.qualityReview);return {replyKind:'progress',message:'Ready',summary:'Complete',stageReady:true,brief:{...data.brief,productDraft:unit('Copyable visit checklist')},qualityReview:{...report,improvements:[...report.improvements,{title:'Unfounded idea',why:'A claim without project evidence',basis:'A made-up customer outcome'}]}};}});
 assert.equal(calls,1);assert.ok(result.brief.productDraft.startsWith(data.approvedDraft));assert.equal(result.stageReady,false);assert.equal(result.approvedDraft,undefined);assert.equal(result.qualityReview.improvements.length,1);assert.deepEqual(result.qualityReview.improvements,report.improvements);
});

test('review is bounded, escaped and cannot execute a suggestion or change product content',()=>{
 const value=cleanQualityReview({...report,improvements:Array(5).fill({...report.improvements[0],title:'<img src=x onerror=alert(1)>'})});assert.equal(value.improvements.length,3);
 const html=renderQualityReview(value,'Draft');assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img|data-suggestion|<button/);assert.match(html,/Why/);assert.equal(cleanQualityReview({summary:'',fixes:[],improvements:[]}),null);
 assert.deepEqual(parseQualityReview(JSON.stringify({qualityReview:report})),report);assert.equal(parseQualityReview('Done!'),null);
});

test('review survives normal save/open and becomes stale when its exact product changes',()=>{
 const p=freshProject(),data=request();p.brief={...data.brief};applyReply(p,{brief:p.brief,message:'Ready',stageReady:false,qualityReview:report});assert.deepEqual(p.qualityReview.review,report);assert.equal(p.qualityReview.sourceKey,qualityReviewKey(p.brief));
 const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};persistStudio(storage,{version:3,activeId:p.id,projects:[p],profile:{preferences:[],candidates:[],forgotten:[],paused:false}});const loaded=loadStudio(storage).projects[0];assert.deepEqual(loaded.qualityReview,p.qualityReview);
 assert.notEqual(qualityReviewKey({...p.brief,productDraft:p.brief.productDraft+' changed'}),p.qualityReview.sourceKey);
 assert.notEqual(qualityReviewKey({...p.brief,format:'Webinar'}),p.qualityReview.sourceKey);
});

test('chosen format supplies its own concise final quality criteria without slide rules leaking into written formats',()=>{
 assert.match(qualityReviewInstructions('Google Sheets tracker'),/tracker|capacity|record/i);assert.match(qualityReviewInstructions('Template kit'),/template|blank|filled/i);assert.match(qualityReviewInstructions('Webinar presentation'),/notes|14|40%/i);assert.doesNotMatch(qualityReviewInstructions('Practical guide'),/14 visible|40%/i);
});

test('native suggestions require actual source/readback evidence and cannot use hidden metadata as buyer proof',()=>{
 const fabricated={title:'Raise the price',why:'Unsupported sales claim',basis:'A thousand paying customers'};
 assert.deepEqual(groundedQualityReview({...report,improvements:[...report.improvements,fabricated]},request().brief,[{_meta:{hidden:'A thousand paying customers'}}]).improvements,report.improvements);
 const native=groundedQualityReview(report,{},[{text:'Copyable visit checklist'}]);assert.deepEqual(native.improvements,report.improvements);
});

test('actual workspace renders only the current checked native or source review, never an earlier file report',()=>{
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),begin=source.indexOf('function renderFinalQuality(){'),end=source.indexOf('\nfunction renderSuggestions()',begin),p=freshProject();p.brief=request().brief;p.qualityReview={sourceKey:qualityReviewKey(p.brief),review:report};
 const google={id:'abc',status:'ready',verified:true,destination:'docs',sourceKey:googleSourceKey(p.brief),qualityReview:report,qualityReviewContext:qualityReviewKey(p.brief)};const context={view:'draft',state:p,canvaJobs:new Map(),googleChecked:new Set(['abc']),qualityReviewKey,renderQualityReview,googleSourceKey,googleLabel:()=> 'Google Docs',nativeKey:()=> 'current'};vm.createContext(context);vm.runInContext(source.slice(begin,end),context);
 assert.match(context.renderFinalQuality(),/Draft source/);p.googleDelivery=google;assert.match(context.renderFinalQuality(),/Actual Google Docs/);context.googleChecked.clear();assert.match(context.renderFinalQuality(),/Draft source/);
 context.googleChecked.add('abc');p.brief.buyer='A different buyer';assert.equal(context.renderFinalQuality(),'');p.brief.productDraft+=' changed';assert.equal(context.renderFinalQuality(),'');context.view='brief';assert.equal(context.renderFinalQuality(),'');
 const base={id:'a'.repeat(36),destination:'docs',sourceKey:'source',status:'unavailable',creationAttempted:true,qualityReview:report};assert.equal(cleanGoogleDelivery(base).qualityReview,undefined);
});
