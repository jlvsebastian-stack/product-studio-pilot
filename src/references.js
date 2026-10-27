import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { Worker } from 'node:worker_threads';
import { z } from 'zod';

const MiB = 1024 * 1024;
const MAX_TEXT = 16000, MAX_TOTAL_TEXT = 60000, MAX_IMAGE = 512 * 1024;
const extensions = { txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', tsv: 'text/tab-separated-values', json: 'application/json', pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

export function validateReferenceImage(bytes, mimeType) {
  let width = 0, height = 0;
  if (bytes.length > MAX_IMAGE) throw new Error('Each image must be at most 512 KiB.');
  if (mimeType === 'image/png') {
    if (bytes.length < 33 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes.toString('ascii', 12, 16) !== 'IHDR' || bytes.readUInt32BE(8) !== 13) throw new Error('This file is not a valid PNG image.');
    width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20);
    let position = 8, ended = false, data = false;
    while (position + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(position), type = bytes.toString('ascii', position + 4, position + 8);
      if (length > bytes.length - position - 12) throw new Error('This PNG image is truncated.');
      if (type === 'IDAT') data = true;
      position += length + 12;
      if (type === 'IEND' && length === 0) { ended = true; break; }
    }
    if (!ended || !data || position !== bytes.length) throw new Error('This PNG image is incomplete or malformed.');
  } else if (mimeType === 'image/jpeg') {
    if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) throw new Error('This file is not a valid JPEG image.');
    let position = 2, scan = false;
    while (position + 4 <= bytes.length) {
      if (bytes[position] !== 255) throw new Error('This JPEG image has invalid marker framing.');
      while (bytes[position] === 255) position++;
      const marker = bytes[position++];
      if (marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (position + 2 > bytes.length) throw new Error('This JPEG image is truncated.');
      const length = bytes.readUInt16BE(position);
      if (length < 2 || position + length > bytes.length) throw new Error('This JPEG image is truncated.');
      if (marker === 0xda) { scan = true; break; }
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 8) { height = bytes.readUInt16BE(position + 3); width = bytes.readUInt16BE(position + 5); }
      position += length;
    }
    if (!scan) throw new Error('This JPEG image has no readable image scan.');
  } else throw new Error('Only PNG or JPEG images are supported.');
  if (!width || !height || width > 4096 || height > 4096 || width * height > 16777216) throw new Error('This image exceeds the 4096-pixel dimension or 16-megapixel limit, or has no readable dimensions.');
  return { width, height };
}
function imageBytes(data, mimeType) {
  if (!data || data.length > Math.ceil(MAX_IMAGE / 3) * 4 || data.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) return false;
  const bytes = Buffer.from(data, 'base64');
  if (bytes.length > MAX_IMAGE || bytes.toString('base64') !== data) return false;
  try { validateReferenceImage(bytes, mimeType); return true; } catch { return false; }
}
const imageDataSchema = z.string().max(700000).refine(value => {
  const parts = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  return !!parts && imageBytes(parts[2], parts[1]);
}, 'Use a valid PNG or JPEG image no larger than 512 KiB.');

/** Processed source data only. Original document binaries never enter project state. */
export const referenceSchema = z.object({
  id: z.string().min(1).max(80), name: z.string().min(1).max(240),
  kind: z.enum(['file', 'link', 'image']), mimeType: z.string().max(100),
  text: z.string().max(MAX_TEXT), status: z.enum(['ready', 'excerpt', 'unavailable']),
  note: z.string().max(500), url: z.string().max(2048).optional(), imageData: imageDataSchema.optional(),
}).strict().superRefine((ref, context) => {
  if (ref.kind === 'image' && ref.status !== 'unavailable' && !ref.imageData) context.addIssue({ code: 'custom', path: ['imageData'], message: 'A readable image needs actual image bytes.' });
  if (ref.imageData && (ref.kind !== 'image' || !ref.imageData.startsWith(`data:${ref.mimeType};base64,`))) context.addIssue({ code: 'custom', path: ['imageData'], message: 'Image bytes and MIME type must match.' });
});

function invalid(message, statusCode = 400) { return Object.assign(new Error(message), { statusCode }); }
function cleanName(value) { return String(value || 'Reference').split(/[\\/]/).at(-1).replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 240) || 'Reference'; }
function unavailable(ref, error) { return { ...ref, text: '', status: 'unavailable', note: String(error?.message || error || 'This source could not be read.').slice(0, 500) }; }

