import "server-only";
import { chatwootFetch } from "./client";
import type { ChatwootInbox } from "./types";

export async function listInboxes(accountId: number, accountToken: string) {
  const data = await chatwootFetch<{ payload: ChatwootInbox[] } | ChatwootInbox[]>(
    `/api/v1/accounts/${accountId}/inboxes`,
    { token: accountToken },
  );
  return Array.isArray(data) ? data : (data.payload ?? []);
}

export async function getInbox(accountId: number, inboxId: number, accountToken: string) {
  return chatwootFetch<ChatwootInbox>(`/api/v1/accounts/${accountId}/inboxes/${inboxId}`, {
    token: accountToken,
  });
}

/** Inbox genérica API — útil para testes; WhatsApp Cloud entra na Fase 4. */
export async function createApiInbox(
  accountId: number,
  accountToken: string,
  input: { name: string; webhookUrl?: string },
) {
  return chatwootFetch<ChatwootInbox>(`/api/v1/accounts/${accountId}/inboxes`, {
    token: accountToken,
    method: "POST",
    body: {
      name: input.name,
      channel: {
        type: "api",
        ...(input.webhookUrl ? { webhook_url: input.webhookUrl } : {}),
      },
    },
  });
}
