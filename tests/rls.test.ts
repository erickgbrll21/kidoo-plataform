import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, errorOf, type Db } from "./helpers/db";

/**
 * Prova de isolamento multi-tenant executada contra as migrations REAIS.
 * Atores:
 *  Empresa A: alice (owner), carol (admin), dan (agent), erin (viewer)
 *  Empresa B: bob (owner)
 *  mallory: usuária sem empresa
 */
let db: Db;
const ids: Record<string, string> = {};
let orgA: string;
let orgB: string;

beforeAll(async () => {
  db = await createTestDb();
  for (const n of ["alice", "bob", "carol", "dan", "erin", "mallory"]) {
    ids[n] = await db.createUser(`${n}@example.com`, { name: n });
  }
  orgA = await db.createOrg(ids.alice!, "Empresa A", "empresa-a");
  orgB = await db.createOrg(ids.bob!, "Empresa B", "empresa-b");
  // sem limite de membros na A para montar o cenário (limite é testado à parte na B)
  await db.admin(`update public.subscriptions set plan_key = 'enterprise' where organization_id = $1`, [orgA]);
  await db.addMember(orgA, ids.alice!, ids.carol!, "carol@example.com", "admin");
  await db.addMember(orgA, ids.alice!, ids.dan!, "dan@example.com", "agent");
  await db.addMember(orgA, ids.alice!, ids.erin!, "erin@example.com", "viewer");
});

afterAll(async () => {
  await db.pg.close();
});

describe("isolamento entre empresas (leitura)", () => {
  it("bob só enxerga a própria empresa", async () => {
    const rows = await db.asUser<{ id: string }>(ids.bob!, `select id from public.organizations`);
    expect(rows.map((r) => r.id)).toEqual([orgB]);
  });

  it("bob não lê membros, assinatura, equipes nem convites da empresa A", async () => {
    for (const t of ["organization_members", "subscriptions", "teams", "invitations"]) {
      const rows = await db.asUser(ids.bob!, `select 1 from public.${t} where organization_id = $1`, [orgA]);
      expect(rows, t).toHaveLength(0);
    }
  });

  it("usuária sem empresa não enxerga nada de nenhum tenant", async () => {
    for (const t of ["organizations", "organization_members", "subscriptions"]) {
      expect(await db.asUser(ids.mallory!, `select 1 from public.${t}`), t).toHaveLength(0);
    }
  });

  it("perfis: colegas são visíveis; estranhos não", async () => {
    const rows = await db.asUser<{ id: string }>(ids.dan!, `select id from public.profiles`);
    const seen = new Set(rows.map((r) => r.id));
    expect(seen.has(ids.alice!)).toBe(true);
    expect(seen.has(ids.dan!)).toBe(true);
    expect(seen.has(ids.bob!)).toBe(false);
  });

  it("org_effective_limits retorna null para quem não é membro", async () => {
    const r = await db.asUser<{ l: unknown }>(ids.bob!, `select public.org_effective_limits($1) as l`, [orgA]);
    expect(r[0]!.l).toBeNull();
  });
});

