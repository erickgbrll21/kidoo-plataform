import { after } from "next/server";
import { ingestChatwootWebhook, processWebhookEvent } from "@/services/chatwoot/webhooks";
import type { ChatwootWebhookPayload } from "@/lib/integrations/chatwoot";

/**
 * Receptor de webhooks do Chatwoot.
 * Autenticação: segredo por conta em `?t=` (Nginx não altera query string).
 * Sempre responde rápido; o espelho é atualizado via `after()`.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t");

  let payload: ChatwootWebhookPayload;
  try {
    payload = (await request.json()) as ChatwootWebhookPayload;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const result = await ingestChatwootWebhook(payload, token);
  if (!result.ok) return Response.json({ ok: false }, { status: result.status });

  if (result.eventId) {
    const eventId = result.eventId;
    after(async () => {
      try {
        await processWebhookEvent(eventId);
      } catch (err) {
        console.error("[chatwoot.webhook] after process", err);
      }
    });
  }

  return Response.json({ ok: true, duplicate: result.duplicate });
}

/** Health check simples (sem autenticação sensível). */
export async function GET() {
  return Response.json({ ok: true, service: "chatwoot-webhook" });
}
