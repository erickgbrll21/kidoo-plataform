import "server-only";
import { createServiceClient } from "@/lib/database/service";
import type { Result } from "@/services/organizations/service";

/**
 * Operações da administração interna da KIDOO. Usam o service role (ignoram RLS),
 * portanto TODA chamada precisa ter passado antes por `requirePlatformAdmin()` /
 * `isPlatformAdmin()` na camada de entrada (página ou Server Action).
 */

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  createdAt: string;
  planKey: string | null;
  subscriptionStatus: string | null;
  activeMembers: number;
};

const TENANT_LIMIT = 200;

export async function listTenants(): Promise<{ rows: TenantRow[]; truncated: boolean }> {
  const db = createServiceClient();
  const { data: orgs, error } = await db
    .from("organizations")
    .select("id, name, slug, status, created_at")
    .order("created_at", { ascending: false })
    .limit(TENANT_LIMIT + 1);
  if (error) throw new Error(`Falha ao listar empresas: ${error.message}`);

  const truncated = (orgs?.length ?? 0) > TENANT_LIMIT;
  const page = (orgs ?? []).slice(0, TENANT_LIMIT);
  const ids = page.map((o) => o.id as string);
  if (ids.length === 0) return { rows: [], truncated: false };

  const [{ data: subs }, { data: members }] = await Promise.all([
    db.from("subscriptions").select("organization_id, plan_key, status").in("organization_id", ids),
    db.from("organization_members").select("organization_id").eq("status", "active").in("organization_id", ids),
  ]);

  const subByOrg = new Map((subs ?? []).map((s) => [s.organization_id as string, s]));
  const counts = new Map<string, number>();
  for (const m of members ?? []) {
    const id = m.organization_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return {
    truncated,
    rows: page.map((o) => {
      const sub = subByOrg.get(o.id as string);
      return {
        id: o.id as string,
        name: o.name as string,
        slug: o.slug as string,
        status: o.status as "active" | "suspended",
        createdAt: o.created_at as string,
        planKey: (sub?.plan_key as string | undefined) ?? null,
        subscriptionStatus: (sub?.status as string | undefined) ?? null,
        activeMembers: counts.get(o.id as string) ?? 0,
      };
    }),
  };
}

export async function setTenantStatus(
  adminUserId: string,
  organizationId: string,
  status: "active" | "suspended",
): Promise<Result<null>> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("organizations")
    .update({ status })
    .eq("id", organizationId)
    .select("id");
  if (error) return { ok: false, error: "Não foi possível alterar a situação da empresa." };
  if (!data?.length) return { ok: false, error: "Empresa não encontrada." };

  const { error: auditError } = await db.rpc("write_audit_log", {
    p_organization_id: organizationId,
    p_actor_user_id: adminUserId,
    p_action: status === "suspended" ? "organization.suspended" : "organization.reactivated",
    p_resource_type: "organization",
    p_resource_id: organizationId,
    p_metadata: {},
    p_actor_type: "platform_admin",
  });
  if (auditError) console.error("[admin] falha ao registrar auditoria", auditError.message);

  return { ok: true, data: null };
}
