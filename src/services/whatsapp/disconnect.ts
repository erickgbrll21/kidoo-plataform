import "server-only";
import { createServiceClient } from "@/lib/database/service";
import { deleteInbox } from "@/lib/integrations/chatwoot";
import { clearReceivedWebhook, type ZapiCredentials } from "@/lib/integrations/zapi";
import { getAccountAccessToken } from "@/services/chatwoot/provision";
import { deleteSecret, readSecret } from "@/services/chatwoot/secrets";
import type { Result } from "@/services/organizations/service";

export async function disconnectWhatsappNumber(input: {
  organizationId: string;
  userId: string;
  connectionId: string;
}): Promise<Result<null>> {
  const db = createServiceClient();
  const { data: conn } = await db
    .from("whatsapp_connections")
    .select("id, status, token_secret_id, webhook_secret_id, display_phone_number, zapi_instance_id")
    .eq("id", input.connectionId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (!conn) return { ok: false, error: "Conexão não encontrada." };
  if (conn.status === "disconnected") return { ok: true, data: null };

  if (conn.token_secret_id) {
    try {
      const raw = await readSecret(conn.token_secret_id as string, input.organizationId, "zapi_instance");
      const creds = JSON.parse(raw) as ZapiCredentials;
      await clearReceivedWebhook(creds);
    } catch (err) {
      console.error("[whatsapp.disconnect] clear webhook", err);
    }
  }

  const { data: inbox } = await db
    .from("chatwoot_inboxes")
    .select("id, chatwoot_inbox_id")
    .eq("organization_id", input.organizationId)
    .eq("connection_id", input.connectionId)
    .maybeSingle();

  const account = await getAccountAccessToken(input.organizationId);
  if (account && inbox?.chatwoot_inbox_id) {
    try {
      await deleteInbox(account.accountId, inbox.chatwoot_inbox_id as number, account.token);
    } catch (err) {
      console.error("[whatsapp.disconnect] chatwoot inbox", err);
    }
  }

  if (inbox?.id) {
    await db
      .from("chatwoot_inboxes")
      .update({ status: "disabled" })
      .eq("id", inbox.id as string)
      .eq("organization_id", input.organizationId);
  }

  for (const secretId of [conn.token_secret_id, conn.webhook_secret_id]) {
    if (!secretId) continue;
    try {
      await deleteSecret(secretId as string);
    } catch (err) {
      console.error("[whatsapp.disconnect] secret", err);
    }
  }

  await db
    .from("whatsapp_connections")
    .update({
      status: "disconnected",
      token_secret_id: null,
      webhook_secret_id: null,
      last_error: null,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", input.connectionId)
    .eq("organization_id", input.organizationId);

  await db.rpc("write_audit_log", {
    p_organization_id: input.organizationId,
    p_actor_user_id: input.userId,
    p_action: "whatsapp.disconnected",
    p_resource_type: "whatsapp_connection",
    p_resource_id: input.connectionId,
    p_metadata: {
      display: conn.display_phone_number,
      instance_id: conn.zapi_instance_id,
    },
    p_actor_type: "user",
  });

  return { ok: true, data: null };
}
