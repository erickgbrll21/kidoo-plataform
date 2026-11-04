import "server-only";
import { chatwootFetch } from "./client";
import { CHATWOOT_WEBHOOK_SUBSCRIPTIONS, type ChatwootWebhook } from "./types";

export async function listWebhooks(accountId: number, accountToken: string) {
  const data = await chatwootFetch<{ payload?: ChatwootWebhook[] } | ChatwootWebhook[]>(
    `/api/v1/accounts/${accountId}/webhooks`,
    { token: accountToken },
  );
  return Array.isArray(data) ? data : (data.payload ?? []);
}

export async function createWebhook(
  accountId: number,
  accountToken: string,
  input: { url: string; subscriptions?: readonly string[] },
) {
  return chatwootFetch<ChatwootWebhook>(`/api/v1/accounts/${accountId}/webhooks`, {
    token: accountToken,
    method: "POST",
    body: {
      url: input.url,
      subscriptions: [...(input.subscriptions ?? CHATWOOT_WEBHOOK_SUBSCRIPTIONS)],
    },
  });
}

export async function deleteWebhook(accountId: number, webhookId: number, accountToken: string) {
  return chatwootFetch<unknown>(`/api/v1/accounts/${accountId}/webhooks/${webhookId}`, {
    token: accountToken,
    method: "DELETE",
  });
}
