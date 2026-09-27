begin;
create extension if not exists pgcrypto;
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text, created_at timestamptz not null default now());
create table public.projects (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), name text not null,
 status text not null default 'CLARIFYING', revision integer not null default 1, spec jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,owner_id)
);
create table public.project_specs (id uuid primary key default gen_random_uuid(),project_id uuid not null,owner_id uuid not null,revision integer not null,spec jsonb not null,created_at timestamptz not null default now(), foreign key(project_id,owner_id) references public.projects(id,owner_id),unique(project_id,revision));
create table public.interview_messages (id uuid primary key default gen_random_uuid(),project_id uuid not null,owner_id uuid not null,role text not null check(role in('user','assistant')),content text not null,created_at timestamptz not null default now(),foreign key(project_id,owner_id) references public.projects(id,owner_id));
create table public.build_plans (id uuid primary key,project_id uuid not null,owner_id uuid not null,revision integer not null,plan_hash text not null,plan jsonb not null,created_at timestamptz not null default now(),foreign key(project_id,owner_id) references public.projects(id,owner_id),unique(id,owner_id));
create table public.payments (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null,project_id uuid not null,plan_id uuid not null,
 tier text not null check(tier in('starter','production','advanced')),request_key text not null, stripe_price_id text not null,
 amount_snapshot bigint not null check(amount_snapshot>0), currency text not null,checkout_session_id text unique,payment_intent_id text,
 status text not null default 'PENDING' check(status in('PENDING','PAID','FAILED','REFUNDED','REVIEW_REQUIRED')),livemode boolean not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(project_id,owner_id) references public.projects(id,owner_id),foreign key(plan_id,owner_id) references public.build_plans(id,owner_id),unique(owner_id,request_key)
);
create unique index one_active_payment_per_plan on public.payments(plan_id) where status in('PENDING','PAID');
create table public.entitlements (id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),payment_id uuid not null unique references public.payments(id),plan_id uuid not null,
 status text not null default 'AVAILABLE' check(status in('AVAILABLE','RESERVED','CONSUMED','REVOKED')),created_at timestamptz not null default now(),foreign key(plan_id,owner_id) references public.build_plans(id,owner_id));
create table public.generation_jobs (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),project_id uuid not null,
 plan_id uuid not null,entitlement_id uuid not null unique references public.entitlements(id),request_key text not null,status text not null default 'QUEUED',
 fence uuid,lease_until timestamptz,worker_id uuid,attempts integer not null default 0,stage text not null default 'QUEUED',error_code text,
 budget_usd numeric(14,6) not null check(budget_usd>0),spent_usd numeric(14,6) not null default 0,reserved_usd numeric(14,6) not null default 0,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(plan_id,owner_id) references public.build_plans(id,owner_id),foreign key(project_id,owner_id) references public.projects(id,owner_id),unique(owner_id,request_key),unique(id,owner_id)
);
create table public.generation_events (id bigint generated always as identity primary key,owner_id uuid not null,job_id uuid not null,type text not null,data jsonb not null default '{}',created_at timestamptz not null default now(),foreign key(job_id,owner_id) references public.generation_jobs(id,owner_id));
create table public.artifacts (id uuid primary key default gen_random_uuid(),owner_id uuid not null,job_id uuid not null unique,storage_key text not null unique,sha256 text not null,size_bytes bigint not null check(size_bytes>0),manifest jsonb not null,reports jsonb not null,visibility text not null default 'private' check(visibility='private'),created_at timestamptz not null default now(),expires_at timestamptz not null default(now()+interval '30 days'),foreign key(job_id,owner_id) references public.generation_jobs(id,owner_id));
create table public.audit_runs(id uuid primary key default gen_random_uuid(),owner_id uuid not null,job_id uuid not null,tool text not null,report jsonb not null,created_at timestamptz not null default now(),foreign key(job_id,owner_id) references public.generation_jobs(id,owner_id));
create table public.download_events(id bigint generated always as identity primary key,owner_id uuid not null references auth.users(id),artifact_id uuid not null references public.artifacts(id),created_at timestamptz not null default now());
create table public.framework_sources(id text primary key,data jsonb not null,updated_at timestamptz not null default now());
create table public.skill_sources(id text primary key,data jsonb not null,updated_at timestamptz not null default now());
create table public.source_provenance(id uuid primary key default gen_random_uuid(),owner_id uuid not null,project_id uuid not null,data jsonb not null,created_at timestamptz not null default now(),foreign key(project_id,owner_id) references public.projects(id,owner_id));
create table public.model_catalog(id text primary key,provider text not null,model_id text not null,enabled boolean not null default true,data jsonb not null default '{}',updated_at timestamptz not null default now());
create table public.webhook_events(id text primary key,type text not null,created_at timestamptz not null default now());
create table public.refund_tombstones(payment_intent_id text primary key,created_at timestamptz not null default now());
create table public.worker_heartbeats(id uuid primary key,ready boolean not null default false,capabilities jsonb not null default '{}',updated_at timestamptz not null default now());
create table public.rate_limits(key text primary key,count integer not null,reset_at timestamptz not null);
create table public.cost_ledger(id uuid primary key,owner_id uuid not null,job_id uuid not null,phase text not null,provider text not null,model text not null,reserved_usd numeric(14,6) not null,charged_usd numeric(14,6),usage jsonb,created_at timestamptz not null default now(),foreign key(job_id,owner_id) references public.generation_jobs(id,owner_id));
create table public.preview_costs(owner_id uuid not null references auth.users(id),day date not null,reserved_usd numeric(14,6) not null default 0,primary key(owner_id,day));
create index on public.generation_jobs(status,created_at);
create index on public.generation_events(job_id,id);
create index on public.payments(payment_intent_id);
create index on public.projects(owner_id,created_at desc);

