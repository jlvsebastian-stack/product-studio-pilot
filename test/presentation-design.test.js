import {test} from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {extractText} from 'unpdf';
import {freshProject} from '../src/product.js';
import {designProduct,parseManuscript,textWidth,pageSvg} from '../src/page-design.js';
import {exportProduct,exportCanvaSource} from '../src/exports.js';

const manuscript=`## Choose your website’s job

Your minimum launch setup starts with what you want visitors to do.

- **Awareness:** understand your digital product and follow a contact or external link.
- **Lead capture:** submit their details to express interest or receive an offered resource.
- **Direct sales:** pay for your digital product and follow the confirmed access process.

**Choose one primary action.** Build the features it requires; keep additional features for later.

### Presenter notes

NOTES ALPHA: Keep all three options as choices, not mandatory stages.

## Compare the options

**Illustrative example: one digital guide, three possible website setups.**

| Setup | Visitor journey | Main action |
| --- | --- | --- |
| Awareness | Read about the guide → follow a contact link | Ask about the guide |
| Lead capture | Read about the guide → submit an interest form | Join the interest list |
| Direct sales | Read about the guide → pay → receive access after payment is confirmed | Buy and access the guide |

**Choose the journey you need now.** You can combine these options later.

### Presenter notes

NOTES BRAVO: Payment and access must be confirmed separately.`;
function project(){const p=freshProject();p.stage=9;Object.assign(p.brief,{title:'Choose your website’s job',format:'Webinar presentation',author:'Illustrative creator',outcome:'Choose the visitor action your first website needs to support.',productDraft:manuscript,theme:'ink'});return p;}
const visible=pages=>pages.flatMap(page=>page.items.filter(item=>item.type==='text').map(item=>item.text)).join(' ').replace(/\s+/g,' ');

