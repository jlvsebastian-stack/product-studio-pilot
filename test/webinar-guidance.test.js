import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interviewPrompt,interview} from '../src/interview.js';
import {freshProject} from '../src/product.js';
const brief={...freshProject().brief,topic:'Craft-fair price labels',format:'Webinar plus course materials',outline:'Make the price easy to find'};

test('a webinar uses the slide design skill and promises presentation plus per-slide notes',()=>{
  for(const provider of ['chatgpt','claude']){
    const {prompt}=interviewPrompt({provider,interviewStage:9,brief,messages:[{role:'user',content:'Create the first sample slide with presenter notes.'}]});
    assert.match(prompt,/# Presentation slides/);
    assert.match(prompt,/actual slide presentation together with per-slide presenter notes/i);
    assert.match(prompt,/## Slide title/);assert.match(prompt,/### Presenter notes/);
    assert.match(prompt,/native speaker notes/);
    assert.match(prompt,/Hosting, presenting and recording happen separately/);
  }
});

test('the representative webinar sample keeps its slide content and notes without expanding the whole deck',async()=>{
  const draft='## Make the price easy to find\n\n- Place a clear price beside the item.\n- Check the label from the buyer’s side of the stall.\n\n### Presenter notes\n\nDemonstrate an item with its label hidden behind it. Move the label beside the item, then ask the audience to compare how quickly they can find its price. Give participants a moment to choose one product and plan its label placement.';
  const result=await interview({interviewStage:9,brief,approvedDraft:'',messages:[{role:'user',content:'Create the first sample slide with presenter notes.'}]},{infer:async()=>({message:'Here is one sample slide with its presenter notes. Review both before we build the rest.',stageReady:true,summary:'One slide and corresponding notes for review.',brief:{...brief,productDraft:draft}})});
  assert.equal(result.brief.productDraft,draft);
  assert.equal((draft.match(/^## /gm)||[]).length,1);
  assert.equal(result.stageReady,true);
});
