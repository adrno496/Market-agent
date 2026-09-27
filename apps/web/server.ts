import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { AppError, invariant, object, text, uuid } from '../../packages/core/errors.ts';
import { appUrl, modelFor, providerName, KEYS } from '../../packages/core/config.ts';
import type { Env } from '../../packages/core/config.ts';
import { Supabase, SupabaseStorage } from '../../packages/core/database.ts';
import { newSpec, answer, nextQuestion, parseSpec, readyForPlan, FIELDS } from '../../packages/core/spec.ts';
import type { FieldName } from '../../packages/core/spec.ts';
import { GitHubResolver, SkillResolver, selectFramework, makePlan } from '../../packages/core/research.ts';
import { AIQuestionEngine, interviewRequest } from '../../packages/core/interview.ts';
import { HTTPModelProvider, reserveCost, ModelCatalog } from '../../packages/core/providers.ts';
import { StripePayments, tierLimits } from '../../packages/core/payments.ts';
import type { Tier } from '../../packages/core/payments.ts';
import { workshopExport } from '../../packages/core/workshop.ts';
const publicDir=fileURLToPath(new URL('./public/',import.meta.url));
const env:Env=process.env;const db=new Supabase(env);const catalog=new ModelCatalog(env);const stripe=new StripePayments(env);
const allowedOrigin=appUrl(env).origin;
const local=env.NODE_ENV!=='production'&&env.ENABLE_LOCAL_WORKSHOP!=='false';
const hitMap=new Map<string,{count:number;until:number}>();
function localLimit(key:string,max=60){
  const now=Date.now();let hit=hitMap.get(key);if(!hit||hit.until<=now){hit={count:0,until:now+60000};hitMap.set(key,hit);}hit.count++;
  if(hitMap.size>5000){for(const [key,h]of hitMap)if(h.until<=now)hitMap.delete(key);invariant(hitMap.size<=5000,'RATE_LIMIT','Serveur occupé.',429);}
  invariant(hit.count<=max,'RATE_LIMIT','Trop de demandes. Réessaie plus tard.',429);
}
function cookies(req:IncomingMessage):Record<string,string>{return Object.fromEntries((req.headers.cookie||'').split(';').filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1))];}));}
function cookie(name:string,value:string,age:number):string{return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${env.NODE_ENV==='production'?'; Secure':''}`;}
function setSession(res:ServerResponse,data:any){invariant(data?.access_token&&data?.refresh_token,'AUTH_CONFIRM_EMAIL','Confirme ton adresse email avant de te connecter.',401);res.setHeader('Set-Cookie',[cookie('af_access',data.access_token,Math.min(data.expires_in||3600,3600)),cookie('af_refresh',data.refresh_token,604800),cookie('af_pkce','',0)]);}
function json(res:ServerResponse,status:number,value:unknown){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
async function body(req:IncomingMessage,max=300000):Promise<Buffer>{
  const length=Number(req.headers['content-length']??0);invariant(Number.isFinite(length)&&length<=max,'BODY_TOO_LARGE','Demande trop volumineuse.',413);
  const chunks:Buffer[]=[];let size=0;for await(const chunk of req){const b=Buffer.from(chunk);size+=b.length;invariant(size<=max,'BODY_TOO_LARGE','Demande trop volumineuse.',413);chunks.push(b);}return Buffer.concat(chunks);
}
async function input(req:IncomingMessage):Promise<Record<string,any>>{invariant(String(req.headers['content-type']||'').startsWith('application/json'),'CONTENT_TYPE','JSON requis.',415);try{return object(JSON.parse((await body(req)).toString('utf8')));}catch(e){if(e instanceof AppError)throw e;throw new AppError('INVALID_JSON','JSON invalide.');}}
function origin(req:IncomingMessage){const supplied=req.headers.origin;const choices=[allowedOrigin];if(local){const port=new URL(allowedOrigin).port;choices.push(`http://127.0.0.1${port?':'+port:''}`);}
  invariant(typeof supplied==='string'&&choices.includes(supplied),'CSRF_REJECTED','Origine de la demande non autorisée.',403);
}
async function current(req:IncomingMessage):Promise<{id:string;email:string;token:string}>{const token=cookies(req).af_access;invariant(token,'AUTH_REQUIRED','Connecte-toi pour continuer.',401);const u=await db.user(token);await db.rate('user:'+u.id,90,60);return {...u,token};}
async function enrichInterview(spec:ReturnType<typeof newSpec>,owner:string):Promise<{spec:ReturnType<typeof newSpec>;interview_mode:string;warning?:string}>{
  if(!env.AI_INTERVIEW_MODEL)return {spec,interview_mode:'LOCAL_RULES_NO_AI'};
  try{const choice=modelFor(env,'INTERVIEW');const request=interviewRequest(spec,choice.model);const info=await catalog.get(choice.provider,choice.model);const amount=reserveCost(info,request);
    invariant(amount<=0.05,'PREVIEW_CALL_BUDGET','Coût du cadrage trop élevé.',503);
    await db.rpc('af_reserve_preview',{p_owner:owner,p_amount:amount});
    const result=await new AIQuestionEngine().enrich(spec,new HTTPModelProvider(choice.provider,env),request);
    return {spec:result.spec,interview_mode:'AI_SUGGESTIONS_REQUIRE_CONFIRMATION'};
  }catch(e){return {spec,interview_mode:'LOCAL_RULES_NO_AI',warning:e instanceof AppError?e.code:'INTERVIEW_UNAVAILABLE'};}
}
async function project(user:{id:string;token:string},id:string):Promise<any>{const rows=await db.select('projects',{id:'eq.'+uuid(id),owner_id:'eq.'+user.id,select:'*'},user.token);invariant(rows.length===1,'NOT_FOUND','Projet introuvable.',404);return rows[0];}
function configuration(){return {app_name:env.APP_NAME||'AgentForge',local_workshop:local,auth_configured:!!(env.SUPABASE_URL&&env.SUPABASE_ANON_KEY&&env.SUPABASE_SERVICE_ROLE_KEY),
  payments_mode:env.STRIPE_SECRET_KEY?.startsWith('sk_test_')?'test':env.STRIPE_SECRET_KEY?.startsWith('sk_live_')?'live':'not_configured',
  connected_build_configured:!!(env.AI_DEFAULT_MODEL||env.AI_CODE_MODEL),release_status:'IMPLEMENTATION_CANDIDATE',store_enabled:false};}
