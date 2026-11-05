import { serverEnv } from "@/lib/env";
import { sweepPendingWebhooks } from "@/services/chatwoot/webhooks";

/**
 * Reprocessa webhooks pendentes / com backoff.
 * Protegido por `Authorization: Bearer ${CRON_SECRET}`.
 * Vercel Cron invoca GET; mantemos POST para disparo manual.
 */
async function run(request: Request) {
  const env = serverEnv();
  const secret = env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, error: "CRON_SECRET ausente" }, { status: 503 });

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== secret) return Response.json({ ok: false }, { status: 401 });

  const results = await sweepPendingWebhooks(25);
  return Response.json({
    ok: true,
    processed: results.length,
    failed: results.filter((r) => !r.ok).length,
  });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