describe("isolamento entre empresas (escrita)", () => {
  it("bob não altera a empresa A", async () => {
    const rows = await db.asUser(ids.bob!, `update public.organizations set name = 'hack' where id = $1 returning id`, [orgA]);
    expect(rows).toHaveLength(0);
  });

  it("bob não cria equipe na empresa A", async () => {
    const err = await errorOf(
      db.asUser(ids.bob!, `insert into public.teams (organization_id, name) values ($1, 'infiltrada')`, [orgA]),
    );
    expect(err).toMatch(/row-level security/);
  });

  it("bob não altera nem remove membros da empresa A", async () => {
    const roleAdmin = await db.roleId("admin");
    expect(
      await db.asUser(ids.bob!, `update public.organization_members set role_id = $2 where organization_id = $1 returning id`, [orgA, roleAdmin]),
    ).toHaveLength(0);
    expect(
      await db.asUser(ids.bob!, `delete from public.organization_members where organization_id = $1 returning id`, [orgA]),
    ).toHaveLength(0);
  });

  it("FK composta impede vincular usuário de outra empresa a uma equipe", async () => {
    const team = (await db.asUser<{ id: string }>(
      ids.alice!,
      `insert into public.teams (organization_id, name) values ($1, 'Comercial') returning id`,
      [orgA],
    ))[0]!;
    const err = await errorOf(
      db.admin(`insert into public.team_members (organization_id, team_id, user_id) values ($1, $2, $3)`, [orgA, team.id, ids.bob!]),
    );
    expect(err).toMatch(/foreign key/i);
  });

  it("usuário não pode inserir convite em nome de outro usuário nem em outra empresa", async () => {
    const roleAgent = await db.roleId("agent");
    const hash = "a".repeat(64);
    const e1 = await errorOf(
      db.asUser(ids.bob!, `insert into public.invitations (organization_id, email, role_id, token_hash, invited_by, expires_at)
        values ($1, 'x@example.com', $2, $3, $4, now() + interval '1 day')`, [orgA, roleAgent, hash, ids.bob!]),
    );
    expect(e1).toMatch(/row-level security/);
  });
});

describe("permissões por papel", () => {
  it("viewer e agent não convidam; admin convida", async () => {
    const roleAgent = await db.roleId("agent");
    const mk = (uid: string, n: string) =>
      db.asUser(uid, `insert into public.invitations (organization_id, email, role_id, token_hash, invited_by, expires_at)
        values ($1, $2, $3, $4, $5, now() + interval '1 day')`,
        [orgA, `${n}@convidado.com`, roleAgent, n.padEnd(64, "b"), uid]);
    expect(await errorOf(mk(ids.erin!, "v"))).toMatch(/row-level security/);
    expect(await errorOf(mk(ids.dan!, "a"))).toMatch(/row-level security/);
    expect(await errorOf(mk(ids.carol!, "ok"))).toBeNull();
  });

  it("admin não pode convidar proprietário; owner pode", async () => {
    const roleOwner = await db.roleId("owner");
    const mk = (uid: string, h: string, email: string) =>
      db.asUser(uid, `insert into public.invitations (organization_id, email, role_id, token_hash, invited_by, expires_at)
        values ($1, $2, $3, $4, $5, now() + interval '1 day')`, [orgA, email, roleOwner, h, uid]);
    expect(await errorOf(mk(ids.carol!, "c".repeat(64), "o1@convidado.com"))).toMatch(/owner_required/);
    expect(await errorOf(mk(ids.alice!, "d".repeat(64), "o2@convidado.com"))).toBeNull();
  });

  it("convite com expiração absurda é rejeitado", async () => {
    const roleAgent = await db.roleId("agent");
    const err = await errorOf(
      db.asUser(ids.alice!, `insert into public.invitations (organization_id, email, role_id, token_hash, invited_by, expires_at)
        values ($1, 'longo@convidado.com', $2, $3, $4, now() + interval '90 days')`, [orgA, roleAgent, "e".repeat(64), ids.alice!]),
    );
    expect(err).toMatch(/invalid_expiration/);
  });

  it("agent não escala o próprio papel; admin não rebaixa/remove proprietário nem promove a owner", async () => {
    const roleAdmin = await db.roleId("admin");
    const roleOwner = await db.roleId("owner");
    // auto-escalação: policy impede (0 linhas)
    expect(
      await db.asUser(ids.dan!, `update public.organization_members set role_id = $2 where user_id = $1 returning id`, [ids.dan!, roleAdmin]),
    ).toHaveLength(0);
    // admin tentando promover dan a owner
    expect(
      await errorOf(db.asUser(ids.carol!, `update public.organization_members set role_id = $2 where user_id = $1`, [ids.dan!, roleOwner])),
    ).toMatch(/owner_required/);
    // admin tentando remover o owner
    expect(
      await errorOf(db.asUser(ids.carol!, `delete from public.organization_members where user_id = $1 and organization_id = $2`, [ids.alice!, orgA])),
    ).toMatch(/owner_required/);
    // admin altera papel de um agent normalmente
    expect(
      await db.asUser(ids.carol!, `update public.organization_members set role_id = $2 where user_id = $1 and organization_id = $3 returning id`, [ids.dan!, await db.roleId("manager"), orgA]),
    ).toHaveLength(1);
    await db.admin(`update public.organization_members set role_id = $2 where user_id = $1`, [ids.dan!, await db.roleId("agent")]);
  });

  it("último proprietário não pode sair nem ser rebaixado", async () => {
    const e = await errorOf(db.asUser(ids.alice!, `delete from public.organization_members where user_id = $1 and organization_id = $2`, [ids.alice!, orgA]));
    expect(e).toMatch(/last_owner/);
    // service role também é bloqueado pelo gatilho
    const e2 = await errorOf(db.admin(`update public.organization_members set status = 'suspended' where user_id = $1 and organization_id = $2`, [ids.alice!, orgA]));
    expect(e2).toMatch(/last_owner/);
  });

  it("papel customizado de outra empresa não pode ser atribuído", async () => {
    const [custom] = await db.admin<{ id: string }>(
      `insert into public.roles (organization_id, key, name) values ($1, 'custom_b', 'Custom B') returning id`,
      [orgB],
    );
    const err = await errorOf(
      db.admin(`update public.organization_members set role_id = $1 where user_id = $2 and organization_id = $3`, [custom!.id, ids.dan!, orgA]),
    );
    expect(err).toMatch(/role_not_in_organization/);
  });

  it("clientes não alteram status/slug da empresa", async () => {
    const e1 = await errorOf(db.asUser(ids.alice!, `update public.organizations set status = 'suspended' where id = $1`, [orgA]));
    expect(e1).toMatch(/permission denied/);
    const e2 = await errorOf(db.asUser(ids.alice!, `update public.organizations set slug = 'novo-slug' where id = $1`, [orgA]));
    expect(e2).toMatch(/permission denied/);
    const ok = await db.asUser(ids.alice!, `update public.organizations set name = 'Empresa A Ltda' where id = $1 returning id`, [orgA]);
    expect(ok).toHaveLength(1);
  });
});

