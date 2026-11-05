import { after } from "next/server";
import { ingestZapiWebhook, processZapiWebhookEvent, type ZapiReceivedPayload } from "@/services/whatsapp/webhooks";

type Ctx = { params: Promise<{ instanceId: string }> };

/**
 * Webhook Z-API "Ao receber".
 * URL configurada automaticamente no connect: /api/webhooks/zapi/{instanceId}?t=...
 */
export async function POST(request: Request, ctx: Ctx) {
  const { instanceId } = await ctx.params;
  const url = new URL(request.url);
  const token = url.searchParams.get("t");

  let payload: ZapiReceivedPayload;
  try {
    payload = (await request.json()) as ZapiReceivedPayload;
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const result = await ingestZapiWebhook(instanceId, payload, token);
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });

  if (result.eventId) {
    const eventId = result.eventId;
    after(async () => {
      try {
        await processZapiWebhookEvent(eventId);
      } catch (err) {
        console.error("[zapi.webhook] after()", err);
      }
    });
  }

  return Response.json({ ok: true, duplicate: result.duplicate });
}
