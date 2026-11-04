import "server-only";
import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/database/service";
import type { ChatwootWebhookPayload } from "@/lib/integrations/chatwoot";
import { readSecret, webhookSecretMatches } from "./secrets";

export type IngestResult =
  | { ok: true; duplicate: boolean; eventId: string | null }
  | { ok: false; error: string; status: number };

function idempotencyKey(payload: ChatwootWebhookPayload): string {
  const accountId = payload.account?.id ?? "x";
  const event = payload.event ?? "unknown";
  const id =
    payload.id ??
    payload.conversation?.id ??
    payload.conversation_id ??
    payload.messages?.[0]?.id ??
    "none";
  const updated = payload.updated_at ?? payload.created_at ?? payload.conversation?.timestamp ?? "";
  const raw = `${accountId}|${event}|${id}|${updated}`;
  return createHash("sha256").update(String(raw)).digest("hex");
}

async function resolveOrgByChatwootAccount(chatwootAccountId: number) {
  const db = createServiceClient();
  const { data } = await db
    .from("chatwoot_accounts")
    .select("organization_id, webhook_secret_id, status")
    .eq("chatwoot_account_id", chatwootAccountId)
    .eq("status", "active")
    .maybeSingle();
  return data;
}

/**
 * Valida o segredo da URL (?t=), resolve o tenant pelo account.id do payload
 * e enfileira com idempotência. Resposta deve ser rápida (200).
 */
export async function ingestChatwootWebhook(
  payload: ChatwootWebhookPayload,
  tokenFromQuery: string | null,
): Promise<IngestResult> {
  if (!tokenFromQuery) return { ok: false, error: "missing token", status: 401 };
  const accountId = payload.account?.id;
  if (!accountId) return { ok: false, error: "missing account", status: 400 };

  const row = await resolveOrgByChatwootAccount(accountId);
  if (!row?.organization_id || !row.webhook_secret_id) {
    return { ok: false, error: "unknown account", status: 404 };
  }

  const expected = await readSecret(row.webhook_secret_id as string, row.organization_id as string, "chatwoot_webhook");
  if (!webhookSecretMatches(tokenFromQuery, expected)) {
    return { ok: false, error: "invalid token", status: 401 };
  }

  // Inbox do payload, se presente, deve pertencer à conta (quando já mapeada)
  const inboxId = payload.inbox?.id ?? payload.conversation?.inbox_id;
  if (inboxId) {
    const db = createServiceClient();
    const { data: inbox } = await db
      .from("chatwoot_inboxes")
      .select("id")
      .eq("organization_id", row.organization_id)
      .eq("chatwoot_inbox_id", inboxId)
      .maybeSingle();
    // Sem inboxes cadastradas ainda (pré-Fase 4): aceita o evento da conta.
    const { count } = await db
      .from("chatwoot_inboxes")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", row.organization_id);
    if ((count ?? 0) > 0 && !inbox) {
      return { ok: false, error: "inbox mismatch", status: 403 };
    }
  }

  const key = idempotencyKey(payload);
  const db = createServiceClient();
  const { data, error } = await db
    .from("webhook_events")
    .insert({
      organization_id: row.organization_id,
      provider: "chatwoot",
      idempotency_key: key,
      event_type: String(payload.event ?? "unknown"),
      payload,
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return { ok: true, duplicate: true, eventId: null };
    console.error("[chatwoot.webhook] insert", error.message);
    return { ok: false, error: "persist failed", status: 500 };
  }

  return { ok: true, duplicate: false, eventId: (data?.id as string) ?? null };
}

function asStatus(value: unknown): "open" | "resolved" | "pending" | "snoozed" {
  const s = String(value ?? "open");
  if (s === "resolved" || s === "pending" || s === "snoozed") return s;
  return "open";
}

function previewFromPayload(payload: ChatwootWebhookPayload): string {
  const content =
    payload.content ??
    payload.messages?.[0]?.content ??
    payload.conversation?.last_non_activity_message?.content ??
    "";
  return String(content ?? "").slice(0, 240);
}

/** Processa um evento pendente — atualiza espelho de contato/conversa. */
export async function processWebhookEvent(eventId: string): Promise<{ ok: boolean; error?: string }> {
  const db = createServiceClient();
  const { data: event } = await db.from("webhook_events").select("*").eq("id", eventId).maybeSingle();
  if (!event) return { ok: false, error: "not found" };
  if (event.status === "done") return { ok: true };

  await db
    .from("webhook_events")
    .update({ status: "processing", attempts: (event.attempts as number) + 1 })
    .eq("id", eventId);

  try {
    const payload = event.payload as ChatwootWebhookPayload;
    const organizationId = event.organization_id as string;
    const accountId = payload.account?.id;
    if (!organizationId || !accountId) throw new Error("payload incompleto");

    const contact = payload.sender ?? payload.conversation?.meta?.sender;
    if (contact?.id) {
      await db.from("contacts_mirror").upsert(
        {
          organization_id: organizationId,
          chatwoot_contact_id: contact.id,
          name: contact.name ?? "",
          email: contact.email ?? null,
          phone_number: contact.phone_number ?? null,
          identifier: contact.identifier ?? null,
          last_activity_at: new Date().toISOString(),
          raw: contact,
        },
        { onConflict: "organization_id,chatwoot_contact_id" },
      );
    }

    const conversationId = payload.conversation?.id ?? payload.conversation_id;
    if (conversationId) {
      const conv = payload.conversation;
      await db.from("conversations_index").upsert(
        {
          organization_id: organizationId,
          chatwoot_account_id: accountId,
          chatwoot_conversation_id: conversationId,
          chatwoot_inbox_id: conv?.inbox_id ?? payload.inbox?.id ?? null,
          chatwoot_contact_id: contact?.id ?? conv?.meta?.sender?.id ?? null,
          status: asStatus(conv?.status),
          assignee_chatwoot_user_id: conv?.meta?.assignee?.id ?? null,
          last_message_at: new Date().toISOString(),
          last_message_preview: previewFromPayload(payload),
          unread_count: conv?.unread_count ?? 0,
          meta: { event: payload.event },
        },
        { onConflict: "organization_id,chatwoot_conversation_id" },
      );
    }

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

export async function sweepPendingWebhooks(limit = 20) {
  const db = createServiceClient();
  const { data } = await db
    .from("webhook_events")
    .select("id")
    .eq("provider", "chatwoot")
    .eq("status", "pending")
    .lte("available_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);

  const results = [];
  for (const row of data ?? []) {
    results.push(await processWebhookEvent(row.id as string));
  }
  return results;
}