async function readiness():Promise<{ready:boolean;reasons:string[]}>{
  const reasons:string[]=[];
  for(const key of ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET'])if(!env[key])reasons.push(key+'_MISSING');
  try{const model=modelFor(env,'CODE');if(!env[KEYS[model.provider]])reasons.push('CODE_PROVIDER_KEY_MISSING');}catch{reasons.push('CODE_MODEL_MISSING');}
  if(reasons.length)return {ready:false,reasons};
  try{await new SupabaseStorage(env).ready();}catch{reasons.push('PRIVATE_STORAGE_UNAVAILABLE');}
  try{const workers=await db.select('worker_heartbeats',{ready:'eq.true',updated_at:'gte.'+new Date(Date.now()-90000).toISOString(),select:'id',limit:'1'});if(!workers.length)reasons.push('READY_WORKER_MISSING');}catch{reasons.push('DATABASE_UNAVAILABLE');}
  return {ready:reasons.length===0,reasons};
}
export const server=createServer(async(req,res)=>{
  const start=Date.now();const requestId=randomBytes(8).toString('hex');res.setHeader('X-Request-Id',requestId);
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://checkout.stripe.com");
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');if(env.NODE_ENV==='production')res.setHeader('Strict-Transport-Security','max-age=31536000');
  try{
    const url=new URL(req.url||'/',allowedOrigin);const path=url.pathname;const method=req.method||'GET';
    const allowedHosts=[new URL(allowedOrigin).host];if(local)allowedHosts.push('127.0.0.1:'+new URL(allowedOrigin).port);
    // Railway probe host is accepted only for read-only health endpoints, never APIs.
    if(method==='GET'&&(path==='/health'||path==='/ready'))allowedHosts.push('healthcheck.railway.app');
    invariant(allowedHosts.includes(req.headers.host||''),'INVALID_HOST','Hôte non autorisé.',403);
    localLimit(req.socket.remoteAddress||'unknown',300);
    if(path==='/health'&&method==='GET'){json(res,200,{status:'ok',service:'agentforge-web',version:'0.1.0'});return;}
    if(path==='/ready'&&method==='GET'){const r=await readiness();json(res,r.ready?200:503,r);return;}
    if(path==='/api/config'&&method==='GET'){json(res,200,configuration());return;}
    if(path==='/api/stripe/webhook'&&method==='POST'){
      const raw=await body(req,1_000_000);json(res,200,await stripe.webhook(raw,String(req.headers['stripe-signature']||'')));return;
    }
    if(!['GET','HEAD'].includes(method))origin(req);
    if(path.startsWith('/api/auth/')){
      localLimit('auth:'+(req.socket.remoteAddress||'unknown'),15);const action=path.split('/').at(-1);invariant(method==='POST','METHOD_NOT_ALLOWED','Méthode non autorisée.',405);
      const data=await input(req);
      if(action==='login'){const session=await db.auth('token?grant_type=password',{email:text(data.email,'email',254),password:text(data.password,'password',256)});setSession(res,session);json(res,200,{ok:true});return;}
      if(action==='signup'||action==='recover'){
        const verifier=randomBytes(32).toString('base64url');const challenge=createHash('sha256').update(verifier).digest('base64url');res.setHeader('Set-Cookie',cookie('af_pkce',verifier,3600));
        const redirect=allowedOrigin+'/?auth_callback=1'+(action==='recover'?'&recovery=1':'');
        const session=await db.auth((action==='signup'?'signup':'recover')+'?redirect_to='+encodeURIComponent(redirect),{email:text(data.email,'email',254),...(action==='signup'?{password:text(data.password,'password',256)}:{}),code_challenge:challenge,code_challenge_method:'s256'});
        if(session?.access_token)setSession(res,session);json(res,200,{ok:true,message:'Consulte ta boîte email. La confirmation peut être nécessaire.'});return;
      }
      if(action==='callback'){const verifier=cookies(req).af_pkce;invariant(verifier,'INVALID_CALLBACK','Reprends la connexion depuis ce navigateur.');const session=await db.auth('token?grant_type=pkce',{auth_code:text(data.code,'code',2048),code_verifier:verifier});setSession(res,session);json(res,200,{ok:true});return;}
      if(action==='refresh'){const token=cookies(req).af_refresh;invariant(token,'AUTH_REQUIRED','Session expirée.',401);const session=await db.auth('token?grant_type=refresh_token',{refresh_token:token});setSession(res,session);json(res,200,{ok:true});return;}
      if(action==='logout'){const token=cookies(req).af_access;if(token)await db.auth('logout',{},token).catch(()=>null);res.setHeader('Set-Cookie',[cookie('af_access','',0),cookie('af_refresh','',0),cookie('af_pkce','',0)]);json(res,200,{ok:true});return;}
      if(action==='password'){const user=await current(req);const password=text(data.password,'password',256);invariant(password.length>=12,'WEAK_PASSWORD','Utilise au moins 12 caractères.');await db.request('/auth/v1/user',{method:'PUT',body:JSON.stringify({password})},user.token);json(res,200,{ok:true});return;}
      throw new AppError('NOT_FOUND','Action inconnue.',404);
    }
    if(path.startsWith('/api/local/')){
      invariant(local,'LOCAL_WORKSHOP_DISABLED','Atelier local désactivé en production.',404);invariant(method==='POST','METHOD_NOT_ALLOWED','POST requis.',405);const data=await input(req);
      let spec=path.endsWith('/start')?newSpec(data.idea):parseSpec(data.spec);
      if(path.endsWith('/answer'))spec=answer(spec,data.field as FieldName,data.value,!!data.confirm_default);
      if(path.endsWith('/export')){const pack=workshopExport(spec);res.writeHead(200,{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="agentforge-cadrage-local.zip"','Cache-Control':'no-store','X-Artifact-SHA256':pack.sha256});res.end(pack.buffer);return;}
      invariant(path.endsWith('/start')||path.endsWith('/answer'),'NOT_FOUND','Action inconnue.',404);
      json(res,200,{spec,question:nextQuestion(spec),decision:selectFramework(spec),mode:'LOCAL_RULES_NO_AI',ready_for_plan:readyForPlan(spec)});return;
    }
    if(path.startsWith('/api/')){
      const user=await current(req);
      if(path==='/api/me'){json(res,200,{id:user.id,email:user.email,admin:(env.ADMIN_USER_IDS||'').split(',').includes(user.id)});return;}
      if(path==='/api/projects'&&method==='GET'){json(res,200,await db.select('projects',{select:'id,name,status,revision,created_at,updated_at',order:'created_at.desc',limit:'100'},user.token));return;}
      if(path==='/api/projects'&&method==='POST'){const data=await input(req);const interview=await enrichInterview(newSpec(data.idea),user.id);const result=await db.rpc('af_create_project',{p_owner:user.id,p_spec:interview.spec});json(res,201,{project:result,...interview,spec:result.spec,question:nextQuestion(result.spec),decision:selectFramework(result.spec)});return;}
      const pm=path.match(/^\/api\/projects\/([a-f0-9-]+)(?:\/(answer|plan))?$/);
      if(pm){
        const p=await project(user,pm[1]);if(!pm[2]&&method==='GET'){json(res,200,{project:p,spec:p.spec,question:nextQuestion(p.spec),decision:selectFramework(p.spec)});return;}
        invariant(method==='POST','METHOD_NOT_ALLOWED','POST requis.',405);const data=await input(req);
        if(pm[2]==='answer'){
          invariant(Number(data.revision)===p.revision,'REVISION_CONFLICT','Le projet a changé. Recharge-le.',409);
          const next=answer(parseSpec(p.spec),data.field,data.value,!!data.confirm_default);
          const updated=await db.rpc('af_update_spec',{p_owner:user.id,p_project:p.id,p_revision:p.revision,p_spec:next,p_message:`${data.field}: ${data.value}`});
          json(res,200,{project:updated,spec:next,question:nextQuestion(next),decision:selectFramework(next)});return;
        }
        if(pm[2]==='plan'){
          await db.rate('plan:'+user.id,10,3600);const spec=parseSpec(p.spec);invariant(readyForPlan(spec),'SPEC_INCOMPLETE','Termine les questions importantes.');
          const tier=(data.tier||'production') as Tier;invariant(tier in tierLimits,'INVALID_TIER','Offre inconnue.');
          const selected=modelFor(env,'CODE');const preference=spec.fields.provider_preference.value?.toLowerCase();
          if(preference&&preference!=='auto'){
            selected.provider=providerName(preference);const defaults=JSON.parse(env.AI_PROVIDER_DEFAULT_MODELS_JSON||'{}');
            invariant(defaults[selected.provider]||selected.provider===modelFor(env,'CODE').provider,'MODEL_NOT_CONFIGURED','Configure un modèle pour ce fournisseur.',503);
            if(defaults[selected.provider])selected.model=String(defaults[selected.provider]);
          }
          if(spec.fields.model_preference.confirmed&&spec.fields.model_preference.value&&spec.fields.model_preference.value.toLowerCase()!=='auto')selected.model=spec.fields.model_preference.value;
          const model=await catalog.get(selected.provider,selected.model);
          invariant(model.price_input!==null&&model.price_output!==null,'PRICE_UNKNOWN','Configure les tarifs du modèle avant de chiffrer un build.',503);
          const decision=selectFramework(spec);const source=await new GitHubResolver(env).framework(decision.framework);const skills=await new SkillResolver(env).resolve(spec);
          const quote=await stripe.price(tier);const budget=Number(env['BUDGET_'+tier.toUpperCase()+'_USD']||tierLimits[tier].defaultBudget);
          invariant(Number.isFinite(budget)&&budget>0&&budget<=100,'INVALID_BUDGET','Budget interne invalide.',503);
          const plan=makePlan(spec,decision,source,skills,selected.provider,selected.model,{max_repairs:tierLimits[tier].repairs,budget_usd:budget,max_output_tokens:Math.min(32000,Number(env.CODE_MAX_OUTPUT_TOKENS||16000))},tier,quote);
          await db.rpc('af_save_plan',{p_owner:user.id,p_project:p.id,p_revision:p.revision,p_plan:plan});
          json(res,200,{plan,ready_for_checkout:(await readiness()).ready});return;
        }
      }
      if(path==='/api/checkout'&&method==='POST'){
        const data=await input(req);const planId=uuid(data.plan_id);const rows=await db.select('build_plans',{id:'eq.'+planId,select:'plan'},user.token);
        invariant(rows.length===1,'NOT_FOUND','Plan introuvable.',404);const ready=await readiness();invariant(ready.ready,'PLATFORM_NOT_READY','Services non prêts : '+ready.reasons.join(', '),503);
        json(res,200,await stripe.checkout(user.id,planId,rows[0].plan.tier,text(data.idempotency_key,'idempotency_key',100)));return;
      }
      if(path==='/api/pricing'&&method==='GET'){const prices=await Promise.all((['starter','production','advanced'] as Tier[]).map(async tier=>({tier,...await stripe.price(tier)})));json(res,200,prices);return;}
      if(path==='/api/models'&&method==='GET'){json(res,200,await catalog.list(providerName(url.searchParams.get('provider')||undefined)));return;}
      if(path==='/api/jobs'&&method==='GET'){json(res,200,await db.select('generation_jobs',{select:'id,project_id,status,stage,error_code,spent_usd,budget_usd,created_at',order:'created_at.desc',limit:'100'},user.token));return;}
      if(path==='/api/payments'&&method==='GET'){json(res,200,await db.select('payments',{select:'id,status,tier,amount_snapshot,currency,livemode,created_at',order:'created_at.desc',limit:'100'},user.token));return;}
      if(path==='/api/artifacts'&&method==='GET'){json(res,200,await db.select('artifacts',{select:'id,job_id,sha256,size_bytes,manifest,reports,expires_at,created_at',order:'created_at.desc',limit:'100'},user.token));return;}
      const jm=path.match(/^\/api\/jobs\/([a-f0-9-]+)\/(events|retry)$/);
      if(jm){
        const id=uuid(jm[1]);const jobs=await db.select('generation_jobs',{id:'eq.'+id,select:'id'},user.token);invariant(jobs.length,'NOT_FOUND','Génération introuvable.',404);
        if(jm[2]==='retry'&&method==='POST'){json(res,200,await db.rpc('af_retry_job',{p_owner:user.id,p_job:id}));return;}
        invariant(jm[2]==='events'&&method==='GET','METHOD_NOT_ALLOWED','Méthode non autorisée.',405);
        let last=Number(req.headers['last-event-id']||url.searchParams.get('after')||0);invariant(Number.isSafeInteger(last)&&last>=0,'INVALID_CURSOR','Curseur invalide.');
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});let stopped=false;res.on('close',()=>{stopped=true;});
        while(!stopped){
          const events=await db.select('generation_events',{job_id:'eq.'+id,id:'gt.'+last,select:'id,type,data,created_at',order:'id.asc',limit:'100'},user.token);
          for(const event of events){last=event.id;res.write(`id: ${event.id}\nevent: progress\ndata: ${JSON.stringify(event)}\n\n`);}
          if(events.some(e=>['completed','blocked','failed'].includes(e.type)))break;
          res.write(': heartbeat\n\n');await new Promise(resolve=>setTimeout(resolve,2000));
        }res.end();return;
      }
      const dm=path.match(/^\/api\/artifacts\/([a-f0-9-]+)\/download$/);
      if(dm&&method==='POST'){const a=await db.rpc('af_download',{p_owner:user.id,p_artifact:uuid(dm[1])});json(res,200,{url:await new SupabaseStorage(env).signedUrl(a.storage_key),sha256:a.sha256,expires_in_seconds:60});return;}
      if(path.startsWith('/api/admin')){
        invariant((env.ADMIN_USER_IDS||'').split(',').includes(user.id),'FORBIDDEN','Accès administrateur requis.',403);
        if(path==='/api/admin'&&method==='GET'){
          const [jobs,payments,models,workers]=await Promise.all([db.select('generation_jobs',{select:'*',order:'created_at.desc',limit:'100'}),db.select('payments',{select:'id,status,amount_snapshot,currency,tier',limit:'100'}),db.select('model_catalog',{select:'*'}),db.select('worker_heartbeats',{select:'*'})]);
          json(res,200,{scope:'last_100_records_not_all_time',jobs,payments,models,workers});return;
        }
        if(path==='/api/admin/model'&&method==='POST'){
          const d=await input(req);const provider=providerName(d.provider);const model=text(d.model_id,'model_id',160);invariant(typeof d.enabled==='boolean','INVALID_FIELD','Statut invalide.');
          await db.insert('model_catalog',{id:provider+':'+model,provider,model_id:model,enabled:d.enabled,updated_at:new Date().toISOString()},true);json(res,200,{ok:true});return;
        }
      }
      throw new AppError('NOT_FOUND','Route introuvable.',404);
    }
    const files:Record<string,[string,string]>={'/':['index.html','text/html; charset=utf-8'],'/app':['index.html','text/html; charset=utf-8'],'/app/dashboard':['index.html','text/html; charset=utf-8'],'/app/framework':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/styles.css':['styles.css','text/css; charset=utf-8'],'/favicon.svg':['favicon.svg','image/svg+xml'],'/legal':['legal.html','text/html; charset=utf-8']};
    invariant(method==='GET'||method==='HEAD','METHOD_NOT_ALLOWED','Méthode non autorisée.',405);const asset=files[path];invariant(asset,'NOT_FOUND','Page introuvable.',404);
    const bytes=await readFile(join(publicDir,asset[0]));res.writeHead(200,{'Content-Type':asset[1],'Cache-Control':'no-cache'});res.end(method==='HEAD'?undefined:bytes);
  }catch(e){
    if(res.headersSent){res.end();return;}const error=e instanceof AppError?e:new AppError('INTERNAL_ERROR','Une erreur interne est survenue.',500);
    json(res,error.status,{error:error.code,message:error.message,request_id:requestId});
  }finally{if(env.LOG_REQUESTS==='true')console.log(JSON.stringify({request_id:requestId,method:req.method,status:res.statusCode,duration_ms:Date.now()-start}));}
});
server.requestTimeout=20000;server.headersTimeout=10000;server.maxHeadersCount=50;
const port=Number(env.PORT||3000);const host=env.HOST||(env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1');
server.listen(port,host,()=>console.log(JSON.stringify({event:'web_listening',host,port,local_workshop:local,external_services:'not_verified_at_startup'})));
