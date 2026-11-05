"use client";

import { useActionState } from "react";
import { assignInboxAction, setInboxStatusAction } from "@/app/(dashboard)/inbox/actions";
import { ActionMessage } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/actions";
import type { InboxAgentOption } from "@/services/inbox/agents";
import type { InboxThread } from "@/services/inbox/thread";
import { statusLabel, statusTone } from "./labels";
import { MessageComposer } from "./message-composer";

const empty: ActionState = {};

export function ConversationThread({
  thread,
  agents,
  canReply,
  canAssign,
}: {
  thread: InboxThread;
  agents: InboxAgentOption[];
  canReply: boolean;
  canAssign: boolean;
}) {
  const [assignState, assignAction] = useActionState(assignInboxAction, empty);
  const [statusState, statusAction] = useActionState(setInboxStatusAction, empty);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f7f6f4]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-kidoo-100 bg-white px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-kidoo-950">{thread.contact.name}</h2>
            <Badge tone={statusTone(thread.status)}>{statusLabel(thread.status)}</Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-kidoo-500">
            {thread.channelLabel ?? thread.inboxName ?? "Canal"}
            {thread.contact.phone ? ` · ${thread.contact.phone}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canAssign ? (
            <form action={assignAction} className="flex items-center gap-1.5">
              <input type="hidden" name="conversationId" value={thread.conversationId} />
              <Select
                name="assigneeChatwootUserId"
                className="h-8 w-40 text-xs"
                defaultValue={thread.assigneeChatwootUserId != null ? String(thread.assigneeChatwootUserId) : ""}
                aria-label="Responsável"
              >
                <option value="">Sem responsável</option>
                {agents.map((a) => (
                  <option key={a.chatwootUserId} value={String(a.chatwootUserId)}>
                    {a.fullName}
                  </option>
                ))}
              </Select>
              <SubmitButton size="sm" variant="outline">
                Atribuir
              </SubmitButton>
            </form>
          ) : null}

          {canReply ? (
            <form action={statusAction} className="flex items-center gap-1.5">
              <input type="hidden" name="conversationId" value={thread.conversationId} />
              <Select
                name="status"
                className="h-8 w-32 text-xs"
                defaultValue={thread.status}
                aria-label="Situação"
              >
                <option value="open">Aberta</option>
                <option value="pending">Pendente</option>
                <option value="snoozed">Adiada</option>
                <option value="resolved">Resolvida</option>
              </Select>
              <SubmitButton size="sm" variant="secondary">
                Aplicar
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </header>

      <div className="space-y-1 px-4 pt-2">
        <ActionMessage state={assignState} />
        <ActionMessage state={statusState} />
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {thread.messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-kidoo-500">Sem mensagens nesta conversa.</p>
        ) : (
          thread.messages.map((m) => {
            const outgoing = m.direction === "outgoing";
            const other = m.direction === "other";
            if (other) {
              return (
                <p key={m.id} className="text-center text-[11px] text-kidoo-400">
                  {m.content}
                </p>
              );
            }
            return (
              <div key={m.id} className={cn("flex", outgoing ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[min(100%,28rem)] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                    m.private
                      ? "border border-dashed border-warning/40 bg-warning-soft text-kidoo-800"
                      : outgoing
                        ? "rounded-br-md bg-kidoo-800 text-white"
                        : "rounded-bl-md border border-kidoo-100 bg-white text-kidoo-900",
                  )}
                >
                  {m.private ? <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide">Nota interna</p> : null}
                  {m.senderName && !outgoing ? (
                    <p className="mb-0.5 text-[11px] font-medium text-kidoo-500">{m.senderName}</p>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={cn("mt-1 text-[10px]", outgoing && !m.private ? "text-white/60" : "text-kidoo-400")}>
                    <LocalDateTime value={m.createdAt} fallback="" />
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {canReply ? <MessageComposer conversationId={thread.conversationId} /> : null}
    </div>
  );
}

export function ThreadEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#f7f6f4] px-6 text-center">
      <p className="text-sm font-medium text-kidoo-800">Selecione uma conversa</p>
      <p className="max-w-sm text-xs text-kidoo-500">
        A lista à esquerda mostra o espelho local alimentado pelos webhooks do Chatwoot e pela sincronização.
      </p>
    </div>
  );
}
