import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { request } from 'node:http';
import { salonIdea,salonAnswers } from '../fixtures/salon.ts';
let child:ReturnType<typeof spawn>;let base:string;
before(async()=>{const probe=createServer();await new Promise<void>(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=(probe.address() as any).port;await new Promise<void>(resolve=>probe.close(()=>resolve()));base='http://127.0.0.1:'+port;
child=spawn(process.execPath,['--experimental-strip-types','apps/web/server.ts'],{env:{PATH:process.env.PATH,NODE_ENV:'test',PORT:String(port),APP_URL:base,HOST:'127.0.0.1'},stdio:'pipe'});for(let i=0;i<60;i++){try{if((await fetch(base+'/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Local test server did not start.');});
after(()=>{child?.kill('SIGTERM');});
async function post(path:string,data:unknown,origin=base){return fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(data)});}
test('local HTTP: UI exists with CSP and no inline executable scripts',async()=>{const r=await fetch(base+'/');assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy')||'',/script-src 'self'/);const html=await r.text();assert.match(html,/Atelier local/);assert.ok(!/<script(?![^>]*src=)[^>]*>[^<]/.test(html));});
test('local HTTP: liveness is not readiness',async()=>{assert.equal((await fetch(base+'/health')).status,200);const r=await fetch(base+'/ready');assert.equal(r.status,503);const d=await r.json();assert.equal(d.ready,false);assert.ok(d.reasons.includes('SUPABASE_URL_MISSING'));});
test('local HTTP: private collection requires authentication',async()=>{for(const path of ['/api/projects','/api/jobs','/api/payments','/api/artifacts','/api/admin'])assert.equal((await fetch(base+path)).status,401);});
test('local HTTP: forged browser payment has no authority',async()=>{const r=await post('/api/checkout',{paid:true,plan_id:'not-a-plan'});assert.equal(r.status,401);});
test('local HTTP: CSRF rejected before request processing',async()=>{const r=await post('/api/local/start',{idea:'salon'},'https://evil.example');assert.equal(r.status,403);assert.equal((await r.json()).error,'CSRF_REJECTED');});
test('local HTTP: GET cannot mutate local project',async()=>assert.equal((await fetch(base+'/api/local/start')).status,405));
test('local HTTP: JSON required',async()=>{const r=await fetch(base+'/api/local/start',{method:'POST',headers:{Origin:base,'Content-Type':'text/plain'},body:'anything'});assert.equal(r.status,415);});
test('local HTTP: unknown field rejected',async()=>{const start=await (await post('/api/local/start',{idea:salonIdea})).json();const r=await post('/api/local/answer',{spec:start.spec,field:'admin',value:'true'});assert.equal(r.status,400);});
test('local HTTP: secret-looking input rejected',async()=>{const r=await post('/api/local/start',{idea:'My key '+'sk-'+'x'.repeat(40)});assert.equal(r.status,400);assert.equal((await r.json()).error,'SECRET_DETECTED');});
test('local HTTP salon: idea -> ten answers -> actual framing ZIP, never a paid delivery',async()=>{let d=await (await post('/api/local/start',{idea:salonIdea})).json();let count=0;while(d.question){const r=await post('/api/local/answer',{spec:d.spec,field:d.question.field,value:salonAnswers[d.question.field]});assert.equal(r.status,200);d=await r.json();count++;assert.ok(count<=10);}assert.equal(count,10);assert.equal(d.mode,'LOCAL_RULES_NO_AI');const zip=await post('/api/local/export',{spec:d.spec});assert.equal(zip.status,200);assert.equal(zip.headers.get('content-type'),'application/zip');const b=Buffer.from(await zip.arrayBuffer());assert.equal(b.readUInt32LE(0),0x04034b50);assert.match(zip.headers.get('x-artifact-sha256')||'',/^[a-f0-9]{64}$/);});
test('local HTTP: build progress is not fabricated when jobs absent',async()=>assert.equal((await fetch(base+'/api/jobs/11111111-1111-4111-8111-111111111111/events')).status,401));
test('local HTTP: body limit rejects before model calls',async()=>{const r=await post('/api/local/start',{idea:'x'.repeat(300001)});assert.equal(r.status,413);});

async function rawHost(path:string,host:string,method='GET'):Promise<number>{
 return new Promise((resolve,reject)=>{const req=request(base+path,{method,headers:{Host:host}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode||0));});req.on('error',reject);req.end();});
}
test('local HTTP: Railway probe host allowed only for read-only health endpoints',async()=>{
 assert.equal(await rawHost('/health','healthcheck.railway.app'),200);
 assert.equal(await rawHost('/ready','healthcheck.railway.app'),503);
 assert.equal(await rawHost('/api/config','healthcheck.railway.app'),403);
 assert.equal(await rawHost('/health','healthcheck.railway.app','POST'),403);
});
test('local HTTP: arbitrary host rejected even on health endpoint',async()=>{
 assert.equal(await rawHost('/health','evil.example'),403);
});
