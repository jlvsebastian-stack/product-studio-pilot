import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const directory=new URL('../fonts/',import.meta.url);
await mkdir(directory,{recursive:true});
const hashes={
  'Lato-Regular.ttf':'d636e4683231f931eda222d588e944d082bfd3bdba02f928bee461c0f185b251',
  'Lato-Bold.ttf':'8a0aace75d33794eece4b28187bfc1df0bbd2888b5d8a56e01788c8d65d16be1'
};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const [name,expected] of Object.entries(hashes)){
  const path=new URL(name,directory);
  try{if(hash(await readFile(path))===expected)continue;}catch{}
  const response=await fetch(`https://raw.githubusercontent.com/google/fonts/f3b885d5590e307e02542f1a724cec55d567fdaa/ofl/lato/${name}`);
  if(!response.ok)throw new Error('Could not retrieve the licensed Lato font. Retry npm ci with internet access.');
  const bytes=Buffer.from(await response.arrayBuffer());
  if(hash(bytes)!==expected)throw new Error('Font checksum did not match the pinned source.');
  await writeFile(path,bytes);
}
