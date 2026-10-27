// Local protocol harness only. This file is not a ChatGPT host test.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { handleMcp } from '../src/http.js';
import { exampleProject } from './fixture.js';
const port=8789;process.env.STUDIO_INVITE_TOKEN=randomBytes(32).toString('hex');
const client=new Client({name:'local-panel-harness',version:'1'});
const html=`<!doctype html><html><meta charset="utf-8"><title>Product Studio · Local host harness</title><style>body{margin:0;font:14px system-ui;background:#e9e8df}header{padding:12px 25px;display:flex;gap:18px;align-items:center}iframe{border:0;width:100%;height:1100px;background:#f7f5ef}button{padding:8px}#hostStatus{font-size:12px}</style><header><strong>Local host harness · not ChatGPT</strong><button id="sample">Load illustrative sample</button><span id="hostStatus"></span></header><iframe id="app" src="/studio" sandbox="allow-scripts allow-same-origin"></iframe><script>
const app=document.getElementById('app'),status=document.getElementById('hostStatus');
function send(data){app.contentWindow.postMessage({jsonrpc:'2.0',...data},location.origin);}
window.addEventListener('message',async event=>{
 if(event.source!==app.contentWindow)return;const m=event.data;if(!m||m.jsonrpc!=='2.0')return;
 try{let result={};
 if(m.method==='ui/initialize')result={protocolVersion:'2026-01-26',hostInfo:{name:'Local harness',version:'1'},hostCapabilities:{downloadFile:{},updateModelContext:{},message:{text:{}}},hostContext:{theme:'light'}};
 else if(m.method==='ui/notifications/initialized'){const output=await (await fetch('/start')).json();send({method:'ui/notifications/tool-result',params:output});return;}
 else if(m.method==='tools/call')result=await (await fetch('/call',{method:'POST',body:JSON.stringify(m.params),headers:{'content-type':'application/json'}})).json();
 else if(m.method==='ui/message'){status.textContent='User message sent: '+m.params.content[0].text;}
 else if(m.method==='ui/update-model-context'){status.textContent='Edited project shared with host';}
 else if(m.method==='ui/download-file'){result=await (await fetch('/download',{method:'POST',body:JSON.stringify(m.params),headers:{'content-type':'application/json'}})).json();status.textContent='Downloaded: '+result.name;}
 else if(m.method!=='ui/notifications/size-changed')throw new Error('Unsupported harness method');
 if(m.id)send({id:m.id,result});
 }catch(e){if(m.id)send({id:m.id,error:{code:-32603,message:e.message}});}
});
document.getElementById('sample').onclick=async()=>send({method:'ui/notifications/tool-result',params:await(await fetch('/sample')).json()});
</script></html>`;
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/mcp/'))return handleMcp(req,res);
 res.setHeader('Cache-Control','no-store');
 if(req.headers.origin&&req.headers.origin!==`http://127.0.0.1:${port}`){res.writeHead(403).end();return;}
 if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'}).end(html);return;}
 if(url.pathname==='/studio'){res.writeHead(200,{'Content-Type':'text/html'}).end(readFileSync(new URL('../public/studio.html',import.meta.url)));return;}
 res.setHeader('Content-Type','application/json');
 if(url.pathname==='/start'){res.end(JSON.stringify(await client.callTool({name:'open_product_studio',arguments:{}})));return;}
 if(url.pathname==='/sample'){res.end(JSON.stringify(await client.callTool({name:'update_product_studio',arguments:{project:exampleProject()}})));return;}
 if(req.method==='POST'&&['/call','/download'].includes(url.pathname)){
   try{let body='';for await(const c of req){body+=c;if(body.length>4000000)throw new Error('Too large');}const value=JSON.parse(body);
   if(url.pathname==='/call'){await new Promise(r=>setTimeout(r,1000));res.end(JSON.stringify(await client.callTool(value)));return;}
   const resource=value.contents[0].resource,name=decodeURIComponent(resource.uri.split('/').pop());
   if(!/^[a-zA-Z0-9._-]+$/.test(name))throw new Error('Invalid file name');
   mkdirSync('test-artifacts',{recursive:true});writeFileSync('test-artifacts/host-'+name,Buffer.from(resource.blob,'base64'));res.end(JSON.stringify({name}));return;
   }catch{res.writeHead(400).end('{}');return;}
 }
 res.writeHead(404).end('{}');
});
await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp/${process.env.STUDIO_INVITE_TOKEN}`)));
console.log(`Local MCP panel harness: http://127.0.0.1:${port}`);
