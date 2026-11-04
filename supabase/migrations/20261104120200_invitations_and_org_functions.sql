-- =============================================================================
-- KIDOO HUB — Fase 2: convites e funções de escrita sensível
-- (criar empresa, aceitar convite). Todas derivam o usuário de auth.uid().
-- =============================================================================

create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email           text not null check (email = lower(email) and char_length(email) between 5 and 254 and position('@' in email) > 1),
  role_id         uuid not null references public.roles (id) on delete restrict,
  -- somente o SHA-256 do token; o token em si é entregue uma única vez a quem convida
  token_hash      text not null unique check (char_length(token_hash) = 64),
  invited_by      uuid references auth.users (id) on delete set null,
  expires_at      timestamptz not null,
  accepted_at     timestamptz,
  accepted_by     uuid references auth.users (id) on delete set null,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now()
);

create unique index invitations_pending_uq
  on public.invitations (organization_id, email)
  where accepted_at is null and revoked_at is null;
create index invitations_org_idx on public.invitations (organization_id, created_at desc);

create or replace function public.enforce_invitation_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_client boolean := current_user in ('authenticated', 'anon');
  v_role_org uuid;
  v_is_owner_role boolean;
  v_max integer;
  v_used integer;
begin
  select r.organization_id, (r.organization_id is null and r.key = 'owner')
    into v_role_org, v_is_owner_role
    from public.roles r where r.id = new.role_id;

  if v_role_org is not null and v_role_org <> new.organization_id then
    raise exception 'role_not_in_organization' using errcode = 'P0001';
  end if;
  if v_client and v_is_owner_role and not public.is_org_owner(new.organization_id) then
    raise exception 'owner_required' using errcode = 'P0001';
  end if;
  if new.expires_at <= now() or new.expires_at > now() + interval '14 days' then
    raise exception 'invalid_expiration' using errcode = 'P0001';
  end if;

  -- convites pendentes + membros ativos não podem ultrapassar o limite do plano
  select (to_jsonb(p) || coalesce(s.limit_overrides, '{}'::jsonb)) ->> 'max_members'
    into v_max
    from public.subscriptions s join public.plans p on p.key = s.plan_key
    where s.organization_id = new.organization_id;
  if v_max is not null then
    select
      (select count(*) from public.organization_members m where m.organization_id = new.organization_id and m.status = 'active')
      + (select count(*) from public.invitations i
           where i.organization_id = new.organization_id and i.accepted_at is null
             and i.revoked_at is null and i.expires_at > now())
      into v_used;
    if v_used >= v_max::integer then
      raise exception 'member_limit_reached' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger invitations_rules
  before insert on public.invitations
  for each row execute function public.enforce_invitation_rules();

create or replace function public.audit_invitation_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit_log(new.organization_id, (select auth.uid()), 'invitation.created', 'invitation',
      new.id::text, jsonb_build_object('email', new.email, 'role_id', new.role_id));
  elsif tg_op = 'UPDATE' and old.revoked_at is null and new.revoked_at is not null then
    perform public.write_audit_log(new.organization_id, (select auth.uid()), 'invitation.revoked', 'invitation',
      new.id::text, jsonb_build_object('email', new.email));
  end if;
  return new;
end;
$$;

create trigger invitations_audit
  after insert or update on public.invitations
  for each row execute function public.audit_invitation_changes();

alter table public.invitations enable row level security;

revoke all on public.invitations from anon, authenticated;
grant select (id, organization_id, email, role_id, invited_by, expires_at, accepted_at, revoked_at, created_at)
  on public.invitations to authenticated;
grant insert (organization_id, email, role_id, token_hash, invited_by, expires_at) on public.invitations to authenticated;
grant update (revoked_at) on public.invitations to authenticated;

create policy invitations_select on public.invitations for select to authenticated
  using (public.has_org_permission(organization_id, 'team.invite'));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (public.has_org_permission(organization_id, 'team.invite') and invited_by = (select auth.uid()));
