-- =============================================================================
-- KIDOO HUB — Fase 2: identidade, tenancy, papéis/permissões, equipes,
-- auditoria, rate limit e administradores da plataforma.
--
-- Princípios:
--   * Toda tabela de tenant tem organization_id NOT NULL + RLS habilitada.
--   * Privilégios mínimos: revogamos tudo de anon/authenticated e concedemos
--     apenas o necessário (inclusive por coluna).
--   * Funções SECURITY DEFINER sempre com search_path vazio e nomes qualificados.
--   * Escritas sensíveis passam por funções que derivam o usuário de auth.uid().
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 com auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  avatar_url  text check (avatar_url is null or char_length(avatar_url) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 80),
  slug        text not null unique
              check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,48})[a-z0-9]$'),
  status      text not null default 'active' check (status in ('active', 'suspended')),
  settings    jsonb not null default '{}'::jsonb,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- permissions / roles / role_permissions
-- ---------------------------------------------------------------------------
create table public.permissions (
  key         text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  module      text not null,
  description text not null
);

create table public.roles (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  key             text not null check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  name            text not null check (char_length(name) between 2 and 60),
  description     text not null default '',
  is_system       boolean not null default false,
  created_at      timestamptz not null default now(),
  -- papel de sistema <=> sem organização
  constraint roles_system_scope check (is_system = (organization_id is null))
);

-- unicidade da chave dentro do escopo (sistema ou empresa)
create unique index roles_system_key_uq on public.roles (key) where organization_id is null;
create unique index roles_org_key_uq on public.roles (organization_id, key) where organization_id is not null;

create table public.role_permissions (
  role_id        uuid not null references public.roles (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (role_id, permission_key)
);

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------
create table public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role_id         uuid not null references public.roles (id) on delete restrict,
  status          text not null default 'active' check (status in ('active', 'suspended')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_members_user_idx on public.organization_members (user_id) where status = 'active';
create index organization_members_role_idx on public.organization_members (role_id);

create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- teams / team_members
-- ---------------------------------------------------------------------------
create table public.teams (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (char_length(name) between 2 and 60),
  description     text not null default '' check (char_length(description) <= 300),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name)
);

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

create table public.team_members (
  organization_id uuid not null,
  team_id         uuid not null,
  user_id         uuid not null,
  is_lead         boolean not null default false,
  created_at      timestamptz not null default now(),
  primary key (team_id, user_id),
  -- FKs compostas: equipe e usuário DEVEM pertencer à mesma organização
  foreign key (organization_id, team_id) references public.teams (organization_id, id) on delete cascade,
  foreign key (organization_id, user_id) references public.organization_members (organization_id, user_id) on delete cascade
);

create index team_members_org_idx on public.team_members (organization_id, user_id);

-- ---------------------------------------------------------------------------
-- platform_admins (equipe interna KIDOO — separado de papéis de empresa)
-- ---------------------------------------------------------------------------
create table public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- audit_logs (append-only)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  -- sem FK de propósito: a trilha deve sobreviver à remoção de empresas/usuários
  organization_id uuid,
  actor_user_id   uuid,
  actor_type      text not null default 'user' check (actor_type in ('user', 'system', 'platform_admin')),
  action          text not null check (char_length(action) between 3 and 80),
  resource_type   text not null,
  resource_id     text,
  metadata        jsonb not null default '{}'::jsonb,
  ip              text,
  user_agent      text,
  created_at      timestamptz not null default now()
);

create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);

create or replace function public.audit_logs_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = 'P0001';
end;
$$;

create trigger audit_logs_no_update
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function public.audit_logs_immutable();

create or replace function public.write_audit_log(
  p_organization_id uuid,
  p_actor_user_id   uuid,
  p_action          text,
  p_resource_type   text,
  p_resource_id     text default null,
  p_metadata        jsonb default '{}'::jsonb,
  p_actor_type      text default 'user',
  p_ip              text default null,
  p_user_agent      text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs
    (organization_id, actor_user_id, actor_type, action, resource_type, resource_id, metadata, ip, user_agent)
  values
    (p_organization_id, p_actor_user_id, p_actor_type, p_action, p_resource_type, p_resource_id,
     coalesce(p_metadata, '{}'::jsonb), p_ip, p_user_agent);
$$;

-- ---------------------------------------------------------------------------
-- rate_limits (janela fixa; compartilhado entre instâncias; só service role)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        integer not null default 0
);

