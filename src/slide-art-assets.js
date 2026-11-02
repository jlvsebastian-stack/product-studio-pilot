import {createHash,randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const MAX_IMAGE=10*1024*1024;
export function nativeImagePayload(item){
  let value=item.result||{};
  for(let depth=0;depth<6;depth++){
    if(typeof value==='string'){try{value=JSON.parse(value);continue;}catch{return {text:value};}}
    if(!value||typeof value!=='object')return value;
    if(value.structuredContent!=null){value=value.structuredContent;continue;}
    if(value.structured_content!=null){value=value.structured_content;continue;}
    const text=value.content?.find(entry=>entry.type==='text'&&typeof entry.text==='string')?.text;
    if(text){try{return JSON.parse(text);}catch{return {text};}}
    return value;
  }return value;
}
export function imageDimensions(bytes,mimeType){
  if(mimeType==='image/png'&&bytes.length>=45&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){
    let offset=8,dimensions,hasData=false;
    while(offset+12<=bytes.length){const length=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8);if(length>bytes.length-offset-12)break;
      if(offset===8&&type==='IHDR'&&length===13)dimensions={width:bytes.readUInt32BE(offset+8),height:bytes.readUInt32BE(offset+12)};
      if(type==='IDAT'&&length)hasData=true;offset+=length+12;if(type==='IEND'&&length===0&&offset===bytes.length&&dimensions&&hasData)return dimensions;
    }
  }
  if(mimeType==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217){
    let offset=2;while(offset+4<bytes.length){if(bytes[offset++]!==255)break;while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===1||marker>=208&&marker<=215)continue;const length=bytes.readUInt16BE(offset);if(length<2||offset+length>bytes.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=8)return {width:bytes.readUInt16BE(offset+5),height:bytes.readUInt16BE(offset+3)};offset+=length;}
  }
  throw new Error('The connected image tool did not provide a valid PNG or JPEG image. No placeholder was substituted.');
}
export function canvaImageUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&(!url.port||url.port==='443')&&['canva.com','canvausercontent.com','canva.net'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host))?url.href:null;}catch{return null;}}
const mediaRefs=value=>{
  const result=[];const visit=node=>{if(!node||typeof node!=='object')return;if(node.type==='MEDIA'&&typeof node.id==='string')result.push(node.id);for(const [key,child]of Object.entries(node))if(key!=='_meta'&&child&&typeof child==='object')visit(child);};visit(value);return [...new Set(result)];
};
export {mediaRefs};
export function imageCandidate(records,mediaIds){
  for(const record of records.filter(record=>/get-assets$/.test(record.tool))){
    const root=record.data,items=Array.isArray(root)?root:root?.assets||root?.items||root?.result?.assets||[];
    for(const entry of items){const item=entry.result?.asset||entry.asset||entry,mediaId=item.id||entry.assetId||item.asset_id||item.media_id;if(!mediaIds.includes(mediaId))continue;
      const full=item.download_url||item.downloadUrl||item.image_url||item.image?.url||item.url;
      const url=canvaImageUrl(full)||canvaImageUrl(item.thumbnail?.url||item.thumbnail_url);
      if(url)return {url,mediaId,quality:canvaImageUrl(full)?'native':'preview',originalWidth:item.metadata?.width,originalHeight:item.metadata?.height};
    }
  }
  for(const record of records.filter(record=>/get-generate-image-job$/.test(record.tool))){
    const image=record.rawContent?.find(entry=>entry.type==='image'&&['image/png','image/jpeg'].includes(entry.mimeType)&&typeof entry.data==='string');
    if(image)return {bytes:Buffer.from(image.data,'base64'),mimeType:image.mimeType,mediaId:mediaIds[0]||'',quality:'preview'};
  }return null;
}
export async function downloadImage(candidate,{fetchFn=fetch}={}){
  if(candidate.bytes){if(candidate.bytes.length>MAX_IMAGE)throw new Error('The generated image exceeds the local 10 MB limit.');return candidate;}
  const url=canvaImageUrl(candidate.url);if(!url)throw new Error('The image tool returned no supported Canva image resource.');
  const response=await fetchFn(url,{redirect:'error',signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new Error(`The generated image could not be downloaded (${response.status}). Its existing generation was retained; no replacement was requested.`);
  const mimeType=String(response.headers.get('content-type')||'').split(';')[0].toLowerCase();
  if(!['image/png','image/jpeg'].includes(mimeType))throw new Error('The image resource is not a PNG or JPEG. Its native generation was retained.');
  if(Number(response.headers.get('content-length')||0)>MAX_IMAGE)throw new Error('The generated image exceeds the local 10 MB limit.');
  const chunks=[];let length=0;for await(const chunk of response.body){length+=chunk.length;if(length>MAX_IMAGE){await response.body.cancel?.().catch(()=>{});throw new Error('The generated image exceeds the local 10 MB limit.');}chunks.push(chunk);}
  return {...candidate,bytes:Buffer.concat(chunks),mimeType};
}
export function createSlideAssetStore(directory,{fetchFn=fetch}={}){
  const assets=join(directory,'assets');
  async function put(candidate){
    const downloaded=await downloadImage(candidate,{fetchFn}),{bytes,mimeType}=downloaded,dimensions=imageDimensions(bytes,mimeType);
    if(dimensions.width<64||dimensions.height<64||dimensions.width>8192||dimensions.height>8192||dimensions.width*dimensions.height>40e6)throw new Error('The generated image is too small to preview or exceeds the local image limit. Its original generation is retained.');
    const id=randomBytes(20).toString('hex'),sha256=createHash('sha256').update(bytes).digest('hex'),metadata={id,mimeType,...dimensions,sha256,quality:downloaded.quality==='native'&&(!downloaded.originalWidth||dimensions.width>=downloaded.originalWidth&&dimensions.height>=downloaded.originalHeight)?'native':'preview',...(downloaded.originalWidth?{originalWidth:downloaded.originalWidth,originalHeight:downloaded.originalHeight}:{}),canvaMediaId:downloaded.mediaId||'',url:`/slide-assets/${id}`};
    await mkdir(assets,{recursive:true,mode:0o700});await writeFile(join(assets,id+'.bin'),bytes,{mode:0o600});await writeFile(join(assets,id+'.json'),JSON.stringify(metadata),{mode:0o600});return metadata;
  }
  async function get(id){if(!/^[a-f0-9]{40}$/.test(id))throw Object.assign(new Error('Artwork not found.'),{statusCode:404});try{const metadata=JSON.parse(await readFile(join(assets,id+'.json'),'utf8')),bytes=await readFile(join(assets,id+'.bin'));if(createHash('sha256').update(bytes).digest('hex')!==metadata.sha256)throw Error('Artwork integrity check failed.');return {...metadata,bytes};}catch{throw Object.assign(new Error('This local artwork is missing. The app will not substitute another image.'),{statusCode:404});}}
  return {put,get};
}
