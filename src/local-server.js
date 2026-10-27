import { createServer, get } from 'node:http';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createProviderManager, providerId } from './providers.js';
import { interview } from './interview.js';
import { exportProduct, previewProduct } from './exports.js';
import { modelCatalog } from './models.js';
import { prepareReferences } from './references.js';
import JSZip from 'jszip';

const MAX_BODY=4000000,MAX_REFERENCE_BODY=9*1024*1024;
const defaultPublic=new URL('../public/',import.meta.url);
export function createLocalHandler({providers=createProviderManager(),publicDirectory=defaultPublic,exporter=exportProduct,previewer=previewProduct,referencePreparer=prepareReferences,now=Date.now}={}){
  const packages=new Map();
  const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify(value));};
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self' data:; base-uri 'none'; object-src 'none'; frame-ancestors 'none'");
    const port=req.socket.localPort,hosts=[`127.0.0.1:${port}`,`localhost:${port}`];
    if(!hosts.includes((req.headers.host||'').toLowerCase()))return json(res,403,{error:'This app accepts local connections only.'});
    let url;try{url=new URL(req.url,`http://${req.headers.host}`);}catch{return json(res,400,{error:'Invalid address.'});}
    const maxBody=url.pathname==='/api/references'?MAX_REFERENCE_BODY:MAX_BODY;
    if(req.method==='GET'){
      if(url.pathname==='/api/health')return json(res,200,{app:'product-studio-local',version:'0.3.10'});
      if(url.pathname==='/api/models')return json(res,200,modelCatalog);
      if(url.pathname==='/api/status'){
        try{return json(res,200,await providers.status(providerId(url.searchParams.get('provider')||'chatgpt')));}catch(error){return json(res,400,{error:error.message});}
      }
      const staticFiles={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/studio-store.js':'studio-store.js','/composer.js':'composer.js','/model-access.js':'model-access.js','/example-project.json':'example-project.json'};
      if(Object.hasOwn(staticFiles,url.pathname)){
        const file=staticFiles[url.pathname];
        try{const bytes=await readFile(new URL(file,publicDirectory));res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.json')?'application/json; charset=utf-8':'text/html; charset=utf-8'}).end(bytes);}
        catch{json(res,500,{error:'The application files are missing. Download the complete package and run the launcher again.'});}return;
      }
      if(url.pathname.startsWith('/downloads/')){
        const parts=url.pathname.split('/');let name;
        try{name=decodeURIComponent(parts[3]||'');}catch{return json(res,404,{error:'File not found.'});}
        const pack=packages.get(parts[2]),file=pack?.files.get(name);
        if(parts.length!==4||!pack||pack.expires<now()||!file)return json(res,404,{error:'This download expired. Create the package again.'});
        res.writeHead(200,{'Content-Type':file.mimeType,'Content-Length':file.bytes.length,'Content-Disposition':`attachment; filename="${file.name}"`}).end(file.bytes);return;
      }
      return json(res,404,{error:'Not found.'});
    }
    if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
    if(!hosts.map(host=>`http://${host}`).includes(req.headers.origin))return json(res,403,{error:'Open Product Studio from its own local address.'});
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(res,415,{error:'Use a JSON request.'});
    if(Number(req.headers['content-length']||0)>maxBody)return json(res,413,{error:'This request is too large. Use fewer or smaller reference files, or save a project backup.'});
    let body;
    try{
      let chunks=[],size=0;
      for await(const chunk of req){size+=chunk.length;if(size>maxBody)return json(res,413,{error:'This request is too large. Use fewer or smaller reference files, or save a project backup.'});chunks.push(chunk);}
      body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(!body||typeof body!=='object'||Array.isArray(body))return json(res,400,{error:'This request needs a project object.'});
    }catch{return json(res,400,{error:'This request could not be read. Your project is unchanged.'});}
    try{
      if(url.pathname==='/api/login')return json(res,200,await providers.login(providerId(body.provider||'chatgpt')));
      if(url.pathname==='/api/check-model'){
        try{return json(res,200,await providers.checkModel(body.provider,{model:body.model,reasoningEffort:body.reasoningEffort}));}
        catch(error){return json(res,error.statusCode===409?409:400,{available:false,...(error.statusCode===409?{}:{retryable:true}),message:error.message||'The selected model could not be checked. Try again.'});}
      }
      if(url.pathname==='/api/references')return json(res,200,{references:await referencePreparer(body)});
      if(url.pathname==='/api/interview')return json(res,200,await interview(body,providers));
      if(url.pathname==='/api/preview-product')return json(res,200,await previewer({stage:12,stageReady:false,summary:'Current product preview.',brief:body.brief},{coverImage:body.coverImage}));
      if(url.pathname==='/api/export-product'){
        const draft=body.draft===true;
        if(!draft&&body.reviewed!==true)throw new Error('Review the current content and confirm it before exporting.');
        const result=await exporter({stage:draft?9:12,stageReady:!draft,summary:draft?'Draft sample for external review.':'Creator-reviewed local export.',brief:body.brief},{coverImage:body.coverImage,draft});
        const zip=new JSZip(),files=new Map();
        const publicFiles=result.files.filter(file=>(file.mimeType==='application/pdf'&&/\.pdf$/i.test(file.name))||(file.mimeType==='text/markdown'&&/\.md$/i.test(file.name)));
        const pdf=publicFiles.find(file=>file.mimeType==='application/pdf'),markdown=publicFiles.find(file=>file.mimeType==='text/markdown'&&file.name===pdf?.name.replace(/\.pdf$/i,'.md'))||publicFiles.find(file=>file.mimeType==='text/markdown');
        if(!pdf||!markdown)throw new Error('The export is missing its PDF or Markdown source. Your project is unchanged.');
        for(const f of publicFiles){const bytes=Buffer.from(f.blob,'base64');files.set(f.name,{name:f.name,mimeType:f.mimeType,bytes});zip.file(f.name,bytes);}
        zip.file('READ-ME.txt','PDF: designed audience-facing product pages. Markdown: complete editable source, including presenter notes when present. Native Canva presentations and Google Docs links are provided separately only after their cloud files have been created and verified. Save project in the app to back up the full interview. Private project checkpoints and personal preferences are not part of these product files.\n');
        const archiveName=pdf.name.replace(/\.pdf$/i,'-complete.zip');
        files.set(archiveName,{name:archiveName,mimeType:'application/zip',bytes:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});
        const id=randomBytes(24).toString('hex');
        for(const [key,value]of packages)if(value.expires<now())packages.delete(key);
        while(packages.size>=3)packages.delete(packages.keys().next().value);
        packages.set(id,{expires:now()+3600000,files});
        const link=f=>({name:f.name,url:`/downloads/${id}/${encodeURIComponent(f.name)}`});
        return json(res,200,{draft,pages:result.pages,files:{pdf:link(pdf),markdown:link(markdown),zip:link({name:archiveName})}});
      }
      return json(res,404,{error:'Not found.'});
    }catch(error){
      const message=error?.name==='ZodError'?'The project or AI reply has invalid fields. Your saved conversation is unchanged; check it and retry.':error.message||'The request could not finish. Your project is unchanged.';
      return json(res,error.statusCode===413?413:400,{error:message});
    }
  };
}

