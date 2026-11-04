import "server-only";
import { randomBytes } from "node:crypto";
import { chatwootFetch, platformToken } from "./client";
import type { ChatwootPlatformUser } from "./types";

/** Senha que atende às regras típicas do Chatwoot (maiúscula, minúscula, número, especial). */
export function generateServicePassword() {
  return `Kh${randomBytes(12).toString("base64url")}!9a`;
}

export async function createPlatformUser(input: {
  name: string;
  email: string;
  password: string;
  customAttributes?: Record<string, unknown>;
}) {
  return chatwootFetch<ChatwootPlatformUser>("/platform/api/v1/users", {
    token: platformToken(),
    method: "POST",
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
      custom_attributes: input.customAttributes ?? {},
    },
  });
}

export async function getPlatformUser(userId: number) {
  return chatwootFetch<ChatwootPlatformUser>(`/platform/api/v1/users/${userId}`, {
    token: platformToken(),
  });
}

export async function deletePlatformUser(userId: number) {
  return chatwootFetch<unknown>(`/platform/api/v1/users/${userId}`, {
    token: platformToken(),
    method: "DELETE",
  });
}

/**
 * Lista agentes da conta (Application API).
 * Requer o access_token do usuário de serviço daquela conta.
 */
export async function listAccountAgents(accountId: number, accountToken: string) {
  return chatwootFetch<{ payload?: unknown[] } | unknown[]>(`/api/v1/accounts/${accountId}/agents`, {
    token: accountToken,
  });
}
