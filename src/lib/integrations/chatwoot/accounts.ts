import "server-only";
import { chatwootFetch, platformToken } from "./client";
import type { ChatwootAccount, ChatwootAccountUser } from "./types";

export async function createPlatformAccount(input: {
  name: string;
  locale?: string;
  supportEmail?: string;
}) {
  return chatwootFetch<ChatwootAccount>("/platform/api/v1/accounts", {
    token: platformToken(),
    method: "POST",
    body: {
      name: input.name,
      locale: input.locale ?? "pt_BR",
      ...(input.supportEmail ? { support_email: input.supportEmail } : {}),
      status: "active",
    },
  });
}

export async function getPlatformAccount(accountId: number) {
  return chatwootFetch<ChatwootAccount>(`/platform/api/v1/accounts/${accountId}`, {
    token: platformToken(),
  });
}

export async function listPlatformAccounts() {
  return chatwootFetch<ChatwootAccount[]>("/platform/api/v1/accounts", {
    token: platformToken(),
  });
}

export async function deletePlatformAccount(accountId: number) {
  return chatwootFetch<unknown>(`/platform/api/v1/accounts/${accountId}`, {
    token: platformToken(),
    method: "DELETE",
  });
}

export async function createAccountUser(accountId: number, userId: number, role: "administrator" | "agent") {
  return chatwootFetch<ChatwootAccountUser>(`/platform/api/v1/accounts/${accountId}/account_users`, {
    token: platformToken(),
    method: "POST",
    body: { user_id: userId, role },
  });
}
