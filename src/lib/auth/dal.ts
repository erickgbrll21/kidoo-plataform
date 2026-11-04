import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/database/server";
import type { Permission } from "./permissions";

/**
 * DATA ACCESS LAYER — única porta de entrada para saber "quem é o usuário" e
 * "em qual empresa ele está agindo".
 *
 * Regras:
 *  - A empresa ativa vem de um cookie, mas o cookie é só uma PREFERÊNCIA: a cada
 *    requisição o vínculo é reconsultado no banco (RLS) com a sessão do usuário.
 *  - Nenhum organization_id vindo do navegador é confiável sem passar por aqui.
 *  - `getUser()` valida o token no servidor Auth (não apenas decodifica o JWT).
 */

export const ACTIVE_ORG_COOKIE = "kidoo_org";

export type SessionUser = { id: string; email: string; emailConfirmed: boolean };

export type MembershipSummary = {
  organizationId: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  roleKey: string;
  roleName: string;
};

export type TenantContext = {
  status: "ready";
  user: SessionUser & { fullName: string };
  organization: { id: string; name: string; slug: string; status: "active" | "suspended" };
  role: { id: string; key: string; name: string };
  permissions: ReadonlySet<Permission>;
  memberships: MembershipSummary[];
};

export type ContextResult =
  | { status: "anonymous" }
  | { status: "no_organization"; user: SessionUser & { fullName: string } }
  | TenantContext;

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    emailConfirmed: Boolean(data.user.email_confirmed_at),
  };
});

type MembershipRow = {
  role_id: string;
  role: { id: string; key: string; name: string } | null;
  organization: { id: string; name: string; slug: string; status: "active" | "suspended" } | null;
};

export const getTenantContext = cache(async (): Promise<ContextResult> => {
  const user = await getSessionUser();
  if (!user) return { status: "anonymous" };

  const supabase = await createClient();

  const [{ data: profile }, { data: rows, error }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("organization_members")
      .select("role_id, role:roles(id, key, name), organization:organizations(id, name, slug, status)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
  ]);

  if (error) throw new Error(`Falha ao carregar vínculos do usuário: ${error.message}`);

  const fullUser = { ...user, fullName: (profile?.full_name as string | undefined) ?? "" };
  const memberships = ((rows ?? []) as unknown as MembershipRow[]).filter((r) => r.organization && r.role);

  if (memberships.length === 0) return { status: "no_organization", user: fullUser };

  const preferred = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const active = memberships.find((m) => m.organization!.id === preferred) ?? memberships[0]!;

  const { data: perms, error: permError } = await supabase
    .from("role_permissions")
    .select("permission_key")
    .eq("role_id", active.role_id);
  if (permError) throw new Error(`Falha ao carregar permissões: ${permError.message}`);

  return {
    status: "ready",
    user: fullUser,
    organization: active.organization!,
    role: active.role!,
    permissions: new Set((perms ?? []).map((p) => p.permission_key as Permission)),
    memberships: memberships.map((m) => ({
      organizationId: m.organization!.id,
      name: m.organization!.name,
      slug: m.organization!.slug,
      status: m.organization!.status,
      roleKey: m.role!.key,
      roleName: m.role!.name,
    })),
  };
});

/** Para páginas/layouts do app: garante sessão + empresa ativa e utilizável. */
export async function requireTenantContext(): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (ctx.status === "anonymous") redirect("/login");
  if (ctx.status === "no_organization") redirect("/onboarding");
  if (ctx.organization.status === "suspended") redirect("/suspenso");
  return ctx;
}

/** Para páginas fora do shell (onboarding, convite): exige apenas sessão. */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

export function can(ctx: Pick<TenantContext, "permissions">, permission: Permission) {
  return ctx.permissions.has(permission);
}

/** Administração interna da KIDOO — independente de qualquer papel de empresa. */
export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const user = await getSessionUser();
  if (!user) return false;
  const supabase = await createClient();
  // RLS: cada usuário só enxerga a própria linha.
  const { data } = await supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return Boolean(data);
});

export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (!(await isPlatformAdmin())) notFound(); // não revela a existência da área
  return user;
}
