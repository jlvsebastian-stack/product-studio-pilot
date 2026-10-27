import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { handleMcp } from './http.js';
const port=Number(process.env.PORT||8788);
createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path.startsWith('/mcp/')) return handleMcp(req,res);
  if(path==='/preview') {res.writeHead(200,{'Content-Type':'text/html'}).end(readFileSync(new URL('../public/studio.html',import.meta.url)));return;}
  if(path==='/') {res.writeHead(200,{'Content-Type':'text/html'}).end(readFileSync(new URL('../public/index.html',import.meta.url)));return;}
  res.writeHead(404).end('Not found');
}).listen(port,'127.0.0.1',()=>console.log(`Product Studio MCP on http://127.0.0.1:${port}; invite endpoint is configured privately.`));
