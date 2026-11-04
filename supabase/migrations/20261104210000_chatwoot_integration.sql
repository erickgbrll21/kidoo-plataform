-- =============================================================================
-- KIDOO HUB — Fase 3: integração Chatwoot (segredos, contas, inboxes, agentes,
-- webhooks idempotentes e espelho enxuto de contatos/conversas).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- integration_secrets (somente service role; ciphertext AES-GCM)
-- ---------------------------------------------------------------------------
create table public.integration_secrets (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  purpose         text not null check (purpose in (
                    'chatwoot_account_token',
                    'chatwoot_webhook',
                    'meta_whatsapp',
                    'ai_provider'
                  )),
  ciphertext      text not null check (char_length(ciphertext) between 20 and 4000),
  key_id          text not null default 'v1',
  aad             text not null,
  created_at      timestamptz not null default now(),
  rotated_at      timestamptz,
  unique (organization_id, purpose)
);

create index integration_secrets_org_idx on public.integration_secrets (organization_id);

alter table public.integration_secrets enable row level security;
revoke all on public.integration_secrets from anon, authenticated;
grant all on public.integration_secrets to service_role;

-- ---------------------------------------------------------------------------
-- chatwoot_accounts (1:1 com organização)
-- ---------------------------------------------------------------------------
create table public.chatwoot_accounts (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null unique references public.organizations (id) on delete cascade,
  chatwoot_account_id   bigint unique,
  service_agent_id      bigint,
  -- UUIDs de integration_secrets (sem FK: evita ciclo no CASCADE ao apagar a organização)
  account_token_secret_id uuid,
  webhook_secret_id     uuid,
  chatwoot_webhook_id   bigint,
  status                text not null default 'active'
                        check (status in ('pending', 'active', 'error', 'disabled')),
  last_error            text,
  provisioned_at        timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger chatwoot_accounts_set_updated_at
  before update on public.chatwoot_accounts
  for each row execute function public.set_updated_at();

-- necessário para FKs compostas (inboxes / agent_links / conversations)
create unique index chatwoot_accounts_org_cw_uq
  on public.chatwoot_accounts (organization_id, chatwoot_account_id);

alter table public.chatwoot_accounts enable row level security;
revoke all on public.chatwoot_accounts from anon, authenticated;
grant select on public.chatwoot_accounts to authenticated;
grant all on public.chatwoot_accounts to service_role;

create policy chatwoot_accounts_select on public.chatwoot_accounts
  for select to authenticated
  using (public.is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- chatwoot_inboxes (Fase 4 liga connection_id; Fase 3 já cria a estrutura)
-- ---------------------------------------------------------------------------
create table public.chatwoot_inboxes (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  chatwoot_account_id   bigint not null,
  chatwoot_inbox_id     bigint not null,
  name                  text not null default '',
  channel_type          text not null default 'api'
                        check (channel_type in ('api', 'whatsapp', 'website', 'email', 'other')),
  status                text not null default 'active'
                        check (status in ('active', 'disabled', 'error')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (organization_id, chatwoot_inbox_id),
  unique (organization_id, chatwoot_account_id, chatwoot_inbox_id),
  foreign key (organization_id, chatwoot_account_id)
    references public.chatwoot_accounts (organization_id, chatwoot_account_id) on delete cascade
);

create trigger chatwoot_inboxes_set_updated_at
  before update on public.chatwoot_inboxes
  for each row execute function public.set_updated_at();

alter table public.chatwoot_inboxes enable row level security;
revoke all on public.chatwoot_inboxes from anon, authenticated;
grant select on public.chatwoot_inboxes to authenticated;
grant all on public.chatwoot_inboxes to service_role;

create policy chatwoot_inboxes_select on public.chatwoot_inboxes
  for select to authenticated
  using (public.is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- chatwoot_agent_links (membro KIDOO ↔ agente Chatwoot)
-- ---------------------------------------------------------------------------
create table public.chatwoot_agent_links (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null,
  user_id             uuid not null,
  chatwoot_user_id    bigint not null,
  chatwoot_account_id bigint not null,
  role                text not null default 'agent'
                      check (role in ('agent', 'administrator')),
  created_at          timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (organization_id, chatwoot_user_id),
  foreign key (organization_id, user_id)
    references public.organization_members (organization_id, user_id) on delete cascade,
  foreign key (organization_id, chatwoot_account_id)
    references public.chatwoot_accounts (organization_id, chatwoot_account_id) on delete cascade
);

alter table public.chatwoot_agent_links enable row level security;
revoke all on public.chatwoot_agent_links from anon, authenticated;
grant select on public.chatwoot_agent_links to authenticated;
grant all on public.chatwoot_agent_links to service_role;

create policy chatwoot_agent_links_select on public.chatwoot_agent_links
  for select to authenticated
  using (public.is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- webhook_events (idempotência + fila de processamento)
-- ---------------------------------------------------------------------------
create table public.webhook_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  provider        text not null check (provider in ('chatwoot', 'meta')),
  idempotency_key text not null,
  event_type      text not null,
  payload         jsonb not null,
  status          text not null default 'pending'
                  check (status in ('pending', 'processing', 'done', 'dead')),
  attempts        integer not null default 0 check (attempts >= 0),
  last_error      text,
  available_at    timestamptz not null default now(),
  processed_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (provider, idempotency_key)
);

create index webhook_events_queue_idx
  on public.webhook_events (status, available_at)
  where status in ('pending', 'processing');

alter table public.webhook_events enable row level security;
revoke all on public.webhook_events from anon, authenticated;
grant all on public.webhook_events to service_role;

-- admin da plataforma pode inspecionar via service role no backend; sem policy de cliente

-- ---------------------------------------------------------------------------
-- Espelho enxuto (listagem / contexto; Chatwoot continua fonte da verdade)
-- ---------------------------------------------------------------------------
create table public.contacts_mirror (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  chatwoot_contact_id   bigint not null,
  name                  text not null default '',
  email                 text,
  phone_number          text,
  identifier            text,
  last_activity_at      timestamptz,
  raw                   jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (organization_id, chatwoot_contact_id)
);

create index contacts_mirror_org_activity_idx
  on public.contacts_mirror (organization_id, last_activity_at desc nulls last);

create trigger contacts_mirror_set_updated_at
  before update on public.contacts_mirror
  for each row execute function public.set_updated_at();

alter table public.contacts_mirror enable row level security;
revoke all on public.contacts_mirror from anon, authenticated;
grant select on public.contacts_mirror to authenticated;
grant all on public.contacts_mirror to service_role;

create policy contacts_mirror_select on public.contacts_mirror
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and public.has_org_permission(organization_id, 'contacts.read')
  );

create table public.conversations_index (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references public.organizations (id) on delete cascade,
  chatwoot_account_id       bigint not null,
  chatwoot_conversation_id  bigint not null,
  chatwoot_inbox_id         bigint,
  chatwoot_contact_id       bigint,
  status                    text not null default 'open'
                            check (status in ('open', 'resolved', 'pending', 'snoozed')),
  assignee_chatwoot_user_id bigint,
  last_message_at           timestamptz,
  last_message_preview      text not null default '',
  unread_count              integer not null default 0 check (unread_count >= 0),
  meta                      jsonb not null default '{}'::jsonb,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (organization_id, chatwoot_conversation_id),
  foreign key (organization_id, chatwoot_account_id)
    references public.chatwoot_accounts (organization_id, chatwoot_account_id) on delete cascade
);

create index conversations_index_org_last_idx
  on public.conversations_index (organization_id, last_message_at desc nulls last);

create trigger conversations_index_set_updated_at
  before update on public.conversations_index
  for each row execute function public.set_updated_at();

alter table public.conversations_index enable row level security;
revoke all on public.conversations_index from anon, authenticated;
grant select on public.conversations_index to authenticated;
grant all on public.conversations_index to service_role;

create policy conversations_index_select on public.conversations_index
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and public.has_org_permission(organization_id, 'inbox.read')
  );
