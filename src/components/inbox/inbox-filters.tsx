"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/input";
import type { InboxAgentOption } from "@/services/inbox/agents";
import type { InboxChannelOption } from "@/services/inbox/list";

export function InboxFilters({
  channels,
  agents,
  canAssign,
}: {
  channels: InboxChannelOption[];
  agents: InboxAgentOption[];
  canAssign: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    // Ao filtrar, mantém conversa só se ainda fizer sentido (não remove c automaticamente)
    router.push(`/inbox?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-kidoo-100 bg-white px-3 py-2">
      <Select
        aria-label="Situação"
        className="h-9 w-[8.5rem]"
        value={params.get("status") ?? "open"}
        onChange={(e) => update("status", e.target.value)}
      >
        <option value="open">Abertas</option>
        <option value="pending">Pendentes</option>
        <option value="snoozed">Adiadas</option>
        <option value="resolved">Resolvidas</option>
        <option value="all">Todas</option>
      </Select>

      <Select
        aria-label="Canal"
        className="h-9 min-w-[9rem] flex-1"
        value={params.get("inbox") ?? "all"}
        onChange={(e) => update("inbox", e.target.value)}
      >
        <option value="all">Todos os canais</option>
        {channels.map((c) => (
          <option key={c.chatwootInboxId} value={String(c.chatwootInboxId)}>
            {c.phoneNumber ? `${c.name} · ${c.phoneNumber}` : c.name}
          </option>
        ))}
      </Select>

      {canAssign ? (
        <Select
          aria-label="Responsável"
          className="h-9 min-w-[9rem] flex-1"
          value={params.get("assignee") ?? "all"}
          onChange={(e) => update("assignee", e.target.value)}
        >
          <option value="all">Qualquer responsável</option>
          <option value="me">Minhas</option>
          <option value="unassigned">Sem responsável</option>
          {agents.map((a) => (
            <option key={a.chatwootUserId} value={String(a.chatwootUserId)}>
              {a.fullName}
            </option>
          ))}
        </Select>
      ) : null}
    </div>
  );
}
