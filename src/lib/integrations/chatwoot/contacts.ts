import "server-only";
import { chatwootFetch } from "./client";
import type { ChatwootContact } from "./types";

export async function searchContacts(accountId: number, accountToken: string, query: string) {
  const data = await chatwootFetch<{ payload: ChatwootContact[] }>(
    `/api/v1/accounts/${accountId}/contacts/search`,
    { token: accountToken, searchParams: { q: query } },
  );
  return data.payload ?? [];
}

export async function getContact(accountId: number, contactId: number, accountToken: string) {
  const data = await chatwootFetch<{ payload: ChatwootContact }>(
    `/api/v1/accounts/${accountId}/contacts/${contactId}`,
    { token: accountToken },
  );
  return data.payload;
}

export async function createContact(
  accountId: number,
  accountToken: string,
  input: { name?: string; email?: string; phoneNumber?: string; identifier?: string },
) {
  return chatwootFetch<{ payload: ChatwootContact }>(`/api/v1/accounts/${accountId}/contacts`, {
    token: accountToken,
    method: "POST",
    body: {
      name: input.name,
      email: input.email,
      phone_number: input.phoneNumber,
      identifier: input.identifier,
    },
  });
}
