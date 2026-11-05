"use client";

import { disconnectWhatsappAction } from "@/app/(dashboard)/canais/actions";
import { ConnectZapiForm } from "@/components/channels/connect-zapi-form";
import { InlineActionButton } from "@/components/team/inline-action";
import { Badge } from "@/components/ui/badge";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import type { WhatsappConnectionRow } from "@/services/whatsapp/list";

const STATUS: Record<
  WhatsappConnectionRow["status"],
  { label: string; tone: "success" | "warning" | "danger" | "outline" | "neutral" }
> = {
  active: { label: "Ativo", tone: "success" },
  pending: { label: "Pendente", tone: "warning" },
  error: { label: "Erro", tone: "danger" },
  disconnected: { label: "Desconectado", tone: "outline" },
};

export function ChannelsPanel({
  connections,
  canManage,
  chatwootReady,
  limitLabel,
}: {
  connections: WhatsappConnectionRow[];
  canManage: boolean;
  chatwootReady: boolean;
  limitLabel: string;
}) {
  const disabledReason = !chatwootReady
    ? "Provisiona a conta Chatwoot em Configurações antes de conectar um número."
    : null;

  const activeCount = connections.filter((c) => c.status === "active" || c.status === "pending").length;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-kidoo-500">
          Números ativos: <span className="font-medium text-kidoo-800">{activeCount}</span>
          <span className="mx-1.5 text-kidoo-300">·</span>
          Limite do plano: <span className="font-medium text-kidoo-800">{limitLabel}</span>
        </p>
      </div>

      {canManage ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-kidoo-900">Adicionar WhatsApp (Z-API)</h3>
          <ConnectZapiForm disabledReason={disabledReason} />
        </div>
      ) : null}

      {connections.length === 0 ? (
        <p className="text-sm text-kidoo-500">Nenhuma instância conectada ainda.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Número / instância</Th>
              <Th>Situação</Th>
              <Th>Inbox Chatwoot</Th>
              <Th>Conectado em</Th>
              {canManage ? <Th className="text-right">Ações</Th> : null}
            </tr>
          </thead>
          <tbody>
            {connections.map((c) => {
              const st = STATUS[c.status];
              return (
                <Tr key={c.id}>
                  <Td>
                    <p className="font-medium text-kidoo-900">{c.displayPhoneNumber || c.instanceId}</p>
                    <p className="font-mono text-xs text-kidoo-500">{c.instanceId}</p>
                    {c.verifiedName ? <p className="text-xs text-kidoo-500">{c.verifiedName}</p> : null}
                    {c.lastError ? <p className="mt-1 text-xs text-danger">{c.lastError}</p> : null}
                  </Td>
                  <Td>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </Td>
                  <Td className="font-mono text-xs text-kidoo-600">{c.chatwootInboxId ?? "—"}</Td>
                  <Td className="text-kidoo-500">
                    <LocalDateTime value={c.connectedAt} />
                  </Td>
                  {canManage ? (
                    <Td>
                      <div className="flex justify-end">
                        {c.status !== "disconnected" ? (
                          <InlineActionButton
                            action={disconnectWhatsappAction}
                            fields={{ connectionId: c.id }}
                            variant="danger-outline"
                            confirmMessage={`Desconectar ${c.displayPhoneNumber || c.instanceId}?`}
                          >
                            Desconectar
                          </InlineActionButton>
                        ) : null}
                      </div>
                    </Td>
                  ) : null}
                </Tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
