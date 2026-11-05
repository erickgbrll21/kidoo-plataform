"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { cn } from "@/lib/utils";
import type { ConversationListItem } from "@/services/inbox/list";
import { statusLabel, statusTone } from "./labels";

export function ConversationList({ items }: { items: ConversationListItem[] }) {
  const params = useSearchParams();
  const selected = params.get("c");

  function hrefFor(id: number) {
    const next = new URLSearchParams(params.toString());
    next.set("c", String(id));
    return `/inbox?${next.toString()}`;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <p className="text-sm font-medium text-kidoo-800">Nenhuma conversa neste filtro</p>
        <p className="max-w-xs text-xs text-kidoo-500">
          Conecte um WhatsApp em Canais e aguarde mensagens, ou use Sincronizar para puxar do Chatwoot.
        </p>
      </div>
    );
  }

  return (
    <ul className="min-h-0 flex-1 overflow-y-auto divide-y divide-kidoo-100">
      {items.map((item) => {
        const active = selected === String(item.chatwootConversationId);
        return (
          <li key={item.id}>
            <Link
              href={hrefFor(item.chatwootConversationId)}
              className={cn(
                "block px-3 py-3 transition-colors hover:bg-kidoo-50",
                active && "bg-kidoo-100/80 hover:bg-kidoo-100",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-kidoo-950">{item.contactName}</p>
                  <p className="mt-0.5 truncate text-xs text-kidoo-500">
                    {item.channelLabel ?? item.inboxName ?? "Canal"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                  {item.unreadCount > 0 ? (
                    <span className="rounded-full bg-kidoo-700 px-1.5 text-[10px] font-semibold text-white">
                      {item.unreadCount}
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-kidoo-600">{item.lastMessagePreview || "—"}</p>
              <p className="mt-1 text-[11px] text-kidoo-400">
                <LocalDateTime value={item.lastMessageAt} fallback="" />
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
