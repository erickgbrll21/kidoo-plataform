import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ChatwootCard } from "@/components/settings/chatwoot-card";
import { OrganizationForm, PasswordForm, ProfileForm } from "@/components/settings/settings-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { auditLabel } from "@/lib/audit-labels";
import { can, requireTenantContext } from "@/lib/auth/dal";
import { isChatwootConfigured } from "@/lib/env";
import { formatDateTime } from "@/lib/utils";
import { getChatwootAccountStatus } from "@/services/chatwoot/provision";
import { countActiveMembers, getEffectiveLimits, getPlanSummary, listAuditLogs } from "@/services/organizations/service";

export const metadata: Metadata = { title: "Configurações" };

const STATUS_LABELS: Record<string, string> = {
  trialing: "Em período de teste",
  active: "Ativa",
  past_due: "Pagamento pendente",
  canceled: "Cancelada",
  suspended: "Suspensa",
};

const limitText = (v: number | null | undefined) => (v == null ? "Ilimitado" : v.toLocaleString("pt-BR"));

async function SettingsContent() {
  const ctx = await requireTenantContext();
  const orgId = ctx.organization.id;
  const [limits, members, audit, chatwoot] = await Promise.all([
    getEffectiveLimits(orgId),
    countActiveMembers(orgId),
    can(ctx, "audit.read") ? listAuditLogs(orgId, 20) : Promise.resolve([]),
    getChatwootAccountStatus(orgId),
  ]);
  const plan = limits ? await getPlanSummary(limits.plan_key) : null;

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader title="Configurações" description="Empresa, perfil, segurança, plano e registros de auditoria." />

      <Card>
        <CardHeader>
          <CardTitle>Empresa</CardTitle>
          <CardDescription>Dados exibidos para a sua equipe.</CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationForm
            name={ctx.organization.name}
            slug={ctx.organization.slug}
            canEdit={can(ctx, "org.update")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seu perfil</CardTitle>
          <CardDescription>
            Papel nesta empresa: <strong className="font-medium text-kidoo-800">{ctx.role.name}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm fullName={ctx.user.fullName} email={ctx.user.email} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Segurança</CardTitle>
          <CardDescription>Altere sua senha. Você precisará informar a senha atual.</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chatwoot</CardTitle>
          <CardDescription>
            Infraestrutura de atendimento da empresa. Conta provisionada automaticamente; WhatsApp entra na Fase 4.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChatwootCard
            configured={isChatwootConfigured()}
            canManage={can(ctx, "settings.manage")}
            status={chatwoot?.status ?? null}
            chatwootAccountId={chatwoot?.chatwoot_account_id ?? null}
            lastError={chatwoot?.last_error ?? null}
            provisionedAt={chatwoot?.provisioned_at ?? null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Plano e limites</CardTitle>
              <CardDescription>{plan?.description ?? "Informações do plano contratado."}</CardDescription>
            </div>
            {limits ? <Badge tone="brand">{plan?.name ?? limits.plan_key}</Badge> : null}
          </div>
        </CardHeader>
        <CardContent>
          {!limits ? (
            <p className="text-sm text-kidoo-500">Não foi possível carregar as informações do plano.</p>
          ) : (
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Situação da assinatura", STATUS_LABELS[limits.subscription_status] ?? limits.subscription_status],
                ["Usuários", `${members} de ${limitText(limits.max_members)}`],
                ["Números de WhatsApp", `Até ${limitText(limits.max_whatsapp_numbers)}`],
                ["Agentes de IA", `Até ${limitText(limits.max_ai_agents)}`],
                ["Fluxos de automação", `Até ${limitText(limits.max_automation_flows)}`],
                ["Mensagens de IA por mês", `Até ${limitText(limits.max_monthly_ai_messages)}`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-medium tracking-wide text-kidoo-500 uppercase">{label}</dt>
                  <dd className="mt-1 text-sm font-medium text-kidoo-900">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-5 text-xs text-kidoo-500">
            Mudanças de plano e cobrança serão habilitadas na Fase 9. Para ajustar limites agora, fale com a KIDOO.
          </p>
        </CardContent>
      </Card>

      {can(ctx, "audit.read") ? (
        <Card>
          <CardHeader>
            <CardTitle>Auditoria</CardTitle>
            <CardDescription>Últimas operações administrativas. Os registros são imutáveis.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {audit.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-kidoo-500">Nenhum registro ainda.</p>
            ) : (
              <ul className="divide-y divide-kidoo-100">
                {audit.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                    <span className="text-kidoo-900">{auditLabel(a.action)}</span>
                    <time dateTime={a.created_at} className="shrink-0 text-xs text-kidoo-500">
                      {formatDateTime(a.created_at)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <SettingsContent />
    </Suspense>
  );
}
