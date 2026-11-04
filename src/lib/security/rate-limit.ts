import "server-only";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/database/service";
import { isServiceRoleConfigured } from "@/lib/env";

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/**
 * Rate limit em Postgres (função `consume_rate_limit`) — compartilhado entre
 * instâncias/serverless, sem Redis. Falha FECHADO em produção.
 */
export async function rateLimit(opts: { key: string; max: number; windowSeconds: number }): Promise<RateLimitResult> {
  const isProd = process.env.NODE_ENV === "production";

  if (!isServiceRoleConfigured()) {
    if (isProd) return { allowed: false, retryAfterSeconds: 60 };
    console.warn("[rate-limit] SUPABASE_SERVICE_ROLE_KEY ausente: limite desativado (apenas desenvolvimento).");
    return { allowed: true, retryAfterSeconds: 0 };
  }

  try {
    const { data, error } = await createServiceClient().rpc("consume_rate_limit", {
      p_key: opts.key,
      p_max: opts.max,
      p_window_seconds: opts.windowSeconds,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { allowed: Boolean(row?.allowed), retryAfterSeconds: Number(row?.retry_after_seconds ?? 0) };
  } catch (err) {
    console.error("[rate-limit] erro ao consumir limite", err);
    return isProd ? { allowed: false, retryAfterSeconds: 30 } : { allowed: true, retryAfterSeconds: 0 };
  }
}

/**
 * IP do cliente. ATENÇÃO: só confie em X-Forwarded-For se a aplicação estiver atrás
 * de um proxy/CDN confiável que sobrescreve o cabeçalho (ex.: Vercel, Cloudflare, nginx).
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}
