import { AppError, invariant } from './errors.ts';
import { limitedFetch } from './security.ts';
import { required, supabaseUrl } from './config.ts';
import type { Env } from './config.ts';
export class Supabase {
  env:Env;constructor(env:Env){this.env=env;}
  async request(path:string,init:RequestInit={},accessToken?:string):Promise<any>{
    invariant(/^\/(rest\/v1|auth\/v1|storage\/v1)\//.test(path),'INVALID_DB_PATH','Chemin de service invalide.');
    const apiKey=accessToken?required(this.env,'SUPABASE_ANON_KEY'):required(this.env,'SUPABASE_SERVICE_ROLE_KEY');
    const headers={'apikey':apiKey,Authorization:`Bearer ${accessToken||apiKey}`,'Content-Type':'application/json',...(init.headers||{})};
    const {response,body}=await limitedFetch(supabaseUrl(this.env)+path,{...init,headers},15_000_000);
    if(!response.ok){
      let code='DATABASE_ERROR';try{const error=JSON.parse(body); if(typeof error.message==='string'&&/^[A-Z_]{3,60}$/.test(error.message))code=error.message;}catch{}
      throw new AppError(code,'Opération de stockage refusée ou indisponible.',response.status===401?401:response.status===403?403:409);
    }
    return body?JSON.parse(body):null;
  }
  async rpc(name:string,args:unknown):Promise<any>{invariant(/^af_[a-z_]+$/.test(name),'INVALID_RPC','Commande inconnue.');return this.request('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(args)});}
  async select(table:string,query:Record<string,string>,accessToken?:string):Promise<any[]>{
    invariant(/^[a-z_]+$/.test(table),'INVALID_TABLE','Table invalide.');const q=new URLSearchParams(query);
    return this.request('/rest/v1/'+table+'?'+q,{},accessToken);
  }
  async insert(table:string,row:unknown,upsert=false):Promise<any>{
    invariant(/^[a-z_]+$/.test(table),'INVALID_TABLE','Table invalide.');return this.request('/rest/v1/'+table,{method:'POST',headers:{Prefer:upsert?'resolution=merge-duplicates,return=representation':'return=representation'},body:JSON.stringify(row)});
  }
  async rate(key:string,limit=30,seconds=60):Promise<void>{invariant(await this.rpc('af_rate_limit',{p_key:key,p_limit:limit,p_seconds:seconds}),'RATE_LIMIT','Trop de demandes. Réessaie plus tard.',429);}
  async user(token:string):Promise<{id:string;email:string}>{
    invariant(token&&token.length<5000,'AUTH_REQUIRED','Connecte-toi pour continuer.',401);
    const data=await this.request('/auth/v1/user',{},token);invariant(data?.id,'AUTH_REQUIRED','Session invalide.',401);return data;
  }
  async auth(path:string,body:unknown,token?:string):Promise<any>{
    const base=supabaseUrl(this.env);const apiKey=required(this.env,'SUPABASE_ANON_KEY');
    const {response,body:result}=await limitedFetch(base+'/auth/v1/'+path,{method:'POST',headers:{apikey:apiKey,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)},200000);
    invariant(response.ok,'AUTH_FAILED','Authentification refusée. Vérifie tes informations ou ton email de confirmation.',response.status===429?429:401);
    return result?JSON.parse(result):null;
  }
}
export class SupabaseStorage {
  db:Supabase;bucket:string;
  constructor(env:Env){this.db=new Supabase(env);this.bucket=env.ARTIFACT_BUCKET||'agentforge-artifacts';invariant(/^[a-z0-9-]+$/.test(this.bucket),'INVALID_BUCKET','Nom de bucket invalide.');}
  async ready():Promise<void>{const bucket=await this.db.request('/storage/v1/bucket/'+this.bucket);invariant(bucket.public===false,'PUBLIC_BUCKET','Le bucket doit être privé.',503);}
  async upload(key:string,bytes:Buffer):Promise<void>{
    invariant(/^[a-f0-9-]+\/[a-f0-9-]+\/[a-f0-9]{64}\.zip$/.test(key),'INVALID_STORAGE_KEY','Clé de stockage invalide.');
    await this.ready();await this.db.request('/storage/v1/object/'+this.bucket+'/'+key,{method:'POST',headers:{'Content-Type':'application/zip','x-upsert':'false'},body:new Uint8Array(bytes)});
  }
  async signedUrl(key:string):Promise<string>{
    invariant(/^[a-f0-9-]+\/[a-f0-9-]+\/[a-f0-9]{64}\.zip$/.test(key),'INVALID_STORAGE_KEY','Clé de stockage invalide.');
    const result=await this.db.request('/storage/v1/object/sign/'+this.bucket+'/'+key,{method:'POST',body:JSON.stringify({expiresIn:60,download:true})});
    const path=result.signedURL??result.signedUrl;invariant(typeof path==='string'&&path.startsWith('/object/sign/'),'INVALID_SIGNED_URL','URL de téléchargement invalide.',502);
    return supabaseUrl(this.db.env)+'/storage/v1'+path;
  }
}
