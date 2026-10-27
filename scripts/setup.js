import { readFile, writeFile, mkdir, lstat, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sourceRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function installLauncher({appRoot=sourceRoot,home=homedir(),nodePath=process.execPath}={}){
  if(Number(process.versions.node.split('.')[0])<22)throw new Error('Product Studio needs Node.js 22 or newer.');
  appRoot=resolve(appRoot);home=resolve(home);
  const pkg=JSON.parse(await readFile(join(appRoot,'package.json'),'utf8'));
  if(pkg.name!=='product-studio-local')throw new Error('Choose the Product Studio application folder.');
  await readFile(join(appRoot,'scripts','launch.js'),'utf8');
  const skill=await readFile(join(appRoot,'skills','product-studio','SKILL.md'),'utf8');
  const registryPath=join(home,'.product-studio','install.json');
  const targets=['.agents','.claude'].map(folder=>join(home,folder,'skills','product-studio','SKILL.md'));
  // Check every destination before changing any; keep unrelated/customized files.
  for(const target of [registryPath,...targets]){
    try{
      const stat=await lstat(target);if(stat.isSymbolicLink())throw new Error(`A linked file was preserved: ${target}`);
      const existing=await readFile(target,'utf8');
      if(target===registryPath){let value;try{value=JSON.parse(existing);}catch{throw new Error(`An existing file was preserved: ${target}`);}if(value.kind!=='product-studio-install')throw new Error(`An unrelated file was preserved: ${target}`);}
      else if(existing!==skill)throw new Error(`An existing or customized skill was preserved: ${target}`);
    }catch(error){if(error.code!=='ENOENT')throw error;
      if(target!==registryPath){try{if((await readdir(dirname(target))).length)throw new Error(`An existing skill folder was preserved: ${dirname(target)}`);}catch(e){if(e.code!=='ENOENT')throw e;}}
    }
  }
  await mkdir(dirname(registryPath),{recursive:true});
  await writeFile(registryPath,JSON.stringify({kind:'product-studio-install',version:1,appRoot,nodePath:resolve(nodePath)},null,2)+'\n',{mode:0o600});
  for(const target of targets){await mkdir(dirname(target),{recursive:true});await writeFile(target,skill);}
  return {appRoot,registryPath,skills:targets};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2);let home;
  if(args.length){if(args.length!==2||args[0]!=='--home'){console.error('Usage: node scripts/setup.js [--home PATH]');process.exitCode=1;}else home=args[1];}
  if(!process.exitCode)installLauncher({home}).then(()=>console.log('Product Studio is installed. Ask your local AI: Launch Product Studio. New skills may require a new chat.')).catch(error=>{console.error(error.message);process.exitCode=1;});
}