test('Markdown tables become structured comparisons with native journey graphics rather than pipe text',async()=>{
  const blocks=parseManuscript(manuscript),table=blocks.find(block=>block.kind==='table');assert.ok(table,'The parser must recognize a real table');assert.equal(table.rows.length,3);assert.deepEqual(table.columns,['Setup','Visitor journey','Main action']);
  const design=await designProduct(project()),page=design.pages.find(page=>page.layout!=='cover'&&page.title==='Compare the options');
  assert.ok(page.items.some(item=>item.role==='journey-node'&&item.type==='rect'));assert.ok(page.items.some(item=>item.role==='journey-connector'&&item.type==='line'));assert.equal(page.items.some(item=>item.type==='text'&&item.text.includes('|')),false);
  for(const phrase of ['Awareness','Lead capture','Direct sales','Ask about the guide','Join the interest list','Buy and access the guide','receive access after payment is confirmed'])assert.ok(visible([page]).includes(phrase),phrase);
});
test('a compact choice lesson keeps its concluding instruction on the source slide',async()=>{
  const design=await designProduct(project()),pages=design.pages.filter(page=>page.layout!=='cover'&&page.title==='Choose your website’s job');
  assert.equal(pages.length,1,'The short closing paragraph must not orphan onto an almost-empty continuation');assert.ok(visible(pages).includes('Choose one primary action. Build the features it requires; keep additional features for later.'));
  assert.equal(pages[0].items.filter(item=>item.role==='choice-node').length,3);assert.ok(pages[0].items.some(item=>item.role==='choice-connector'&&item.type==='line'),'The teaching slide explains actual alternatives with a shared branch, not a decorative list');assert.equal(design.pages[0].items.filter(item=>item.role==='cover-choice-node').length,3);assert.ok(design.pages[0].items.some(item=>item.role==='cover-choice-connector'),'The cover uses the source choice relationship');assert.equal(design.pages.length,3,'Two short source slides need one designed cover and two content slides');
});
test('presentation design is reusable for unrelated comparisons and actual sequences',async()=>{
  const p=project();p.brief.title='Choose an onboarding route';p.brief.productDraft='## Compare the onboarding routes\n\n| Route | Next actions | Outcome |\n| --- | --- | --- |\n| Self serve | Read instructions → create a workspace | Start alone |\n| Guided | Book a call → agree the scope → create a workspace | Start together |\n\n## Review sequence\n\n1. Inspect the actual draft.\n2. Record an observable problem.\n3. Repeat the same check.';
  const design=await designProduct(p);assert.ok(design.pages.some(page=>page.items.some(item=>item.role==='journey-connector')));assert.ok(design.pages.some(page=>page.items.some(item=>item.role==='process-connector')));assert.equal(/Awareness|digital guide|Direct sales/.test(visible(design.pages)),false);
});
test('native scene text and graphics stay within slide bounds and the internal source uses bounded editable text boxes',async()=>{
  const p=project(),design=await designProduct(p);
  assert.notEqual(design.pages[0].items.find(item=>item.role==='paper').fill,'FCFCFD','The cover needs an intentional contrasting composition');
  for(const page of design.pages)for(const item of page.items){if(item.type==='text'){assert.ok(item.x>=0&&item.y>=0&&item.y+item.size<=516,item.text);assert.ok(item.x+textWidth(item.text,item.size,item.bold)<=930,item.text);assert.ok(item.w>0,'Deck text carries its actual column width');}else if(item.type==='rect'||item.type==='ellipse')assert.ok(item.x>=0&&item.y>=0&&item.x+item.w<=960&&item.y+item.h<=540);}
  const archive=await JSZip.loadAsync((await exportCanvaSource(p,{draft:true})).bytes),slides=await Promise.all(Object.entries(archive.files).filter(([name])=>/^ppt\/slides\/slide\d+\.xml$/.test(name)).map(([,entry])=>entry.async('string')));
  assert.ok(slides.join('').includes('studio-journey-node'));assert.ok(slides.join('').includes('studio-journey-connector'));
  const bounded=design.pages.flatMap(page=>page.items).find(item=>item.text==='follow a contact link');
  const nativeShape=[...slides.join('').matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].find(match=>match[0].includes('<a:t>follow a contact link</a:t>'))?.[0];
  assert.ok(nativeShape,'The diagram label remains editable native text');const nativeWidth=Number(nativeShape.match(/<a:ext cx="(\d+)"/)?.[1]);assert.ok(Math.abs(nativeWidth-bounded.w*12700)<=2,'Native text uses its diagram node width, not the remaining full slide width');
  assert.ok(design.pages.every(page=>pageSvg(page).includes('viewBox="0 0 960 540"')));
});
test('PDF retains audience wording, Markdown remains exact, and each output slide carries its own native notes',async()=>{
  const p=project(),design=await designProduct(p),result=await exportProduct(p,{draft:true});
  assert.equal(Buffer.from(result.files.find(file=>file.name.endsWith('.md')).blob,'base64').toString(),'> DRAFT SAMPLE — for review\n\n'+p.brief.productDraft);
  const pdf=(await extractText(Uint8Array.from(Buffer.from(result.files[0].blob,'base64')),{mergePages:true})).text.replace(/\s+/g,' ');
  for(const phrase of ['Choose one primary action.','Build the features it requires; keep additional features for later.','Ask about the guide','Buy and access the guide'])assert.ok(pdf.includes(phrase),phrase);
  assert.equal(pdf.includes('NOTES ALPHA'),false);assert.ok(design.pages.filter(page=>page.title==='Compare the options').every(page=>page.presenterNotes==='NOTES BRAVO: Payment and access must be confirmed separately.'));
});
test('Markdown tables accept optional outer pipes while literal and fenced-code pipes stay literal',async()=>{
  const rows=['Route | Next action | Outcome','--- | --- | ---','Self serve | Read the instructions | Start alone','Guided | Book a planning call | Start together'];
  const without=rows.join('\n'),withOuter=rows.map(row=>'| '+row+' |').join('\n');
  const table=parseManuscript(without).find(block=>block.kind==='table');assert.ok(table,'A valid delimiter row recognizes tables without outer pipes');assert.deepEqual(table,parseManuscript(withOuter)[0]);
  const literals=parseManuscript('Keep the literal a | b expression.\n\n```text\nRoute | Next action | Outcome\n--- | --- | ---\nSelf serve | Read instructions | Start alone\n```');assert.equal(literals.some(block=>block.kind==='table'),false);assert.ok(literals.some(block=>block.kind==='body'&&block.text==='Keep the literal a | b expression.'));assert.ok(literals.some(block=>block.kind==='code'&&block.text==='Route | Next action | Outcome'));
  const p=project();p.brief.title='Compare onboarding routes';p.brief.productDraft='## Compare onboarding routes\n\nChoose the next action that suits the team.\n\n'+without+'\n\n### Presenter notes\n\nRetain the source-specific explanation.';const original=p.brief.productDraft,design=await designProduct(p);assert.equal(visible(design.pages).includes('|'),false);for(const phrase of ['Self serve','Read the instructions','Start alone','Guided','Book a planning call','Start together'])assert.ok(visible(design.pages).includes(phrase));assert.equal(p.brief.productDraft,original);assert.ok(design.pages.some(page=>page.presenterNotes==='Retain the source-specific explanation.'));
});
test('long duplicated cover labels stay bounded while complete source labels remain on teaching slides',async()=>{
  const labels=['Independent teams who need to read the complete onboarding guide and check access before inviting their colleagues','Small teams who need to review all permissions with a coordinator before creating their first shared workspace','Distributed teams who need a supported demonstration of the full onboarding process before assigning local owners','New project teams who need to compare the existing onboarding materials and agree a reviewed first working draft'];
  const p=project();p.brief.title='Compare onboarding routes';p.brief.outcome='';p.brief.author='';p.brief.productDraft='## Compare onboarding routes\n\nChoose the next action that suits the team.\n\n| Route | Next action | Outcome |\n| --- | --- | --- |\n'+labels.map(label=>`| ${label} | Read the instructions | Start together |`).join('\n')+'\n\n### Presenter notes\n\nPreserve this explanation with the original comparison.';
  const original=p.brief.productDraft,design=await designProduct(p),cover=design.pages[0];
  for(const item of cover.items){if(item.type==='text')assert.ok(item.y>=0&&item.y+item.size<=516,`Cover text is clipped: ${item.text}`);if(item.type==='rect'||item.type==='ellipse')assert.ok(item.y>=0&&item.y+item.h<=540,'Cover node is outside the canvas');if(item.type==='line')assert.ok(Math.max(item.y,item.y2)<=474,'Cover connector crosses the footer');}
  const teaching=visible(design.pages.slice(1));for(const label of labels)assert.ok(teaching.includes(label),'Complete source label remains visible: '+label);assert.equal(p.brief.productDraft,original);assert.ok(design.pages.filter(page=>page.layout!=='cover').every(page=>page.presenterNotes==='Preserve this explanation with the original comparison.'));
});
