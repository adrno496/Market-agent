import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { modelFor, KEYS } from '../packages/core/config.ts';
const env=process.env;const checks:any[]=[];checks.push({check:'node',status:Number(process.versions.node.split('.')[0])>=22?'PASS':'BLOCK',version:process.version});
checks.push({check:'local_source',status:existsSync('apps/web/server.ts')?'PASS':'BLOCK'});
const docker=spawnSync('docker',['version','--format','{{.Server.Version}}'],{encoding:'utf8',timeout:10000});checks.push({check:'docker',status:docker.status===0?'PASS':'NOT_AVAILABLE',version:docker.status===0?docker.stdout.trim():null});
for(const key of ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','SANDBOX_IMAGE','RECURSIVE_ROOT','BR360_ROOT'])checks.push({check:key,status:env[key]?'CONFIGURED_NOT_VERIFIED':'NOT_AVAILABLE'});
try{const m=modelFor(env,'CODE');checks.push({check:'code_model',status:env[KEYS[m.provider]]?'CONFIGURED_NOT_VERIFIED':'NOT_AVAILABLE',provider:m.provider,model:m.model});}catch{checks.push({check:'code_model',status:'NOT_AVAILABLE'});}
console.log(JSON.stringify({scope:'local_configuration_only',production_ready:false,checks},null,2));
