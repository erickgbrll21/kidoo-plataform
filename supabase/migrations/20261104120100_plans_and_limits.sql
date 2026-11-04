-- =============================================================================
-- KIDOO HUB — Fase 2: planos, assinaturas (sem cobrança) e limites centralizados.
-- Limites com valor NULL significam "sem limite".
-- Nenhum dado de cobrança é simulado: campos de gateway ficam nulos até a Fase 9.
-- =============================================================================

create table public.plans (
  key                  text primary key check (key ~ '^[a-z][a-z0-9_]{1,29}$'),
  name                 text not null,
  description          text not null default '',
  max_whatsapp_numbers integer check (max_whatsapp_numbers is null or max_whatsapp_numbers >= 0),
  max_members          integer check (max_members is null or max_members >= 1),
  max_ai_agents        integer check (max_ai_agents is null or max_ai_agents >= 0),
  max_automation_flows integer check (max_automation_flows is null or max_automation_flows >= 0),
  max_monthly_ai_messages integer check (max_monthly_ai_messages is null or max_monthly_ai_messages >= 0),
  features             jsonb not null default '{}'::jsonb,
  is_public            boolean not null default true,
  is_active            boolean not null default true,
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

create table public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null unique references public.organizations (id) on delete cascade,
  plan_key                 text not null references public.plans (key),
  status                   text not null default 'trialing'
                           check (status in ('trialing', 'active', 'past_due', 'canceled', 'suspended')),
  billing_provider         text not null default 'none' check (billing_provider in ('none', 'stripe', 'mercadopago', 'manual')),
  provider_customer_id     text,
  provider_subscription_id text,
  trial_ends_at            timestamptz,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  -- sobrescritas por empresa (ex.: enterprise). Chave ausente = usa o plano; null = sem limite.
  limit_overrides          jsonb not null default '{}'::jsonb check (jsonb_typeof(limit_overrides) = 'object'),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index subscriptions_plan_idx on public.subscriptions (plan_key);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

insert into public.plans
  (key, name, description, max_whatsapp_numbers, max_members, max_ai_agents, max_automation_flows, max_monthly_ai_messages, features, sort_order)
values
  ('starter', 'Starter', 'Para começar a atender em um único número.',
    1, 3, 0, 3, 0,
    '{"inbox": true, "crm": "basic", "automations": "basic", "ai_agents": false, "teams": false, "reports": "basic"}'::jsonb, 10),
  ('growth', 'Growth', 'Mais números, agentes de IA e CRM completo.',
    3, 10, 3, 15, 2000,
    '{"inbox": true, "crm": "full", "automations": "advanced", "ai_agents": true, "teams": false, "reports": "basic"}'::jsonb, 20),
  ('business', 'Business', 'Equipes, vários agentes de IA e relatórios avançados.',
    5, 30, 10, 50, 10000,
    '{"inbox": true, "crm": "full", "automations": "advanced", "ai_agents": true, "teams": true, "reports": "advanced"}'::jsonb, 30),
  ('enterprise', 'Enterprise', 'Limites personalizados e suporte prioritário.',
    null, null, null, null, null,
    '{"inbox": true, "crm": "full", "automations": "advanced", "ai_agents": true, "teams": true, "reports": "advanced", "priority_support": true}'::jsonb, 40);

-- ---------------------------------------------------------------------------
-- Limites efetivos = plano + limit_overrides. Único ponto de verdade.
-- ---------------------------------------------------------------------------
create or replace function public.org_effective_limits(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan public.plans;
  v_sub public.subscriptions;
  v_overrides jsonb;
  v_keys text[] := array['max_whatsapp_numbers', 'max_members', 'max_ai_agents', 'max_automation_flows', 'max_monthly_ai_messages'];
  v_key text;
  v_base jsonb;
  v_result jsonb := '{}'::jsonb;
begin
  -- chamadas de cliente só para membros; service role / funções internas não têm auth.uid()
  if (select auth.uid()) is not null and not public.is_org_member(p_org) then
    return null;
  end if;

  select * into v_sub from public.subscriptions s where s.organization_id = p_org;
  if not found then
    return null;
  end if;
  select * into v_plan from public.plans p where p.key = v_sub.plan_key;
  v_overrides := v_sub.limit_overrides;
  v_base := to_jsonb(v_plan);

  foreach v_key in array v_keys loop
    v_result := v_result || jsonb_build_object(
      v_key,
      case when v_overrides ? v_key then v_overrides -> v_key else v_base -> v_key end
    );
  end loop;

  return v_result || jsonb_build_object(
    'plan_key', v_sub.plan_key,
    'subscription_status', v_sub.status,
    'features', v_base -> 'features'
  );
end;
$$;

-- Limite de membros: aplicado a QUALQUER inserção (cliente, função ou service role)
create or replace function public.enforce_member_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_limits jsonb;
  v_max integer;
  v_current integer;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select to_jsonb(p) || coalesce(s.limit_overrides, '{}'::jsonb)
    into v_limits
    from public.subscriptions s
    join public.plans p on p.key = s.plan_key
    where s.organization_id = new.organization_id;

  -- organização em criação (sem assinatura ainda): permite o primeiro membro
  if v_limits is null then
    return new;
  end if;

  v_max := (v_limits ->> 'max_members')::integer;
  if v_max is null then
    return new;
  end if;

  select count(*) into v_current
    from public.organization_members m
    where m.organization_id = new.organization_id and m.status = 'active';

  if v_current >= v_max then
    raise exception 'member_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger organization_members_limit
  before insert on public.organization_members
  for each row execute function public.enforce_member_limit();

-- ---------------------------------------------------------------------------
-- RLS / privilégios
-- ---------------------------------------------------------------------------
alter table public.plans         enable row level security;
alter table public.subscriptions enable row level security;

revoke all on public.plans, public.subscriptions from anon, authenticated;
grant select on public.plans, public.subscriptions to authenticated;
-- escrita de planos/assinaturas: somente service role (painel admin da KIDOO)
grant all on public.plans, public.subscriptions to service_role;

create policy plans_select on public.plans for select to authenticated
  using (is_active and (is_public or exists (
    select 1 from public.subscriptions s
    where s.plan_key = plans.key and public.is_org_member(s.organization_id))));

create policy subscriptions_select on public.subscriptions for select to authenticated
  using (public.is_org_member(organization_id));

revoke execute on function public.org_effective_limits(uuid) from public, anon;
grant execute on function public.org_effective_limits(uuid) to authenticated, service_role;