-- Users can read only their own records. ALL writes below require the server-only service role.
do $$ declare t text; begin
 foreach t in array array['projects','project_specs','interview_messages','build_plans','payments','entitlements','generation_jobs','generation_events','artifacts','audit_runs','download_events','source_provenance','cost_ledger'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid()) = owner_id)',t);
   execute format('revoke all on public.%I from anon, authenticated',t);
   execute format('grant select on public.%I to authenticated',t);
 end loop;
 foreach t in array array['framework_sources','skill_sources','model_catalog','webhook_events','refund_tombstones','worker_heartbeats','rate_limits','preview_costs'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
alter table public.profiles enable row level security;
create policy own_profile on public.profiles for select to authenticated using((select auth.uid())=id);
revoke all on public.profiles from anon,authenticated;
grant select on public.profiles to authenticated;

create function public.af_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer; begin
 if p_limit<1 or p_seconds<1 then raise exception 'INVALID_LIMIT';end if;
 insert into rate_limits(key,count,reset_at) values(p_key,1,now()+make_interval(secs=>p_seconds))
 on conflict(key) do update set count=case when rate_limits.reset_at<=now() then 1 else rate_limits.count+1 end,
 reset_at=case when rate_limits.reset_at<=now() then now()+make_interval(secs=>p_seconds) else rate_limits.reset_at end returning count into n;
 return n<=p_limit;
end $$;
create function public.af_reserve_preview(p_owner uuid,p_amount numeric) returns numeric language plpgsql security definer set search_path=public,pg_temp as $$
declare spent numeric;begin
 if p_amount is null or p_amount<0 or p_amount>0.05 then raise exception 'PREVIEW_BUDGET';end if;
 insert into preview_costs(owner_id,day)values(p_owner,(now() at time zone 'UTC')::date)on conflict do nothing;
 select reserved_usd into spent from preview_costs where owner_id=p_owner and day=(now() at time zone 'UTC')::date for update;
 if spent+p_amount>0.5 then raise exception 'PREVIEW_DAILY_BUDGET';end if;
 update preview_costs set reserved_usd=reserved_usd+p_amount where owner_id=p_owner and day=(now() at time zone 'UTC')::date;
 return spent+p_amount;
end $$;
create function public.af_create_project(p_owner uuid,p_spec jsonb) returns public.projects language plpgsql security definer set search_path=public,pg_temp as $$
declare p projects; begin
 if p_spec->>'schema_version'<>'1.0.0' or (p_spec->>'revision')::int<>1 then raise exception 'INVALID_SPEC';end if;
 insert into projects(owner_id,name,spec) values(p_owner,p_spec->>'project_name',p_spec) returning * into p;
 insert into project_specs(project_id,owner_id,revision,spec)values(p.id,p_owner,1,p_spec);
 insert into interview_messages(project_id,owner_id,role,content)values(p.id,p_owner,'user',p_spec->'fields'->'objective'->>'value');return p;
end $$;
create function public.af_update_spec(p_owner uuid,p_project uuid,p_revision integer,p_spec jsonb,p_message text) returns public.projects language plpgsql security definer set search_path=public,pg_temp as $$
declare p projects;begin
 select * into p from projects where id=p_project and owner_id=p_owner for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if p.revision<>p_revision or p.status not in('CLARIFYING','SPEC_READY','ARCHITECTURE_READY','QUOTE_READY') then raise exception 'REVISION_CONFLICT';end if;
 if (p_spec->>'revision')::int<>p_revision+1 then raise exception 'INVALID_REVISION';end if;
 update projects set spec=p_spec,revision=p_revision+1,status='CLARIFYING',updated_at=now() where id=p_project returning * into p;
 insert into project_specs(project_id,owner_id,revision,spec)values(p_project,p_owner,p.revision,p_spec);
 insert into interview_messages(project_id,owner_id,role,content)values(p_project,p_owner,'user',left(p_message,8000));return p;
end $$;
create function public.af_save_plan(p_owner uuid,p_project uuid,p_revision integer,p_plan jsonb) returns public.build_plans language plpgsql security definer set search_path=public,pg_temp as $$
declare p projects;b build_plans;begin
 select * into p from projects where id=p_project and owner_id=p_owner for update;
 if not found or p.revision<>p_revision or p.status not in('CLARIFYING','SPEC_READY','ARCHITECTURE_READY','QUOTE_READY') then raise exception 'REVISION_CONFLICT';end if;
 insert into build_plans(id,project_id,owner_id,revision,plan_hash,plan)values((p_plan->>'id')::uuid,p_project,p_owner,p_revision,p_plan->>'hash',p_plan) returning * into b;
 update projects set status='QUOTE_READY',updated_at=now() where id=p_project;
 insert into source_provenance(owner_id,project_id,data)values(p_owner,p_project,p_plan->'source');return b;
end $$;
create function public.af_create_payment(p_owner uuid,p_plan uuid,p_tier text,p_key text,p_price text,p_amount bigint,p_currency text,p_live boolean) returns public.payments language plpgsql security definer set search_path=public,pg_temp as $$
declare b build_plans;p projects;r payments;begin
 select * into b from build_plans where id=p_plan and owner_id=p_owner;
 if not found then raise exception 'NOT_FOUND';end if;
 if b.plan->>'tier'<>p_tier or b.plan->'quote'->>'id'<>p_price or (b.plan->'quote'->>'amount')::bigint<>p_amount or b.plan->'quote'->>'currency'<>p_currency then raise exception 'QUOTE_MISMATCH';end if;
 select * into p from projects where id=b.project_id for update;
 select * into r from payments where owner_id=p_owner and request_key=p_key;
 if found then if r.plan_id<>p_plan then raise exception 'IDEMPOTENCY_CONFLICT';end if;return r;end if;
 select * into r from payments where plan_id=p_plan and status in('PENDING','PAID');if found then return r;end if;
 if p.revision<>b.revision or p.status<>'QUOTE_READY' then raise exception 'PLAN_EXPIRED';end if;
 insert into payments(owner_id,project_id,plan_id,tier,request_key,stripe_price_id,amount_snapshot,currency,livemode)
 values(p_owner,p.id,p_plan,p_tier,p_key,p_price,p_amount,p_currency,p_live) returning * into r;
 update projects set status='PAYMENT_REQUIRED',updated_at=now() where id=p.id;return r;
end $$;
create function public.af_link_checkout(p_payment uuid,p_session text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin update payments set checkout_session_id=p_session where id=p_payment and (checkout_session_id is null or checkout_session_id=p_session);if not found then raise exception 'CHECKOUT_CONFLICT';end if;end $$;
create function public.af_fulfill_payment(p_event text,p_type text,p_payment uuid,p_session text,p_intent text,p_amount bigint,p_currency text,p_live boolean) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare p payments;e uuid;n integer;begin
 select * into p from payments where id=p_payment for update;if not found then raise exception 'PAYMENT_UNKNOWN';end if;
 if p.amount_snapshot<>p_amount or p.currency<>p_currency or p.livemode<>p_live or (p.checkout_session_id is not null and p.checkout_session_id<>p_session) then raise exception 'PAYMENT_MISMATCH';end if;
 insert into webhook_events(id,type) values(p_event,p_type) on conflict do nothing;get diagnostics n=row_count;
 if n=0 then select x.id into e from entitlements x where x.payment_id=p.id and x.status<>'REVOKED' and p.status='PAID';return e;end if;
 if p.status in('REFUNDED','REVIEW_REQUIRED') or exists(select 1 from refund_tombstones where payment_intent_id=p_intent) then
   update payments set status='REFUNDED',payment_intent_id=p_intent,checkout_session_id=p_session where id=p.id;return null;end if;
 update payments set status='PAID',checkout_session_id=p_session,payment_intent_id=p_intent,updated_at=now() where id=p.id;
 insert into entitlements(owner_id,payment_id,plan_id)values(p.owner_id,p.id,p.plan_id)on conflict(payment_id)do nothing;
 select id into e from entitlements where payment_id=p.id;
 update projects set status='PAID',updated_at=now() where id=p.project_id and status='PAYMENT_REQUIRED';return e;
end $$;
create function public.af_refund(p_event text,p_intent text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into webhook_events(id,type)values(p_event,'charge.refunded')on conflict do nothing;
 insert into refund_tombstones(payment_intent_id)values(p_intent)on conflict do nothing;
 update payments set status='REFUNDED',updated_at=now() where payment_intent_id=p_intent;
 update entitlements set status='REVOKED' where payment_id in(select id from payments where payment_intent_id=p_intent);
 update generation_jobs set status='REFUNDED',fence=null,lease_until=null,updated_at=now() where entitlement_id in(select id from entitlements where payment_id in(select id from payments where payment_intent_id=p_intent));
 update projects set status='REFUNDED',updated_at=now() where id in(select project_id from payments where payment_intent_id=p_intent);
end $$;
create function public.af_queue_generation(p_owner uuid,p_entitlement uuid,p_key text) returns public.generation_jobs language plpgsql security definer set search_path=public,pg_temp as $$
declare e entitlements;b build_plans;j generation_jobs;begin
 select * into e from entitlements where id=p_entitlement and owner_id=p_owner for update;if not found then raise exception 'ENTITLEMENT_UNKNOWN';end if;
 select * into j from generation_jobs where entitlement_id=e.id;if found then return j;end if;
 if e.status<>'AVAILABLE' or not exists(select 1 from payments where id=e.payment_id and status='PAID') then raise exception 'ENTITLEMENT_UNAVAILABLE';end if;
 select * into b from build_plans where id=e.plan_id;
 insert into generation_jobs(owner_id,project_id,plan_id,entitlement_id,request_key,budget_usd)values(p_owner,b.project_id,b.id,e.id,p_key,(b.plan->'limits'->>'budget_usd')::numeric) returning * into j;
 update entitlements set status='RESERVED' where id=e.id;update projects set status='QUEUED',updated_at=now()where id=b.project_id;
 insert into generation_events(owner_id,job_id,type)values(p_owner,j.id,'job_created');return j;
end $$;
create function public.af_claim_job(p_worker uuid) returns public.generation_jobs language plpgsql security definer set search_path=public,pg_temp as $$
declare j generation_jobs;begin
 -- Expired attempts are blocked, not automatically replayed. Earlier AI reservations remain charged conservatively.
 update generation_jobs set status='BLOCKED',error_code='WORKER_LEASE_EXPIRED',fence=null,updated_at=now() where status in('RESEARCHING','GENERATING','VERIFYING','REPAIRING','PACKAGING') and lease_until<now();
 select * into j from generation_jobs where status='QUEUED' order by created_at for update skip locked limit 1;
 if not found then return null;end if;
 update generation_jobs set status='RESEARCHING',stage='RESEARCHING',fence=gen_random_uuid(),lease_until=now()+interval '5 minutes',worker_id=p_worker,attempts=attempts+1,updated_at=now()where id=j.id returning * into j;return j;
end $$;
create function public.af_heartbeat_job(p_job uuid,p_fence uuid) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin update generation_jobs set lease_until=now()+interval '5 minutes',updated_at=now() where id=p_job and fence=p_fence and lease_until>now() and status in('RESEARCHING','GENERATING','VERIFYING','REPAIRING','PACKAGING');return found;end $$;
create function public.af_job_event(p_job uuid,p_fence uuid,p_stage text,p_type text,p_data jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare j generation_jobs;begin
 select * into j from generation_jobs where id=p_job and fence=p_fence and lease_until>now() for update;if not found then raise exception 'LEASE_LOST';end if;
 if not ((j.status='RESEARCHING' and p_stage in('RESEARCHING','GENERATING')) or (j.status='GENERATING' and p_stage in('GENERATING','VERIFYING')) or
 (j.status='VERIFYING' and p_stage in('VERIFYING','REPAIRING','PACKAGING')) or (j.status='REPAIRING' and p_stage in('REPAIRING','VERIFYING')) or (j.status='PACKAGING' and p_stage='PACKAGING')) then raise exception 'INVALID_TRANSITION';end if;
 update generation_jobs set status=p_stage,stage=p_stage,updated_at=now()where id=j.id;
 update projects set status=p_stage,updated_at=now()where id=j.project_id;
 insert into generation_events(owner_id,job_id,type,data)values(j.owner_id,j.id,p_type,p_data);
end $$;
create function public.af_reserve_cost(p_job uuid,p_fence uuid,p_id uuid,p_amount numeric,p_phase text,p_provider text,p_model text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare j generation_jobs;begin
 select * into j from generation_jobs where id=p_job and fence=p_fence and lease_until>now() for update;
 if not found then raise exception 'LEASE_LOST';end if;
 if exists(select 1 from cost_ledger where id=p_id) then raise exception 'RESERVATION_ALREADY_EXISTS';end if;
 if p_amount<0 or j.spent_usd+j.reserved_usd+p_amount>j.budget_usd then raise exception 'BUDGET_BLOCKED';end if;
 insert into cost_ledger(id,owner_id,job_id,phase,provider,model,reserved_usd)values(p_id,j.owner_id,p_job,p_phase,p_provider,p_model,p_amount);
 update generation_jobs set reserved_usd=reserved_usd+p_amount where id=j.id;
end $$;
create function public.af_settle_cost(p_id uuid,p_amount numeric,p_usage jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c cost_ledger;a numeric;begin
 select * into c from cost_ledger where id=p_id for update;if not found or c.charged_usd is not null then return;end if;
 -- On ambiguous failures charge the full reservation; never silently release a possibly billable call.
 a=greatest(0,coalesce(p_amount,c.reserved_usd));
 update cost_ledger set charged_usd=a,usage=p_usage where id=p_id;
 update generation_jobs set reserved_usd=reserved_usd-c.reserved_usd,spent_usd=spent_usd+a where id=c.job_id;
end $$;
create function public.af_fail_job(p_job uuid,p_fence uuid,p_code text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare j generation_jobs;begin
 select * into j from generation_jobs where id=p_job and fence=p_fence for update;if not found then return;end if;
 update generation_jobs set status='BLOCKED',error_code=p_code,fence=null,lease_until=null,updated_at=now()where id=p_job;
 update projects set status='BLOCKED',updated_at=now()where id=j.project_id;
 insert into generation_events(owner_id,job_id,type,data)values(j.owner_id,j.id,'blocked',jsonb_build_object('code',p_code));
end $$;
create function public.af_retry_job(p_owner uuid,p_job uuid) returns public.generation_jobs language plpgsql security definer set search_path=public,pg_temp as $$
declare j generation_jobs;begin
 select * into j from generation_jobs where id=p_job and owner_id=p_owner for update;
 if not found or j.status not in('BLOCKED','FAILED') then raise exception 'RETRY_UNAVAILABLE';end if;
 if j.spent_usd+j.reserved_usd>=j.budget_usd then raise exception 'BUDGET_BLOCKED';end if;
 if not exists(select 1 from entitlements e join payments p on p.id=e.payment_id where e.id=j.entitlement_id and e.status='RESERVED' and p.status='PAID') then raise exception 'PAYMENT_REQUIRED';end if;
 update generation_jobs set status='QUEUED',error_code=null,fence=null,lease_until=null,updated_at=now()where id=p_job returning * into j;return j;
end $$;
create function public.af_finish_job(p_job uuid,p_fence uuid,p_key text,p_sha text,p_size bigint,p_manifest jsonb,p_reports jsonb) returns public.artifacts language plpgsql security definer set search_path=public,pg_temp as $$
declare j generation_jobs;a artifacts;t text;begin
 select * into j from generation_jobs where id=p_job and fence=p_fence and lease_until>now() and status='PACKAGING' for update;if not found then raise exception 'LEASE_LOST';end if;
 if j.spent_usd+j.reserved_usd>j.budget_usd then raise exception 'BUDGET_BLOCKED';end if;
 if not exists(select 1 from entitlements e join payments p on p.id=e.payment_id where e.id=j.entitlement_id and e.status='RESERVED' and p.status='PAID')then raise exception 'PAYMENT_REVOKED';end if;
 foreach t in array array['static','sandbox','recursive','br360'] loop
   if (select count(*) from jsonb_array_elements(p_reports)r where r->>'tool'=t)<>1 or not exists(select 1 from jsonb_array_elements(p_reports)r where r->>'tool'=t and r->>'status'='PASS' and r->>'executed_at' is not null and jsonb_array_length(r->'evidence')>0) then raise exception 'RELEASE_GATE_BLOCKED';end if;
 end loop;
 insert into artifacts(owner_id,job_id,storage_key,sha256,size_bytes,manifest,reports)values(j.owner_id,j.id,p_key,p_sha,p_size,p_manifest,p_reports) returning * into a;
 insert into audit_runs(owner_id,job_id,tool,report)select j.owner_id,j.id,r->>'tool',r from jsonb_array_elements(p_reports)r;
 update generation_jobs set status='COMPLETED',stage='COMPLETED',fence=null,lease_until=null,updated_at=now()where id=j.id;
 update entitlements set status='CONSUMED'where id=j.entitlement_id;update projects set status='COMPLETED',updated_at=now()where id=j.project_id;
 insert into generation_events(owner_id,job_id,type,data)values(j.owner_id,j.id,'completed',jsonb_build_object('artifact_id',a.id,'sha256',p_sha));return a;
end $$;
create function public.af_download(p_owner uuid,p_artifact uuid) returns public.artifacts language plpgsql security definer set search_path=public,pg_temp as $$
declare a artifacts;begin
 select x.* into a from artifacts x join generation_jobs j on j.id=x.job_id join entitlements e on e.id=j.entitlement_id join payments p on p.id=e.payment_id
 where x.id=p_artifact and x.owner_id=p_owner and x.expires_at>now() and j.status='COMPLETED' and e.status='CONSUMED' and p.status='PAID';
 if not found then raise exception 'DOWNLOAD_UNAVAILABLE';end if;
 insert into download_events(owner_id,artifact_id)values(p_owner,a.id);return a;
end $$;

-- Default PostgreSQL function EXECUTE privileges must not expose service operations to clients.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'af\_%' escape '\' loop
   execute format('revoke all on function %s from public, anon, authenticated',f.sig);
   execute format('grant execute on function %s to service_role',f.sig);
 end loop;
end $$;
do $$ declare t text; begin
 foreach t in array array['profiles','projects','project_specs','interview_messages','build_plans','payments','entitlements','generation_jobs','generation_events','artifacts','audit_runs','download_events','framework_sources','skill_sources','source_provenance','model_catalog','webhook_events','refund_tombstones','worker_heartbeats','rate_limits','cost_ledger','preview_costs'] loop
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant usage,select on sequence public.generation_events_id_seq,public.download_events_id_seq to service_role;
commit;
