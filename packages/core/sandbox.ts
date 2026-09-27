import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError, invariant } from './errors.ts';
import { redact, sha256 } from './security.ts';
import { validateFiles } from './packaging.ts';
import type { ProjectFiles } from './packaging.ts';
import type { Env } from './config.ts';
import type { BuildPlan } from './research.ts';
import type { EvidenceReport } from './states.ts';
import { validateDependencyManifest } from './dependencies.ts';
import { unavailable } from './states.ts';
const exec=promisify(execFile);
export interface SandboxProvider { inspect():Promise<unknown>; resolveDependencies(files:ProjectFiles,plan:BuildPlan):Promise<ProjectFiles>; validate(files:ProjectFiles,plan:BuildPlan):Promise<EvidenceReport[]> }
export class UnavailableSandbox implements SandboxProvider {
  async inspect():Promise<unknown>{throw new AppError('SANDBOX_NOT_AVAILABLE','Sandbox isolée non configurée.',503);}
  async resolveDependencies():Promise<ProjectFiles>{throw new AppError('SANDBOX_NOT_AVAILABLE','Résolution isolée indisponible.',503);}
  async validate():Promise<EvidenceReport[]>{return ['sandbox','recursive','br360'].map(t=>unavailable(t,'Sandbox isolée non configurée.'));}
}
/** Docker executes only on an isolated worker, never in the web server. No docker socket in generated containers. */
export class LocalDockerSandbox implements SandboxProvider {
  env:Env;constructor(env:Env){this.env=env;}
  async inspect():Promise<any>{
    invariant(this.env.SANDBOX_PROVIDER==='docker','SANDBOX_NOT_AVAILABLE','Fournisseur de sandbox non configuré.',503);
    invariant(this.env.NODE_ENV!=='production'||this.env.ISOLATED_WORKER_ACK==='true','WORKER_NOT_ISOLATED','Un worker isolé doit être configuré.',503);
    invariant(/^[A-Za-z0-9_./:-]+@sha256:[a-f0-9]{64}$/.test(this.env.SANDBOX_IMAGE||''),'UNPINNED_IMAGE','L’image de sandbox doit être épinglée par digest.',503);
    const {stdout}=await exec('docker',['image','inspect',this.env.SANDBOX_IMAGE!],{timeout:15000,maxBuffer:1_000_000});
    const image=JSON.parse(stdout)[0];const labels=image?.Config?.Labels??{};
    invariant(labels['agentforge.sandbox-contract']==='1','SANDBOX_CONTRACT_MISSING','L’image ne déclare pas le contrat de sandbox AgentForge.',503);
    return {image:this.env.SANDBOX_IMAGE,labels};
  }
  async run(root:string,mode:'runtime'|'recursive'|'br360'|'dependencies',language:string):Promise<{stdout:string;stderr:string;exitCode:number;command:string[]}>{
    const name='agentforge-'+randomUUID();const image=this.env.SANDBOX_IMAGE!;
    const mounts=['--mount',`type=bind,src=${root},dst=/input,readonly`];
    if(mode==='recursive'||mode==='br360'){
      const variable=mode==='recursive'?'RECURSIVE_ROOT':'BR360_ROOT';const toolRoot=this.env[variable];
      invariant(toolRoot&&isAbsolute(toolRoot)&&!toolRoot.includes(','),'TOOL_NOT_AVAILABLE',`${variable} non configuré.`,503);
      invariant((await stat(toolRoot)).isDirectory(),'TOOL_NOT_AVAILABLE','Répertoire du moteur introuvable.',503);
      mounts.push('--mount',`type=bind,src=${toolRoot},dst=/opt/${mode},readonly`);
    }
    const setup='cp -R /input/. /work/ && cd /work && ';
    const command=mode==='recursive'?['python','-B','/opt/recursive/recursive.py','verify','/work','--no-cache']:
      mode==='br360'?['python','-B','/opt/br360/runtime/br360_engine.py','audit','--project','/work']:[];
    // The shell strings below are fixed application constants. No user/model strings are interpolated.
    const dependencyTask=language==='typescript'?'cp -R /opt/npm-cache /tmp/npm-cache && npm install --package-lock-only --offline --ignore-scripts --no-audit --no-fund 1>&2 && cat package-lock.json':
      "python -m pip download --no-index --find-links=/opt/wheels --only-binary=:all: -r requirements.in -d /work/resolved 1>&2 && python -c '"+'import pathlib, zipfile, email, hashlib; rows=[]\nfor p in sorted(pathlib.Path(\'"\'"\'/work/resolved\'"\'"\').glob(\'"\'"\'*.whl\'"\'"\')):\n z=zipfile.ZipFile(p); f=next(n for n in z.namelist() if n.endswith(\'"\'"\'.dist-info/METADATA\'"\'"\')); m=email.message_from_bytes(z.read(f)); rows.append(m[\'"\'"\'Name\'"\'"\']+\'"\'"\'==\'"\'"\'+m[\'"\'"\'Version\'"\'"\']+\'"\'"\' --hash=sha256:\'"\'"\'+hashlib.sha256(p.read_bytes()).hexdigest())\nprint(\'"\'"\'\\n\'"\'"\'.join(sorted(rows)))'+"'";
    const task=mode==='dependencies'?dependencyTask:mode==='runtime'?(language==='typescript'
      ?'cp -R /opt/npm-cache /tmp/npm-cache && npm ci --offline --ignore-scripts --no-audit --no-fund && npm run build && node --test --test-reporter=tap tests/*.test.mjs'
      :'python -m pip install --target /work/.deps --no-index --find-links=/opt/wheels --require-hashes -r requirements.lock && python -m compileall -q src tests && python -m unittest discover -s tests -v'):
      command.join(' ');
    const args=['run','--name',name,'--rm','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
      '--pids-limit','128','--memory','768m','--cpus','1','--user','65534:65534',
      '--tmpfs','/tmp:rw,nosuid,noexec,size=268435456','--tmpfs','/work:rw,nosuid,size=536870912',
      '-e','HOME=/tmp','-e','npm_config_cache=/tmp/npm-cache','-e','npm_config_offline=true','-e','PYTHONDONTWRITEBYTECODE=1','-e','PYTHONPATH=/work/.deps:/work/src',
      ...mounts,image,'/bin/sh','-c',setup+task];
    try{
      const result=await exec('docker',args,{timeout:180000,maxBuffer:4_000_000,env:{PATH:process.env.PATH,HOME:process.env.HOME}});
      return {stdout:result.stdout,stderr:result.stderr,exitCode:0,command:mode==='runtime'?[task]:command};
    }catch(e:any){return {stdout:String(e.stdout??''),stderr:String(e.stderr??e.message??'Execution failed'),exitCode:Number.isInteger(e.code)?e.code:124,command:mode==='runtime'?[task]:command};}
    finally{await exec('docker',['rm','-f',name],{timeout:15000,maxBuffer:100000}).catch(()=>undefined);}
  }
  async resolveDependencies(files:ProjectFiles,plan:BuildPlan):Promise<ProjectFiles>{
    validateDependencyManifest(files,plan);await this.inspect();validateFiles(files);const root=await mkdtemp(join(tmpdir(),'agentforge-deps-'));
    try{await import('node:fs/promises').then(fs=>fs.chmod(root,0o755));
      const manifests=plan.decision.language==='typescript'?['package.json']:['requirements.in'];
      for(const path of manifests)await writeFile(join(root,path),files[path],{mode:0o644});
      const run=await this.run(root,'dependencies',plan.decision.language);
      invariant(run.exitCode===0,'DEPENDENCY_RESOLUTION_BLOCKED','La résolution hors ligne des dépendances a échoué. L’image doit contenir toutes les dépendances nécessaires.',503);
      const result={...files};if(plan.decision.language==='typescript'){
        const lock=JSON.parse(run.stdout);invariant(lock.lockfileVersion>=2&&lock.packages,'INVALID_DEPENDENCY_LOCK','Lockfile npm invalide.');result['package-lock.json']=JSON.stringify(lock,null,2)+'\n';
      }else{invariant(run.stdout.includes('--hash=sha256:'),'INVALID_DEPENDENCY_LOCK','Aucun hash de wheel vérifié.');result['requirements.lock']=run.stdout;}
      validateFiles(result);return result;
    }finally{await rm(root,{recursive:true,force:true});}
  }
  async validate(files:ProjectFiles,plan:BuildPlan):Promise<EvidenceReport[]>{
    let root:string|undefined;
    try{
      const image=await this.inspect();
      const approved=JSON.parse(image.labels['agentforge.frameworks']??'{}');
      invariant(approved[plan.source.package!]===plan.source.version,'DEPENDENCY_IMAGE_MISMATCH','La version du framework doit être présente dans l’image prévalidée.',503);
      validateFiles(files);root=await mkdtemp(join(tmpdir(),'agentforge-'));await import('node:fs/promises').then(fs=>fs.chmod(root!,0o755));
      for(const [path,content] of Object.entries(files)){const full=join(root,path);await mkdir(dirname(full),{recursive:true,mode:0o755});await writeFile(full,content,{mode:0o644});}
      const reports:EvidenceReport[]=[];
      for(const mode of ['runtime','recursive','br360'] as const){
        const tool=mode==='runtime'?'sandbox':mode;
        try{
          const run=await this.run(root,mode,plan.decision.language);
          const output=redact(run.stdout+'\n'+run.stderr);
          const evidence=[{image:image.image,network:'none',exit_code:run.exitCode,command:run.command,stdout_sha256:sha256(run.stdout),stderr_sha256:sha256(run.stderr)}];
          if(mode==='runtime'){
            const matched=plan.decision.language==='typescript'?output.match(/^# tests (\d+)/m):output.match(/Ran (\d+) tests?/);
            const count=matched?Number(matched[1]):0;
            reports.push({tool,status:run.exitCode===0&&count>0?'PASS':'BLOCK',summary:`Tests isolés : ${count}; exit ${run.exitCode}.`,findings:run.exitCode||!count?[output.slice(-10000)]:[],evidence,executed_at:new Date().toISOString(),scope:'offline_runtime_only'});
          }else{
            let raw:any;try{raw=JSON.parse(run.stdout);}catch{raw=null;}
            reports.push(normalizeAudit(mode,raw,run.exitCode,evidence));
          }
        }catch(e){reports.push(unavailable(tool,e instanceof AppError?e.message:'Moteur indisponible.'));}
      }
      return reports;
    }catch(e){return ['sandbox','recursive','br360'].map(tool=>unavailable(tool,e instanceof AppError?e.message:'Docker ou image de sandbox indisponible.'));}
    finally{if(root)await rm(root,{recursive:true,force:true});}
  }
}
export function normalizeAudit(tool:'recursive'|'br360',raw:any,exitCode:number,evidence:unknown[]):EvidenceReport{
  const rawStatus=tool==='br360'?raw?.final?.status:raw?.status??raw?.verification?.status??raw?.result?.status;
  let status:EvidenceReport['status']='UNKNOWN';
  if(exitCode!==0)status='BLOCK';
  else if(rawStatus==='PASS')status='PASS';
  else if(['FAIL','BLOCK','BLOCKED'].includes(rawStatus))status='BLOCK';
  else if(['PARTIAL','WARN','WARNING'].includes(rawStatus))status='WARN';
  // Even a raw PASS is not accepted when the tool documents missing verification or critical blockers.
  if(raw?.blockers?.length || raw?.audit_self_evaluation?.missing_real_world_data?.length || raw?.audit_self_evaluation?.unverified_assumptions?.length)status=status==='BLOCK'?'BLOCK':'WARN';
  if(!raw||!rawStatus)status='UNKNOWN';
  return {tool,status,summary:`Statut natif : ${rawStatus??'non reconnu'}; sortie ${exitCode}.`,findings:status==='PASS'?[]:[`NATIVE_STATUS:${rawStatus??'UNKNOWN'}`],evidence,raw:raw??null,executed_at:new Date().toISOString(),scope:tool==='br360'?'business_readiness_as_reported':'recursive_as_reported'};
}
export function sandboxFor(env:Env):SandboxProvider {return env.SANDBOX_PROVIDER==='docker'?new LocalDockerSandbox(env):new UnavailableSandbox();}