describe("convites", () => {
  const mkInvite = async (email: string, hash: string, orgId = orgA, by = ids.alice!, role = "agent") =>
    db.asUser(by, `insert into public.invitations (organization_id, email, role_id, token_hash, invited_by, expires_at)
      values ($1, $2, $3, $4, $5, now() + interval '3 days')`, [orgId, email, await db.roleId(role), hash, by]);

  it("e-mail diferente não aceita; e-mail não confirmado não aceita", async () => {
    const hash = "1".repeat(64);
    await mkInvite("mallory@example.com", hash);
    const stranger = await db.createUser("zed@example.com");
    expect(await errorOf(db.asUser(stranger, `select public.accept_invitation($1)`, [hash]))).toMatch(/invitation_email_mismatch/);

    // mallory (confirmada) aceita; usuário não confirmado com mesmo e-mail não
    const unconfirmed = await db.createUser("novo@example.com", { confirmed: false });
    const hash2 = "2".repeat(64);
    await mkInvite("novo@example.com", hash2);
    expect(await errorOf(db.asUser(unconfirmed, `select public.accept_invitation($1)`, [hash2]))).toMatch(/email_not_confirmed/);
  });

  it("aceite funciona uma única vez e vincula ao papel correto", async () => {
    // convite "1…" (agent) foi criado no teste anterior para mallory@example.com
    const r = await db.asUser<{ organization_id: string }>(
      ids.mallory!,
      `select public.accept_invitation($1) as organization_id`,
      ["1".repeat(64)],
    );
    expect(r[0]!.organization_id).toBe(orgA);
    expect(await errorOf(db.asUser(ids.mallory!, `select public.accept_invitation($1)`, ["1".repeat(64)]))).toMatch(/invitation_invalid/);
    const m = await db.asUser<{ key: string }>(
      ids.mallory!,
      `select r.key from public.organization_members m join public.roles r on r.id = m.role_id where m.user_id = $1`,
      [ids.mallory!],
    );
    expect(m[0]!.key).toBe("agent");
  });

  it("convite revogado ou expirado é inválido", async () => {
    const u = await db.createUser("rev@example.com");
    await mkInvite("rev@example.com", "4".repeat(64));
    // clientes não leem token_hash: revogação é feita por id
    const [inv] = await db.asUser<{ id: string }>(ids.alice!, `select id from public.invitations where email = 'rev@example.com'`);
    expect(await db.asUser(ids.alice!, `update public.invitations set revoked_at = now() where id = $1 returning id`, [inv!.id])).toHaveLength(1);
    expect(await errorOf(db.asUser(ids.alice!, `select token_hash from public.invitations`))).toMatch(/permission denied/);
    expect(await errorOf(db.asUser(u, `select public.accept_invitation($1)`, ["4".repeat(64)]))).toMatch(/invitation_invalid/);

    const u2 = await db.createUser("exp@example.com");
    await mkInvite("exp@example.com", "5".repeat(64));
    await db.admin(`update public.invitations set expires_at = now() - interval '1 minute' where token_hash = $1`, ["5".repeat(64)]);
    expect(await errorOf(db.asUser(u2, `select public.accept_invitation($1)`, ["5".repeat(64)]))).toMatch(/invitation_invalid/);
  });

  it("limite de membros do plano é respeitado (Starter = 3)", async () => {
    // Empresa B: owner(1) + 2 convites = 3; o terceiro convite excede o limite
    await mkInvite("b1@example.com", "6".repeat(64), orgB, ids.bob!);
    await mkInvite("b2@example.com", "7".repeat(64), orgB, ids.bob!);
    expect(await errorOf(mkInvite("b3@example.com", "8".repeat(64), orgB, ids.bob!))).toMatch(/member_limit_reached/);
  });

  it("limit_overrides tem precedência sobre o plano (null = ilimitado)", async () => {
    await db.admin(`update public.subscriptions set limit_overrides = '{"max_members": null, "max_whatsapp_numbers": 12}'::jsonb where organization_id = $1`, [orgB]);
    const l = (await db.asUser<{ l: Record<string, unknown> }>(ids.bob!, `select public.org_effective_limits($1) as l`, [orgB]))[0]!.l;
    expect(l.max_members).toBeNull();
    expect(l.max_whatsapp_numbers).toBe(12);
    expect(l.plan_key).toBe("starter");
    await mkInvite("b3@example.com", "8".repeat(64), orgB, ids.bob!); // agora passa
  });
});

