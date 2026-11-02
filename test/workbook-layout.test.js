import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { freshProject } from '../src/product.js';
import { designProduct, textWidth } from '../src/page-design.js';
import { previewProduct, exportProduct } from '../src/exports.js';

function workbook(source) {
  const project=freshProject();
  Object.assign(project.brief,{title:'Map exams and fixed commitments',format:'Compact workbook',productDraft:source});
  return project;
}
const normalize=value=>value.replace(/\s+/g,' ').trim();
const tableRows=Array.from({length:7},(_,i)=>[
  ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][i],
  `Commitment ${i+1}: classes 9:00 a.m.–12:00 p.m.; travel 8:30–9:00 a.m. and 12:30–1:00 p.m.`,
  i===6?'No opening selected yet':'2:00–2:30 p.m.'
]);
const tableSource='## Map exams and fixed commitments\n\n### Fictional filled example\n\n'+
  '| Day | Fixed commitments, including travel | One possible study opening |\n'+
  '| --- | --- | --- |\n'+tableRows.map(row=>'| '+row.join(' | ')+' |').join('\n');

test('workbook tables are actual aligned cells in the production preview and PDF pipeline',async()=>{
  const project=workbook(tableSource),design=await designProduct(project,{draft:true});
  const pages=design.pages.filter(page=>page.items.some(item=>item.role==='table-cell'));
  assert.ok(pages.length,'the table must be drawn as cells, not a pipe paragraph');
  const cells=pages.flatMap(page=>page.items.filter(item=>item.role==='table-cell'));
  const columns=[...new Set(cells.map(item=>item.x))].sort((a,b)=>a-b);
  assert.equal(columns.length,3,'all three source columns remain separate');
  for(let column=0;column<3;column++){
    const rendered=normalize(cells.filter(item=>item.x===columns[column]).map(item=>item.text).join(' '));
    assert.equal(rendered,normalize(tableRows.map(row=>row[column]).join(' ')),'each cell survives in its source column and row order');
  }
  for(const page of pages){
    assert.ok(page.items.some(item=>item.role==='table-header'));
    assert.ok(page.items.filter(item=>item.role==='table-rule').length>=4);
    for(const item of page.items.filter(item=>item.role==='table-cell'||item.role==='table-header')){
      assert.ok(item.size>=11.5,'table copy remains legible');
      assert.ok(item.x+textWidth(item.text,item.size,item.bold)<=design.geometry.width-design.geometry.margin+0.1);
      assert.ok(item.y+item.size<=design.geometry.bottom);
    }
  }
  assert.ok(design.pages.every(page=>!page.items.some(item=>item.type==='text'&&item.text.includes(' | '))));
  const preview=await previewProduct(project,{draft:true});
  assert.ok(preview.pages.some(page=>page.svg.includes('data-role="table-cell"')));
  const output=await exportProduct(project,{draft:true});
  const pdf=await PDFDocument.load(Buffer.from(output.files.find(file=>file.mimeType==='application/pdf').blob,'base64'));
  assert.equal(pdf.getPageCount(),preview.pageCount);
  assert.equal(Buffer.from(output.files.find(file=>file.mimeType==='text/markdown').blob,'base64').toString(),'> DRAFT SAMPLE — for review\n\n'+project.brief.productDraft);
  assert.equal(JSON.parse(Buffer.from(output.checkpoint.blob,'base64').toString()).project.brief.productDraft,project.brief.productDraft);
});

test('standalone underscore fields provide writing space and retain each adjacent day group together',async()=>{
  const days=Array.from({length:7},(_,i)=>`**Day ${i+1} — day and date:**\n____________________________\nFixed commitments and everyday needs:\n____________________________\nPossible study opening:\n____________________________`).join('\n\n');
  const project=workbook('## Map exams and fixed commitments\n\n### Your exercise: map your seven days\n\nFor each day, record fixed commitments and a possible study opening. Leave room for travel, meals, rest and uncertain times.\n\n'+days);
  const design=await designProduct(project,{draft:true});
  const rules=design.pages.flatMap(page=>page.items.filter(item=>item.role==='writing-line'));
  assert.equal(rules.length,42,'all twenty-one explicit fields get two useful ruled answer lines');
  for(let day=1;day<=7;day++){
    const page=design.pages.find(page=>page.items.some(item=>item.text===`Day ${day} — day and date:`));
    assert.ok(page,`Day ${day} heading is present`);
    const start=page.items.find(item=>item.text===`Day ${day} — day and date:`).y;
    const nextDay=page.items.find(item=>/^Day \d+ — day and date:$/.test(item.text||'')&&item.y>start)?.y??Infinity;
    const group=page.items.filter(item=>item.y>=start&&item.y<nextDay);
    assert.ok(group.some(item=>item.text==='Fixed commitments and everyday needs:'),`Day ${day} commitments stay with its label`);
    assert.ok(group.some(item=>item.text==='Possible study opening:'),`Day ${day} opening stays with its label`);
    assert.equal(group.filter(item=>item.role==='writing-line').length,6,`Day ${day} has its complete writing area on the same page`);
  }
  assert.ok(design.pages.every(page=>page.items.every(item=>item.role!=='writing-line'||item.y<=design.geometry.bottom)));
  assert.ok(design.pages.every(page=>page.items.every(item=>item.type!=='text'||!/_{3,}/.test(item.text))));
});

test('long tables continue with headers and keep each feasible source row intact',async()=>{
  const rows=Array.from({length:24},(_,i)=>`Row ${i+1} | A specific commitment for row ${i+1}, including travel and meal time | Opening ${i+1}`);
  const design=await designProduct(workbook('## Weekly record\n\nDay | Commitments | Opening\n--- | --- | ---\n'+rows.join('\n')));
  const pages=design.pages.filter(page=>page.items.some(item=>item.role==='table-cell'));
  assert.ok(pages.length>=2,'the table is deliberately longer than one usable page');
  for(const page of pages){
    assert.ok(page.items.some(item=>item.role==='table-header'&&item.text==='Commitments'),'continuation pages repeat the column headings');
    const cells=page.items.filter(item=>item.role==='table-cell');
    for(const marker of cells.filter(item=>/^Row \d+$/.test(item.text))){
      const number=marker.text.slice(4);
      assert.ok(cells.some(item=>item.text===`Opening ${number}`&&item.y===marker.y),'a row does not lose its final cell to the following page');
    }
  }
});
