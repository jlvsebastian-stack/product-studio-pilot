import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import { exportProduct } from '../src/exports.js';
import { createLocalHandler } from '../src/local-server.js';
import { designProject } from './fixtures/design-project.js';

test('default export creates only PDF and Markdown with its private checkpoint separate and no presentation serialization', async () => {
  const project = designProject(), originalWrite = PptxGenJS.prototype.write;
  try {
    PptxGenJS.prototype.write = () => { throw new Error('Default export must not serialize an Office presentation.'); };
    const result = await exportProduct(project);
    assert.deepEqual(result.files.map(file => file.mimeType), ['application/pdf', 'text/markdown']);
    assert.ok(result.files.every(file => !/\.(?:docx|pptx|json)$/i.test(file.name)));
    assert.equal(Buffer.from(result.files.find(file => file.mimeType === 'text/markdown').blob, 'base64').toString(), project.brief.productDraft);
    assert.equal(result.checkpoint.mimeType, 'application/json');
    assert.equal(JSON.parse(Buffer.from(result.checkpoint.blob, 'base64').toString()).project.brief.productDraft, project.brief.productDraft);
  } finally { PptxGenJS.prototype.write = originalWrite; }
});

test('normal HTTP export ZIP and registered downloads exclude Office and private JSON files', async t => {
  const server = createServer(createLocalHandler());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}`, project = designProject();
  project.brief.listingCopy = 'A complete handoff guide with a worked example and worksheet. Review the sample before choosing it.';
  const response = await fetch(url + '/api/export-product', { method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify({ brief: project.brief, reviewed: true }) });
  assert.equal(response.status, 200);
  const { files } = await response.json();
  assert.deepEqual(Object.keys(files).sort(), ['markdown', 'pdf', 'zip']);
  const zip = await JSZip.loadAsync(await (await fetch(url + files.zip.url)).arrayBuffer());
  const names = Object.keys(zip.files).filter(name => !zip.files[name].dir);
  assert.ok(names.some(name => name.endsWith('.pdf'))); assert.ok(names.some(name => name.endsWith('.md')));
  assert.ok(names.every(name => !/\.(?:docx|pptx|json)$/i.test(name)));
  assert.equal(await zip.file(files.markdown.name).async('string'), project.brief.productDraft);
  assert.equal(await zip.file(files.markdown.name.replace(/\.md$/, '-listing.md')).async('string'), project.brief.listingCopy);
  const readme = await zip.file('READ-ME.txt').async('string');
  assert.match(readme, /Canva/); assert.match(readme, /Google Docs/); assert.doesNotMatch(readme, /Word|PowerPoint|\.docx|\.pptx/);
  const checkpointUrl = files.pdf.url.replace(/\.pdf$/, '-project.json');
  assert.equal((await fetch(url + checkpointUrl)).status, 404, 'a private checkpoint is not registered as a downloadable asset');
});
