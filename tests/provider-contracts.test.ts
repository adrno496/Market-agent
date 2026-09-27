import test from 'node:test';import assert from 'node:assert/strict';
import { HTTPModelProvider } from '../packages/core/providers.ts';
import type { ProviderName } from '../packages/core/config.ts';
import { KEYS } from '../packages/core/config.ts';
import { StripePayments } from '../packages/core/payments.ts';
import { createHmac } from 'node:crypto';
const env={OPENROUTER_API_KEY:'test-only',OPENAI_API_KEY:'test-only',ANTHROPIC_API_KEY:'test-only',MISTRAL_API_KEY:'test-only',GOOGLE_GENERATIVE_AI_API_KEY:'test-only'};
for(const provider of ['openrouter','openai','anthropic','mistral','google'] as ProviderName[])test('HTTP adapter contract with fixture only: '+provider,async()=>{
const original=globalThis.fetch;let called=false;globalThis.fetch=(async(url:any,init:any)=>{called=true;assert.equal(init.redirect,'error');assert.equal(init.method,'POST');const body=JSON.parse(init.body);assert.ok(JSON.stringify(body).includes('test-model')||String(url).includes('test-model'));
if(provider==='openai'){assert.equal(body.store,false);assert.ok(String(url).endsWith('/responses'));return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:'{"files":{}}'}]}],usage:{input_tokens:2,output_tokens:3}}));}
if(provider==='anthropic'){assert.equal(init.headers['x-api-key'],'test-only');return new Response(JSON.stringify({content:[{type:'text',text:'{"files":{}}'}],usage:{input_tokens:2,output_tokens:3}}));}
if(provider==='google'){assert.equal(init.headers['x-goog-api-key'],'test-only');return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"files":{}}'}]}}],usageMetadata:{promptTokenCount:2,candidatesTokenCount:3}}));}
return new Response(JSON.stringify({choices:[{message:{content:'{"files":{}}'}}],usage:{prompt_tokens:2,completion_tokens:3,cost:0.01}}));})as any;
try{const p=new HTTPModelProvider(provider,env);const r=await p.generate({model:'test-model',prompt:'test input',system:'JSON required',maxOutputTokens:200});assert.equal(r.text,'{"files":{}}');assert.equal(r.inputTokens,2);assert.equal(r.outputTokens,3);assert.equal(called,true);}finally{globalThis.fetch=original;}});
test('provider missing keys fails without HTTP',async()=>{await assert.rejects(()=>new HTTPModelProvider('openai',{}).generate({model:'test-model',prompt:'test',system:'json',maxOutputTokens:50}),{code:'CONFIGURATION_REQUIRED'});});
test('Stripe browser does not supply entitlement or price: missing configuration blocks',async()=>{await assert.rejects(()=>new StripePayments({}).price('production'),{code:'CONFIGURATION_REQUIRED'});});
test('Stripe live mode explicitly locked by default',async()=>{await assert.rejects(()=>new StripePayments({STRIPE_SECRET_KEY:'sk_live_'+'synthetic'}).api('/prices/price_example'),{code:'LIVE_PAYMENTS_DISABLED'});});
test('Stripe unsigned webhook rejected before database writes',async()=>{await assert.rejects(()=>new StripePayments({STRIPE_WEBHOOK_SECRET:'test-secret-not-a-real-credential'}).webhook(Buffer.from('{}'),''),{code:'INVALID_SIGNATURE'});});
test('Stripe unconfigured signature key cannot silently authorize a webhook',async()=>{await assert.rejects(()=>new StripePayments({}).webhook(Buffer.from('{}'),''),{code:'CONFIGURATION_REQUIRED'});});
