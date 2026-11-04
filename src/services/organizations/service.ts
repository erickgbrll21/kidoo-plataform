import "server-only";
import { createClient } from "@/lib/database/server";
import { dbErrorMessage } from "@/lib/database/errors";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type EffectiveLimits = {
  plan_key: string;
  subscription_status: string;
  max_whatsapp_numbers: number | null;
  max_members: number | null;
  max_ai_agents: number | null;
  max_automation_flows: number | null;
  max_monthly_ai_messages: number | null;
  features: Record<string, unknown>;
};

export async function createOrganization(input: { name: string; slug: string }): Promise<Result<{ id: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organization", { p_name: input.name, p_slug: input.slug });
  if (error || !data) return { ok: false, error: dbErrorMessage(error, "Não foi possível criar a empresa.") };
  return { ok: true, data: { id: data as string } };
}

export async function updateOrganizationName(organizationId: string, name: string): Promise<Result<null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({ name })
    .eq("id", organizationId)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  // RLS filtra silenciosamente: nenhuma linha atualizada = sem permissão
  if (!data?.length) return { ok: false, error: "Você não tem permissão para editar esta empresa." };
  return { ok: true, data: null };
}

export async function getEffectiveLimits(organizationId: string): Promise<EffectiveLimits | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("org_effective_limits", { p_org: organizationId });
  if (error || !data) return null;
  return data as EffectiveLimits;
}

export type PlanSummary = { key: string; name: string; description: string };

export async function getPlanSummary(planKey: string): Promise<PlanSummary | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("plans").select("key, name, description").eq("key", planKey).maybeSingle();
  return (data as PlanSummary | null) ?? null;
}

export async function countActiveMembers(organizationId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "active");
  return count ?? 0;
}

export async function listAuditLogs(organizationId: string, limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, resource_type, resource_id, actor_user_id, metadata, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data as Array<{
    id: string;
    action: string;
    resource_type: string;
    resource_id: string | null;
    actor_user_id: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
}
