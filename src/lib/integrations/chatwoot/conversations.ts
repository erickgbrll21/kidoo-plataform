import "server-only";
import { chatwootFetch } from "./client";
import type { ChatwootConversation } from "./types";

export async function listConversations(
  accountId: number,
  accountToken: string,
  opts?: { status?: string; inboxId?: number; page?: number },
) {
  const data = await chatwootFetch<{ data: { payload: ChatwootConversation[] } } | { payload: ChatwootConversation[] }>(
    `/api/v1/accounts/${accountId}/conversations`,
    {
      token: accountToken,
      searchParams: {
        status: opts?.status,
        inbox_id: opts?.inboxId,
        page: opts?.page,
      },
    },
  );
  if ("data" in data && data.data?.payload) return data.data.payload;
  if ("payload" in data) return data.payload ?? [];
  return [];
}

export async function getConversation(accountId: number, conversationId: number, accountToken: string) {
  return chatwootFetch<ChatwootConversation>(
    `/api/v1/accounts/${accountId}/conversations/${conversationId}`,
    { token: accountToken },
  );
}

export async function updateConversationStatus(
  accountId: number,
  conversationId: number,
  accountToken: string,
  status: "open" | "resolved" | "pending" | "snoozed",
) {
  return chatwootFetch<ChatwootConversation>(
    `/api/v1/accounts/${accountId}/conversations/${conversationId}/toggle_status`,
    { token: accountToken, method: "POST", body: { status } },
  );
}

export async function assignConversation(
  accountId: number,
  conversationId: number,
  accountToken: string,
  assigneeId: number | null,
) {
  return chatwootFetch<unknown>(`/api/v1/accounts/${accountId}/conversations/${conversationId}/assignments`, {
    token: accountToken,
    method: "POST",
    body: { assignee_id: assigneeId },
  });
}
