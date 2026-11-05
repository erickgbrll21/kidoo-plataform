import "server-only";
import {
  assignConversation as cwAssign,
  sendMessage as cwSend,
  updateConversationStatus as cwStatus,
} from "@/lib/integrations/chatwoot";
import type { Result } from "@/services/organizations/service";
import { assertConversationInOrg, patchConversationIndex } from "./guards";

export async function replyToConversation(input: {
  organizationId: string;
  chatwootConversationId: number;
  content: string;
  asPrivate?: boolean;
}): Promise<Result<{ messageId: number }>> {
  const content = input.content.trim();
  if (!content) return { ok: false, error: "Escreva uma mensagem." };
  if (content.length > 4000) return { ok: false, error: "Mensagem muito longa (máx. 4000 caracteres)." };

  const guard = await assertConversationInOrg(input.organizationId, input.chatwootConversationId);
  if (!guard) return { ok: false, error: "Conversa não encontrada nesta empresa." };

  try {
    const msg = await cwSend(guard.chatwootAccountId, guard.chatwootConversationId, guard.token, {
      content,
      private: input.asPrivate ?? false,
      messageType: "outgoing",
    });
    await patchConversationIndex(input.organizationId, guard.chatwootConversationId, {
      lastMessagePreview: content,
      lastMessageAt: new Date().toISOString(),
      status: guard.status === "resolved" ? "open" : guard.status,
    });
    return { ok: true, data: { messageId: msg.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao enviar mensagem." };
  }
}

export async function assignInboxConversation(input: {
  organizationId: string;
  chatwootConversationId: number;
  assigneeChatwootUserId: number | null;
}): Promise<Result<null>> {
  const guard = await assertConversationInOrg(input.organizationId, input.chatwootConversationId);
  if (!guard) return { ok: false, error: "Conversa não encontrada nesta empresa." };

  try {
    await cwAssign(
      guard.chatwootAccountId,
      guard.chatwootConversationId,
      guard.token,
      input.assigneeChatwootUserId,
    );
    await patchConversationIndex(input.organizationId, guard.chatwootConversationId, {
      assigneeChatwootUserId: input.assigneeChatwootUserId,
    });
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao atribuir conversa." };
  }
}

export async function setConversationStatus(input: {
  organizationId: string;
  chatwootConversationId: number;
  status: "open" | "resolved" | "pending" | "snoozed";
}): Promise<Result<null>> {
  const guard = await assertConversationInOrg(input.organizationId, input.chatwootConversationId);
  if (!guard) return { ok: false, error: "Conversa não encontrada nesta empresa." };

  try {
    await cwStatus(guard.chatwootAccountId, guard.chatwootConversationId, guard.token, input.status);
    await patchConversationIndex(input.organizationId, guard.chatwootConversationId, {
      status: input.status,
    });
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao alterar situação." };
  }
}
