import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadPresentationSkill} from '../src/presentation-skills.js';
import {interviewPrompt} from '../src/interview.js';
import {freshProject} from '../src/product.js';
import {withApprovedOutline} from './interview-fixtures.js';

test('every runtime-loaded direction turns source meaning into a bespoke explanatory illustration and preserves existing artwork',()=>{
  for(const id of ['editorial','studio','warm']){
    const loaded=loadPresentationSkill(id);
    for(const term of [/learner.?s question/i,/visual takeaway/i,/headline clues/i,/objects, actions and relationships/i,/exact source anchors/i,/reuse.*unchanged.*asset/i,/no.*letters.*numbers/i])assert.match(loaded,term,id);
    assert.doesNotMatch(loaded,/native graphics first/i);
  }
});
test('the actual selected-style interview prompt loads the illustration interpretation process without imposing another creator’s brand',()=>{
  const data=withApprovedOutline({interviewStage:9,messages:[{role:'user',content:'Create the sample.'}],brief:{...freshProject().brief,title:'Choose A Useful Action',format:'Webinar presentation',outline:'Choose a useful action.'},presentationDesign:{conceptId:'editorial',approved:false,sourceFingerprint:'sample'}}),{prompt}=interviewPrompt(data);
  assert.match(prompt,/learner.?s question/i);assert.match(prompt,/headline clues/i);assert.match(prompt,/Quiet Editorial/);assert.doesNotMatch(prompt,/# Signal Studio|# Warm Dimension/);assert.match(prompt,/actual.*Canva|editable.*Canva/i);
});
