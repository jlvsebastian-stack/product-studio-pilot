import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProject} from '../src/product.js';
import {designProduct,parseManuscript,wrapText} from '../src/page-design.js';
import {exportProduct} from '../src/exports.js';

const paragraph='A useful example records the actual cost before choosing a selling price. '.repeat(7).trim();
const project=source=>{const value=freshProject();value.stage=12;value.stageReady=true;Object.assign(value.brief,{title:'A Practical Cost Lesson',format:'Course materials',productDraft:source});return value;};
const pageText=page=>page.items.filter(item=>item.type==='text').map(item=>item.text).join(' ');
const normalized=value=>value.replace(/\s+/g,' ').trim();

test('a short continuation flows into the next teaching section instead of becoming a stranded paragraph page',async()=>{
  const tail='Use active hands-on labor consistently when calculating the real batch cost.';
  const source='## Find The Cost\n\n'+Array.from({length:4},(_,index)=>'Example '+(index+1)+'. '+paragraph).join('\n\n')+'\n\n'+tail+'\n\n## Choose The Price\n\n'+Array.from({length:4},(_,index)=>'Price example '+(index+1)+'. '+paragraph).join('\n\n')+'\n\n## Check The Result\n\n'+paragraph+'\n\n'+paragraph;
  const value=project(source),snapshot=structuredClone(value),design=await designProduct(value),continued=design.pages.find(page=>page.continued&&pageText(page).includes(tail));
  assert.ok(continued,'The fixture must exercise an actual continuation.');
  assert.ok(pageText(continued).includes('Choose The Price'),'the next heading uses the available continuation page');
  assert.ok(pageText(continued).includes('Price example 1.'),'the heading has real teaching content with it');
  const sourceText=normalized(design.pages.flatMap(page=>page.items.filter(item=>item.role==='body').map(item=>item.text)).join(' '));
  for(const block of parseManuscript(source).filter(block=>block.kind==='body'))assert.ok(sourceText.includes(normalized(block.text)),block.text.slice(0,40));
  assert.deepEqual(value,snapshot);
});

test('a whole short table keeps its subheading and introducing paragraph on the same page',async()=>{
  const source='## Prepare The Worked Example\n\n'+Array.from({length:3},(_,index)=>'Context '+(index+1)+'. '+paragraph).join('\n\n')+'\n\n### Approved Cost Record\n\nThe example below records the costs for one finished batch.\n\n| Item | Calculation | Cost |\n|---|---|---|\n| Ingredients | Add each recipe ingredient | 600 |\n| Packaging | Include the actual batch packaging | 100 |\n| Labor | Two active hours at 150 each | 300 |\n| Total | Add the modeled batch costs | 1000 |\n\nCheck the complete batch before dividing by the sellable yield.';
  const value=project(source),design=await designProduct(value),tablePage=design.pages.find(page=>page.items.some(item=>item.role==='table-header'));
  assert.ok(tablePage);assert.ok(pageText(tablePage).includes('Approved Cost Record'),'the table retains its descriptive subheading');assert.ok(pageText(tablePage).includes('The example below records the costs for one finished batch.'),'the table retains its introduction');
  const exported=await exportProduct(value),markdown=exported.files.find(file=>file.name.endsWith('.md'));
  assert.equal(Buffer.from(markdown.blob,'base64').toString('utf8'),source,'the canonical manuscript is byte-exact');
  const text=normalized(design.pages.flatMap(page=>page.items.filter(item=>['body','table-header','table-cell'].includes(item.role)).map(item=>item.text)).join(' '));
  for(const block of parseManuscript(source)){if(block.kind==='body')assert.ok(text.includes(normalized(block.text)));if(block.kind==='table')for(const row of [block.columns,...block.rows])for(const cell of row)assert.ok(text.includes(normalized(cell)));}
  for(const page of design.pages)for(const item of page.items)if(item.type==='text')assert.ok(item.y>=0&&item.y+item.size<design.geometry.height-24,'text stays inside normal page bounds');
});

test('a final short paragraph uses available text space instead of creating a two-line last page',async()=>{
  const short='Keep the last confirmed plan until the couple replies.';
  const longer='Before sending the revised plan, ask the couple to confirm the named groups and tell both helpers the agreed order. Keep the confirmed plan until they reply.';
  const tail='For a change during portraits, ask the couple directly which remaining group takes priority, then tell both helpers the revised order.';
  assert.equal(wrapText(short,13.2,491.28).length,1);assert.equal(wrapText(longer,13.2,491.28).length,2);assert.equal(wrapText(tail,13.2,491.28).length,2);
  const paragraphs=[...Array(3).fill(longer),...Array(13).fill(short),tail],source='## Handle A Late Change\n\n'+paragraphs.join('\n\n'),value=project(source),design=await designProduct(value);
  assert.equal(design.pages.length,2,'a near-fit final paragraph must not get its own continuation page');
  assert.ok(pageText(design.pages.at(-1)).includes(tail));
  const body=design.pages.at(-1).items.filter(item=>item.role==='body');assert.ok(body.every(item=>item.size===13.2),'body type is unchanged');assert.ok(body.every(item=>item.y+item.h<=design.geometry.bottom),'the actual line boxes stay within the existing content bottom');
  assert.equal(normalized(body.map(item=>item.text).join(' ')),normalized(paragraphs.join(' ')),'all source text and order are retained');assert.equal(value.brief.productDraft,source);
});
