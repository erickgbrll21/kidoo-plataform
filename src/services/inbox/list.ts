import "server-only";
import { createClient } from "@/lib/database/server";

export type InboxStatus = "open" | "resolved" | "pending" | "snoozed";

export type ConversationListItem = {
  id: string;
  chatwootConversationId: number;
  chatwootInboxId: number | null;
  chatwootContactId: number | null;
  status: InboxStatus;
  assigneeChatwootUserId: number | null;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  unreadCount: number;
  contactName: string;
  contactPhone: string | null;
  inboxName: string | null;
  channelLabel: string | null;
};

export type InboxListFilters = {
  status?: InboxStatus | "all";
  inboxId?: number | null;
  assignee?: "all" | "me" | "unassigned" | number;
  /** chatwoot_user_id do membro atual (para filtro "me") */
  myChatwootUserId?: number | null;
  limit?: number;
};

export type InboxChannelOption = {
  chatwootInboxId: number;
  name: string;
  phoneNumber: string | null;
};

export async function listInboxChannels(organizationId: string): Promise<InboxChannelOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chatwoot_inboxes")
    .select("chatwoot_inbox_id, name, connection_id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("name", { ascending: true });

  const connectionIds = (data ?? [])
    .map((r) => r.connection_id as string | null)
    .filter((id): id is string => Boolean(id));

  const phoneByConnection = new Map<string, string>();
  if (connectionIds.length > 0) {
    const { data: connections } = await supabase
      .from("whatsapp_connections")
      .select("id, display_phone_number")
      .eq("organization_id", organizationId)
      .in("id", connectionIds);
    for (const c of connections ?? []) {
      phoneByConnection.set(c.id as string, (c.display_phone_number as string) || "");
    }
  }

  return (data ?? []).map((r) => {
    const connectionId = r.connection_id as string | null;
    const phone = connectionId ? phoneByConnection.get(connectionId) ?? null : null;
    return {
      chatwootInboxId: Number(r.chatwoot_inbox_id),
      name: (r.name as string) || `Inbox ${r.chatwoot_inbox_id}`,
      phoneNumber: phone || null,
    };
  });
}

export async function listConversations(
  organizationId: string,
  filters: InboxListFilters = {},
): Promise<ConversationListItem[]> {
  const supabase = await createClient();
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);

  let query = supabase
    .from("conversations_index")
    .select(
      "id, chatwoot_conversation_id, chatwoot_inbox_id, chatwoot_contact_id, status, assignee_chatwoot_user_id, last_message_at, last_message_preview, unread_count",
    )
    .eq("organization_id", organizationId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.inboxId != null) {
    query = query.eq("chatwoot_inbox_id", filters.inboxId);
  }
  if (filters.assignee === "unassigned") {
    query = query.is("assignee_chatwoot_user_id", null);
  } else if (filters.assignee === "me" && filters.myChatwootUserId != null) {
    query = query.eq("assignee_chatwoot_user_id", filters.myChatwootUserId);
  } else if (typeof filters.assignee === "number") {
    query = query.eq("assignee_chatwoot_user_id", filters.assignee);
  }

  const { data: rows, error } = await query;
  if (error || !rows?.length) return [];

  const contactIds = [
    ...new Set(
      rows
        .map((r) => (r.chatwoot_contact_id != null ? Number(r.chatwoot_contact_id) : null))
        .filter((id): id is number => id != null),
    ),
  ];
  const inboxIds = [
    ...new Set(
      rows
        .map((r) => (r.chatwoot_inbox_id != null ? Number(r.chatwoot_inbox_id) : null))
        .filter((id): id is number => id != null),
    ),
  ];

  const [{ data: contacts }, { data: inboxes }, channels] = await Promise.all([
    contactIds.length
      ? supabase
          .from("contacts_mirror")
          .select("chatwoot_contact_id, name, phone_number")
          .eq("organization_id", organizationId)
          .in("chatwoot_contact_id", contactIds)
      : Promise.resolve({ data: [] as Array<{ chatwoot_contact_id: number; name: string; phone_number: string | null }> }),
    inboxIds.length
      ? supabase
          .from("chatwoot_inboxes")
          .select("chatwoot_inbox_id, name")
          .eq("organization_id", organizationId)
          .in("chatwoot_inbox_id", inboxIds)
      : Promise.resolve({ data: [] as Array<{ chatwoot_inbox_id: number; name: string }> }),
    listInboxChannels(organizationId),
  ]);

  const contactById = new Map(
    (contacts ?? []).map((c) => [
      Number(c.chatwoot_contact_id),
      { name: (c.name as string) || "Contato", phone: (c.phone_number as string | null) ?? null },
    ]),
  );
  const inboxById = new Map((inboxes ?? []).map((i) => [Number(i.chatwoot_inbox_id), (i.name as string) || null]));
  const channelByInbox = new Map(
    channels.map((c) => [c.chatwootInboxId, c.phoneNumber ? `WhatsApp ${c.phoneNumber}` : c.name]),
  );

  return rows.map((r) => {
    const contactId = r.chatwoot_contact_id != null ? Number(r.chatwoot_contact_id) : null;
    const inboxId = r.chatwoot_inbox_id != null ? Number(r.chatwoot_inbox_id) : null;
    const contact = contactId != null ? contactById.get(contactId) : undefined;
    return {
      id: r.id as string,
      chatwootConversationId: Number(r.chatwoot_conversation_id),
      chatwootInboxId: inboxId,
      chatwootContactId: contactId,
      status: (r.status as InboxStatus) || "open",
      assigneeChatwootUserId:
        r.assignee_chatwoot_user_id != null ? Number(r.assignee_chatwoot_user_id) : null,
      lastMessageAt: (r.last_message_at as string | null) ?? null,
      lastMessagePreview: (r.last_message_preview as string) || "",
      unreadCount: Number(r.unread_count ?? 0),
      contactName: contact?.name ?? "Contato",
      contactPhone: contact?.phone ?? null,
      inboxName: inboxId != null ? inboxById.get(inboxId) ?? null : null,
      channelLabel: inboxId != null ? channelByInbox.get(inboxId) ?? null : null,
    };
  });
}