create policy invitations_update on public.invitations for update to authenticated
  using (public.has_org_permission(organization_id, 'team.invite') and accepted_at is null)
  with check (public.has_org_permission(organization_id, 'team.invite'));

-- ---------------------------------------------------------------------------
-- create_organization: empresa + proprietário + assinatura Starter (sem cobrança)
-- ---------------------------------------------------------------------------
create or replace function public.create_organization(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_org uuid;
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.users u where u.id = v_uid) then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if v_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,48})[a-z0-9]$' then
    raise exception 'invalid_slug' using errcode = 'P0001';
  end if;

  select r.id into v_owner from public.roles r where r.organization_id is null and r.key = 'owner';

  begin
    insert into public.organizations (name, slug, created_by) values (v_name, v_slug, v_uid)
    returning id into v_org;
  exception when unique_violation then
    raise exception 'slug_taken' using errcode = 'P0001';
  end;

  insert into public.organization_members (organization_id, user_id, role_id) values (v_org, v_uid, v_owner);
  insert into public.subscriptions (organization_id, plan_key, status, billing_provider)
    values (v_org, 'starter', 'trialing', 'none');

  perform public.write_audit_log(v_org, v_uid, 'organization.created', 'organization', v_org::text,
    jsonb_build_object('name', v_name, 'slug', v_slug));
  return v_org;
end;
$$;

-- ---------------------------------------------------------------------------
-- Convites: pré-visualização e aceite
-- ---------------------------------------------------------------------------
create or replace function public.get_invitation_preview(p_token_hash text)
returns table (
  organization_name text,
  role_name         text,
  email             text,
  status            text,
  email_matches     boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_user_email text;
begin
  if v_uid is null then
    return;
  end if;
  select lower(u.email) into v_user_email from auth.users u where u.id = v_uid;

  return query
  select o.name, r.name, i.email,
         case
           when i.accepted_at is not null then 'accepted'
           when i.revoked_at is not null then 'revoked'
           when i.expires_at <= now() then 'expired'
           when o.status <> 'active' then 'unavailable'
           else 'valid'
         end,
         (i.email = v_user_email)
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  join public.roles r on r.id = i.role_id
  where i.token_hash = p_token_hash;
end;
$$;

create or replace function public.accept_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_user auth.users;
  v_inv public.invitations;
  v_org_status text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_user from auth.users u where u.id = v_uid;
  if not found then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  -- evita que alguém cadastre o e-mail de outra pessoa e "aceite" o convite dela
  if v_user.email_confirmed_at is null then
    raise exception 'email_not_confirmed' using errcode = 'P0001';
  end if;

  select * into v_inv from public.invitations i where i.token_hash = p_token_hash for update;
  if not found or v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception 'invitation_invalid' using errcode = 'P0001';
  end if;
  if lower(v_user.email) <> v_inv.email then
    raise exception 'invitation_email_mismatch' using errcode = 'P0001';
  end if;

  select o.status into v_org_status from public.organizations o where o.id = v_inv.organization_id;
  if v_org_status is distinct from 'active' then
    raise exception 'organization_unavailable' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.organization_members m
             where m.organization_id = v_inv.organization_id and m.user_id = v_uid) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  -- o convite pendente é descontado do limite no momento da criação; ao aceitar, ele deixa de ser "pendente"
  update public.invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;

  insert into public.organization_members (organization_id, user_id, role_id)
    values (v_inv.organization_id, v_uid, v_inv.role_id);

  perform public.write_audit_log(v_inv.organization_id, v_uid, 'invitation.accepted', 'invitation',
    v_inv.id::text, jsonb_build_object('email', v_inv.email));
  return v_inv.organization_id;
end;
$$;

revoke execute on function public.create_organization(text, text) from public, anon;
revoke execute on function public.get_invitation_preview(text) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;
revoke execute on function public.audit_invitation_changes() from public, anon, authenticated;
grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.get_invitation_preview(text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
