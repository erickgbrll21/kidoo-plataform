import "server-only";
import { createServiceClient } from "@/lib/database/service";
import { listConversations as cwListConversations } from "@/lib/integrations/chatwoot";
import { getAccountAccessToken } from "@/services/chatwoot/provision";
import type { Result } from "@/services/organizations/service";

/**
 * Puxa conversas recentes do Chatwoot para o índice local.
 * Útil quando webhooks atrasam ou a lista local está vazia.
 */
export async function syncConversationsFromChatwoot(organizationId: string): Promise<Result<{ upserted: number }>> {
  const account = await getAccountAccessToken(organizationId);
  if (!account) return { ok: false, error: "Conta Chatwoot não está ativa." };

  try {
    const remote = await cwListConversations(account.accountId, account.token, { page: 1 });
    const db = createServiceClient();
    let upserted = 0;

    for (const c of remote) {
      const preview = c.last_non_activity_message?.content?.slice(0, 280) ?? "";
      const lastAt =
        c.last_non_activity_message?.created_at != null
          ? new Date(
              c.last_non_activity_message.created_at < 1e12
                ? c.last_non_activity_message.created_at * 1000
                : c.last_non_activity_message.created_at,
            ).toISOString()
          : c.timestamp != null
            ? new Date(c.timestamp < 1e12 ? c.timestamp * 1000 : c.timestamp).toISOString()
            : new Date().toISOString();

      const status = (c.status as string) || "open";
      const safeStatus = ["open", "resolved", "pending", "snoozed"].includes(status) ? status : "open";

      const { error } = await db.from("conversations_index").upsert(
        {
          organization_id: organizationId,
          chatwoot_account_id: account.accountId,
          chatwoot_conversation_id: c.id,
          chatwoot_inbox_id: c.inbox_id ?? null,
          chatwoot_contact_id: c.meta?.sender?.id ?? null,
          status: safeStatus,
          assignee_chatwoot_user_id: c.meta?.assignee?.id ?? null,
          last_message_at: lastAt,
          last_message_preview: preview,
          unread_count: c.unread_count ?? 0,
          meta: { synced_at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,chatwoot_conversation_id" },
      );
      if (!error) upserted += 1;

      if (c.meta?.sender?.id) {
        await db.from("contacts_mirror").upsert(
          {
            organization_id: organizationId,
            chatwoot_contact_id: c.meta.sender.id,
            name: c.meta.sender.name || "Contato",
            email: c.meta.sender.email ?? null,
            phone_number: c.meta.sender.phone_number ?? null,
            identifier: c.meta.sender.identifier ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,chatwoot_contact_id" },
        );
      }
    }

    return { ok: true, data: { upserted } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao sincronizar conversas." };
  }
}
