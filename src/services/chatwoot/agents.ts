import "server-only";
import { createServiceClient } from "@/lib/database/service";
import {
  ChatwootApiError,
  createAccountUser,
  createPlatformUser,
  deletePlatformUser,
  generateServicePassword,
} from "@/lib/integrations/chatwoot";
import type { Result } from "@/services/organizations/service";
import { getChatwootAccountStatus } from "./provision";

function agentEmail(organizationId: string, userId: string) {
  const org = organizationId.replace(/-/g, "").slice(0, 10);
  const user = userId.replace(/-/g, "").slice(0, 12);
  return `cw.agent+${org}.${user}@kidoohub.internal`;
}

function chatwootRoleFromKey(roleKey: string | null | undefined): "administrator" | "agent" {
  return roleKey === "owner" || roleKey === "admin" ? "administrator" : "agent";
}

/**
 * Cria (ou reutiliza) o agente Chatwoot do membro e grava `chatwoot_agent_links`.
 * Falha não deve bloquear aceite de convite / onboarding — o caller decide.
 */
export async function linkMemberAsChatwootAgent(input: {
  organizationId: string;
  userId: string;
  fullName: string;
  roleKey?: string | null;
}): Promise<Result<{ chatwootUserId: number }>> {
  const account = await getChatwootAccountStatus(input.organizationId);
  if (!account || account.status !== "active" || !account.chatwoot_account_id) {
    return { ok: false, error: "Conta Chatwoot indisponível." };
  }

  const db = createServiceClient();
  const { data: existing } = await db
    .from("chatwoot_agent_links")
    .select("chatwoot_user_id")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (existing?.chatwoot_user_id) {
    return { ok: true, data: { chatwootUserId: existing.chatwoot_user_id as number } };
  }

  const role = chatwootRoleFromKey(input.roleKey);
  let createdUserId: number | null = null;

  try {
    const user = await createPlatformUser({
      name: (input.fullName || "Atendente KIDOO").slice(0, 80),
      email: agentEmail(input.organizationId, input.userId),
      password: generateServicePassword(),
      customAttributes: {
        kidoo_organization_id: input.organizationId,
        kidoo_user_id: input.userId,
        kidoo_role: "member_agent",
      },
    });
    createdUserId = user.id;
    await createAccountUser(account.chatwoot_account_id, user.id, role);

    const { error } = await db.from("chatwoot_agent_links").insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      chatwoot_user_id: user.id,
      chatwoot_account_id: account.chatwoot_account_id,
      role,
    });
    if (error) throw new Error(error.message);

    await db.rpc("write_audit_log", {
      p_organization_id: input.organizationId,
      p_actor_user_id: null,
      p_action: "chatwoot.agent_linked",
      p_resource_type: "chatwoot_agent_link",
      p_resource_id: String(user.id),
      p_metadata: { user_id: input.userId, role },
      p_actor_type: "system",
    });

    return { ok: true, data: { chatwootUserId: user.id } };
  } catch (err) {
    if (createdUserId) {
      try {
        await deletePlatformUser(createdUserId);
      } catch (e) {
        console.error("[chatwoot.agents] rollback user", e);
      }
    }
    const message =
      err instanceof ChatwootApiError
        ? `Chatwoot: ${err.message}`
        : err instanceof Error
          ? err.message
          : "Falha ao vincular agente.";
    console.error("[chatwoot.agents]", input.organizationId, input.userId, message);
    return { ok: false, error: message };
  }
}

/** Vincula agentes Chatwoot para membros ativos ainda sem `chatwoot_agent_links`. */
export async function syncMissingAgentLinks(organizationId: string): Promise<{ linked: number; failed: number }> {
  const account = await getChatwootAccountStatus(organizationId);
  if (!account || account.status !== "active" || !account.chatwoot_account_id) {
    return { linked: 0, failed: 0 };
  }

  const db = createServiceClient();
  const [{ data: members }, { data: links }, { data: roles }] = await Promise.all([
    db
      .from("organization_members")
      .select("user_id, role_id")
      .eq("organization_id", organizationId)
      .eq("status", "active"),
    db.from("chatwoot_agent_links").select("user_id").eq("organization_id", organizationId),
    db.from("roles").select("id, key"),
  ]);

  const linkedIds = new Set((links ?? []).map((l) => l.user_id as string));
  const roleKeyById = new Map((roles ?? []).map((r) => [r.id as string, r.key as string]));
  const pending = (members ?? []).filter((m) => !linkedIds.has(m.user_id as string));
  if (pending.length === 0) return { linked: 0, failed: 0 };

  const userIds = pending.map((m) => m.user_id as string);
  const { data: profiles } = await db.from("profiles").select("id, full_name").in("id", userIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string) || ""]));

  let linked = 0;
  let failed = 0;

  for (const m of pending) {
    const userId = m.user_id as string;
    const result = await linkMemberAsChatwootAgent({
      organizationId,
      userId,
      fullName: nameById.get(userId) ?? "",
      roleKey: roleKeyById.get(m.role_id as string) ?? null,
    });
    if (result.ok) linked += 1;
    else failed += 1;
  }

  return { linked, failed };
}
