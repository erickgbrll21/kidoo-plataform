import { Badge } from "@/components/ui/badge";
import { LocalDateTime } from "@/components/ui/local-datetime";
import type { InboxThread } from "@/services/inbox/thread";
import { statusLabel, statusTone } from "./labels";

export function ContactSidebar({ thread }: { thread: InboxThread | null }) {
  if (!thread) {
    return (
      <aside className="hidden h-full flex-col border-l border-kidoo-100 bg-white xl:flex">
        <div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-kidoo-400">
          Detalhes do contato aparecem ao abrir uma conversa.
        </div>
      </aside>
    );
  }

  const c = thread.contact;

  return (
    <aside className="hidden h-full flex-col overflow-y-auto border-l border-kidoo-100 bg-white xl:flex">
      <div className="border-b border-kidoo-100 px-4 py-4">
        <p className="text-xs font-medium tracking-wide text-kidoo-500 uppercase">Contato</p>
        <h3 className="mt-1 text-base font-semibold text-kidoo-950">{c.name}</h3>
        <div className="mt-2">
          <Badge tone={statusTone(thread.status)}>{statusLabel(thread.status)}</Badge>
        </div>
      </div>

      <dl className="space-y-4 px-4 py-4 text-sm">
        <div>
          <dt className="text-xs font-medium text-kidoo-500">Telefone</dt>
          <dd className="mt-1 text-kidoo-900">{c.phone || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-kidoo-500">E-mail</dt>
          <dd className="mt-1 break-all text-kidoo-900">{c.email || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-kidoo-500">Canal</dt>
          <dd className="mt-1 text-kidoo-900">{thread.channelLabel ?? thread.inboxName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-kidoo-500">Última atividade</dt>
          <dd className="mt-1 text-kidoo-900">
            <LocalDateTime value={c.lastActivityAt} />
          </dd>
        </div>
        {c.chatwootContactId != null ? (
          <div>
            <dt className="text-xs font-medium text-kidoo-500">ID Chatwoot</dt>
            <dd className="mt-1 font-mono text-xs text-kidoo-600">{c.chatwootContactId}</dd>
          </div>
        ) : null}
      </dl>
    </aside>
  );
}
