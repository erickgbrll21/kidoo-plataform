import "server-only";
import { chatwootFetch } from "./client";
import type { ChatwootMessage } from "./types";

export async function listMessages(accountId: number, conversationId: number, accountToken: string) {
  const data = await chatwootFetch<{ payload: ChatwootMessage[] }>(
    `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
    { token: accountToken },
  );
  return data.payload ?? [];
}

export async function sendMessage(
  accountId: number,
  conversationId: number,
  accountToken: string,
  input: { content: string; private?: boolean; messageType?: "outgoing" | "incoming" },
) {
  return chatwootFetch<ChatwootMessage>(
    `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
    {
      token: accountToken,
      method: "POST",
      body: {
        content: input.content,
        private: input.private ?? false,
        message_type: input.messageType ?? "outgoing",
      },
    },
  );
}
