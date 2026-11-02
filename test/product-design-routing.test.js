import test from 'node:test';
import assert from 'node:assert/strict';
import * as formats from '../src/format-skills.js';
import {interviewPrompt} from '../src/interview.js';
import {freshProject} from '../src/product.js';

test('native design guidance uses only the chosen format and keeps creator preferences above defaults',()=>{
  assert.equal(typeof formats.readProductDesign,'function');
  const guide=formats.readProductDesign('Practical guide');
  assert.match(guide,/PRODUCT VISUAL DIRECTION/);assert.match(guide,/# Guide Writer/);
  assert.doesNotMatch(guide,/# Slide Deck Architect|# Spreadsheet Craft/);
  assert.match(guide,/creator|approved/i);assert.match(guide,/reference|audience|topic/i);
  const slides=formats.readProductDesign('Webinar presentation');
  assert.match(slides,/# Slide Deck Architect/);assert.match(slides,/# Webinar Craft/);
  assert.doesNotMatch(slides,/# Guide Writer/);
  for(const format of ['Google Sheets tracker','Workbook','Ebook','Calculator','Template kit','Checklist','Manual','Report','Google Docs document','Course materials'])assert.match(formats.readProductDesign(format),/## Visual Design/);
});

test('design adaptation reaches existing sample creation without expanding outline planning or private memory',()=>{
  const brief={...freshProject().brief,title:'Lunch Break Meal Prep',format:'Practical guide',design:'Navy and citrus, clear diagrams, no florals.'};
  const data={provider:'chatgpt',model:'gpt-6.1-sol',reasoningEffort:'medium',interviewStage:9,messages:[{role:'user',content:'Use the approved direction for the sample.'}],brief};
  const {prompt}=interviewPrompt(data);
  assert.match(prompt,/## Design Direction/);assert.match(prompt,/## Visual Design/);
  assert.ok(prompt.includes(brief.design));
  const plan=interviewPrompt({...data,interviewStage:7}).prompt;
  assert.doesNotMatch(plan,/## Design Direction|## Visual Design/,'planning loads compact format contracts, not production design work');
});
