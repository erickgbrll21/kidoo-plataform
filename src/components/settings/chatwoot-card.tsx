"use client";

import * as React from "react";
import { provisionChatwootAction } from "@/app/(dashboard)/configuracoes/actions";
import { ActionMessage } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionState } from "@/lib/actions";

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" | "outline" }> = {
  active: { label: "Ativa", tone: "success" },
  pending: { label: "Pendente", tone: "warning" },
  error: { label: "Erro", tone: "danger" },
  disabled: { label: "Desativada", tone: "outline" },
};

export function ChatwootCard({
  configured,
  canManage,
  status,
  chatwootAccountId,
  lastError,
  provisionedAt,
}: {
  configured: boolean;
  canManage: boolean;
  status: string | null;
  chatwootAccountId: number | null;
  lastError: string | null;
  provisionedAt: string | null;
}) {
  const [state, action] = React.useActionState(provisionChatwootAction, {} as ActionState);
  const meta = status ? STATUS[status] ?? { label: status, tone: "neutral" as const } : null;

  return (
    <div className="space-y-4">
      {!configured ? (
        <p className="text-sm text-kidoo-500">
          O servidor ainda não tem <code className="font-mono text-xs">CHATWOOT_BASE_URL</code> /{" "}
          <code className="font-mono text-xs">CHATWOOT_PLATFORM_TOKEN</code>. Veja docs/SETUP.md.
        </p>
      ) : (
        <>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium tracking-wide text-kidoo-500 uppercase">Situação</dt>
              <dd className="mt-1">
                {meta ? <Badge tone={meta.tone}>{meta.label}</Badge> : <span className="text-sm text-kidoo-500">Não provisionada</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-kidoo-500 uppercase">Account ID</dt>
              <dd className="mt-1 font-mono text-sm text-kidoo-900">{chatwootAccountId ?? "—"}</dd>
            </div>
            {provisionedAt ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium tracking-wide text-kidoo-500 uppercase">Provisionada em</dt>
                <dd className="mt-1 text-sm text-kidoo-800">
                  <LocalDateTime value={provisionedAt} />
                </dd>
              </div>
            ) : null}
          </dl>
          {lastError ? <p className="text-sm text-danger">{lastError}</p> : null}
          <ActionMessage state={state} />
          {canManage ? (
            <form action={action}>
              <SubmitButton pendingLabel="Provisionando…">
                {status === "active" ? "Revalidar integração" : "Provisionar Chatwoot"}
              </SubmitButton>
            </form>
          ) : null}
          <p className="text-xs text-kidoo-500">
            Tokens ficam cifrados no servidor. O header HTTP usado é <code className="font-mono">api-access-token</code>{" "}
            (hífen), exigido pelo Nginx desta instância. Webhooks só chegam se{" "}
            <code className="font-mono">NEXT_PUBLIC_APP_URL</code> for HTTPS público (não localhost).
          </p>
        </>
      )}
    </div>
  );
}
