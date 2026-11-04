import "server-only";
import { chatwootEnv } from "@/lib/env";

/**
 * Cliente HTTP do Chatwoot.
 *
 * IMPORTANTE (Nginx em atendimento.kidoohub.com.br):
 * `underscores_in_headers off` — NUNCA enviar `api_access_token`.
 * Sempre usar o header com hífen: `api-access-token`.
 */
export const CHATWOOT_TOKEN_HEADER = "api-access-token" as const;

export class ChatwootApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly path: string;

  constructor(message: string, opts: { status: number; body: unknown; path: string }) {
    super(message);
    this.name = "ChatwootApiError";
    this.status = opts.status;
    this.body = opts.body;
    this.path = opts.path;
  }
}

export type ChatwootRequestInit = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Token Platform App OU access_token do usuário/agente de serviço. */
  token: string;
  body?: unknown;
  searchParams?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
};

function joinUrl(base: string, path: string, searchParams?: ChatwootRequestInit["searchParams"]) {
  const url = new URL(path.replace(/^\//, ""), base.endsWith("/") ? base : `${base}/`);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url;
}

/**
 * Chamada genérica ao Chatwoot. Paths tipicamente:
 * - Platform: `/platform/api/v1/...`
 * - Account/Application: `/api/v1/accounts/{id}/...`
 */
export async function chatwootFetch<T>(path: string, init: ChatwootRequestInit): Promise<T> {
  const { baseUrl } = chatwootEnv();
  const url = joinUrl(baseUrl, path, init.searchParams);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "kidoo-hub/chatwoot-client",
    // hífen obrigatório — ver comentário no topo do arquivo
    [CHATWOOT_TOKEN_HEADER]: init.token,
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
      cache: "no-store",
    });
  } catch (err) {
    console.error("[chatwoot] rede", path, err);
    throw new ChatwootApiError("Falha de rede ao falar com o Chatwoot.", {
      status: 0,
      body: null,
      path,
    });
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    const detail =
      typeof parsed === "object" && parsed && "message" in parsed
        ? String((parsed as { message: unknown }).message)
        : typeof parsed === "object" && parsed && "error" in parsed
          ? String((parsed as { error: unknown }).error)
          : text.slice(0, 200);
    console.error("[chatwoot]", response.status, path, detail);
    throw new ChatwootApiError(detail || `Chatwoot respondeu ${response.status}`, {
      status: response.status,
      body: parsed,
      path,
    });
  }

  return parsed as T;
}

export function platformToken() {
  return chatwootEnv().platformToken;
}
