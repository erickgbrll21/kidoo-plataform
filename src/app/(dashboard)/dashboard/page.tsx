import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Bot, CircleCheck, CircleDashed, Radio, UsersRound, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { auditLabel } from "@/lib/audit-labels";
import { can, requireTenantContext } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/utils";
import { countActiveMembers, getEffectiveLimits, getPlanSummary, listAuditLogs } from "@/services/organizations/service";
import { listWhatsappConnections } from "@/services/whatsapp/list";

export const metadata: Metadata = { title: "Dashboard" };

const SUBSCRIPTION_LABELS: Record<string, string> = {
  trialing: "Em teste",
  active: "Ativa",
  past_due: "Pendente",
  canceled: "Cancelada",
  suspended: "Suspensa",
};

const limitText = (limit: number | null | undefined) => (limit == null ? "Ilimitado" : String(limit));

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-kidoo-500">{label}</p>
          <Icon className="size-4 text-kidoo-400" aria-hidden />
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-kidoo-950">{value}</p>
        <p className="mt-1 text-xs text-kidoo-500">{hint}</p>
      </CardContent>
    </Card>
  );
}

async function Overview() {
  const ctx = await requireTenantContext();
  const orgId = ctx.organization.id;

  const [limits, members, activity, whatsapp] = await Promise.all([
    getEffectiveLimits(orgId),
    countActiveMembers(orgId),
    can(ctx, "audit.read") ? listAuditLogs(orgId, 8) : Promise.resolve([]),
    can(ctx, "channels.read") ? listWhatsappConnections(orgId) : Promise.resolve([]),
  ]);
  const plan = limits ? await getPlanSummary(limits.plan_key) : null;
  const firstName = ctx.user.fullName.split(" ")[0] || "";
  const waActive = whatsapp.filter((c) => c.status === "active" || c.status === "pending").length;

  const steps = [
    { done: true, label: "Criar a empresa", href: null as string | null, soon: false },
    { done: members > 1, label: "Convidar a equipe", href: "/equipe", soon: false },
    { done: waActive > 0, label: "Conectar um número de WhatsApp", href: "/canais", soon: false },
    { done: false, label: "Criar um agente de IA", href: null, soon: true },
  ];

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={firstName ? `Olá, ${firstName}` : "Dashboard"}
        description={`Visão geral de ${ctx.organization.name}.`}
        actions={limits ? <Badge tone="neutral">{plan?.name ?? limits.plan_key}</Badge> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Usuários ativos"
          value={String(members)}
          hint={`Limite do plano: ${limitText(limits?.max_members)}`}
          icon={UsersRound}
        />
        <StatCard
          label="Números de WhatsApp"
          value={String(waActive)}
          hint={`Limite do plano: ${limitText(limits?.max_whatsapp_numbers)}`}
          icon={Radio}
        />
        <StatCard
          label="Agentes de IA"
          value="—"
          hint={`Limite do plano: ${limitText(limits?.max_ai_agents)} · disponível na Fase 7`}
          icon={Bot}
        />
        <StatCard
          label="Assinatura"
          value={limits ? (SUBSCRIPTION_LABELS[limits.subscription_status] ?? limits.subscription_status) : "—"}
          hint="Cobrança automática ainda não habilitada"
          icon={CircleCheck}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Primeiros passos</CardTitle>
            <CardDescription>Configure seu ambiente em poucos minutos.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-kidoo-100">
              {steps.map((s) => (
                <li key={s.label} className="flex items-center gap-3 px-5 py-3.5 text-sm">
                  {s.done ? (
                    <CircleCheck className="size-4.5 shrink-0 text-success" aria-label="Concluído" />
                  ) : (
                    <CircleDashed className="size-4.5 shrink-0 text-kidoo-300" aria-label="Pendente" />
                  )}
                  <span className={s.done ? "text-kidoo-500 line-through" : "text-kidoo-900"}>{s.label}</span>
                  {s.soon ? (
                    <Badge tone="outline" className="ml-auto">
                      Em breve
                    </Badge>
                  ) : s.href && !s.done ? (
                    <Link
                      href={s.href}
                      className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-kidoo-700 hover:text-kidoo-950"
                    >
                      Abrir <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atividade recente</CardTitle>
            <CardDescription>Registros de auditoria da empresa.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {!can(ctx, "audit.read") ? (
              <p className="px-5 py-8 text-center text-sm text-kidoo-500">
                Somente administradores visualizam a atividade da empresa.
              </p>
            ) : activity.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-kidoo-500">Nenhuma atividade registrada ainda.</p>
            ) : (
              <ul className="divide-y divide-kidoo-100">
                {activity.map((a) => (
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
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div aria-busy>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview />
    </Suspense>
  );
}
