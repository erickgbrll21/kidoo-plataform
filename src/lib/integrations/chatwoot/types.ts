/** Tipos mínimos da API Chatwoot 4.18 usados pela KIDOO. */

export type ChatwootAccount = {
  id: number;
  name: string;
  locale?: string | null;
  status?: string;
  support_email?: string | null;
};

export type ChatwootPlatformUser = {
  id: number;
  email: string;
  name: string;
  access_token: string;
  confirmed?: boolean;
};

export type ChatwootAccountUser = {
  id: number;
  account_id: number;
  user_id: number;
  role: "administrator" | "agent";
};

export type ChatwootInbox = {
  id: number;
  name: string;
  channel_type?: string;
  phone_number?: string | null;
};

export type ChatwootWebhook = {
  id: number;
  url: string;
  subscriptions?: string[];
};

export type ChatwootContact = {
  id: number;
  name?: string;
  email?: string | null;
  phone_number?: string | null;
  identifier?: string | null;
  last_activity_at?: number | string | null;
};

export type ChatwootConversation = {
  id: number;
  inbox_id?: number;
  status?: string;
  meta?: {
    sender?: ChatwootContact;
    assignee?: { id: number; name?: string } | null;
  };
  contact_last_seen_at?: number | null;
  timestamp?: number | null;
  unread_count?: number;
  last_non_activity_message?: { content?: string | null; created_at?: number } | null;
};

export type ChatwootMessage = {
  id: number;
  content?: string | null;
  message_type?: number | string;
  private?: boolean;
  created_at?: number;
  conversation_id?: number;
  sender?: { id?: number; type?: string; name?: string };
};

/** Eventos que a KIDOO assina no webhook da conta. */
export const CHATWOOT_WEBHOOK_SUBSCRIPTIONS = [
  "message_created",
  "message_updated",
  "conversation_created",
  "conversation_updated",
  "conversation_status_changed",
  "webwidget_triggered",
] as const;

export type ChatwootWebhookEventName = (typeof CHATWOOT_WEBHOOK_SUBSCRIPTIONS)[number] | string;

export type ChatwootWebhookPayload = {
  event: ChatwootWebhookEventName;
  id?: string | number;
  account?: { id: number; name?: string };
  inbox?: { id: number };
  conversation?: ChatwootConversation & { id: number; messages?: ChatwootMessage[] };
  messages?: ChatwootMessage[];
  content?: string | null;
  created_at?: string | number;
  updated_at?: string | number;
  sender?: ChatwootContact;
  // message_* trazem campos no root
  message_type?: number | string;
  private?: boolean;
  conversation_id?: number;
};
