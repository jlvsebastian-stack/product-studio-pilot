import { parentPort, workerData } from 'node:worker_threads';
import JSZip from 'jszip';
import { validateReferenceImage } from './references.js';

const MAX_TEXT = 16000, MAX_XML = 2 * 1024 * 1024, MAX_ZIP = 16 * 1024 * 1024;
const bytes = Buffer.from(workerData.bytes), extension = workerData.extension;
function decode(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
    if (entity[0] === '#') { const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)); return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : ''; }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[entity.toLowerCase()];
  });
}
function utf8(buffer) {
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); } catch { throw new Error('This file is not readable UTF-8 text.'); }
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new Error('This file contains binary data instead of readable text.');
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}
function xmlText(xml, prefix) {
  return decode(xml.replace(new RegExp(`<${prefix}:tab\\b[^>]*/>`, 'g'), '\t').replace(new RegExp(`<${prefix}:br\\b[^>]*/>`, 'g'), '\n').replace(new RegExp(`</${prefix}:p\\s*>`, 'g'), '\n').replace(new RegExp(`</${prefix}:tc\\s*>`, 'g'), '\t').replace(new RegExp(`<(?!/?${prefix}:t(?:\\s|>))[^>]*>`, 'g'), '').replace(new RegExp(`</?${prefix}:t(?:\\s[^>]*)?>`, 'g'), '')).replace(/\n{3,}/g, '\n\n').trim();
}
function attrs(tag) { return Object.fromEntries([...tag.matchAll(/([\w:.-]+)\s*=\s*(["'])(.*?)\2/g)].map(match => [match[1], decode(match[3])])); }
function spreadsheetPosition(reference, row, nextColumn) {
  let column = nextColumn, label = '';
  if (reference) {
    const coordinate = /^([A-Z]{1,3})([1-9]\d{0,6})$/i.exec(reference);
    if (!coordinate || Number(coordinate[2]) !== row) throw new Error('This spreadsheet has an invalid or mismatched cell coordinate.');
    label = coordinate[1].toUpperCase(); column = 0;
    for (const character of label) column = column * 26 + character.charCodeAt(0) - 64;
  }
  if (!Number.isInteger(column) || column < 1 || column > 16384) throw new Error('This spreadsheet exceeds the safe XLSX column coordinate limit.');
  if (!label) for (let n = column; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + (n - 1) % 26) + label;
  return { column, label: `${label}${row}` };
}
async function loadOffice() {
  if (bytes.readUInt32LE(0) !== 0x04034b50) throw new Error('This Office file is not a readable ZIP document.');
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: false, createFolders: false });
  const entries = Object.values(zip.files);
  if (entries.length > 1000) throw new Error('This archive exceeds the safe ZIP entry limit.');
  let expanded = 0;
  for (const entry of entries) {
    const size = entry._data?.uncompressedSize;
    if (!entry.dir && (!Number.isSafeInteger(size) || size < 0)) throw new Error('This ZIP archive has invalid expanded sizes.');
    expanded += size || 0;
    if (expanded > MAX_ZIP) throw new Error('This archive exceeds the 16 MiB expanded ZIP limit.');
    if (/\.xml$/i.test(entry.name) && size > MAX_XML) throw new Error('This archive has XML exceeding the 2 MiB decompression limit.');
  }
  let readBytes = 0;
  const read = async path => {
    const entry = zip.file(path); if (!entry) return '';
    const buffer = await new Promise((resolve, reject) => {
      const chunks = []; let length = 0; const stream = entry.internalStream('nodebuffer');
      stream.on('data', chunk => {
        length += chunk.length; readBytes += chunk.length;
        if (length > MAX_XML || readBytes > MAX_ZIP) { stream.pause(); reject(new Error('This archive exceeded the safe decompression limit.')); return; }
        chunks.push(chunk);
      });
      stream.on('error', reject); stream.on('end', () => resolve(Buffer.concat(chunks))); stream.resume();
    });
    const xml = utf8(buffer);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('XML document types and entities are not supported.');
    return xml;
  };
  return { zip, read };
}
function image() {
  const { width, height } = validateReferenceImage(bytes, extension === 'png' ? 'image/png' : 'image/jpeg');
  return { text: '', status: 'ready', note: `Actual ${width}×${height} image attached for the selected model. No text recognition was performed.` };
}
async function extract() {
  if (['png', 'jpg', 'jpeg'].includes(extension)) return image();
  let text = '', note = '', clipped = false;
  if (['txt', 'md', 'csv', 'tsv', 'json', 'html'].includes(extension)) {
    text = utf8(bytes).trim(); note = 'Actual UTF-8 source text. Content is untrusted reference data.';
    if (extension === 'html') text = decode(text.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|noscript|template|svg|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<(?:br|\/p|\/div|\/h[1-6]|\/li|\/tr|\/section)\b[^>]*>/gi, '\n').replace(/<[^>]*>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  else if (extension === 'pdf') {
    if (!bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error('This file is not a readable PDF.');
    const { getDocumentProxy } = await import('unpdf');
    let doc;
    try {
      doc = await getDocumentProxy(new Uint8Array(bytes), { isEvalSupported: false, maxImageSize: 16777216, disableFontFace: true, useSystemFonts: false, disableAutoFetch: true, disableStream: true, verbosity: 0 });
      if (doc.numPages > 100) throw new Error('This PDF exceeds the 100 pages safe page limit.');
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n), content = await page.getTextContent();
        text += content.items.filter(item => typeof item.str === 'string').map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('') + '\n'; page.cleanup();
        if (text.length > MAX_TEXT) { clipped = true; break; }
      }
      if (!text.trim()) throw new Error('This PDF has no readable text; it may be scanned. OCR was not performed.');
      note = 'Extracted PDF page text; layout, handwriting and images were not read.';
    } catch (error) {
      if (/page limit|no readable text/.test(error.message)) throw error;
      throw new Error('This PDF could not be read; it may be corrupt, encrypted or unsupported.');
    } finally { await doc?.loadingTask.destroy(); }
  } else {
    const { zip, read } = await loadOffice();
    if (extension === 'docx') { const xml = await read('word/document.xml'); if (!xml) throw new Error('This DOCX has no readable document body.'); text = xmlText(xml, 'w'); note = 'Extracted Word body text. Images, comments and macros were not read or executed.'; }
    if (extension === 'pptx') {
      const slides = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/slide(\d+)/)[1]) - Number(b.match(/slide(\d+)/)[1]));
      if (slides.length > 100) throw new Error('This PowerPoint exceeds the 100-slide limit.');
      let content = false;
      for (const [index, path] of slides.entries()) { const slideText = xmlText(await read(path), 'a'); content ||= !!slideText; text += `[Slide ${index + 1}]\n${slideText}\n\n`; if (text.length > MAX_TEXT) { clipped = true; break; } }
      if (!content) text = '';
      note = 'Extracted slide text in file order. Speaker notes, images, charts and macros were not read or executed.';
    }
    if (extension === 'xlsx') {
      const sharedXml = await read('xl/sharedStrings.xml');
      const shared = [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(match => decode([...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(value => value[1]).join('')));
      const workbook = await read('xl/workbook.xml'), relationships = await read('xl/_rels/workbook.xml.rels');
      const targets = Object.fromEntries([...relationships.matchAll(/<Relationship\b[^>]*\/?\s*>/g)].map(match => { const a = attrs(match[0]); return [a.Id, a.Target]; }));
      let sheets = [...workbook.matchAll(/<sheet\b[^>]*\/?\s*>/g)].map(match => { const a = attrs(match[0]), target = targets[a['r:id']]; return { name: a.name || 'Worksheet', path: target?.startsWith('/') ? target.slice(1) : target ? `xl/${target.replace(/^\.\//, '')}` : '' }; });
      if (!sheets.length) sheets = Object.keys(zip.files).filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort().map(path => ({ name: path.split('/').at(-1), path }));
      if (sheets.length > 25) throw new Error('This spreadsheet exceeds the 25-sheet limit.');
      let cells = 0, content = false;
      for (const sheet of sheets) {
        if (!/^xl\/worksheets\/[^/]+\.xml$/.test(sheet.path)) continue;
        const xml = await read(sheet.path); text += `[Sheet: ${sheet.name}]\n`;
        let nextRow = 1;
        for (const row of xml.matchAll(/<row\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/row\s*>)/g)) {
          const rowNumber = Number(attrs(row[1]).r || nextRow);
          if (!Number.isInteger(rowNumber) || rowNumber < 1 || rowNumber > 1048576) throw new Error('This spreadsheet has an invalid row coordinate.');
          nextRow = rowNumber + 1;
          const values = [], columns = new Set(); let nextColumn = 1;
          for (const cell of (row[2] || '').matchAll(/<c\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/c\s*>)/g)) {
            if (++cells > 100000) throw new Error('This spreadsheet exceeds the safe cell limit.');
            const a = attrs(cell[1]), body = cell[2] || '', value = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1];
            const position = spreadsheetPosition(a.r, rowNumber, nextColumn); nextColumn = position.column + 1;
            if (columns.has(position.column)) throw new Error('This spreadsheet has duplicate cell coordinates.');
            columns.add(position.column);
            let text = '';
            if (a.t === 's') text = shared[Number(value)] || '';
            else if (a.t === 'inlineStr') text = decode([...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(match => match[1]).join(''));
            else if (value !== undefined) text = decode(value);
            else if (/<f\b/.test(body)) text = '[formula has no cached value]';
            values.push({ ...position, text });
          }
          content ||= values.some(value => !!value.text.trim());
          if (values.length) text += values.sort((a, b) => a.column - b.column).map(value => `${value.label}=${JSON.stringify(value.text)}`).join('\t') + '\n'; if (text.length > MAX_TEXT) { clipped = true; break; }
        }
        if (clipped) break;
      }
      if (!content) text = '';
      note = 'Spreadsheet text and stored or cached cell values only. Cells are labeled with worksheet coordinates; omitted cells are blank. Formulas were not recalculated, and macros or external links were not executed.';
    }
  }
  text = text.trim(); if (!text) throw new Error('This file has no readable text. Images and scanned content were not read.');
  clipped ||= text.length > MAX_TEXT;
  return { text: text.slice(0, MAX_TEXT), status: clipped ? 'excerpt' : 'ready', note: clipped ? `${note} Text excerpt truncated at the 16000-character source limit.` : note };
}
try { parentPort.postMessage(await extract()); } catch (error) { parentPort.postMessage({ error: String(error.message || 'This file could not be read.').slice(0, 500) }); }
