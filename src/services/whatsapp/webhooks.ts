import "server-only";
import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/database/service";
import { createContact, searchContacts } from "@/lib/integrations/chatwoot/contacts";
import { createConversation } from "@/lib/integrations/chatwoot/conversations";
import { getAccountAccessToken } from "@/services/chatwoot/provision";
import { readSecret, webhookSecretMatches } from "@/services/chatwoot/secrets";

export type ZapiReceivedPayload = {
  phone?: string;
  fromMe?: boolean;
  isGroup?: boolean;
  participantPhone?: string;
  chatName?: string;
  senderName?: string;
  text?: { message?: string };
  body?: string;
  messageId?: string;
  instanceId?: string;
  momment?: number;
  type?: string;
};

function textFromPayload(payload: ZapiReceivedPayload): string {
  return (payload.text?.message || payload.body || "").trim();
}

function idempotencyKey(instanceId: string, payload: ZapiReceivedPayload): string {
  const raw = `${instanceId}|${payload.messageId ?? ""}|${payload.momment ?? ""}|${payload.type ?? "ReceivedCallback"}`;
  return createHash("sha256").update(raw).digest("hex");
}

export async function ingestZapiWebhook(
  instanceId: string,
  payload: ZapiReceivedPayload,
  tokenFromQuery: string | null,
): Promise<{ ok: true; duplicate: boolean; eventId: string | null } | { ok: false; error: string; status: number }> {
  if (!tokenFromQuery) return { ok: false, error: "missing token", status: 401 };

  const db = createServiceClient();
  const { data: conn } = await db
    .from("whatsapp_connections")
    .select("id, organization_id, webhook_secret_id, status, display_phone_number")
    .eq("zapi_instance_id", instanceId)
    .eq("status", "active")
    .maybeSingle();

  if (!conn?.organization_id || !conn.webhook_secret_id) {
    return { ok: false, error: "unknown instance", status: 404 };
  }

  // chatwoot_webhook purpose reutilizado com resource_key zapi:*
  const expected = await readSecret(
    conn.webhook_secret_id as string,
    conn.organization_id as string,
    "chatwoot_webhook",
  );
  if (!webhookSecretMatches(tokenFromQuery, expected)) {
    return { ok: false, error: "invalid token", status: 401 };
  }

  const key = idempotencyKey(instanceId, payload);
  const { data, error } = await db
    .from("webhook_events")
    .insert({
      organization_id: conn.organization_id,
      provider: "zapi",
      idempotency_key: key,
      event_type: String(payload.type ?? "ReceivedCallback"),
      payload: { ...payload, _connection_id: conn.id, _instance_id: instanceId },
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return { ok: true, duplicate: true, eventId: null };
    console.error("[zapi.webhook] insert", error.message);
    return { ok: false, error: "persist failed", status: 500 };
  }

  return { ok: true, duplicate: false, eventId: (data?.id as string) ?? null };
}

/** Espelha contato/conversa e empurra mensagem incoming para o Chatwoot (Inbox API). */
export async function processZapiWebhookEvent(eventId: string): Promise<{ ok: boolean; error?: string }> {
  const db = createServiceClient();
  const { data: event } = await db.from("webhook_events").select("*").eq("id", eventId).maybeSingle();
  if (!event) return { ok: false, error: "not found" };
  if (event.status === "done") return { ok: true };

  await db
    .from("webhook_events")
    .update({ status: "processing", attempts: (event.attempts as number) + 1 })
    .eq("id", eventId);

  try {
    const payload = event.payload as ZapiReceivedPayload & { _connection_id?: string; _instance_id?: string };
    const organizationId = event.organization_id as string;
    if (payload.fromMe || payload.isGroup) {
      await db
        .from("webhook_events")
        .update({ status: "done", processed_at: new Date().toISOString(), last_error: null })
        .eq("id", eventId);
      return { ok: true };
    }

    const phone = (payload.phone || "").replace(/\D/g, "");
    const content = textFromPayload(payload);
    if (!phone || !content) {
      await db
        .from("webhook_events")
        .update({ status: "done", processed_at: new Date().toISOString(), last_error: null })
        .eq("id", eventId);
      return { ok: true };
    }

    const name = payload.senderName || payload.chatName || phone;
    const account = await getAccountAccessToken(organizationId);
    const connectionId = payload._connection_id;
    let chatwootContactId: number | null = null;

    if (account && connectionId) {
      const { data: inbox } = await db
        .from("chatwoot_inboxes")
        .select("chatwoot_inbox_id")
        .eq("organization_id", organizationId)
        .eq("connection_id", connectionId)
        .eq("status", "active")
        .maybeSingle();

      if (inbox?.chatwoot_inbox_id) {
        const found = await searchContacts(account.accountId, account.token, phone);
        const match = found.find((c) => c.phone_number?.includes(phone) || c.identifier === `zapi:${phone}`);
        if (match?.id) {
          chatwootContactId = match.id;
        } else {
          const created = await createContact(account.accountId, account.token, {
            name,
            phoneNumber: `+${phone}`,
            identifier: `zapi:${phone}`,
          });
          chatwootContactId = created.payload?.id ?? null;
        }

        if (chatwootContactId) {
          try {
            await createConversation(account.accountId, account.token, {
              inboxId: inbox.chatwoot_inbox_id as number,
              contactId: chatwootContactId,
              sourceId: `zapi:${phone}`,
              content,
              messageType: "incoming",
            });
          } catch {
            console.warn("[zapi.webhook] createConversation falhou; seguindo com espelho");
          }
        }
      }
    }

    if (chatwootContactId) {
      await db.from("contacts_mirror").upsert(
        {
          organization_id: organizationId,
          chatwoot_contact_id: chatwootContactId,
          name,
          phone_number: phone,
          identifier: `zapi:${phone}`,
          last_activity_at: new Date().toISOString(),
          raw: payload,
        },
        { onConflict: "organization_id,chatwoot_contact_id" },
      );
    }

    await db
      .from("whatsapp_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", connectionId ?? "")
      .eq("organization_id", organizationId);

    await db
      .from("webhook_events")
      .update({ status: "done", processed_at: new Date().toISOString(), last_error: null })
      .eq("id", eventId);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro";
    const attempts = ((event.attempts as number) ?? 0) + 1;
    const dead = attempts >= 8;
    const delaySec = Math.min(3600, 2 ** Math.min(attempts, 10));
    await db
      .from("webhook_events")
      .update({
        status: dead ? "dead" : "pending",
        last_error: message.slice(0, 500),
        available_at: new Date(Date.now() + delaySec * 1000).toISOString(),
      })
      .eq("id", eventId);
    return { ok: false, error: message };
  }
}