describe("empresa: criação e suspensão", () => {
  it("valida nome/slug e impede slug duplicado", async () => {
    expect(await errorOf(db.createOrg(ids.mallory!, "X", "slug-valido"))).toMatch(/invalid_name/);
    expect(await errorOf(db.createOrg(ids.mallory!, "Nome ok", "Slug Inválido"))).toMatch(/invalid_slug/);
    expect(await errorOf(db.createOrg(ids.mallory!, "Outra", "empresa-a"))).toMatch(/slug_taken/);
  });

  it("sem sessão não cria empresa", async () => {
    expect(await errorOf(db.pg.query(`set role authenticated`).then(() => db.pg.query(`select public.create_organization('Teste', 'teste-x')`)).finally(() => db.pg.exec(`reset role`)))).toMatch(/not_authenticated/);
  });

  it("nova empresa nasce com Starter/trialing, sem cobrança e com proprietário", async () => {
    const org = await db.createOrg(ids.erin!, "Empresa Erin", "empresa-erin");
    const [s] = await db.admin<{ plan_key: string; status: string; billing_provider: string; provider_customer_id: string | null }>(
      `select plan_key, status, billing_provider, provider_customer_id from public.subscriptions where organization_id = $1`, [org]);
    expect(s).toMatchObject({ plan_key: "starter", status: "trialing", billing_provider: "none", provider_customer_id: null });
    const [m] = await db.admin<{ key: string }>(
      `select r.key from public.organization_members m join public.roles r on r.id = m.role_id where m.organization_id = $1`, [org]);
    expect(m!.key).toBe("owner");
  });

  it("empresa suspensa: leitura ok, nenhuma escrita por papel", async () => {
    await db.admin(`update public.organizations set status = 'suspended' where id = $1`, [orgB]);
    expect(await db.asUser(ids.bob!, `select 1 from public.organizations where id = $1`, [orgB])).toHaveLength(1);
    expect(await db.asUser(ids.bob!, `update public.organizations set name = 'x' where id = $1 returning id`, [orgB])).toHaveLength(0);
    expect(await errorOf(db.asUser(ids.bob!, `insert into public.teams (organization_id, name) values ($1, 'Nova')`, [orgB]))).toMatch(/row-level security/);
    await db.admin(`update public.organizations set status = 'active' where id = $1`, [orgB]);
  });
});

