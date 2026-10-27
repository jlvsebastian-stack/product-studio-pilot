import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { PDFDocument } from 'pdf-lib';
import { handleMcp } from '../src/http.js';
import { plain, exportProduct } from '../src/exports.js';
import { freshProject } from '../src/product.js';
import { exampleProject } from './fixture.js';

let http,base,endpoint,client;
before(async()=>{
  process.env.STUDIO_INVITE_TOKEN=randomBytes(32).toString('hex');
  http=createServer(handleMcp);await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${http.address().port}`;endpoint=base+'/mcp/'+process.env.STUDIO_INVITE_TOKEN;
  client=new Client({name:'studio-test',version:'1'});
  await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
});
after(async()=>{await client.close();await new Promise(resolve=>http.close(resolve));});

test('invite is required, foreign origins are denied, missing configuration fails closed',async()=>{
  assert.equal((await fetch(base+'/mcp/not-an-invite')).status,404);
  assert.equal((await fetch(endpoint,{headers:{Origin:'https://untrusted.example'}})).status,403);
  const token=process.env.STUDIO_INVITE_TOKEN;delete process.env.STUDIO_INVITE_TOKEN;
  assert.equal((await fetch(endpoint)).status,404);process.env.STUDIO_INVITE_TOKEN=token;
});
test('request size and invalid JSON fail before MCP processing',async()=>{
  assert.equal((await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(300001)})).status,413);
  assert.equal((await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:'{broken'})).status,400);
});
test('real HTTP MCP discovery includes the panel and export tool metadata',async()=>{
  const {tools}=await client.listTools();assert.equal(tools.length,3);
  assert.ok(tools.every(t=>t._meta.ui.resourceUri==='ui://product-studio/panel-v1.html'));
  assert.deepEqual(tools.find(t=>t.name==='export_product')._meta.ui.visibility,['app']);
  const resource=await client.readResource({uri:'ui://product-studio/panel-v1.html'});
  assert.equal(resource.contents[0].mimeType,'text/html;profile=mcp-app');
  assert.match(resource.contents[0].text,/ui\/download-file/);
});
test('start returns the actual twelve-stage skills; a separate start is empty',async()=>{
  const first=await client.callTool({name:'open_product_studio',arguments:{}});
  assert.equal(first.structuredContent.project.stage,1);assert.equal(first.structuredContent.project.stageReady,false);
  assert.match(first.content[0].text,/Ask one focused question/);assert.match(first.content[0].text,/12\. \*\*Download/);
  const p=exampleProject();await client.callTool({name:'update_product_studio',arguments:{project:p}});
  const separate=await client.callTool({name:'open_product_studio',arguments:{}});
  assert.equal(separate.structuredContent.project.brief.productDraft,'');
});
test('stage, review confirmation and outline-only exports are rejected meaningfully',async()=>{
  const invalid=exampleProject();invalid.stage=13;
  const result=await client.callTool({name:'update_product_studio',arguments:{project:invalid}});assert.equal(result.isError,true);
  const unreviewed=await client.callTool({name:'export_product',arguments:{project:exampleProject(),reviewed:false}});assert.equal(unreviewed.isError,true);
  const outline=await client.callTool({name:'export_product',arguments:{project:freshProject(),reviewed:true}});assert.equal(outline.isError,true);assert.match(outline.content[0].text,/outline/);
});
test('real exports contain native PDF, Word, PowerPoint, manuscript and checkpoint bytes',async()=>{
  const p=exampleProject();const result=await client.callTool({name:'export_product',arguments:{project:p,reviewed:true}});
  assert.ok(!result.isError);const files=result._meta.files;assert.equal(files.length,5);
  const pdf=Buffer.from(files[0].blob,'base64');assert.equal(pdf.subarray(0,4).toString(),'%PDF');
  const document=await PDFDocument.load(pdf);assert.ok(document.getPageCount()>=2);
  for(const f of files.slice(1,3))assert.equal(Buffer.from(f.blob,'base64').subarray(0,2).toString(),'PK');
  assert.equal(Buffer.from(files[3].blob,'base64').toString(),p.brief.productDraft.trim());
  assert.deepEqual(JSON.parse(Buffer.from(files[4].blob,'base64').toString()).project,p);
  await mkdir('test-artifacts',{recursive:true});
  for(const f of files)await writeFile('test-artifacts/'+f.name,Buffer.from(f.blob,'base64'));
  await writeFile('test-artifacts/mcp-result.json',JSON.stringify({pages:result.structuredContent.pages,files:files.map(({name,mimeType,blob})=>({name,mimeType,bytes:Buffer.from(blob,'base64').length}))},null,2));
});
test('literal underscores and writing lines survive formatting; unsupported symbols fail explicitly',async()=>{
  assert.equal(plain('**Useful** client_name ________________________'),'Useful client_name ________________________');
  const p=exampleProject();p.brief.productDraft+='\nUnsupported: 🦄';
  await assert.rejects(exportProduct(p),/pilot font cannot render/);
});