export function openLocalBrowser(url){
  const command=process.platform==='win32'?['rundll32.exe',['url.dll,FileProtocolHandler',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];
  return new Promise((resolve,reject)=>execFile(command[0],command[1],{windowsHide:true},error=>error?reject(error):resolve()));
}
async function isStudio(url){
  // A fresh connection avoids a browser/runtime keep-alive pool mistaking a reused port for an old app.
  return new Promise(resolve=>{
    const req=get(url+'/api/health',{agent:false,timeout:700},res=>{
      if(res.statusCode!==200){res.resume();resolve(false);return;}
      let text='';res.setEncoding('utf8');
      res.on('data',chunk=>{text+=chunk;if(text.length>2048){res.destroy();resolve(false);}});
      res.on('end',()=>{try{resolve(JSON.parse(text).app==='product-studio-local');}catch{resolve(false);}});
      res.on('error',()=>resolve(false));
    });
    req.on('timeout',()=>{req.destroy();resolve(false);});req.on('error',()=>resolve(false));
  });
}
export async function startLocalServer({port=Number(process.env.STUDIO_PORT||8767),openBrowser=process.env.STUDIO_OPEN_BROWSER==='1',...options}={}){
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Choose a valid local port.');
  for(let attempt=0;attempt<10;attempt++){
    const candidate=port===0?0:port+attempt;
    if(candidate>65535)break;
    const server=createServer(createLocalHandler(options));
    try{
      await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(candidate,'127.0.0.1',resolve);});
      const url=`http://127.0.0.1:${server.address().port}`;
      if(openBrowser)await openLocalBrowser(url).catch(()=>{});
      return {server,url,reused:false,close:()=>new Promise(resolve=>server.close(resolve))};
    }catch(error){
      if(error.code!=='EADDRINUSE')throw error;
      const url=`http://127.0.0.1:${candidate}`;
      if(await isStudio(url)){if(openBrowser)await openLocalBrowser(url).catch(()=>{});return {server:null,url,reused:true,close:async()=>{}};}
    }
  }
  throw new Error('Product Studio could not find a free local port. Close an older copy and try again.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  startLocalServer().then(({url,reused})=>{process.send?.({type:'product-studio-ready',url,reused});console.log(`Product Studio ${reused?'is already running':'is ready'}: ${url}`);}).catch(error=>{console.error(error.message);process.exitCode=1;});
}
