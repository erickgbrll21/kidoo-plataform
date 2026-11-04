import "server-only";
import { chatwootFetch } from "./client";

export type ChatwootTeam = { id: number; name: string; description?: string | null };

export async function listTeams(accountId: number, accountToken: string) {
  const data = await chatwootFetch<{ payload?: ChatwootTeam[] } | ChatwootTeam[]>(
    `/api/v1/accounts/${accountId}/teams`,
    { token: accountToken },
  );
  return Array.isArray(data) ? data : (data.payload ?? []);
}

export async function createTeam(
  accountId: number,
  accountToken: string,
  input: { name: string; description?: string },
) {
  return chatwootFetch<ChatwootTeam>(`/api/v1/accounts/${accountId}/teams`, {
    token: accountToken,
    method: "POST",
    body: { name: input.name, description: input.description ?? "" },
  });
}
