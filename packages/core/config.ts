import { invariant } from './errors.ts';
import { fixedHttpsUrl } from './security.ts';
export type Env = Record<string, string | undefined>;
export type ProviderName = 'openrouter'|'openai'|'anthropic'|'mistral'|'google';
export const PROVIDERS:ProviderName[]=['openrouter','openai','anthropic','mistral','google'];
export const KEYS:Record<ProviderName,string>={openrouter:'OPENROUTER_API_KEY',openai:'OPENAI_API_KEY',anthropic:'ANTHROPIC_API_KEY',mistral:'MISTRAL_API_KEY',google:'GOOGLE_GENERATIVE_AI_API_KEY'};
export function required(env:Env, key:string):string { const v=env[key]; invariant(v, 'CONFIGURATION_REQUIRED', `Configuration requise : ${key}.`,503); return v; }
export function providerName(value:string|undefined):ProviderName {
  const p=(value||'openrouter').toLowerCase(); invariant(PROVIDERS.includes(p as ProviderName),'INVALID_PROVIDER','Fournisseur inconnu.'); return p as ProviderName;
}
export function appUrl(env:Env):URL {
  const u=new URL(env.APP_URL||'http://localhost:3000');
  if(env.NODE_ENV==='production') fixedHttpsUrl(u.href);
  else invariant(u.protocol==='https:' || u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname),'INVALID_APP_URL','URL locale ou HTTPS requise.');
  return u;
}
export function supabaseUrl(env:Env):string {
  const url=required(env,'SUPABASE_URL'); const u=new URL(url);
  if(env.NODE_ENV!=='production'&&env.ALLOW_LOCAL_SUPABASE==='true'&&['localhost','127.0.0.1'].includes(u.hostname)) return u.origin;
  fixedHttpsUrl(url); invariant(u.pathname==='/'&&!u.search,'INVALID_SUPABASE_URL','URL Supabase invalide.'); return u.origin;
}
export function modelFor(env:Env, phase:'INTERVIEW'|'ARCHITECT'|'CODE'|'REVIEW'): {provider:ProviderName;model:string} {
  return {provider:providerName(env[`AI_${phase}_PROVIDER`]||env.AI_DEFAULT_PROVIDER),model:required({...env,AI_SELECTED_MODEL:env[`AI_${phase}_MODEL`]||env.AI_DEFAULT_MODEL},'AI_SELECTED_MODEL')};
}
export function knownSecrets(env:Env):string[] {return Object.entries(env).filter(([k,v])=>v&&/SECRET|KEY|TOKEN|PASSWORD|DATABASE_URL/.test(k)).map(([,v])=>v!);}
