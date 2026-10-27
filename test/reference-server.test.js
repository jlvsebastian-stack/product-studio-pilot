import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createLocalHandler } from '../src/local-server.js';
async function server(t,options={}){
  const app=createServer(createLocalHandler(options));await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{app.closeAllConnections();app.close(resolve);}));return `http://127.0.0.1:${app.address().port}`;
}
const post=(url,path,body,origin=url)=>fetch(url+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('reference ingestion uses the submitted sources and retains local-origin protection',async t=>{
  let input,calls=0;const referencePreparer=async raw=>{input=raw;calls++;return [{id:'ref-1',name:'notes.txt',kind:'file',mimeType:'text/plain',text:'Creator-selected source',status:'ready',note:''}];};
  const url=await server(t,{referencePreparer});const payload={files:[{name:'notes.txt',mimeType:'text/plain',data:'dGVzdA=='}],links:[]};
  const response=await post(url,'/api/references',payload);assert.equal(response.status,200);assert.equal((await response.json()).references[0].text,'Creator-selected source');assert.deepEqual(input,payload);
  assert.equal((await post(url,'/api/references',payload,'https://elsewhere.example')).status,403);assert.equal(calls,1);
});
test('reference ingestion has a bounded larger body allowance without expanding ordinary requests',async t=>{
  const url=await server(t,{referencePreparer:async()=>[]});const body={files:[{name:'large.txt',mimeType:'text/plain',data:'a'.repeat(4100000)}]};
  assert.equal((await post(url,'/api/references',body)).status,200);
  assert.equal((await post(url,'/api/interview',body)).status,413);
  assert.equal((await post(url,'/api/references',{huge:'x'.repeat(9*1024*1024)})).status,413);
});
test('reference size validation reports a truthful recoverable error',async t=>{
  const url=await server(t,{referencePreparer:async()=>{throw Object.assign(new Error('Choose a file smaller than 3 MB.'),{statusCode:413});}});
  const response=await post(url,'/api/references',{files:[]});assert.equal(response.status,413);assert.match((await response.json()).error,/smaller than 3 MB/);
});
