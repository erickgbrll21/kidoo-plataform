-- =============================================================================
-- Migra schema Meta Embedded Signup → Z-API (ambientes que já rodaram 20261105140000 antigo)
-- Idempotente: seguro se a tabela já estiver no formato Z-API.
-- =============================================================================

-- purposes / webhook providers
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

alter table public.webhook_events drop constraint if exists webhook_events_provider_check;
alter table public.webhook_events
  add constraint webhook_events_provider_check
  check (provider in ('chatwoot', 'meta', 'zapi'));

-- Colunas Z-API
alter table public.whatsapp_connections
  add column if not exists provider text;
alter table public.whatsapp_connections
  add column if not exists zapi_instance_id text;
alter table public.whatsapp_connections
  add column if not exists webhook_secret_id uuid;

update public.whatsapp_connections
  set provider = coalesce(provider, 'zapi')
  where provider is null;

-- Se veio do schema Meta: copia phone_number_id → zapi_instance_id como placeholder
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'whatsapp_connections' and column_name = 'phone_number_id'
  ) then
    execute $q$
      update public.whatsapp_connections
         set zapi_instance_id = coalesce(nullif(zapi_instance_id, ''), phone_number_id)
       where zapi_instance_id is null or zapi_instance_id = ''
    $q$;
  end if;
end $$;

-- Torna colunas Meta opcionais (se existirem)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'whatsapp_connections' and column_name = 'waba_id'
  ) then
    execute 'alter table public.whatsapp_connections alter column waba_id drop not null';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'whatsapp_connections' and column_name = 'phone_number_id'
  ) then
    execute 'alter table public.whatsapp_connections alter column phone_number_id drop not null';
  end if;
end $$;

alter table public.whatsapp_connections
  alter column provider set default 'zapi';

-- Se a tabela antiga não tinha zapi_instance_id NOT NULL ainda:
do $$
begin
  -- remove linhas inválidas sem identificador (dev/vazio)
  delete from public.whatsapp_connections
   where (zapi_instance_id is null or zapi_instance_id = '')
     and status = 'disconnected';

  if exists (
    select 1 from public.whatsapp_connections
    where zapi_instance_id is null or zapi_instance_id = ''
  ) then
    raise notice 'whatsapp_connections ainda tem linhas sem zapi_instance_id — preencha manualmente antes de forçar NOT NULL';
  else
    alter table public.whatsapp_connections
      alter column zapi_instance_id set not null;
  end if;
end $$;

create unique index if not exists whatsapp_connections_zapi_instance_uq
  on public.whatsapp_connections (zapi_instance_id);

create unique index if not exists whatsapp_connections_org_zapi_uq
  on public.whatsapp_connections (organization_id, zapi_instance_id);
