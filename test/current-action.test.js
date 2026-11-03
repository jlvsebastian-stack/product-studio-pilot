import {test} from 'node:test';import assert from 'node:assert/strict';
import {currentAction} from '../public/current-action.js';
const base={runtime:true,connected:true,modelReady:true,stage:10,plan:{basicApproved:true,expandedApproved:true,covered:true},sample:{presentation:true,choice:'editorial',current:true,approved:true,url:'https://www.canva.com/d/actual'},draft:{hasSource:true,pending:false,sampleApproved:true}};
test('the one current action prioritizes actual pending native/slide requests and normal production progress over access errors',()=>{
  const native={status:'approval',approval:{title:'Review this actual Canva step',message:'One current design only.'}};assert.equal(currentAction({...base,modelReady:false,nativeJob:native}).kind,'canva-approval');assert.equal(currentAction({...base,modelReady:false,nativeJob:{status:'running',message:'Importing slides.'}}).kind,'canva-progress');assert.equal(currentAction({...base,slideJob:{status:'approval',autoApproveArtwork:false,approval:{id:'one'}}}).kind,'slide-approval');assert.equal(currentAction({...base,slideJob:{status:'artwork'}}).kind,'slide-progress');
});
test('basic and full-plan approval take one consistent action before content stages',()=>{assert.equal(currentAction({...base,plan:{hasBasic:true}}).primary.id,'approve-basic');assert.equal(currentAction({...base,plan:{basicApproved:true,hasExpanded:true,valid:true}}).primary.id,'approve-expanded');assert.equal(currentAction({...base,modelReady:false}).primary.id,'check-model');});
test('native sample choice, creation, real review and full-deck production remain separate explicit decisions',()=>{assert.equal(currentAction({...base,sample:{presentation:true}}).primary.id,'view-design');assert.equal(currentAction({...base,sample:{presentation:true,choice:'editorial'}}).primary.id,'create-canva-samples');const review=currentAction({...base,sample:{...base.sample,approved:false}});assert.equal(review.primary.id,'approve-native-samples');assert.equal(review.secondary.href,base.sample.url);assert.equal(currentAction(base).primary.id,'create-canva-deck');assert.equal(currentAction({...base,sample:{...base.sample,deckCurrent:true,deckUrl:'https://www.canva.com/d/full'}}).primary.href,'https://www.canva.com/d/full');});
test('guides retain content approval, stage progression and reviewed download behavior',()=>{assert.equal(currentAction({...base,sample:{presentation:false},draft:{hasSource:true,pending:true}}).primary.id,'approve-draft');assert.equal(currentAction({...base,sample:{},stage:2,stageReady:true}).primary.id,'advance');assert.equal(currentAction({...base,sample:{},stage:12}).primary.disabled,true);assert.equal(currentAction({...base,sample:{},stage:12,reviewed:true}).primary.id,'export');});

test('an actually approved written sample builds the remaining full draft directly at stage9',()=>{
  const written={...base,stage:9,stageReady:true,sample:{presentation:false},plan:{basicApproved:true,expandedApproved:true,valid:true,covered:false,total:3,drafted:1}};
  assert.equal(currentAction(written).primary.id,'build-full-draft');
  assert.equal(currentAction({...written,stageReady:false}).primary.id,'build-full-draft','A second direction approval is unnecessary after actual sample approval.');
  for(const change of [{draft:{...written.draft,pending:true}},{draft:{...written.draft,sampleApproved:false}},{draft:{...written.draft,hasSource:false}},{plan:{...written.plan,expandedApproved:false}},{plan:{...written.plan,basicApproved:false}},{plan:{...written.plan,valid:false}},{plan:{...written.plan,covered:true,drafted:3}},{modelReady:false},{working:true}])assert.notEqual(currentAction({...written,...change}).primary?.id,'build-full-draft');
  assert.equal(currentAction({...written,sample:{presentation:true,choice:'editorial',current:true,approved:false}}).primary.id,'approve-native-samples');
});

test('startup checks stay pending until a real runtime error is known',()=>{
  const pending=currentAction({...base,runtime:false});
  assert.equal(pending.kind,'runtime-checking');assert.match(pending.title,/Checking/i);assert.doesNotMatch(pending.detail,/restart|update/i);
  const outdated=currentAction({...base,runtime:false,runtimeError:'Restart the app to finish this update. Your project is retained.'});
  assert.equal(outdated.title,'Finish the app update');
  const offline=currentAction({...base,runtime:false,runtimeError:'The local app could not be reached. Reload it or launch it again.'});
  assert.equal(offline.title,'Reconnect to the local app');assert.match(offline.detail,/could not be reached/);
});
