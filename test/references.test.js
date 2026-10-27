import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { Document, Packer, Paragraph } from 'docx';
import PptxGenJS from 'pptxgenjs';

const intake = await import('../src/references.js').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
const file = (name, bytes, mimeType = '') => ({ name, mimeType, data: Buffer.from(bytes).toString('base64') });
const ingest = async (files, options) => {
  assert.equal(typeof intake.prepareReferences, 'function', 'real bounded reference ingestion must exist');
  return intake.prepareReferences({ files, links: [] }, options);
};
async function office(name, parts) {
  const zip = new JSZip();
  for (const [path, text] of Object.entries(parts)) zip.file(path, text);
  return file(name, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}
async function pdf(text, pages = 1) {
  const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.Helvetica);
  for (let n = 0; n < pages; n++) { const page = doc.addPage(); if (text) page.drawText(text, { font, x: 50, y: 700 }); }
  return file('source.pdf', await doc.save(), 'application/pdf');
}
function network(routes, addresses = [{ address: '93.184.216.34', family: 4 }]) {
  const visits = [];
  return {
    visits,
    resolve: async () => addresses,
    request(url, options, callback) {
      const req = new EventEmitter();
      req.destroy = error => { if (error) queueMicrotask(() => req.emit('error', error)); };
      req.end = () => {
        options.lookup(url.hostname, {}, (error, address, family) => {
          if (error) return req.emit('error', error);
          visits.push({ url: String(url), address, family, headers: options.headers });
          const route = routes[String(url)] || { status: 404, body: '' };
          const response = Readable.from(route.chunks || [Buffer.from(route.body || '')]);
          response.statusCode = route.status || 200;
          response.headers = { 'content-type': 'text/html; charset=utf-8', ...route.headers };
          callback(response);
        });
      };
      return req;
    },
  };
}

test('plain references contain actual source content with format and total excerpt limits', async () => {
  const refs = await ingest([file('notes.md', '# Actual lesson\nUse a budget of 700.'), file('table.csv', 'item,cost\nPaper,125')]);
  assert.match(refs[0].text, /Actual lesson\nUse a budget of 700/);
  assert.match(refs[1].text, /Paper,125/);
  assert.equal(refs[0].status, 'ready');
  assert.equal(intake.referenceSchema.safeParse(refs[0]).success, true);
  const long = await ingest(Array.from({ length: 5 }, (_, n) => file(`notes-${n}.txt`, String(n).repeat(18000))));
  assert.equal(long.reduce((n, r) => n + r.text.length, 0), 60000);
  assert.ok(long.every(r => r.status === 'excerpt' && r.text.length <= 16000 && /limit|excerpt|truncat/i.test(r.note)));
});

test('PDF extracts real page text and labels scan-only, corrupt and page-limited files honestly', async () => {
  const [text, scan, corrupt, tooMany] = await ingest([await pdf('Creator lesson: charge 725 for the workshop.'), await pdf(''), file('broken.pdf', '%PDF-broken'), await pdf('bounded', 101)]);
  assert.match(text.text, /charge 725 for the workshop/);
  assert.equal(text.status, 'ready');
  assert.equal(scan.status, 'unavailable'); assert.match(scan.note, /scan|no readable text/i);
  assert.equal(corrupt.status, 'unavailable'); assert.equal(corrupt.text, '');
  assert.equal(tooMany.status, 'unavailable'); assert.match(tooMany.note, /page limit|100 pages/i);
});

test('Office references extract document, slide, shared-string and stored spreadsheet values', async () => {
  const docs = await office('lesson.docx', { 'word/document.xml': '<w:document><w:body><w:p><w:r><w:t>Actual &amp; useful </w:t></w:r><w:r><w:t>lesson</w:t></w:r></w:p><w:p><w:r><w:t>Second step</w:t></w:r></w:p></w:body></w:document>' });
  const slides = await office('teaching.pptx', { 'ppt/slides/slide2.xml': '<p:sld><a:p><a:r><a:t>Second real slide</a:t></a:r></a:p></p:sld>', 'ppt/slides/slide1.xml': '<p:sld><a:p><a:r><a:t>First real slide</a:t></a:r></a:p></p:sld>' });
  const sheet = await office('budget.xlsx', {
    'xl/workbook.xml': '<workbook><sheets><sheet name="Budget" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': '<sst><si><t>Venue fee</t></si></sst>',
    'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>250</v></c><c r="C1"><f>B1*2</f><v>500</v></c><c r="D1"><f>WEBSERVICE("https://example.com")</f></c><c r="E1" t="inlineStr"><is><t>Actual note</t></is></c></row></sheetData></worksheet>',
  });
  const [doc, deck, workbook] = await ingest([docs, slides, sheet]);
  assert.match(doc.text, /Actual & useful lesson\nSecond step/);
  assert.ok(deck.text.indexOf('First real slide') < deck.text.indexOf('Second real slide'));
  assert.match(workbook.text, /Budget/); assert.match(workbook.text, /Venue fee/); assert.match(workbook.text, /250/); assert.match(workbook.text, /500/); assert.match(workbook.text, /Actual note/);
  assert.match(workbook.text, /no cached value/i); assert.doesNotMatch(workbook.text, /WEBSERVICE/); assert.match(workbook.note, /stored|cached/i);
});

