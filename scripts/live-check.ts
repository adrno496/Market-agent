import { writeFile, mkdir } from 'node:fs/promises';
import { HTTPModelProvider } from '../packages/core/providers.ts';
import { providerName } from '../packages/core/config.ts';
import { Supabase, SupabaseStorage } from '../packages/core/database.ts';
import { StripePayments } from '../packages/core/payments.ts';
import { sandboxFor } from '../packages/core/sandbox.ts';
const checks:any[]=[];
async function check(name:string,fn:()=>Promise<unknown>){try{await fn();checks.push({check:name,status:'PASS',scope:'connectivity_only'});}catch(e:any){checks.push({check:name,status:'BLOCK',code:e.code||'UNAVAILABLE'});}}
if(process.env.RUN_LIVE_CHECKS!=='true'){console.log(JSON.stringify({status:'NOT_AVAILABLE',reason:'Explicit RUN_LIVE_CHECKS=true is required. No call was made.'}));process.exit(2);}
if(!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))throw new Error('Only Stripe test mode is accepted.');
const db=new Supabase(process.env);
await check('Supabase API',()=>db.select('projects',{select:'id',limit:'1'}));
await check('private bucket',()=>new SupabaseStorage(process.env).ready());
await check('model catalog',()=>new HTTPModelProvider(providerName(process.env.AI_DEFAULT_PROVIDER),process.env).listModels());
await check('Stripe test price',()=>new StripePayments(process.env).price('production'));
await check('sandbox image',()=>sandboxFor(process.env).inspect());
await mkdir('reports',{recursive:true});await writeFile('reports/LIVE_CONNECTIVITY_REPORT.json',JSON.stringify({scope:'CONNECTIVITY_ONLY_NOT_END_TO_END',checks},null,2));console.log(JSON.stringify(checks,null,2));process.exitCode=checks.every(x=>x.status==='PASS')?0:1;