create or replace function public.consume_rate_limit(
  p_key            text,
  p_max            integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_count integer;
begin
  if p_max < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit parameters';
  end if;

  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set window_start = case
          when rl.window_start + make_interval(secs => p_window_seconds) <= now() then now()
          else rl.window_start end,
        count = case
          when rl.window_start + make_interval(secs => p_window_seconds) <= now() then 1
          else rl.count + 1 end
  returning rl.window_start, rl.count into v_start, v_count;

  allowed := v_count <= p_max;
  remaining := greatest(p_max - v_count, 0);
  retry_after_seconds := case
    when allowed then 0
    else greatest(ceil(extract(epoch from (v_start + make_interval(secs => p_window_seconds) - now())))::integer, 1)
  end;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Funções de autorização usadas pelas políticas RLS
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function public.is_org_owner(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.roles r on r.id = m.role_id
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and r.organization_id is null
      and r.key = 'owner'
  );
$$;

-- Permissão efetiva do usuário atual. Empresa suspensa => nenhuma permissão de escrita.
create or replace function public.has_org_permission(p_org uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    join public.role_permissions rp on rp.role_id = m.role_id
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and o.status = 'active'
      and rp.permission_key = p_permission
  );
$$;

create or replace function public.shares_org_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members a
    join public.organization_members b on b.organization_id = a.organization_id
    where a.user_id = (select auth.uid()) and a.status = 'active'
      and b.user_id = p_user and b.status = 'active'
  );
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins pa where pa.user_id = (select auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- Regras de integridade de membros (todas as vias, inclusive service role)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_member_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_client boolean := current_user in ('authenticated', 'anon');
  v_old_is_owner boolean := false;
  v_new_is_owner boolean := false;
  v_role_org uuid;
  v_org_exists boolean;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    select r.organization_id, (r.organization_id is null and r.key = 'owner')
      into v_role_org, v_new_is_owner
      from public.roles r where r.id = new.role_id;

    -- papel customizado de OUTRA empresa jamais pode ser atribuído
    if v_role_org is not null and v_role_org <> new.organization_id then
      raise exception 'role_not_in_organization' using errcode = 'P0001';
    end if;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    select (r.organization_id is null and r.key = 'owner')
      into v_old_is_owner
      from public.roles r where r.id = old.role_id;
    v_old_is_owner := coalesce(v_old_is_owner, false) and old.status = 'active';
  end if;

  -- Somente proprietários criam/alteram/removem proprietários (via API de cliente)
  if v_client then
    if tg_op = 'INSERT' and v_new_is_owner and not public.is_org_owner(new.organization_id) then
      raise exception 'owner_required' using errcode = 'P0001';
    end if;
    if tg_op = 'UPDATE' and (v_new_is_owner and new.role_id <> old.role_id)
       and not public.is_org_owner(new.organization_id) then
      raise exception 'owner_required' using errcode = 'P0001';
    end if;
    if tg_op in ('UPDATE', 'DELETE') and v_old_is_owner
       and not public.is_org_owner(old.organization_id)
       and old.user_id <> (select auth.uid()) then
      raise exception 'owner_required' using errcode = 'P0001';
    end if;
  end if;

  -- Nunca deixar a empresa sem proprietário ativo
  if tg_op in ('UPDATE', 'DELETE') and v_old_is_owner then
    if tg_op = 'DELETE' or new.status <> 'active' or not v_new_is_owner then
      select exists (select 1 from public.organizations o where o.id = old.organization_id) into v_org_exists;
      if v_org_exists and not exists (
        select 1
        from public.organization_members m
        join public.roles r on r.id = m.role_id
        where m.organization_id = old.organization_id
          and m.id <> old.id
          and m.status = 'active'
          and r.organization_id is null and r.key = 'owner'
      ) then
        raise exception 'last_owner' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger organization_members_rules
  before insert or update or delete on public.organization_members
  for each row execute function public.enforce_member_rules();

-- Imutabilidade das chaves de vínculo
create or replace function public.organization_members_immutable_keys()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id <> old.organization_id or new.user_id <> old.user_id then
    raise exception 'membership keys are immutable' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger organization_members_keys
  before update on public.organization_members
  for each row execute function public.organization_members_immutable_keys();

-- Auditoria automática de mudanças de membros (à prova de adulteração pelo cliente)
create or replace function public.audit_member_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    perform public.write_audit_log(new.organization_id, v_actor, 'member.added', 'organization_member',
      new.id::text, jsonb_build_object('user_id', new.user_id, 'role_id', new.role_id));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.role_id <> old.role_id or new.status <> old.status then
      perform public.write_audit_log(new.organization_id, v_actor, 'member.updated', 'organization_member',
        new.id::text, jsonb_build_object(
          'user_id', new.user_id,
          'role_id', jsonb_build_object('from', old.role_id, 'to', new.role_id),
          'status', jsonb_build_object('from', old.status, 'to', new.status)));
    end if;
    return new;
  else
    if exists (select 1 from public.organizations o where o.id = old.organization_id) then
      perform public.write_audit_log(old.organization_id, v_actor, 'member.removed', 'organization_member',
        old.id::text, jsonb_build_object('user_id', old.user_id, 'role_id', old.role_id));
    end if;
    return old;
  end if;
end;
$$;

create trigger organization_members_audit
  after insert or update or delete on public.organization_members
  for each row execute function public.audit_member_changes();

-- ---------------------------------------------------------------------------
-- Seeds: catálogo de permissões e papéis de sistema
-- ---------------------------------------------------------------------------
insert into public.permissions (key, module, description) values
  ('org.update',          'organization', 'Editar dados da empresa'),
  ('team.invite',         'team',         'Convidar usuários'),
  ('team.manage_members', 'team',         'Alterar papel, suspender ou remover membros'),
  ('team.manage_teams',   'team',         'Criar e editar equipes'),
  ('channels.read',       'channels',     'Ver canais conectados'),
  ('channels.manage',     'channels',     'Conectar e desconectar canais'),
  ('inbox.read',          'inbox',        'Ver conversas'),
  ('inbox.reply',         'inbox',        'Responder conversas'),
  ('inbox.assign',        'inbox',        'Atribuir e transferir conversas'),
  ('contacts.read',       'contacts',     'Ver contatos'),
  ('contacts.write',      'contacts',     'Criar e editar contatos'),
  ('contacts.delete',     'contacts',     'Excluir contatos'),
  ('crm.read',            'crm',          'Ver funis e oportunidades'),
  ('crm.write',           'crm',          'Criar e editar oportunidades'),
  ('crm.manage',          'crm',          'Configurar funis e etapas'),
  ('agents.read',         'agents',       'Ver agentes de IA'),
  ('agents.manage',       'agents',       'Criar e configurar agentes de IA'),
  ('automations.read',    'automations',  'Ver automações'),
  ('automations.manage',  'automations',  'Criar e editar automações'),
  ('reports.read',        'reports',      'Ver relatórios'),
  ('audit.read',          'audit',        'Ver trilha de auditoria'),
  ('billing.manage',      'billing',      'Gerenciar plano e cobrança'),
  ('settings.manage',     'settings',     'Gerenciar integrações e preferências');

insert into public.roles (key, name, description, is_system) values
  ('owner',   'Proprietário',  'Controle total, inclusive plano e cobrança.', true),
  ('admin',   'Administrador', 'Administra equipe, canais e configurações.', true),
  ('manager', 'Gestor',        'Coordena atendimento, CRM e equipes.', true),
  ('agent',   'Atendente',     'Atende conversas e trabalha o CRM.', true),
  ('viewer',  'Leitor',        'Acesso somente leitura.', true);

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
join public.permissions p on (
  r.key = 'owner'
  or (r.key = 'admin' and p.key <> 'billing.manage')
  or (r.key = 'manager' and p.key in (
        'team.manage_teams', 'channels.read', 'inbox.read', 'inbox.reply', 'inbox.assign',
        'contacts.read', 'contacts.write', 'contacts.delete', 'crm.read', 'crm.write', 'crm.manage',
        'agents.read', 'automations.read', 'reports.read'))
  or (r.key = 'agent' and p.key in (
        'inbox.read', 'inbox.reply', 'inbox.assign', 'contacts.read', 'contacts.write',
        'crm.read', 'crm.write'))
  or (r.key = 'viewer' and p.key in (
        'channels.read', 'inbox.read', 'contacts.read', 'crm.read', 'reports.read'))
)
where r.organization_id is null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.organizations        enable row level security;
alter table public.permissions          enable row level security;
alter table public.roles                enable row level security;
alter table public.role_permissions     enable row level security;
alter table public.organization_members enable row level security;
alter table public.teams                enable row level security;
alter table public.team_members         enable row level security;
alter table public.platform_admins      enable row level security;
alter table public.audit_logs           enable row level security;
alter table public.rate_limits          enable row level security;

-- Privilégios mínimos
revoke all on public.profiles, public.organizations, public.permissions, public.roles,
  public.role_permissions, public.organization_members, public.teams, public.team_members,
  public.platform_admins, public.audit_logs, public.rate_limits
  from anon, authenticated;

grant select on public.profiles, public.permissions, public.roles, public.role_permissions,
  public.organization_members, public.teams, public.team_members, public.platform_admins to authenticated;
grant select (id, name, slug, status, settings, created_at, updated_at) on public.organizations to authenticated;
grant update (name, settings) on public.organizations to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
grant update (role_id, status) on public.organization_members to authenticated;
grant delete on public.organization_members to authenticated;
grant insert, update, delete on public.teams to authenticated;
grant insert, update, delete on public.team_members to authenticated;
grant select on public.audit_logs to authenticated;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_org_with(id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- organizations (INSERT/DELETE somente por funções; status/slug imutáveis para clientes)
create policy organizations_select on public.organizations for select to authenticated
  using (public.is_org_member(id));
create policy organizations_update on public.organizations for update to authenticated
  using (public.has_org_permission(id, 'org.update'))
  with check (public.has_org_permission(id, 'org.update'));

-- catálogo (leitura geral para autenticados)
create policy permissions_select on public.permissions for select to authenticated using (true);
create policy roles_select on public.roles for select to authenticated
  using (organization_id is null or public.is_org_member(organization_id));
create policy role_permissions_select on public.role_permissions for select to authenticated
  using (exists (select 1 from public.roles r where r.id = role_id));

-- organization_members
create policy members_select on public.organization_members for select to authenticated
  using (public.is_org_member(organization_id));
create policy members_update on public.organization_members for update to authenticated
  using (public.has_org_permission(organization_id, 'team.manage_members') and user_id <> (select auth.uid()))
  with check (public.has_org_permission(organization_id, 'team.manage_members') and user_id <> (select auth.uid()));
create policy members_delete on public.organization_members for delete to authenticated
  using (
    (public.has_org_permission(organization_id, 'team.manage_members') and user_id <> (select auth.uid()))
    or user_id = (select auth.uid())  -- sair da empresa (protegido pelo gatilho de último proprietário)
  );

-- teams
create policy teams_select on public.teams for select to authenticated
  using (public.is_org_member(organization_id));
create policy teams_insert on public.teams for insert to authenticated
  with check (public.has_org_permission(organization_id, 'team.manage_teams'));
create policy teams_update on public.teams for update to authenticated
  using (public.has_org_permission(organization_id, 'team.manage_teams'))
  with check (public.has_org_permission(organization_id, 'team.manage_teams'));
create policy teams_delete on public.teams for delete to authenticated
  using (public.has_org_permission(organization_id, 'team.manage_teams'));

create policy team_members_select on public.team_members for select to authenticated
  using (public.is_org_member(organization_id));
create policy team_members_insert on public.team_members for insert to authenticated
  with check (public.has_org_permission(organization_id, 'team.manage_teams'));
create policy team_members_update on public.team_members for update to authenticated
  using (public.has_org_permission(organization_id, 'team.manage_teams'))
  with check (public.has_org_permission(organization_id, 'team.manage_teams'));
create policy team_members_delete on public.team_members for delete to authenticated
  using (public.has_org_permission(organization_id, 'team.manage_teams'));

-- platform_admins: cada usuário vê apenas a própria linha
create policy platform_admins_select_self on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- audit_logs: leitura por quem tem audit.read; ninguém escreve diretamente
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (organization_id is not null and public.has_org_permission(organization_id, 'audit.read'));

-- rate_limits: sem políticas => inacessível para anon/authenticated (apenas service role)

-- ---------------------------------------------------------------------------
-- Execução de funções: nada para PUBLIC/anon por padrão
-- ---------------------------------------------------------------------------
revoke execute on function public.write_audit_log(uuid, uuid, text, text, text, jsonb, text, text, text) from public, anon, authenticated;
revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.audit_member_changes() from public, anon, authenticated;
revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.is_org_owner(uuid) from public, anon;
revoke execute on function public.has_org_permission(uuid, text) from public, anon;
revoke execute on function public.shares_org_with(uuid) from public, anon;
revoke execute on function public.is_platform_admin() from public, anon;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.has_org_permission(uuid, text) to authenticated;
grant execute on function public.shares_org_with(uuid) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.write_audit_log(uuid, uuid, text, text, text, jsonb, text, text, text) to service_role;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
grant all on public.rate_limits, public.audit_logs to service_role;
