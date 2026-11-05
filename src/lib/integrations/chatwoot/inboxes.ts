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

/** Inbox genérica API — útil para testes. */
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

/** Inbox WhatsApp Cloud — Chatwoot consome a Cloud API com o token do cliente. */
export async function createWhatsappCloudInbox(
  accountId: number,
  accountToken: string,
  input: {
    name: string;
    phoneNumber: string;
    phoneNumberId: string;
    businessAccountId: string;
    apiKey: string;
  },
) {
  return chatwootFetch<ChatwootInbox>(`/api/v1/accounts/${accountId}/inboxes`, {
    token: accountToken,
    method: "POST",
    body: {
      name: input.name,
      channel: {
        type: "whatsapp",
        phone_number: input.phoneNumber,
        provider: "whatsapp_cloud",
        provider_config: {
          api_key: input.apiKey,
          phone_number_id: input.phoneNumberId,
          business_account_id: input.businessAccountId,
        },
      },
    },
  });
}

export async function updateInbox(
  accountId: number,
  inboxId: number,
  accountToken: string,
  body: Record<string, unknown>,
) {
  return chatwootFetch<ChatwootInbox>(`/api/v1/accounts/${accountId}/inboxes/${inboxId}`, {
    token: accountToken,
    method: "PATCH",
    body,
  });
}

export async function deleteInbox(accountId: number, inboxId: number, accountToken: string) {
  return chatwootFetch<unknown>(`/api/v1/accounts/${accountId}/inboxes/${inboxId}`, {
    token: accountToken,
    method: "DELETE",
  });
}
