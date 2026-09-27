import { AppError, invariant, object } from './errors.ts';
import { limitedFetch, rejectSecrets } from './security.ts';
import { KEYS, required } from './config.ts';
import type { Env, ProviderName } from './config.ts';
export interface ModelInfo {
  provider:ProviderName; model_id:string; display_name:string; context:number|null; tool_calling:boolean|null;
  structured_output:boolean|null; coding:boolean|null; reasoning:boolean|null; price_input:number|null; price_output:number|null;
  availability:'AVAILABLE'|'UNKNOWN'; updated_at:string;
}
export interface GenerationRequest { model:string; system:string; prompt:string; maxOutputTokens:number }
export interface GenerationResult { text:string; inputTokens:number|null; outputTokens:number|null; providerCost:number|null; provider:ProviderName;model:string }
export interface ModelProvider { listModels():Promise<ModelInfo[]>; generate(request:GenerationRequest):Promise<GenerationResult> }
const urls:Record<ProviderName,string>={openrouter:'https://openrouter.ai/api/v1',openai:'https://api.openai.com/v1',anthropic:'https://api.anthropic.com/v1',mistral:'https://api.mistral.ai/v1',google:'https://generativelanguage.googleapis.com/v1beta'};
/** Raw provider responses never become executable instructions. No secrets included in prompts or logs. */
export class HTTPModelProvider implements ModelProvider {
  provider:ProviderName; env:Env;
  constructor(provider:ProviderName, env:Env){this.provider=provider;this.env=env;}
  headers():Record<string,string>{
    const key=required(this.env,KEYS[this.provider]);
    if(this.provider==='anthropic')return {'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'};
    if(this.provider==='google')return {'content-type':'application/json','x-goog-api-key':key};
    return {'content-type':'application/json',Authorization:`Bearer ${key}`};
  }
  async listModels():Promise<ModelInfo[]> {
    const h=this.provider==='openrouter'&&!this.env[KEYS[this.provider]]?{'content-type':'application/json'}:this.headers();
    const {response,body}=await limitedFetch(`${urls[this.provider]}/models`,{headers:h},8_000_000);
    invariant(response.ok,'MODEL_CATALOG_UNAVAILABLE','Catalogue des modèles indisponible.',503);
    const root=object(JSON.parse(body)); const rows=(root.data??root.models) as Record<string,any>[];
    invariant(Array.isArray(rows),'INVALID_CATALOG','Catalogue fournisseur invalide.',502);
    return rows.slice(0,5000).map(row=>({provider:this.provider,model_id:String(row.id??row.name).replace(/^models\//,''),
      display_name:String(row.name??row.display_name??row.displayName??row.id),context:typeof row.context_length==='number'?row.context_length:null,
      tool_calling:Array.isArray(row.supported_parameters)?row.supported_parameters.includes('tools'):null,
      structured_output:Array.isArray(row.supported_parameters)?row.supported_parameters.includes('structured_outputs')||row.supported_parameters.includes('response_format'):null,
      coding:null,reasoning:Array.isArray(row.supported_parameters)?row.supported_parameters.includes('reasoning'):null,
      price_input:row.pricing?.prompt!=null?Number(row.pricing.prompt):null,price_output:row.pricing?.completion!=null?Number(row.pricing.completion):null,
      availability:'AVAILABLE',updated_at:new Date().toISOString()}));
  }
  async generate(r:GenerationRequest):Promise<GenerationResult>{
    invariant(r.model.length<=160 && /^[a-zA-Z0-9_.:/@-]+$/.test(r.model),'INVALID_MODEL','Identifiant de modèle invalide.');
    invariant(Number.isInteger(r.maxOutputTokens)&&r.maxOutputTokens>0&&r.maxOutputTokens<=64000,'TOKEN_LIMIT','Limite de sortie invalide.');
    rejectSecrets(r.prompt); let path='/chat/completions'; let payload:unknown;
    if(this.provider==='openai') {path='/responses';payload={model:r.model,instructions:r.system,input:r.prompt,max_output_tokens:r.maxOutputTokens,store:false,text:{format:{type:'json_object'}}};}
    else if(this.provider==='anthropic'){path='/messages';payload={model:r.model,system:r.system,messages:[{role:'user',content:r.prompt}],max_tokens:r.maxOutputTokens};}
    else if(this.provider==='google'){path=`/models/${encodeURIComponent(r.model)}:generateContent`;payload={systemInstruction:{parts:[{text:r.system}]},contents:[{role:'user',parts:[{text:r.prompt}]}],generationConfig:{maxOutputTokens:r.maxOutputTokens,responseMimeType:'application/json'}};}
    else payload={model:r.model,messages:[{role:'system',content:r.system},{role:'user',content:r.prompt}],max_tokens:r.maxOutputTokens,response_format:{type:'json_object'}};
    const {response,body}=await limitedFetch(urls[this.provider]+path,{method:'POST',headers:this.headers(),body:JSON.stringify(payload)},10_000_000,120000);
    invariant(response.ok,'AI_PROVIDER_ERROR',`Le fournisseur IA a refusé l’appel (${response.status}).`,502);
    const data=object(JSON.parse(body)) as Record<string,any>; let output:string;
    if(this.provider==='openai')output=(data.output??[]).flatMap((x:any)=>x.content??[]).filter((x:any)=>x.type==='output_text').map((x:any)=>x.text).join('');
    else if(this.provider==='anthropic')output=(data.content??[]).filter((x:any)=>x.type==='text').map((x:any)=>x.text).join('');
    else if(this.provider==='google')output=(data.candidates?.[0]?.content?.parts??[]).map((x:any)=>x.text??'').join('');
    else output=data.choices?.[0]?.message?.content;
    invariant(typeof output==='string'&&output.length>0,'INVALID_AI_OUTPUT','Le modèle n’a pas fourni de contenu exploitable.',502);
    const u=data.usage??data.usageMetadata??{};
    return {text:output,inputTokens:integerOrNull(u.input_tokens??u.prompt_tokens??u.promptTokenCount),outputTokens:integerOrNull(u.output_tokens??u.completion_tokens??u.candidatesTokenCount),
      providerCost:typeof u.cost==='number'&&u.cost>=0?u.cost:null,provider:this.provider,model:r.model};
  }
}
function integerOrNull(v:unknown):number|null{return Number.isInteger(v)&&Number(v)>=0?Number(v):null;}
export class OpenRouterProvider extends HTTPModelProvider{constructor(env:Env){super('openrouter',env);}}
export class OpenAIProvider extends HTTPModelProvider{constructor(env:Env){super('openai',env);}}
export class AnthropicProvider extends HTTPModelProvider{constructor(env:Env){super('anthropic',env);}}
export class MistralProvider extends HTTPModelProvider{constructor(env:Env){super('mistral',env);}}
export class GoogleProvider extends HTTPModelProvider{constructor(env:Env){super('google',env);}}
export class ModelCatalog {
  env:Env; cache=new Map<ProviderName,{time:number;models:ModelInfo[]}>();
  constructor(env:Env){this.env=env;}
  async list(provider:ProviderName):Promise<ModelInfo[]>{
    const cached=this.cache.get(provider);if(cached&&Date.now()-cached.time<900000)return cached.models;
    let list=await new HTTPModelProvider(provider,this.env).listModels();
    const overrides=JSON.parse(this.env.MODEL_CATALOG_OVERRIDES_JSON||'[]') as ModelInfo[];
    list=list.map(m=>{const o=overrides.find(o=>o.provider===provider&&o.model_id===m.model_id);return o?{...m,...o}:m;});
    this.cache.set(provider,{time:Date.now(),models:list});return list;
  }
  async get(provider:ProviderName,id:string):Promise<ModelInfo>{
    const m=(await this.list(provider)).find(m=>m.model_id===id);
    invariant(m&&m.availability==='AVAILABLE','MODEL_UNAVAILABLE','Modèle introuvable ou désactivé.',503);return m;
  }
}
export function reserveCost(model:ModelInfo, request:GenerationRequest):number {
  invariant(model.price_input!==null&&model.price_output!==null&&Number.isFinite(model.price_input)&&Number.isFinite(model.price_output)&&model.price_input>=0&&model.price_output>=0,
    'PRICE_UNKNOWN','Tarifs du modèle non renseignés : génération bloquée.',503);
  invariant(Date.now()-Date.parse(model.updated_at)<30*86400000 && Date.parse(model.updated_at)<=Date.now()+60000,'STALE_MODEL_PRICE','Tarif du modèle expiré.',503);
  // Byte count deliberately over-reserves; includes a fixed allowance for provider request framing.
  const inputBound=Buffer.byteLength(request.prompt+request.system)+4096;
  return Math.ceil((inputBound*model.price_input+request.maxOutputTokens*model.price_output)*1_000_000)/1_000_000;
}
export function parseJSONResponse(r:GenerationResult):Record<string,unknown>{
  let s=r.text.trim();if(s.startsWith('```json\n')&&s.endsWith('```'))s=s.slice(8,-3).trim();
  try{return object(JSON.parse(s));}catch{throw new AppError('INVALID_AI_JSON','La réponse du modèle ne respecte pas le contrat JSON.',502);}
}
