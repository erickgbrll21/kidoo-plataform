"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  authorizeAction,
  fail,
  fieldErrorsOf,
  formObject,
  succeed,
  type ActionState,
} from "@/lib/actions";
import { rateLimit } from "@/lib/security/rate-limit";
import { assignInboxConversation, replyToConversation, setConversationStatus } from "@/services/inbox/mutations";
import { syncConversationsFromChatwoot } from "@/services/inbox/sync";

const conversationIdSchema = z.coerce.number().int().positive();

const replySchema = z.object({
  conversationId: conversationIdSchema,
  content: z.string().trim().min(1, "Escreva uma mensagem.").max(4000),
  asPrivate: z.enum(["0", "1"]).optional(),
});

const assignSchema = z.object({
  conversationId: conversationIdSchema,
  assigneeChatwootUserId: z.union([z.literal(""), z.coerce.number().int().positive()]),
});

const statusSchema = z.object({
  conversationId: conversationIdSchema,
  status: z.enum(["open", "resolved", "pending", "snoozed"]),
});

function revalidateInbox() {
  revalidatePath("/inbox");
}

export async function sendInboxReplyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("inbox.reply");
  if (!auth.ok) return auth.state;

  const parsed = replySchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return fail("Verifique a mensagem.", { fieldErrors: fieldErrorsOf(parsed.error) });
  }

  const limit = await rateLimit({
    key: `inbox-reply:user:${auth.ctx.user.id}`,
    max: 60,
    windowSeconds: 60,
  });
  if (!limit.allowed) return fail("Muitas mensagens em pouco tempo. Aguarde um instante.");

  const result = await replyToConversation({
    organizationId: auth.ctx.organization.id,
    chatwootConversationId: parsed.data.conversationId,
    content: parsed.data.content,
    asPrivate: parsed.data.asPrivate === "1",
  });

  revalidateInbox();
  return result.ok ? succeed("Mensagem enviada.") : fail(result.error);
}

export async function assignInboxAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("inbox.assign");
  if (!auth.ok) return auth.state;

  const parsed = assignSchema.safeParse(formObject(formData));
  if (!parsed.success) return fail("Atribuição inválida.", { fieldErrors: fieldErrorsOf(parsed.error) });

  const result = await assignInboxConversation({
    organizationId: auth.ctx.organization.id,
    chatwootConversationId: parsed.data.conversationId,
    assigneeChatwootUserId:
      parsed.data.assigneeChatwootUserId === "" ? null : Number(parsed.data.assigneeChatwootUserId),
  });

  revalidateInbox();
  return result.ok ? succeed("Conversa atribuída.") : fail(result.error);
}

export async function setInboxStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("inbox.reply");
  if (!auth.ok) return auth.state;

  const parsed = statusSchema.safeParse(formObject(formData));
  if (!parsed.success) return fail("Situação inválida.", { fieldErrors: fieldErrorsOf(parsed.error) });

  const result = await setConversationStatus({
    organizationId: auth.ctx.organization.id,
    chatwootConversationId: parsed.data.conversationId,
    status: parsed.data.status,
  });

  revalidateInbox();
  return result.ok ? succeed("Situação atualizada.") : fail(result.error);
}

export async function syncInboxAction(): Promise<ActionState> {
  const auth = await authorizeAction("inbox.read");
  if (!auth.ok) return auth.state;

  const limit = await rateLimit({
    key: `inbox-sync:org:${auth.ctx.organization.id}`,
    max: 12,
    windowSeconds: 60,
  });
  if (!limit.allowed) return fail("Aguarde antes de sincronizar de novo.");

  const result = await syncConversationsFromChatwoot(auth.ctx.organization.id);
  revalidateInbox();
  return result.ok
    ? succeed(result.data.upserted ? `${result.data.upserted} conversa(s) sincronizada(s).` : "Nenhuma conversa no Chatwoot.")
    : fail(result.error);
}
