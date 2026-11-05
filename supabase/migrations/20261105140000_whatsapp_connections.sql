-- =============================================================================
-- KIDOO HUB — Fase 4: conexões WhatsApp via Z-API + limite do plano
-- =============================================================================

-- ---------------------------------------------------------------------------
-- integration_secrets: vários tokens por empresa (1 por instância Z-API)
-- ---------------------------------------------------------------------------
alter table public.integration_secrets
  add column if not exists resource_key text not null default '';

alter table public.integration_secrets
  drop constraint if exists integration_secrets_organization_id_purpose_key;

-- amplia purposes (Chatwoot + Z-API + futuros)
alter table public.integration_secrets drop constraint if exists integration_secrets_purpose_check;
alter table public.integration_secrets
  add constraint integration_secrets_purpose_check
  check (purpose in (
    'chatwoot_account_token',
    'chatwoot_webhook',
    'meta_whatsapp',
    'zapi_instance',
    'ai_provider'
  ));

create unique index if not exists integration_secrets_org_purpose_resource_uq
  on public.integration_secrets (organization_id, purpose, resource_key);

-- webhook_events aceita provider zapi
alter table public.webhook_events drop constraint if exists webhook_events_provider_check;
alter table public.webhook_events
  add constraint webhook_events_provider_check
  check (provider in ('chatwoot', 'meta', 'zapi'));

-- ---------------------------------------------------------------------------
-- whatsapp_connections (Z-API)
-- ---------------------------------------------------------------------------
create table public.whatsapp_connections (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  provider              text not null default 'zapi'
                        check (provider in ('zapi', 'meta')),
  zapi_instance_id      text not null check (char_length(zapi_instance_id) between 1 and 64),
  display_phone_number  text not null default '',
  verified_name         text,
  status                text not null default 'pending'
                        check (status in ('pending', 'active', 'error', 'disconnected')),
  -- UUID de integration_secrets (purpose = zapi_instance); sem FK para evitar ciclo
  token_secret_id       uuid,
  webhook_secret_id     uuid,
  connected_at          timestamptz,
  last_synced_at        timestamptz,
  last_error            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (zapi_instance_id),
  unique (organization_id, zapi_instance_id)
);

create index whatsapp_connections_org_status_idx
  on public.whatsapp_connections (organization_id, status);

create trigger whatsapp_connections_set_updated_at
  before update on public.whatsapp_connections
  for each row execute function public.set_updated_at();

alter table public.whatsapp_connections enable row level security;
revoke all on public.whatsapp_connections from anon, authenticated;
grant select on public.whatsapp_connections to authenticated;
grant all on public.whatsapp_connections to service_role;

create policy whatsapp_connections_select on public.whatsapp_connections
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and public.has_org_permission(organization_id, 'channels.read')
  );

-- ---------------------------------------------------------------------------
-- chatwoot_inboxes.connection_id → whatsapp_connections
-- ---------------------------------------------------------------------------
alter table public.chatwoot_inboxes
  add column if not exists connection_id uuid
    references public.whatsapp_connections (id) on delete set null;

create index if not exists chatwoot_inboxes_connection_idx
  on public.chatwoot_inboxes (connection_id)
  where connection_id is not null;

-- ---------------------------------------------------------------------------
-- Limite de números WhatsApp (defesa em profundidade)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_whatsapp_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_max integer;
  v_current integer;
  v_overrides jsonb;
begin
  if new.status not in ('pending', 'active') then
    return new;
  end if;

  select p.max_whatsapp_numbers, coalesce(s.limit_overrides, '{}'::jsonb)
    into v_max, v_overrides
    from public.subscriptions s
    join public.plans p on p.key = s.plan_key
    where s.organization_id = new.organization_id;

  if v_overrides ? 'max_whatsapp_numbers' then
    if jsonb_typeof(v_overrides -> 'max_whatsapp_numbers') = 'null' then
      v_max := null;
    else
      v_max := (v_overrides ->> 'max_whatsapp_numbers')::integer;
    end if;
  end if;

  if v_max is null then
    return new;
  end if;

  select count(*) into v_current
    from public.whatsapp_connections c
    where c.organization_id = new.organization_id
      and c.status in ('pending', 'active')
      and (tg_op = 'INSERT' or c.id <> new.id);

  if v_current >= v_max then
    raise exception 'whatsapp_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists whatsapp_connections_limit on public.whatsapp_connections;
create trigger whatsapp_connections_limit
  before insert or update of status on public.whatsapp_connections
  for each row execute function public.enforce_whatsapp_limit();