describe("auditoria, privilégios e rate limit", () => {
  it("audit_logs é append-only mesmo para superusuário", async () => {
    expect(await errorOf(db.admin(`update public.audit_logs set action = 'x.y.z'`))).toMatch(/append-only/);
    expect(await errorOf(db.admin(`delete from public.audit_logs`))).toMatch(/append-only/);
    expect(await errorOf(db.admin(`truncate public.audit_logs`))).toMatch(/append-only/);
  });

  it("mudanças de membros e convites são auditadas automaticamente", async () => {
    const rows = await db.admin<{ action: string }>(
      `select distinct action from public.audit_logs where organization_id = $1`, [orgA]);
    const actions = rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["organization.created", "member.added", "member.updated", "invitation.created", "invitation.accepted"]));
  });

  it("apenas quem tem audit.read lê auditoria — e só da própria empresa", async () => {
    expect((await db.asUser(ids.alice!, `select 1 from public.audit_logs where organization_id = $1`, [orgA])).length).toBeGreaterThan(0);
    expect(await db.asUser(ids.dan!, `select 1 from public.audit_logs where organization_id = $1`, [orgA])).toHaveLength(0);
    expect(await db.asUser(ids.bob!, `select 1 from public.audit_logs where organization_id = $1`, [orgA])).toHaveLength(0);
  });

  it("clientes não escrevem auditoria nem acessam rate_limits / funções internas", async () => {
    expect(await errorOf(db.asUser(ids.alice!, `insert into public.audit_logs (action, resource_type) values ('fake.event', 'x')`))).toMatch(/permission denied/);
    expect(await errorOf(db.asUser(ids.alice!, `select public.write_audit_log($1, null, 'fake.event', 'x')`, [orgA]))).toMatch(/permission denied/);
    expect(await errorOf(db.asUser(ids.alice!, `select * from public.rate_limits`))).toMatch(/permission denied/);
    expect(await errorOf(db.asUser(ids.alice!, `select * from public.consume_rate_limit('k', 5, 60)`))).toMatch(/permission denied/);
  });

  it("clientes não escrevem em planos nem assinaturas", async () => {
    expect(await errorOf(db.asUser(ids.alice!, `update public.subscriptions set plan_key = 'enterprise' where organization_id = $1`, [orgA]))).toMatch(/permission denied/);
    expect(await errorOf(db.asUser(ids.alice!, `update public.plans set max_members = 9999`))).toMatch(/permission denied/);
  });

  it("platform_admins: usuário comum não vê nem se promove", async () => {
    expect(await db.asUser(ids.alice!, `select 1 from public.platform_admins`)).toHaveLength(0);
    expect(await errorOf(db.asUser(ids.alice!, `insert into public.platform_admins (user_id) values ($1)`, [ids.alice!]))).toMatch(/permission denied/);
    const isAdmin = await db.asUser<{ a: boolean }>(ids.alice!, `select public.is_platform_admin() as a`);
    expect(isAdmin[0]!.a).toBe(false);
  });

  it("rate limit: bloqueia após o máximo e informa retry-after", async () => {
    const calls = [];
    for (let i = 0; i < 4; i++) {
      calls.push((await db.asService<{ allowed: boolean; remaining: number; retry_after_seconds: number }>(
        `select * from public.consume_rate_limit('login:test', 3, 60)`))[0]!);
    }
    expect(calls.map((c) => c.allowed)).toEqual([true, true, true, false]);
    expect(calls[3]!.retry_after_seconds).toBeGreaterThan(0);
    // chaves independentes
    const other = (await db.asService<{ allowed: boolean }>(`select * from public.consume_rate_limit('login:other', 3, 60)`))[0]!;
    expect(other.allowed).toBe(true);
  });
});

