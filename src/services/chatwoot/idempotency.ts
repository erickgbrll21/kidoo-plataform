import { createHash } from "node:crypto";
import type { ChatwootWebhookPayload } from "@/lib/integrations/chatwoot/types";

/** Chave estável para deduplicar o mesmo evento Chatwoot. */
export function buildWebhookIdempotencyKey(payload: ChatwootWebhookPayload): string {
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
