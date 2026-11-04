import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

/**
 * Banco de teste: Postgres real (PGlite) + as migrations REAIS do projeto.
 * Apenas o schema `auth` e os papéis do Supabase são simulados (stub mínimo).
 */
const AUTH_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    email_confirmed_at timestamptz,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to authenticated, service_role;
  grant select on auth.users to service_role;
`;

export type Db = Awaited<ReturnType<typeof createTestDb>>;

export async function createTestDb() {
  const pg = new PGlite();
  await pg.exec(AUTH_STUB);

  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    await pg.exec(readFileSync(join(dir, f), "utf8"));
  }

  /** Executa SQL como superusuário (setup / verificação). */
  async function admin<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    const r = await pg.query<T>(sql, params);
    return r.rows;
  }

  /** Executa SQL como um usuário autenticado (RLS + privilégios reais). */
  async function asUser<T = Record<string, unknown>>(userId: string, sql: string, params: unknown[] = []) {
    await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
    try {
      const r = await pg.query<T>(sql, params);
      return r.rows;
    } finally {
      await pg.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
    }
  }

  /** Executa SQL como service_role (processos sem usuário). */
  async function asService<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    await pg.exec(`set role service_role;`);
    try {
      const r = await pg.query<T>(sql, params);
      return r.rows;
    } finally {
      await pg.exec(`reset role;`);
    }
  }

  async function createUser(email: string, opts: { confirmed?: boolean; name?: string } = {}) {
    const rows = await admin<{ id: string }>(
      `insert into auth.users (email, email_confirmed_at, raw_user_meta_data)
       values ($1, $2, $3::jsonb) returning id`,
      [email, opts.confirmed === false ? null : new Date().toISOString(), JSON.stringify({ full_name: opts.name ?? email })],
    );
    return rows[0]!.id;
  }

  async function roleId(key: string) {
    const rows = await admin<{ id: string }>(
      `select id from public.roles where key = $1 and organization_id is null`,
      [key],
    );
    return rows[0]!.id;
  }

  /** Cria empresa via função oficial (como o app faz). */
  async function createOrg(ownerId: string, name: string, slug: string) {
    const rows = await asUser<{ create_organization: string }>(
      ownerId,
      `select public.create_organization($1, $2)`,
      [name, slug],
    );
    return rows[0]!.create_organization;
  }

  /** Convida e aceita (fluxo real) para colocar um usuário numa empresa com um papel. */
  async function addMember(orgId: string, inviterId: string, userId: string, email: string, role: string) {
    const hash = createHash("sha256").update(`${orgId}:${email}:${Math.random()}`).digest("hex");
    await asUser(
      inviterId,
      `insert into public.invitations (organization_id, email, role_id, token_hash, invited_by, expires_at)
       values ($1, $2, $3, $4, $5, now() + interval '7 days')`,
      [orgId, email, await roleId(role), hash, inviterId],
    );
    await asUser(userId, `select public.accept_invitation($1)`, [hash]);
  }

  return { pg, admin, asUser, asService, createUser, roleId, createOrg, addMember };
}

/** Retorna a mensagem de erro de uma promise que deve falhar (ou null). */
export async function errorOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
