"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  authorizeAction,
  fail,
  fieldErrorsOf,
  formObject,
  keepValues,
  succeed,
  type ActionState,
} from "@/lib/actions";
import { isChatwootConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/security/rate-limit";
import { connectZapiInstance } from "@/services/whatsapp/connect";
import { disconnectWhatsappNumber, removeWhatsappConnection } from "@/services/whatsapp/disconnect";

const connectSchema = z.object({
  instanceId: z.string().trim().min(3, "Instance ID inválido.").max(64),
  token: z.string().trim().min(8, "Token inválido.").max(200),
  clientToken: z.string().trim().min(8, "Client-Token inválido.").max(200),
  displayPhoneNumber: z.string().trim().max(32).optional().or(z.literal("")),
});

const disconnectSchema = z.object({
  connectionId: z.uuid({ error: "Conexão inválida." }),
});

export async function connectZapiAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("channels.manage");
  if (!auth.ok) return auth.state;

  const values = keepValues(formData, ["instanceId", "displayPhoneNumber"]);
  if (!isChatwootConfigured()) {
    return fail("Chatwoot precisa estar configurado antes de conectar WhatsApp.", { values });
  }

  const parsed = connectSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return fail("Verifique os campos da Z-API.", { fieldErrors: fieldErrorsOf(parsed.error), values });
  }

  const limit = await rateLimit({
    key: `wa-zapi:org:${auth.ctx.organization.id}`,
    max: 10,
    windowSeconds: 3600,
  });
  if (!limit.allowed) return fail("Muitas conexões em pouco tempo.", { values });

  const result = await connectZapiInstance({
    organizationId: auth.ctx.organization.id,
    userId: auth.ctx.user.id,
    instanceId: parsed.data.instanceId,
    token: parsed.data.token,
    clientToken: parsed.data.clientToken,
    displayPhoneNumber: parsed.data.displayPhoneNumber || undefined,
  });

  revalidatePath("/canais");
  revalidatePath("/dashboard");
  if (!result.ok) return fail(result.error, { values });
  return succeed(
    result.data.webhookConfigured
      ? "Instância Z-API conectada."
      : "Instância conectada, mas sem webhook: este ambiente não é HTTPS, então mensagens recebidas não chegam.",
  );
}

export async function disconnectWhatsappAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("channels.manage");
  if (!auth.ok) return auth.state;

  const parsed = disconnectSchema.safeParse(formObject(formData));
  if (!parsed.success) return fail("Conexão inválida.", { fieldErrors: fieldErrorsOf(parsed.error) });

  const result = await disconnectWhatsappNumber({
    organizationId: auth.ctx.organization.id,
    userId: auth.ctx.user.id,
    connectionId: parsed.data.connectionId,
  });

  revalidatePath("/canais");
  revalidatePath("/dashboard");
  revalidatePath("/inbox");
  return result.ok ? succeed("Número desconectado.") : fail(result.error);
}

export async function removeWhatsappAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("channels.manage");
  if (!auth.ok) return auth.state;

  const parsed = disconnectSchema.safeParse(formObject(formData));
  if (!parsed.success) return fail("Conexão inválida.", { fieldErrors: fieldErrorsOf(parsed.error) });

  const result = await removeWhatsappConnection({
    organizationId: auth.ctx.organization.id,
    userId: auth.ctx.user.id,
    connectionId: parsed.data.connectionId,
  });

  revalidatePath("/canais");
  revalidatePath("/dashboard");
  revalidatePath("/inbox");
  return result.ok ? succeed("Instância Z-API removida.") : fail(result.error);
}
