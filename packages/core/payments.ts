import { AppError, invariant, object } from './errors.ts';
import { limitedFetch, verifyStripeSignature } from './security.ts';
import { required, appUrl } from './config.ts';
import type { Env } from './config.ts';
import { Supabase } from './database.ts';
export type Tier='starter'|'production'|'advanced';
export const tierLimits:Record<Tier,{repairs:number;defaultBudget:number}>={starter:{repairs:1,defaultBudget:2},production:{repairs:3,defaultBudget:5},advanced:{repairs:3,defaultBudget:10}};
export class StripePayments {
  env:Env;db:Supabase;constructor(env:Env){this.env=env;this.db=new Supabase(env);}
  async api(path:string,method='GET',form?:URLSearchParams,idempotency?:string):Promise<any>{
    invariant(/^\/[a-z0-9_/?=&[\]%-]+$/i.test(path),'INVALID_STRIPE_PATH','Chemin Stripe invalide.');
    const key=required(this.env,'STRIPE_SECRET_KEY');
    invariant(key.startsWith('sk_test_') || key.startsWith('sk_live_')&&this.env.ALLOW_LIVE_PAYMENTS==='true'&&this.env.RELEASE_APPROVED==='true',
      'LIVE_PAYMENTS_DISABLED','Les paiements réels sont désactivés.',503);
    const {response,body}=await limitedFetch('https://api.stripe.com/v1'+path,{method,headers:{Authorization:`Bearer ${key}`,
      'Content-Type':'application/x-www-form-urlencoded',...(idempotency?{'Idempotency-Key':idempotency}:{})},...(form?{body:form.toString()}:{})},2_000_000);
    invariant(response.ok,'STRIPE_UNAVAILABLE',`Opération Stripe refusée (${response.status}).`,502);return JSON.parse(body);
  }
  async price(tier:Tier):Promise<{id:string;amount:number;currency:string;livemode:boolean}>{
    invariant(tier in tierLimits,'INVALID_TIER','Offre inconnue.');const id=required(this.env,'STRIPE_PRICE_'+tier.toUpperCase());
    invariant(/^price_[a-zA-Z0-9]+$/.test(id),'INVALID_PRICE','Identifiant Stripe Price invalide.');
    const p=await this.api('/prices/'+id);
    invariant(p.active&&p.type==='one_time'&&Number.isInteger(p.unit_amount)&&p.unit_amount>0&&p.currency,'INVALID_PRICE','Prix ponctuel actif requis.',503);
    invariant(p.livemode===(this.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')??false),'STRIPE_MODE_MISMATCH','Mode Stripe incohérent.',503);
    return {id:p.id,amount:p.unit_amount,currency:p.currency,livemode:p.livemode};
  }
  async checkout(owner:string,planId:string,tier:Tier,key:string):Promise<{url:string;payment_id:string}>{
    const price=await this.price(tier);
    const payment=await this.db.rpc('af_create_payment',{p_owner:owner,p_plan:planId,p_tier:tier,p_key:key,p_price:price.id,p_amount:price.amount,p_currency:price.currency,p_live:price.livemode});
    invariant(payment.status==='PENDING','PAYMENT_ALREADY_HANDLED','Ce paiement est déjà traité.',409);
    let session:any;
    if(payment.checkout_session_id)session=await this.api('/checkout/sessions/'+payment.checkout_session_id);
    else{
      const base=appUrl(this.env).origin;const form=new URLSearchParams({mode:'payment',
        'line_items[0][price]':payment.stripe_price_id,'line_items[0][quantity]':'1',
        'success_url':base+'/?checkout=return','cancel_url':base+'/?checkout=cancelled',
        client_reference_id:payment.id,'metadata[payment_id]':payment.id,'payment_intent_data[metadata][payment_id]':payment.id});
      if(this.env.STRIPE_AUTOMATIC_TAX==='true')form.set('automatic_tax[enabled]','true');
      session=await this.api('/checkout/sessions','POST',form,'agentforge-checkout-'+payment.id);
      await this.db.rpc('af_link_checkout',{p_payment:payment.id,p_session:session.id});
    }
    const u=new URL(session.url||'https://invalid.invalid');invariant(u.protocol==='https:'&&u.hostname==='checkout.stripe.com','CHECKOUT_EXPIRED','Session expirée ou invalide.',409);
    return {url:u.href,payment_id:payment.id};
  }
  async webhook(raw:Buffer,signature:string):Promise<{received:true;action:string}>{
    verifyStripeSignature(raw,signature,required(this.env,'STRIPE_WEBHOOK_SECRET'));
    const e=object(JSON.parse(raw.toString('utf8'))) as Record<string,any>;
    invariant(typeof e.id==='string'&&/^evt_[a-zA-Z0-9]+$/.test(e.id),'INVALID_EVENT','Événement invalide.');
    const live=this.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')??false;
    invariant(e.livemode===live,'STRIPE_MODE_MISMATCH','Événement du mauvais environnement.');
    if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(e.type)){
      const id=e.data?.object?.id;invariant(typeof id==='string'&&/^cs_[a-zA-Z0-9_]+$/.test(id),'INVALID_SESSION','Session invalide.');
      // Signature + canonical API lookup. The browser redirect never grants an entitlement.
      const s=await this.api('/checkout/sessions/'+id);
      if(s.payment_status!=='paid')return {received:true,action:'WAITING_PAYMENT'};
      invariant(s.mode==='payment'&&s.client_reference_id===s.metadata?.payment_id&&typeof s.payment_intent==='string','INVALID_SESSION','Métadonnées incohérentes.');
      const entitlement=await this.db.rpc('af_fulfill_payment',{p_event:e.id,p_type:e.type,p_payment:s.metadata.payment_id,p_session:s.id,
        p_intent:s.payment_intent,p_amount:s.amount_subtotal,p_currency:s.currency,p_live:s.livemode});
      if(entitlement){
        const rows=await this.db.select('entitlements',{id:'eq.'+entitlement,select:'owner_id'});
        await this.db.rpc('af_queue_generation',{p_owner:rows[0].owner_id,p_entitlement:entitlement,p_key:'payment:'+s.id});
      }
      return {received:true,action:'FULFILLED_OR_ALREADY_PROCESSED'};
    }
    if(e.type==='charge.refunded'){
      const id=e.data?.object?.id;invariant(typeof id==='string'&&/^ch_[a-zA-Z0-9]+$/.test(id),'INVALID_CHARGE','Charge invalide.');
      const charge=await this.api('/charges/'+id);
      if(charge.amount_refunded>0&&typeof charge.payment_intent==='string')await this.db.rpc('af_refund',{p_event:e.id,p_intent:charge.payment_intent});
      return {received:true,action:'ACCESS_REVOKED_ON_REFUND'};
    }
    if(['checkout.session.async_payment_failed','checkout.session.expired','payment_intent.payment_failed'].includes(e.type)){
      // No entitlement is granted. A failed checkout may be reconciled by an administrator; do not relabel a later success.
      await this.db.insert('webhook_events',{id:e.id,type:e.type},true);return {received:true,action:'NO_ENTITLEMENT_GRANTED'};
    }
    return {received:true,action:'IGNORED'};
  }
}