test('XLSX keeps dense, omitted, explicitly blank and unsorted cells tied to their real columns', async () => {
  const workbook = await office('sparse.xlsx', {
    'xl/worksheets/sheet1.xml': '<worksheet><sheetData>' +
      '<row r="1"><c r="A1" t="inlineStr"><is><t>Client</t></is></c><c r="B1" t="inlineStr"><is><t>Cost</t></is></c><c r="C1" t="inlineStr"><is><t>Revenue</t></is></c></row>' +
      '<row r="2"><c r="A2" t="inlineStr"><is><t>Alpha</t></is></c><c r="C2"><v>1200</v></c></row>' +
      '<row r="3"><c r="A3" t="inlineStr"><is><t>Beta</t></is></c><c r="B3"/><c r="C3"><v>1300</v></c></row>' +
      '<row r="4"><c r="A4" t="inlineStr"><is><t>Gamma</t></is></c><c r="B4"></c><c r="C4"><v>1400</v></c></row>' +
      '<row r="5"><c r="C5"><v>1500</v></c><c r="A5" t="inlineStr"><is><t>Delta</t></is></c></row>' +
      '<row r="6"><c r="A6" t="inlineStr"><is><t>Dense</t></is></c><c r="B6"><v>100</v></c><c r="C6"><v>1600</v></c></row>' +
      '<row r="7"/><row r="8"><c r="A8" t="inlineStr"><is><t>After blank row</t></is></c><c r="C8"><v>1800</v></c></row>' +
      '</sheetData></worksheet>',
  });
  const [ref] = await ingest([workbook]);
  assert.equal(ref.status, 'ready');
  assert.equal(ref.text, '[Sheet: sheet1.xml]\nA1="Client"\tB1="Cost"\tC1="Revenue"\nA2="Alpha"\tC2="1200"\nA3="Beta"\tB3=""\tC3="1300"\nA4="Gamma"\tB4=""\tC4="1400"\nA5="Delta"\tC5="1500"\nA6="Dense"\tB6="100"\tC6="1600"\nA8="After blank row"\tC8="1800"');
  assert.match(ref.note, /coordinates/i);
});

test('XLSX far columns preserve explicit coordinates without allocating their gaps', async () => {
  const wide = await office('wide.xlsx', { 'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="XFD1"><v>1200</v></c><c r="A1" t="inlineStr"><is><t>Start</t></is></c></row></sheetData></worksheet>' });
  const invalid = await office('invalid.xlsx', { 'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="ZZZZZZZZZZZZZZZZZZZZZZZZZZZZ1"><v>1200</v></c></row></sheetData></worksheet>' });
  const [ref, rejected] = await ingest([wide, invalid]);
  assert.equal(ref.status, 'ready'); assert.equal(ref.text, '[Sheet: sheet1.xml]\nA1="Start"\tXFD1="1200"');
  assert.ok(ref.text.length < 100, 'far sparse columns must not expand into thousands of empty cells');
  assert.equal(rejected.status, 'unavailable'); assert.equal(rejected.text, ''); assert.match(rejected.note, /coordinate|column/i);
});

test('files generated by real Word and PowerPoint libraries retain their authored lesson text', async () => {
  const word = new Document({ sections: [{ children: [new Paragraph('Word source: make a useful worksheet with three customer questions.')] }] });
  const deck = new PptxGenJS(); deck.addSlide().addText('Slide source: validate the workshop before charging 725.', { x: 1, y: 1, w: 8, h: 2 });
  const [docx, pptx] = await ingest([file('authored.docx', await Packer.toBuffer(word)), file('authored.pptx', await deck.write({ outputType: 'nodebuffer' }))]);
  assert.equal(docx.status, 'ready'); assert.match(docx.text, /three customer questions/);
  assert.equal(pptx.status, 'ready'); assert.match(pptx.text, /before charging 725/);
});

