import test from 'node:test';
import assert from 'node:assert/strict';
import {interviewPrompt} from '../src/interview.js';
import {freshProject} from '../src/product.js';
import {readFileSync} from 'node:fs';

const request=(format,extra={})=>({provider:'chatgpt',model:'gpt-6.1-sol',reasoningEffort:'medium',interviewStage:9,messages:[{role:'user',content:'Use our approved topic and create the next useful part.'}],brief:{...freshProject().brief,title:'A Useful First Product',format},...extra});
const skillNames=['course-architect','slide-deck-architect','ebook-formatter','document-writer','guide-writer','report-writer','manual-writer','checklist-craft','template-craft','spreadsheet-craft','calculator-craft','tracker-craft','webinar-craft'];
const headings=['# Course Architect','# Slide Deck Architect','# Ebook Formatter','# Document Writer','# Guide Writer','# Report Writer','# Manual Writer','# Checklist Craft','# Template Craft','# Spreadsheet Craft','# Calculator Craft','# Tracker Craft','# Webinar Craft'];
test('each app skill has the required plain YAML name and description without adding a parser dependency',()=>{
  for(const name of skillNames){
    const text=readFileSync(new URL(`../skills/${name}/SKILL.md`,import.meta.url),'utf8'),header=/^---\r?\nname: ([a-z0-9-]+)\r?\ndescription: ([^\r\n]+)\r?\n---/.exec(text);
    assert.ok(header,name+' frontmatter');assert.equal(header[1],name);assert.ok(header[2].length<=1024);assert.ok(!/[:\[\]{}]/.test(header[2]),name+' description is a plain YAML scalar');
  }
});
test('educational craft skills reach only their applicable product formats',()=>{
  for(const [format,wanted] of [['Course materials',[0]],['Webinar presentation with presenter notes',[0,1,12]],['Presentation',[1]],['Ebook',[0,2]],['PDF e-book',[0,2]],['Practical guide',[4]],['Google Docs guide',[4]],['Google Docs document',[3]],['Report',[5]],['Manual',[6]],['SOP',[6]],['Workbook',[]],['Template kit',[8]],['Google Sheets calculator',[10]],['Google Sheets tracker',[11]],['Google Sheets spreadsheet',[9]],['Checklist',[7]]]){
    const {prompt}=interviewPrompt(request(format));
    for(const [i,heading]of headings.entries())assert.equal(prompt.includes(heading),wanted.includes(i),format+' '+heading);
  }
});
test('guides and other practical formats load their own craft during full drafting and outline planning',()=>{
  for(const [format,heading]of [['Guide','# Guide Writer'],['Checklist','# Checklist Craft'],['Template kit','# Template Craft'],['Calculator','# Calculator Craft'],['Tracker','# Tracker Craft'],['Spreadsheet','# Spreadsheet Craft'],['Report','# Report Writer'],['Manual','# Manual Writer']]){
    for(const mode of ['full-draft','expand-outline']){
      const {prompt}=interviewPrompt(request(format,{mode}));
      assert.ok(prompt.includes(heading),format+' '+mode);assert.ok(!prompt.includes('# Ebook Formatter'));assert.ok(!prompt.includes('# Document Writer'));
    }
  }
  assert.ok(interviewPrompt(request('Workbook')).prompt.includes('name: workbook-craft'));
});
test('changing the selected format switches writing skills without changing retained source',()=>{
  const input=request('Google Docs document'),before=JSON.stringify(input.brief);
  const doc=interviewPrompt(input).prompt;
  assert.ok(doc.includes('# Document Writer'));assert.ok(!doc.includes('# Ebook Formatter'));assert.equal(JSON.stringify(input.brief),before);
  const book=interviewPrompt({...input,brief:{...input.brief,format:'Ebook'}}).prompt;
  assert.ok(book.includes('# Ebook Formatter'));assert.ok(!book.includes('# Document Writer'));
  const slides=interviewPrompt({...input,brief:{...input.brief,format:'Presentation'}}).prompt;
  assert.ok(slides.includes('# Slide Deck Architect'));assert.ok(!slides.includes('# Ebook Formatter'));assert.ok(!slides.includes('# Document Writer'));
});
test('ebook planning receives its reader journey without production formatting or an extra approval cycle',()=>{
  const {prompt}=interviewPrompt(request('Ebook',{mode:'expand-outline',interviewStage:8}));
  assert.match(prompt,/# Course Architect/);assert.match(prompt,/# Ebook Formatter/);assert.match(prompt,/connected reader journey/);assert.doesNotMatch(prompt,/## Production Contract/);
  assert.match(prompt,/ENTIRE product outline/);assert.match(prompt,/not a manuscript/);
});
test('every format keeps detailed production and source references out of its compact planning request',()=>{
  for(const format of ['Course','Webinar','Presentation','Ebook','Guide','Document','Report','Manual','Checklist','Template kit','Workbook','Spreadsheet','Calculator','Tracker']){
    const input=request(format),planning=interviewPrompt({...input,mode:'expand-outline'}).prompt,writing=interviewPrompt(input).prompt;
    assert.match(planning,/FORMAT PLANNING ONLY/);assert.doesNotMatch(planning,/## Production Contract|Reference basis:|## Reference Basis|Reference adaptations/);
    assert.ok(writing.includes('## Production Contract'),format);assert.ok(planning.length<20000,format+' planning stays compact');
  }
});
test('full drafts and focused edits retain format guidance without authorizing a rewrite',()=>{
  const input=request('Ebook');input.brief.productDraft='## Keep This\n\nKeep every approved word.';input.approvedDraft=input.brief.productDraft;
  const full=interviewPrompt({...input,mode:'full-draft'}).prompt;
  assert.match(full,/# Course Architect/);assert.match(full,/# Ebook Formatter/);assert.match(full,/ENTIRE current brief.productDraft is read-only/);
  const edit=interviewPrompt({...input,revisionIntent:true,currentInput:'Change only the final sentence.'}).prompt;
  assert.match(edit,/Formatting advice does not authorize rewriting approved text/);
});
test('slide guidance preserves the stricter existing slide and approval contracts',()=>{
  const {prompt}=interviewPrompt(request('Webinar presentation'));
  assert.match(prompt,/# Slide Deck Architect/);assert.match(prompt,/14 visible words TOTAL/);assert.match(prompt,/40% empty space/);assert.match(prompt,/### Presenter notes/);
  assert.match(prompt,/Title Case/);assert.match(prompt,/THREE source-specific sample slides/);
  assert.doesNotMatch(prompt,/Generate a 5-module course|Bullet 1 \(Max 7 words\)|\/course \[topic\]/);
});
test('discovery does not load writing rules before a format is chosen',()=>{
  const {prompt}=interviewPrompt(request('',{interviewStage:1}));
  for(const heading of headings)assert.equal(prompt.includes(heading),false);
});