async function parseFile(file, bytes, options) {
  const worker = new Worker(new URL('./reference-worker.js', import.meta.url), {
    workerData: { extension: file.extension, bytes: new Uint8Array(bytes) },
    resourceLimits: { maxOldGenerationSizeMb: 96, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
  });
  let timer;
  try {
    return await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Reading this file timed out; its parser was terminated.')), Math.min(8000, Math.max(1, options.parseTimeoutMs || 8000)));
      worker.once('message', result => result.error ? reject(new Error(result.error)) : resolve(result));
      worker.once('error', error => reject(new Error(error.code === 'ERR_WORKER_OUT_OF_MEMORY' ? 'This file exceeded the safe parser memory limit.' : 'This file could not be parsed safely.')));
      worker.once('exit', code => { if (code) reject(new Error('This file exceeded the safe parser limits.')); });
    });
  } finally {
    clearTimeout(timer);
    // terminate() resolves only after the worker has exited, including a hung parser.
    await worker.terminate();
  }
}

function publicIPv4(address) {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}
function publicUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('This link is not a valid public HTTP or HTTPS address.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || url.hostname.length > 253) throw new Error('Only public HTTP or HTTPS links without credentials or custom ports can be read.');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || !host.includes('.') || /(?:^|\.)(?:localhost|local|internal|home|lan)$/.test(host) || host.includes(':') || (isIP(host) && !publicIPv4(host))) throw new Error('Local, private, IPv6 and metadata addresses cannot be read.');
  url.hostname = host; url.hash = '';
  return url;
}
function beforeDeadline(promise, deadline, message) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), Math.max(1, deadline - Date.now())); })]).finally(() => clearTimeout(timer));
}
async function fetchPage(url, address, deadline, options) {
  return new Promise((resolve, reject) => {
    let req, response, settled = false;
    const finish = (error, result) => {
      if (settled) return; settled = true; clearTimeout(timer);
      if (error) { response?.destroy(); req?.destroy(); reject(error); } else resolve(result);
    };
    const timer = setTimeout(() => finish(new Error('Reading this public link timed out.')), Math.max(1, deadline - Date.now()));
    try {
      const send = options.request || (url.protocol === 'https:' ? httpsRequest : httpRequest);
      req = send(url, {
        agent: false, family: 4, maxHeaderSize: 16384,
        headers: { 'User-Agent': 'ProductStudio-ReferenceReader/1.0', Accept: 'text/html, text/plain, text/markdown, application/json', 'Accept-Encoding': 'identity' },
        // Resolve once, validate every result, then pin this connection to that public IP.
        lookup: (_hostname, _settings, callback) => callback(null, address, 4),
      }, res => {
        response = res;
        res.on('error', error => finish(error));
        const status = res.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(status)) { res.destroy(); return finish(null, { redirect: res.headers.location }); }
        if (status < 200 || status >= 300) return finish(new Error(`This page is inaccessible (HTTP ${status}); sign-in pages and account cookies are not used.`));
        const mimeType = String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        if (!(mimeType.startsWith('text/') || mimeType === 'application/json')) return finish(new Error('Only public HTML and text pages can be read from links. Upload PDF or Office files instead.'));
        if (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') return finish(new Error('This page requires unsupported content compression.'));
        if (Number(res.headers['content-length']) > MiB) return finish(new Error('This page exceeds the 1 MiB link size limit.'));
        const chunks = []; let size = 0;
        res.on('data', chunk => {
          size += chunk.length;
          if (size > MiB) return finish(new Error('This page exceeds the 1 MiB link size limit.'));
          chunks.push(Buffer.from(chunk));
        });
        res.on('end', () => finish(null, { bytes: Buffer.concat(chunks), mimeType }));
        res.on('aborted', () => finish(new Error('This page stopped before it could be read.')));
      });
      req.on('error', error => finish(error)); req.end();
    } catch (error) { finish(error); }
  });
}
async function readLink(raw, options) {
  let url = publicUrl(raw);
  const deadline = Date.now() + Math.min(6000, Math.max(1, options.fetchTimeoutMs || 6000));
  for (let redirects = 0; redirects <= 3; redirects++) {
    const addresses = await beforeDeadline((options.resolve || lookup)(url.hostname, { all: true, verbatim: true, family: 4 }), deadline, 'Looking up this public link timed out.');
    if (!Array.isArray(addresses) || !addresses.length || addresses.some(result => result.family !== 4 || !publicIPv4(result.address))) throw new Error('This link resolves to a private, local or IPv6 address and cannot be read.');
    const page = await fetchPage(url, addresses[0].address, deadline, options);
    if (Object.hasOwn(page, 'redirect')) {
      if (!page.redirect || redirects === 3) throw new Error('This page has too many or invalid redirects.');
      url = publicUrl(new URL(page.redirect, url).href); continue;
    }
    const parsed = await parseFile({ extension: page.mimeType.includes('html') ? 'html' : 'txt' }, page.bytes, { ...options, parseTimeoutMs: Math.max(1, Math.min(options.parseTimeoutMs || 8000, deadline - Date.now())) });
    return { text: parsed.text, mimeType: page.mimeType, status: parsed.status, note: parsed.status === 'excerpt' ? 'Public page text excerpt; the 16000-character source limit was reached. No account cookies or scripts were used.' : 'Public page text only. No account cookies or scripts were used; dynamic or sign-in content may be absent.' };
  }
}