test('unsupported formats, XML entities, oversized ZIP inflation and malformed bytes never masquerade as read', async () => {
  const bomb = await office('bomb.docx', { 'word/document.xml': 'x'.repeat(3 * 1024 * 1024) });
  const bombBytes = Buffer.from(bomb.data, 'base64');
  const central = bombBytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  bombBytes.writeUInt32LE(100, central + 24); // Lie about expansion size: the stream must enforce the actual limit.
  bomb.data = bombBytes.toString('base64');
  const entities = await office('entities.docx', { 'word/document.xml': '<!DOCTYPE x [<!ENTITY x SYSTEM "file:///private">]><w:t>&x;</w:t>' });
  const refs = await ingest([file('data.exe', 'Pretend this is known'), bomb, entities, file('binary.txt', Buffer.from([0, 255, 254, 0]))]);
  assert.ok(refs.every(r => r.status === 'unavailable' && r.text === ''));
  assert.match(refs[0].note, /unsupported/i); assert.match(refs[1].note, /expanded|decompress|ZIP|archive/i); assert.match(refs[2].note, /XML|entities/i);
});

test('empty slides and worksheets are unavailable instead of claiming labels as extracted content', async () => {
  const blankDeck = await office('empty.pptx', { 'ppt/slides/slide1.xml': '<p:sld><p:cSld/></p:sld>' });
  const blankSheet = await office('empty.xlsx', { 'xl/worksheets/sheet1.xml': '<worksheet><sheetData/></worksheet>' });
  const refs = await ingest([blankDeck, blankSheet]);
  assert.ok(refs.every(ref => ref.status === 'unavailable' && ref.text === ''), 'source labels alone are not actual content');
});

test('file, aggregate, image and source limits reject input before ingestion', async () => {
  await assert.rejects(() => ingest(Array.from({ length: 6 }, () => file('n.txt', 'x'))), /5 sources/i);
  await assert.rejects(() => ingest([file('large.txt', Buffer.alloc(3 * 1024 * 1024 + 1))]), /3 MiB/i);
  await assert.rejects(() => ingest([file('a.txt', Buffer.alloc(3 * 1024 * 1024)), file('b.txt', Buffer.alloc(3 * 1024 * 1024)), file('c.txt', 'x')]), /6 MiB/i);
  await assert.rejects(() => ingest([file('bad.txt', 'x')].map(v => ({ ...v, data: '!!!!' }))), /base64/i);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0WQAAAAASUVORK5CYII=', 'base64');
  const [image] = await ingest([file('visual.png', png, 'image/png')]);
  assert.equal(image.kind, 'image'); assert.equal(image.status, 'ready'); assert.equal(image.text, ''); assert.equal(image.imageData, `data:image/png;base64,${png.toString('base64')}`);
  await assert.rejects(() => ingest([file('a.png', png), file('b.png', png), file('c.png', png)]), /2 images/i);
  await assert.rejects(() => ingest([file('large.png', Buffer.alloc(512 * 1024 + 1))]), /512 KiB/i);
  const [fake, huge] = await ingest([file('fake.png', 'not image bytes'), file('huge.png', Buffer.from(png))].map((v, i) => { if (i) { const b = Buffer.from(v.data, 'base64'); b.writeUInt32BE(100000, 16); return file(v.name, b); } return v; }));
  assert.equal(fake.status, 'unavailable'); assert.equal(huge.status, 'unavailable');
  const forged = Buffer.from(png); forged.writeUInt32BE(100000, 16);
  assert.equal(intake.referenceSchema.safeParse({ ...image, imageData: `data:image/png;base64,${forged.toString('base64')}` }).success, false, 'restored references cannot bypass image dimension limits');
});

test('a timed-out real parser worker is terminated before return while the main loop remains responsive', async () => {
  let ticked = false;
  const immediate = new Promise(resolve => setImmediate(() => { ticked = true; resolve(); }));
  const started = Date.now();
  const [ref] = await ingest([await pdf('timeout source')], { parseTimeoutMs: 1 });
  await immediate;
  assert.equal(ticked, true); assert.equal(ref.status, 'unavailable'); assert.match(ref.note, /timed out.*terminated/i);
  assert.ok(Date.now() - started < 2000);
  const [next] = await ingest([file('next.txt', 'Still available after cancelled parser')]);
  assert.match(next.text, /Still available/);
});

