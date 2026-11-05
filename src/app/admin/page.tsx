import type { Metadata } from "next";
import { Suspense } from "react";
import { Building2, Webhook } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { InlineActionButton } from "@/components/team/inline-action";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { requirePlatformAdmin } from "@/lib/auth/dal";
import { formatDate } from "@/lib/utils";
import { listDeadWebhookEvents, listTenants } from "@/services/admin/service";
import { reactivateTenantAction, retryDeadWebhookAction, suspendTenantAction } from "./actions";

export const metadata: Metadata = { title: "Administração" };

async function AdminContent() {
  await requirePlatformAdmin(); // defesa em profundidade: a página nunca depende só do layout
  const [{ rows, truncated }, deadWebhooks] = await Promise.all([listTenants(), listDeadWebhookEvents(50)]);

  const active = rows.filter((r) => r.status === "active").length;
  const suspended = rows.length - active;
  const users = rows.reduce((sum, r) => sum + r.activeMembers, 0);

  return (
    <div className="animate-fade-up">
      <PageHeader title="Empresas" description="Gestão dos ambientes cadastrados na plataforma." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Empresas", rows.length],
          ["Ativas", active],
          ["Suspensas", suspended],
          ["Usuários ativos", users],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-sm text-kidoo-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-kidoo-950">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {truncated ? (
        <Alert tone="warning" className="mt-4">
          Exibindo apenas as 200 empresas mais recentes. A paginação será adicionada junto ao painel completo (Fase 9).
        </Alert>
      ) : null}

      <Card className="mt-6 overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Building2} title="Nenhuma empresa cadastrada" description="As empresas aparecerão aqui após o cadastro." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Empresa</Th>
                <Th>Plano</Th>
                <Th>Usuários</Th>
                <Th>Situação</Th>
                <Th>Criada em</Th>
                <Th className="text-right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <Tr key={t.id}>
                  <Td>
                    <p className="font-medium text-kidoo-900">{t.name}</p>
                    <p className="font-mono text-xs text-kidoo-500">{t.slug}</p>
                  </Td>
                  <Td>
                    <span className="capitalize">{t.planKey ?? "—"}</span>
                    {t.subscriptionStatus ? <span className="ml-1.5 text-xs text-kidoo-500">({t.subscriptionStatus})</span> : null}
                  </Td>
                  <Td>{t.activeMembers}</Td>
                  <Td>
                    <Badge tone={t.status === "active" ? "success" : "warning"}>
                      {t.status === "active" ? "Ativa" : "Suspensa"}
                    </Badge>
                  </Td>
                  <Td className="text-kidoo-500">{formatDate(t.createdAt)}</Td>
                  <Td>
                    <div className="flex justify-end">
                      {t.status === "active" ? (
                        <InlineActionButton
                          action={suspendTenantAction}
                          fields={{ organizationId: t.id }}
                          variant="danger-outline"
                          confirmMessage={`Suspender ${t.name}? Todos os usuários perderão o acesso.`}
                        >
                          Suspender
                        </InlineActionButton>
                      ) : (
                        <InlineActionButton action={reactivateTenantAction} fields={{ organizationId: t.id }} variant="secondary">
                          Reativar
                        </InlineActionButton>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="mt-10">
        <PageHeader
          title="Webhooks Chatwoot (dead-letter)"
          description="Eventos que esgotaram as retentativas. Reenfileire para o cron processar de novo."
        />
        <Card className="mt-4 overflow-hidden">
          {deadWebhooks.length === 0 ? (
            <EmptyState
              icon={Webhook}
              title="Nenhum evento em dead-letter"
              description="Quando um webhook falhar várias vezes, ele aparece aqui."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Empresa</Th>
                  <Th>Evento</Th>
                  <Th>Tentativas</Th>
                  <Th>Erro</Th>
                  <Th>Quando</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {deadWebhooks.map((e) => (
                  <Tr key={e.id}>
                    <Td>
                      <p className="font-medium text-kidoo-900">{e.organizationName ?? "—"}</p>
                      {e.organizationId ? (
                        <p className="font-mono text-xs text-kidoo-500">{e.organizationId.slice(0, 8)}…</p>
                      ) : null}
                    </Td>
                    <Td className="font-mono text-xs">{e.eventType}</Td>
                    <Td>{e.attempts}</Td>
                    <Td className="max-w-xs truncate text-kidoo-500" title={e.lastError ?? undefined}>
                      {e.lastError ?? "—"}
                    </Td>
                    <Td className="text-kidoo-500">{formatDate(e.createdAt)}</Td>
                    <Td>
                      <div className="flex justify-end">
                        <InlineActionButton
                          action={retryDeadWebhookAction}
                          fields={{ eventId: e.id }}
                          variant="secondary"
                          confirmMessage="Reenfileirar este evento para novo processamento?"
                        >
                          Reenfileirar
                        </InlineActionButton>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <AdminContent />
    </Suspense>
  );
}
