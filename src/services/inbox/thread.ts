import "server-only";
import { createClient } from "@/lib/database/server";
import { listMessages } from "@/lib/integrations/chatwoot";
import { assertConversationInOrg } from "./guards";

export type InboxMessage = {
  id: number;
  content: string;
  /** incoming | outgoing | activity | template */
  direction: "incoming" | "outgoing" | "other";
  private: boolean;
  createdAt: string | null;
  senderName: string | null;
};

export type InboxContactPanel = {
  chatwootContactId: number | null;
  name: string;
  phone: string | null;
  email: string | null;
  lastActivityAt: string | null;
};

export type InboxThread = {
  conversationId: number;
  status: string;
  assigneeChatwootUserId: number | null;
  messages: InboxMessage[];
  contact: InboxContactPanel;
  inboxName: string | null;
  channelLabel: string | null;
};

function mapMessageType(raw: number | string | undefined): InboxMessage["direction"] {
  // Chatwoot: 0 incoming, 1 outgoing, 2 activity, 3 template
  if (raw === 0 || raw === "incoming") return "incoming";
  if (raw === 1 || raw === "outgoing") return "outgoing";
  return "other";
}

function epochToIso(value: number | string | undefined | null): string | null {
  if (value == null) return null;
  if (typeof value === "string" && value.includes("T")) return value;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  // Chatwoot às vezes manda segundos
  const ms = n < 1e12 ? n * 1000 : n;
  return new Date(ms).toISOString();
}

export async function getConversationThread(
  organizationId: string,
  chatwootConversationId: number,
): Promise<InboxThread | null> {
  const guard = await assertConversationInOrg(organizationId, chatwootConversationId);
  if (!guard) return null;

  const [messages, supabase] = await Promise.all([
    listMessages(guard.chatwootAccountId, guard.chatwootConversationId, guard.token),
    createClient(),
  ]);

  let contact: InboxContactPanel = {
    chatwootContactId: guard.chatwootContactId,
    name: "Contato",
    phone: null,
    email: null,
    lastActivityAt: null,
  };

  if (guard.chatwootContactId != null) {
    const { data } = await supabase
      .from("contacts_mirror")
      .select("name, phone_number, email, last_activity_at")
      .eq("organization_id", organizationId)
      .eq("chatwoot_contact_id", guard.chatwootContactId)
      .maybeSingle();
    if (data) {
      contact = {
        chatwootContactId: guard.chatwootContactId,
        name: (data.name as string) || "Contato",
        phone: (data.phone_number as string | null) ?? null,
        email: (data.email as string | null) ?? null,
        lastActivityAt: (data.last_activity_at as string | null) ?? null,
      };
    }
  }

  let inboxName: string | null = null;
  let channelLabel: string | null = null;
  if (guard.chatwootInboxId != null) {
    const { data: inbox } = await supabase
      .from("chatwoot_inboxes")
      .select("name, connection_id")
      .eq("organization_id", organizationId)
      .eq("chatwoot_inbox_id", guard.chatwootInboxId)
      .maybeSingle();
    inboxName = (inbox?.name as string | null) ?? null;
    if (inbox?.connection_id) {
      const { data: conn } = await supabase
        .from("whatsapp_connections")
        .select("display_phone_number")
        .eq("id", inbox.connection_id as string)
        .maybeSingle();
      const phone = (conn?.display_phone_number as string | null) ?? null;
      channelLabel = phone ? `WhatsApp ${phone}` : inboxName;
    } else {
      channelLabel = inboxName;
    }
  }

  return {
    conversationId: guard.chatwootConversationId,
    status: guard.status,
    assigneeChatwootUserId: guard.assigneeChatwootUserId,
    contact,
    inboxName,
    channelLabel,
    messages: messages.map((m) => ({
      id: m.id,
      content: (m.content ?? "").trim() || (m.private ? "(nota interna)" : "(sem texto)"),
      direction: mapMessageType(m.message_type),
      private: Boolean(m.private),
      createdAt: epochToIso(m.created_at ?? null),
      senderName: m.sender?.name ?? null,
    })),
  };
}