test('public link reader extracts page text, excludes scripts, pins DNS and sends no account headers', async () => {
  const net = network({ 'https://example.com/guide': { body: '<html><head><style>HIDE</style><script>secret()</script></head><body><h1>Real lesson</h1><p>Budget &amp; scope: 725.</p></body></html>' } });
  const [ref] = await intake.prepareReferences({ links: ['https://example.com/guide'] }, net);
  assert.equal(ref.kind, 'link'); assert.equal(ref.status, 'ready'); assert.match(ref.text, /Real lesson/); assert.match(ref.text, /Budget & scope: 725/); assert.doesNotMatch(ref.text, /secret|HIDE/);
  assert.equal(net.visits[0].address, '93.184.216.34'); assert.equal(net.visits[0].family, 4); assert.equal(net.visits[0].headers.Cookie, undefined); assert.equal(net.visits[0].headers.Authorization, undefined);
});

test('dual-stack sites use public IPv4 and HTML parsing is cancellable outside the main loop', async () => {
  const net = network({ 'https://example.com/guide': { body: '<h1>Readable public lesson</h1>' } });
  net.resolve = async (_hostname, options) => options.family === 4 ? [{ address: '93.184.216.34', family: 4 }] : [{ address: '93.184.216.34', family: 4 }, { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 }];
  const [read] = await intake.prepareReferences({ links: ['https://example.com/guide'] }, net);
  assert.equal(read.status, 'ready'); assert.match(read.text, /Readable public lesson/);
  const [cancelled] = await intake.prepareReferences({ links: ['https://example.com/guide'] }, { ...net, parseTimeoutMs: 1 });
  assert.equal(cancelled.status, 'unavailable'); assert.match(cancelled.note, /timed out.*terminated/i);
});

test('private, local, numeric and IPv6 links and private redirect targets are blocked before connecting', async () => {
  for (const url of ['http://localhost/x', 'http://127.1/x', 'http://0x7f000001/x', 'http://169.254.169.254/latest', 'http://[::1]/x', 'file:///tmp/test', 'https://user:pass@example.com/x']) {
    const net = network({});
    const [ref] = await intake.prepareReferences({ links: [url] }, net);
    assert.equal(ref.status, 'unavailable', url); assert.equal(net.visits.length, 0, url);
  }
  for (const address of ['10.0.0.2', '172.16.2.4', '192.168.1.5', '169.254.1.1', '100.64.0.1', '::ffff:127.0.0.1']) {
    const net = network({}, [{ address, family: address.includes(':') ? 6 : 4 }]);
    const [ref] = await intake.prepareReferences({ links: ['https://example.com/private'] }, net);
    assert.equal(ref.status, 'unavailable', address); assert.equal(net.visits.length, 0);
  }
  const mixed = network({}, [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.4', family: 4 }]);
  const [mixedRef] = await intake.prepareReferences({ links: ['https://example.com/mixed'] }, mixed);
  assert.equal(mixedRef.status, 'unavailable'); assert.equal(mixed.visits.length, 0);
  const net = network({ 'https://example.com/start': { status: 302, headers: { location: 'http://127.0.0.1:8767/api/status' } } });
  const [ref] = await intake.prepareReferences({ links: ['https://example.com/start'] }, net);
  assert.equal(ref.status, 'unavailable'); assert.equal(net.visits.length, 1);
  const redirected = network({ 'https://example.com/start': { status: 302, headers: { location: 'https://intranet.example/path' } } });
  redirected.resolve = async host => [{ address: host === 'intranet.example' ? '10.0.0.5' : '93.184.216.34', family: 4 }];
  const [privateDns] = await intake.prepareReferences({ links: ['https://example.com/start'] }, redirected);
  assert.equal(privateDns.status, 'unavailable'); assert.equal(redirected.visits.length, 1);
});

test('link bytes, redirects and total time stay bounded and inaccessible pages remain unavailable', async () => {
  const net = network({
    'https://example.com/big': { chunks: [Buffer.alloc(1024 * 1024 + 1, 65)] },
    'https://example.com/no': { status: 403 },
    'https://example.com/loop': { status: 302, headers: { location: '/loop' } },
    'https://example.com/binary': { body: 'not pdf text', headers: { 'content-type': 'application/pdf' } },
  });
  const refs = await intake.prepareReferences({ links: ['https://example.com/big', 'https://example.com/no', 'https://example.com/loop', 'https://example.com/binary'] }, net);
  assert.ok(refs.every(r => r.status === 'unavailable' && r.text === ''));
  assert.match(refs[0].note, /size|1 MiB|large/i); assert.match(refs[1].note, /403/); assert.match(refs[2].note, /redirect/i); assert.match(refs[3].note, /upload|HTML|text/i);
  const [timed] = await intake.prepareReferences({ links: ['https://example.com/slow'] }, { resolve: () => new Promise(() => {}), fetchTimeoutMs: 5 });
  assert.equal(timed.status, 'unavailable'); assert.match(timed.note, /timed out/i);
});
