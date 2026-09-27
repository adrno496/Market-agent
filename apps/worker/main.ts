import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { Supabase, SupabaseStorage } from '../../packages/core/database.ts';
import { sandboxFor } from '../../packages/core/sandbox.ts';
import { GenerationEngine } from '../../packages/core/generation.ts';
import { modelFor, KEYS } from '../../packages/core/config.ts';
import { AppError } from '../../packages/core/errors.ts';
const env=process.env;const id=randomUUID();const db=new Supabase(env);const sandbox=sandboxFor(env);const engine=new GenerationEngine(env,sandbox);
let stopping=false;let ready=false;let reasons:string[]=[];let running:string|null=null;let lastCheck=0;
async function check(){const missing:string[]=[];
  if(env.AXDIA_INTERNAL_USE_ACK!=='true')missing.push('AXDIA_INTERNAL_USE_NOT_CONFIRMED');
  for(const [root,file]of [['RECURSIVE_ROOT','recursive.py'],['BR360_ROOT','runtime/br360_engine.py']]){
    try{if(!env[root]||!isAbsolute(env[root]!))throw new Error();if(!(await stat(join(env[root]!,file))).isFile())throw new Error();}catch{missing.push(root+'_UNAVAILABLE');}
  }
  try{const m=modelFor(env,'CODE');if(!env[KEYS[m.provider]])missing.push('CODE_KEY_MISSING');}catch{missing.push('CODE_MODEL_MISSING');}
  try{await sandbox.inspect();}catch(e){missing.push(e instanceof AppError?e.code:'SANDBOX_NOT_AVAILABLE');}
  try{await new SupabaseStorage(env).ready();}catch{missing.push('PRIVATE_STORAGE_UNAVAILABLE');}
  ready=missing.length===0;reasons=missing;lastCheck=Date.now();
  try{await db.insert('worker_heartbeats',{id,ready,capabilities:{sandbox:env.SANDBOX_PROVIDER||'none',reasons},updated_at:new Date().toISOString()},true);}catch{ready=false;reasons.push('DATABASE_UNAVAILABLE');}
}
const server=createServer((req,res)=>{const path=(req.url||'').split('?')[0];const isReady=ready&&Date.now()-lastCheck<90000&&!stopping;
  if(!['/health','/ready'].includes(path)){res.writeHead(404);res.end();return;}
  res.writeHead(path==='/ready'&&!isReady?503:200,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify({service:'agentforge-worker',status:stopping?'stopping':'running',ready:isReady,reasons,running_job:running?true:false}));
});
server.listen(Number(env.WORKER_PORT||3001),env.WORKER_HOST||(env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1'));
const heartbeat=setInterval(()=>{db.insert('worker_heartbeats',{id,ready:ready&&!stopping,capabilities:{reasons},updated_at:new Date().toISOString()},true).catch(()=>{ready=false;});},30000);
async function loop(){while(!stopping){try{await check();if(ready){const job=await db.rpc('af_claim_job',{p_worker:id});if(job?.id){running=job.id;await engine.run(job);running=null;continue;}}}catch(e){ready=false;console.error(JSON.stringify({event:'worker_error',code:e instanceof AppError?e.code:'WORKER_ERROR'}));}await new Promise(resolve=>setTimeout(resolve,5000));}
clearInterval(heartbeat);await db.insert('worker_heartbeats',{id,ready:false,capabilities:{stopped:true},updated_at:new Date().toISOString()},true).catch(()=>undefined);server.close();}
process.on('SIGTERM',()=>{stopping=true;ready=false;});process.on('SIGINT',()=>{stopping=true;ready=false;});
console.log(JSON.stringify({event:'worker_started',id,external_checks:'pending'}));void loop();