/** Parse only the files/links explicitly submitted by the creator. No background crawling. */
export async function prepareReferences(raw, options = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalid('Provide a files and links object.');
  const files = raw.files ?? [], links = raw.links ?? [];
  if (!Array.isArray(files) || !Array.isArray(links)) throw invalid('References must contain files and links arrays.');
  if (!files.length && !links.length) throw invalid('Add at least one file or public link.');
  if (files.length + links.length > 5) throw invalid('Add at most 5 sources at a time.');
  let totalBytes = 0, images = 0;
  const inputs = files.map(source => {
    if (!source || typeof source !== 'object' || typeof source.name !== 'string' || source.name.length > 1000 || typeof source.data !== 'string') throw invalid('Each file needs a name and base64 file data.');
    const name = cleanName(source.name), extension = name.split('.').at(-1).toLowerCase();
    const mimeType = extensions[extension] || String(source.mimeType || 'application/octet-stream').slice(0, 100), image = mimeType.startsWith('image/');
    if (source.data.length > Math.ceil(3 * MiB / 3) * 4) throw invalid('Each file must be at most 3 MiB.', 413);
    if (source.data.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(source.data)) throw invalid('File data must use valid base64.');
    const bytes = Buffer.from(source.data, 'base64');
    if (bytes.toString('base64') !== source.data) throw invalid('File data must use canonical base64.');
    totalBytes += bytes.length;
    if (totalBytes > 6 * MiB) throw invalid('Files must total at most 6 MiB.', 413);
    if (image && ++images > 2) throw invalid('Add at most 2 images at a time.');
    if (image && bytes.length > MAX_IMAGE) throw invalid('Each image must be at most 512 KiB.', 413);
    return { name, extension: image && !['png', 'jpg', 'jpeg'].includes(extension) ? (mimeType === 'image/png' ? 'png' : mimeType === 'image/jpeg' ? 'jpg' : extension) : extension, mimeType, image, bytes };
  });
  for (const url of links) if (typeof url !== 'string' || !url.trim() || url.length > 2048) throw invalid('Each public link must be a nonempty address no longer than 2048 characters.');
  const result = []; let totalText = 0;
  for (const source of inputs) {
    let ref = { id: randomUUID(), name: source.name, kind: source.image ? 'image' : 'file', mimeType: source.mimeType, text: '', status: 'unavailable', note: '' };
    try {
      if (!extensions[source.extension]) throw new Error('Unsupported file format. Use PDF, DOCX, PPTX, XLSX, TXT, MD, CSV, TSV, JSON, PNG or JPEG.');
      const parsed = await parseFile(source, source.bytes, options);
      ref = { ...ref, ...parsed };
      if (source.image) ref.imageData = `data:${source.mimeType};base64,${source.bytes.toString('base64')}`;
    } catch (error) { ref = unavailable(ref, error); }
    result.push(ref);
  }
  for (const input of links) {
    const url = input.trim(); let ref = { id: randomUUID(), name: url.slice(0, 240), kind: 'link', mimeType: 'text/html', text: '', status: 'unavailable', note: '', url };
    try { ref = { ...ref, ...await readLink(url, options) }; } catch (error) { ref = unavailable(ref, error); }
    result.push(ref);
  }
  return result.map(ref => {
    if (ref.text.length > MAX_TOTAL_TEXT - totalText) ref = { ...ref, text: ref.text.slice(0, Math.max(0, MAX_TOTAL_TEXT - totalText)), status: 'excerpt', note: `${ref.note} Total reference text was truncated at the 60000-character limit.`.slice(0, 500) };
    totalText += ref.text.length;
    return referenceSchema.parse(ref);
  });
}
