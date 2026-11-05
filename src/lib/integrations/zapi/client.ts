import "server-only";

const ZAPI_BASE = "https://api.z-api.io";

export class ZapiApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly path: string;

  constructor(message: string, opts: { status: number; body: unknown; path: string }) {
    super(message);
    this.name = "ZapiApiError";
    this.status = opts.status;
    this.body = opts.body;
    this.path = opts.path;
  }
}

export type ZapiCredentials = {
  instanceId: string;
  token: string;
  clientToken: string;
};

export async function zapiFetch<T>(
  creds: ZapiCredentials,
  path: string,
  init: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const cleanPath = path.replace(/^\//, "");
  const url = `${ZAPI_BASE}/instances/${encodeURIComponent(creds.instanceId)}/token/${encodeURIComponent(creds.token)}/${cleanPath}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Client-Token": creds.clientToken,
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    const errObj = parsed as { error?: string; message?: string } | null;
    throw new ZapiApiError(errObj?.error || errObj?.message || `Z-API HTTP ${res.status}`, {
      status: res.status,
      body: parsed,
      path: cleanPath,
    });
  }

  return parsed as T;
}