describe("Chatwoot espelho — isolamento RLS", () => {
  beforeAll(async () => {
    await db.admin(
      `insert into public.chatwoot_accounts (organization_id, chatwoot_account_id, status, provisioned_at)
       values ($1, 101, 'active', now()), ($2, 202, 'active', now())
       on conflict (organization_id) do update
         set chatwoot_account_id = excluded.chatwoot_account_id, status = 'active'`,
      [orgA, orgB],
    );
    await db.admin(
      `insert into public.contacts_mirror (organization_id, chatwoot_contact_id, name)
       values ($1, 1, 'Contato A'), ($2, 1, 'Contato B')
       on conflict (organization_id, chatwoot_contact_id) do nothing`,
      [orgA, orgB],
    );
    await db.admin(
      `insert into public.conversations_index
         (organization_id, chatwoot_account_id, chatwoot_conversation_id, status)
       values ($1, 101, 11, 'open'), ($2, 202, 22, 'open')
       on conflict (organization_id, chatwoot_conversation_id) do nothing`,
      [orgA, orgB],
    );
    await db.admin(
      `insert into public.webhook_events (organization_id, provider, idempotency_key, event_type, payload, status)
       values ($1, 'chatwoot', 'key-a', 'message_created', '{}'::jsonb, 'dead'),
              ($2, 'chatwoot', 'key-b', 'message_created', '{}'::jsonb, 'dead')
       on conflict (provider, idempotency_key) do nothing`,
      [orgA, orgB],
    );
  });

  it("bob não lê contacts_mirror nem conversations_index da empresa A", async () => {
    expect(await db.asUser(ids.bob!, `select 1 from public.contacts_mirror where organization_id = $1`, [orgA])).toHaveLength(0);
    expect(await db.asUser(ids.bob!, `select 1 from public.conversations_index where organization_id = $1`, [orgA])).toHaveLength(0);
  });

  it("alice lê o espelho da própria empresa", async () => {
    expect((await db.asUser(ids.alice!, `select 1 from public.contacts_mirror where organization_id = $1`, [orgA])).length).toBeGreaterThan(0);
    expect((await db.asUser(ids.alice!, `select 1 from public.conversations_index where organization_id = $1`, [orgA])).length).toBeGreaterThan(0);
  });

  it("clientes autenticados não leem webhook_events (só service_role)", async () => {
    expect(await errorOf(db.asUser(ids.alice!, `select 1 from public.webhook_events`))).toMatch(/permission denied|row-level security/);
  });

  it("idempotência: chave (provider, idempotency_key) é única", async () => {
    const err = await errorOf(
      db.admin(
        `insert into public.webhook_events (organization_id, provider, idempotency_key, event_type, payload)
         values ($1, 'chatwoot', 'key-a', 'message_created', '{}'::jsonb)`,
        [orgA],
      ),
    );
    expect(err).toMatch(/duplicate|unique/i);
  });
});
