import "server-only";
import { createClient } from "@/lib/database/server";

export type InboxAgentOption = {
  userId: string;
  fullName: string;
  chatwootUserId: number;
};

/** Agentes KIDOO vinculados ao Chatwoot (para atribuição). */
export async function listAssignableAgents(organizationId: string): Promise<InboxAgentOption[]> {
  const supabase = await createClient();
  const { data: links } = await supabase
    .from("chatwoot_agent_links")
    .select("user_id, chatwoot_user_id")
    .eq("organization_id", organizationId);

  if (!links?.length) return [];

  const userIds = links.map((l) => l.user_id as string);
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string) || "Agente"]));

  return links
    .map((l) => ({
      userId: l.user_id as string,
      fullName: names.get(l.user_id as string) || "Agente",
      chatwootUserId: Number(l.chatwoot_user_id),
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
}

export async function getMyChatwootUserId(organizationId: string, userId: string): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chatwoot_agent_links")
    .select("chatwoot_user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.chatwoot_user_id != null ? Number(data.chatwoot_user_id) : null;
}
