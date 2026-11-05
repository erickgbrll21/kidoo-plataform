import "server-only";
import { createClient } from "@/lib/database/server";
import { createServiceClient } from "@/lib/database/service";
import { getAccountAccessToken } from "@/services/chatwoot/provision";

export type ConversationGuard = {
  organizationId: string;
  chatwootAccountId: number;
  chatwootConversationId: number;
  chatwootInboxId: number | null;
  chatwootContactId: number | null;
  status: string;
  assigneeChatwootUserId: number | null;
  token: string;
};

/** Garante que a conversa pertence à empresa e devolve token Chatwoot da conta. */
export async function assertConversationInOrg(
  organizationId: string,
  chatwootConversationId: number,
): Promise<ConversationGuard | null> {
  const account = await getAccountAccessToken(organizationId);
  if (!account) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations_index")
    .select(
      "chatwoot_conversation_id, chatwoot_account_id, chatwoot_inbox_id, chatwoot_contact_id, status, assignee_chatwoot_user_id",
    )
    .eq("organization_id", organizationId)
    .eq("chatwoot_conversation_id", chatwootConversationId)
    .maybeSingle();

  if (!data) return null;
  if (Number(data.chatwoot_account_id) !== account.accountId) return null;

  return {
    organizationId,
    chatwootAccountId: account.accountId,
    chatwootConversationId: Number(data.chatwoot_conversation_id),
    chatwootInboxId: data.chatwoot_inbox_id != null ? Number(data.chatwoot_inbox_id) : null,
    chatwootContactId: data.chatwoot_contact_id != null ? Number(data.chatwoot_contact_id) : null,
    status: String(data.status ?? "open"),
    assigneeChatwootUserId:
      data.assignee_chatwoot_user_id != null ? Number(data.assignee_chatwoot_user_id) : null,
    token: account.token,
  };
}

/** Atualiza o índice local após mutação no Chatwoot (service role — webhook pode atrasar). */
export async function patchConversationIndex(
  organizationId: string,
  chatwootConversationId: number,
  patch: {
    status?: string;
    assigneeChatwootUserId?: number | null;
    lastMessagePreview?: string;
    lastMessageAt?: string;
  },
) {
  const db = createServiceClient();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status != null) row.status = patch.status;
  if (patch.assigneeChatwootUserId !== undefined) {
    row.assignee_chatwoot_user_id = patch.assigneeChatwootUserId;
  }
  if (patch.lastMessagePreview != null) row.last_message_preview = patch.lastMessagePreview.slice(0, 280);
  if (patch.lastMessageAt != null) row.last_message_at = patch.lastMessageAt;

  await db
    .from("conversations_index")
    .update(row)
    .eq("organization_id", organizationId)
    .eq("chatwoot_conversation_id", chatwootConversationId);
}
