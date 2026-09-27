import { stripTypeScriptTypes } from 'node:module';
import { readdir, readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
const root=process.cwd();const out=join(root,'dist');await rm(out,{recursive:true,force:true});
let count=0;
async function walk(dir:string){for(const entry of await readdir(join(root,dir),{withFileTypes:true})){const source=join(dir,entry.name);if(entry.isSymbolicLink())throw new Error('Unexpected symlink: '+source);if(entry.isDirectory()){await walk(source);continue;}
 const target=join(out,source.replace(/\.ts$/,'.js'));await mkdir(join(target,'..'),{recursive:true});
 if(source.endsWith('.ts')){const raw=await readFile(join(root,source),'utf8');const js=stripTypeScriptTypes(raw,{mode:'strip'}).replace(/(from\s+['"]\.[^'"]+)\.ts(['"])/g,'$1.js$2').replace(/(import\(['"]\.[^'"]+)\.ts(['"]\))/g,'$1.js$2');await writeFile(target,js);}else await copyFile(join(root,source),target);count++;}}
await walk('apps');await walk('packages');await writeFile(join(out,'package.json'),JSON.stringify({type:'module',private:true}));console.log(JSON.stringify({build:'PASS',files:count,output:relative(root,out),typecheck:'run separately',external_integrations:'NOT_TESTED'}));
