import "server-only";
import { createClient } from "@/lib/database/server";

export type WhatsappConnectionRow = {
  id: string;
  provider: string;
  instanceId: string;
  displayPhoneNumber: string;
  verifiedName: string | null;
  status: "pending" | "active" | "error" | "disconnected";
  connectedAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  chatwootInboxId: number | null;
};

export async function listWhatsappConnections(organizationId: string): Promise<WhatsappConnectionRow[]> {
  const supabase = await createClient();
  const [{ data: rows }, { data: inboxes }] = await Promise.all([
    supabase
      .from("whatsapp_connections")
      .select(
        "id, provider, zapi_instance_id, display_phone_number, verified_name, status, connected_at, last_synced_at, last_error",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("chatwoot_inboxes")
      .select("connection_id, chatwoot_inbox_id")
      .eq("organization_id", organizationId)
      .not("connection_id", "is", null),
  ]);

  const inboxByConnection = new Map(
    (inboxes ?? []).map((i) => [i.connection_id as string, i.chatwoot_inbox_id as number]),
  );

  return (rows ?? []).map((r) => ({
    id: r.id as string,
    provider: (r.provider as string) || "zapi",
    instanceId: (r.zapi_instance_id as string) || "",
    displayPhoneNumber: (r.display_phone_number as string) || "",
    verifiedName: (r.verified_name as string | null) ?? null,
    status: r.status as WhatsappConnectionRow["status"],
    connectedAt: (r.connected_at as string | null) ?? null,
    lastSyncedAt: (r.last_synced_at as string | null) ?? null,
    lastError: (r.last_error as string | null) ?? null,
    chatwootInboxId: inboxByConnection.get(r.id as string) ?? null,
  }));
}
