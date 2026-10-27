import { timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createStudioServer } from './mcp.js';

const MAX_BODY = 300000;
function equalToken(a,b) {
  const aa=Buffer.from(a), bb=Buffer.from(b);
  return aa.length===bb.length && timingSafeEqual(aa,bb);
}
export async function handleMcp(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  const url=new URL(req.url,'http://studio.invalid');
  let supplied='';
  try {supplied=url.pathname.startsWith('/mcp/') ? decodeURIComponent(url.pathname.slice(5)) : String(req.query?.invite || url.searchParams.get('invite') || '');}
  catch {res.writeHead(404).end('Not found');return;}
  const expected=process.env.STUDIO_INVITE_TOKEN || '';
  if(expected.length<32 || !equalToken(supplied,expected)) {
    res.writeHead(404,{'Content-Type':'application/json'}).end('{"error":"Not found"}');return;
  }
  const origin=req.headers.origin;
  if(origin && !['https://chatgpt.com','https://chat.openai.com','https://claude.ai'].includes(origin)) {
    res.writeHead(403).end('Origin not allowed');return;
  }
  if(origin) res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');
  if(req.method==='OPTIONS') {
    res.writeHead(204,{'Access-Control-Allow-Methods':'POST,GET,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Accept,MCP-Protocol-Version,Mcp-Session-Id'}).end();return;
  }
  if(!['POST','GET','DELETE'].includes(req.method)) {res.writeHead(405).end();return;}
  if(Number(req.headers['content-length']||0)>MAX_BODY) {res.writeHead(413).end('Project is too large');return;}
  let body=req.body;
  if(req.method==='POST') {
    if(!String(req.headers['content-type']).startsWith('application/json')) {res.writeHead(415).end('Use application/json');return;}
    try {
      if(body===undefined) {
        let chunks=[],size=0;
        for await(const chunk of req) {
          size+=chunk.length;
          if(size>MAX_BODY) {res.writeHead(413).end('Project is too large');return;}
          chunks.push(chunk);
        }
        body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } else if(typeof body==='string') body=JSON.parse(body);
      if(Buffer.byteLength(JSON.stringify(body))>MAX_BODY) {res.writeHead(413).end('Project is too large');return;}
    } catch {res.writeHead(400).end('Invalid JSON');return;}
  }
  const server=createStudioServer();
  const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  res.on('close',()=>{transport.close().catch(()=>{});server.close().catch(()=>{});});
  try {
    await server.connect(transport);
    await transport.handleRequest(req,res,body);
  } catch {
    // Deliberately do not log payloads, invite links, or manuscripts.
    if(!res.headersSent) res.writeHead(500).end('Product Studio request failed. Please try again.');
  }
}
