import { invariant, object, text, AppError } from './errors.ts';
import { fixedHttpsUrl, limitedFetch, digest } from './security.ts';
import type { Env } from './config.ts';
import type { ProjectSpec } from './spec.ts';
export const FRAMEWORKS = [
  {id:'openai-agents-js',repo:'openai/openai-agents-js',language:'typescript',package:'@openai/agents',registry:'npm'},
  {id:'openai-agents-python',repo:'openai/openai-agents-python',language:'python',package:'openai-agents',registry:'pypi'},
  {id:'langgraph',repo:'langchain-ai/langgraph',language:'python',package:'langgraph',registry:'pypi'},
  {id:'google-adk',repo:'google/adk-python',language:'python',package:'google-adk',registry:'pypi'},
  {id:'microsoft-agent-framework',repo:'microsoft/agent-framework',language:'python',package:'agent-framework',registry:'pypi'}
] as const;
export interface Source {verification_scope?:string;commit_role?:string;repository:string;commit:string|null;version:string|null;license:string;package:string|null;registry:string|null;integrity:string|null;files_used:string[];usage:string;vendored:false;fetched_at:string;status:'VERIFIED'|'REVIEW_REQUIRED';metadata?:unknown}
export interface FrameworkDecision {framework:string;language:string;architecture:string;reason:string[];alternatives:string[];confidence:number}
export function selectFramework(spec:ProjectSpec):FrameworkDecision {
  const f=spec.fields;const desc=(f.objective.value+' '+(f.workflows.value??'')).toLowerCase();
  const requested=f.framework_preference.value?.toLowerCase();
  let id=FRAMEWORKS.some(x=>x.id===requested)?requested!:'openai-agents-js';
  const reasons=['Sélection du framework distincte du modèle IA.'];
  if(!requested){
    if(/graphe|graph|reprise|longue durée|long-running/.test(desc)){id='langgraph';reasons.push('Workflow avec état et reprise.');}
    else if(/adk|google workspace|gemini/.test(desc)){id='google-adk';reasons.push('Écosystème Google explicitement demandé.');}
    else if(/\.net|microsoft|azure/.test(desc)){id='microsoft-agent-framework';reasons.push('Écosystème Microsoft explicitement demandé ; sortie Python dans cette version.');}
    else if(f.runtime_language.value?.toLowerCase()==='python')id='openai-agents-python';
    else reasons.push('Agent orienté outils ; surface d’orchestration réduite.');
  }
  const fw=FRAMEWORKS.find(x=>x.id===id)!;
  return {framework:id,language:fw.language,architecture:/multi.agent|plusieurs agents/.test(desc)?'multi-agent-workflow':'single-agent-tools',reason:reasons,alternatives:FRAMEWORKS.filter(x=>x.id!==id).map(x=>x.id),confidence:.7};
}
export class GitHubResolver {
  env:Env;constructor(env:Env){this.env=env;}
  async get(path:string):Promise<any>{
    invariant(path.startsWith('/')&&!path.includes('..'),'INVALID_GITHUB_PATH','Chemin API GitHub invalide.');
    const headers:Record<string,string>={'Accept':'application/vnd.github+json','User-Agent':'AgentForge/0.1'};
    if(this.env.GITHUB_TOKEN)headers.Authorization=`Bearer ${this.env.GITHUB_TOKEN}`;
    const {response,body}=await limitedFetch('https://api.github.com'+path,{headers},4_000_000);
    invariant(response.ok,'GITHUB_UNAVAILABLE',`GitHub indisponible (${response.status}).`,503);return JSON.parse(body);
  }
  async inspect(repo:string,usage='dependency'):Promise<Source>{
    invariant(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo),'INVALID_REPOSITORY','Dépôt GitHub invalide.');
    const info=await this.get('/repos/'+repo);const branch=String(info.default_branch);
    const commit=await this.get('/repos/'+repo+'/commits/'+encodeURIComponent(branch));
    const license=String(info.license?.spdx_id??'UNKNOWN');const trusted=FRAMEWORKS.some(x=>x.repo===repo);
    invariant(/^[a-f0-9]{40}$/.test(commit.sha),'INVALID_COMMIT','Commit GitHub invalide.',502);
    return {repository:repo,commit:commit.sha,version:null,license,package:null,registry:null,integrity:null,files_used:[],usage,vendored:false,verification_scope:'repository_metadata_and_registry_version',commit_role:'repository_snapshot_not_verified_release_commit',
      fetched_at:new Date().toISOString(),status:!info.archived&&trusted&&['MIT','Apache-2.0','BSD-3-Clause','BSD-2-Clause','ISC'].includes(license)?'VERIFIED':'REVIEW_REQUIRED',
      metadata:{archived:!!info.archived,pushed_at:info.pushed_at,maintainer:info.owner?.login,source_trust:'metadata_only_untrusted_content'}};
  }
  async search(need:string):Promise<unknown[]> {
    const data=await this.get('/search/repositories?q='+encodeURIComponent(text(need,'need',180)+' archived:false')+'&per_page=5');
    return (data.items??[]).map((r:any)=>({repository:r.full_name,description:String(r.description??'').slice(0,500),license:r.license?.spdx_id??'UNKNOWN',pushed_at:r.pushed_at,status:'REVIEW_REQUIRED'}));
  }
  async framework(id:string):Promise<Source>{
    const f=FRAMEWORKS.find(x=>x.id===id);invariant(f,'UNSUPPORTED_FRAMEWORK','Framework inconnu.');
    const source=await this.inspect(f.repo);let data:any;
    if(f.registry==='npm'){
      const {response,body}=await limitedFetch('https://registry.npmjs.org/'+encodeURIComponent(f.package)+'/latest',{},3_000_000);
      invariant(response.ok,'REGISTRY_UNAVAILABLE','Registre npm indisponible.',503);data=JSON.parse(body);
      source.version=data.version;source.integrity=data.dist?.integrity??null;
    }else{
      const {response,body}=await limitedFetch('https://pypi.org/pypi/'+f.package+'/json',{},4_000_000);
      invariant(response.ok,'REGISTRY_UNAVAILABLE','Registre Python indisponible.',503);data=JSON.parse(body);
      source.version=data.info?.version;source.integrity=data.urls?.[0]?.digests?.sha256??null;
    }
    invariant(source.version&&/^\d+\.\d+\.\d+$/.test(source.version),'NO_STABLE_VERSION','Aucune version stable simple vérifiable : sélection à revoir.',503);
    invariant(source.integrity,'MISSING_INTEGRITY','Empreinte du package absente.',503);
    source.package=f.package;source.registry=f.registry;return source;
  }
}
export class SkillResolver {
  github:GitHubResolver; constructor(env:Env){this.github=new GitHubResolver(env);}
  async resolve(spec:ProjectSpec):Promise<{builtins:unknown[];mcp:unknown[];github:unknown[];warnings:string[]}>{
    const need=(spec.fields.calendar_provider.value??spec.fields.integrations.value??'agent tools').slice(0,160);
    const builtins=[{id:'approval-policy',source:'original_implementation',status:'AVAILABLE',permissions:'deny_by_default'}];
    const warnings:string[]=[];let mcp:unknown[]=[];let github:unknown[]=[];
    try{
      const url=new URL('https://registry.modelcontextprotocol.io/v0.1/servers');url.searchParams.set('search',need);url.searchParams.set('limit','5');
      const {response,body}=await limitedFetch(url,{},2_000_000);invariant(response.ok,'MCP_REGISTRY_UNAVAILABLE','Registre MCP indisponible.');
      const data=object(JSON.parse(body));mcp=Array.isArray(data.servers)?data.servers.slice(0,5).map((r:any)=>({name:r.server?.name,version:r.server?.version,repository:r.server?.repository?.url??null,status:'REVIEW_REQUIRED',auto_execute:false})):[];
    }catch{warnings.push('MCP_REGISTRY_NOT_AVAILABLE');}
    try{github=await this.github.search(need);}catch{warnings.push('GITHUB_SEARCH_NOT_AVAILABLE');}
    return {builtins,mcp,github,warnings};
  }
}
export interface BuildPlan {tier:'starter'|'production'|'advanced';quote:{id:string;amount:number;currency:string};schema_version:'1.0.0';id:string;spec_hash:string;spec:ProjectSpec;decision:FrameworkDecision;source:Source;skills:unknown;provider:string;model:string;limits:{max_repairs:number;budget_usd:number;max_output_tokens:number};created_at:string;hash:string}
export function makePlan(spec:ProjectSpec,decision:FrameworkDecision,source:Source,skills:unknown,provider:string,model:string,limits:BuildPlan['limits'],tier:BuildPlan['tier'],quote:BuildPlan['quote']):BuildPlan{
  invariant(source.status==='VERIFIED'&&source.version&&source.integrity,'SOURCE_REVIEW_REQUIRED','La provenance du framework doit être vérifiée.',409);
  const base={tier,quote,schema_version:'1.0.0' as const,id:crypto.randomUUID(),spec_hash:digest(spec),spec,decision,source,skills,provider,model,limits,created_at:new Date().toISOString()};
  return {...base,hash:digest(base)};
}
export function validatePlan(plan:BuildPlan):void {
  const {hash,...rest}=plan;invariant(hash===digest(rest)&&plan.spec_hash===digest(plan.spec),'PLAN_TAMPERED','Le BuildPlan a été modifié.',409);
  invariant(plan.source.status==='VERIFIED','SOURCE_REVIEW_REQUIRED','Source non vérifiée.',409);
}
