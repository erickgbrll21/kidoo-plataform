import type { Metadata } from "next";
import { Suspense } from "react";
import { UsersRound } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { InlineActionButton, RoleSelect } from "@/components/team/inline-action";
import { AddTeamMemberForm, CreateTeamForm, InviteForm } from "@/components/team/team-forms";
import { can, requireTenantContext } from "@/lib/auth/dal";
import { formatDate } from "@/lib/utils";
import { getEffectiveLimits } from "@/services/organizations/service";
import { listInvitations, listMembers, listRoles, listTeams } from "@/services/team/service";
import {
  changeMemberRoleAction,
  reactivateMemberAction,
  removeMemberAction,
  removeTeamMemberAction,
  revokeInvitationAction,
  suspendMemberAction,
  deleteTeamAction,
} from "./actions";

export const metadata: Metadata = { title: "Equipe" };

async function TeamContent() {
  const ctx = await requireTenantContext();
  const orgId = ctx.organization.id;
  const canInvite = can(ctx, "team.invite");
  const canManageMembers = can(ctx, "team.manage_members");
  const canManageTeams = can(ctx, "team.manage_teams");
  const viewerIsOwner = ctx.role.key === "owner";

  const [members, roles, invitations, teams, limits] = await Promise.all([
    listMembers(orgId),
    listRoles(orgId),
    canInvite ? listInvitations(orgId) : Promise.resolve([]),
    listTeams(orgId),
    getEffectiveLimits(orgId),
  ]);

  // Somente proprietários podem conceder o papel de proprietário (o banco também impõe).
  const assignableRoles = roles.filter((r) => viewerIsOwner || r.key !== "owner");
  const activeCount = members.filter((m) => m.status === "active").length;
  const activeMembers = members.filter((m) => m.status === "active");

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        title="Equipe"
        description="Usuários, convites e equipes de atendimento da sua empresa."
        actions={
          <Badge tone="neutral">
            {activeCount} / {limits?.max_members ?? "∞"} usuários
          </Badge>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Membros</CardTitle>
          <CardDescription>Quem tem acesso ao ambiente de {ctx.organization.name}.</CardDescription>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              <Th>Usuário</Th>
              <Th>Papel</Th>
              <Th>Situação</Th>
              <Th>Desde</Th>
              {canManageMembers ? <Th className="text-right">Ações</Th> : null}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isSelf = m.userId === ctx.user.id;
              const locked = isSelf || (m.roleKey === "owner" && !viewerIsOwner);
              return (
                <Tr key={m.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={m.fullName} />
                      <span className="font-medium text-kidoo-900">
                        {m.fullName || "Usuário sem nome"}
                        {isSelf ? <span className="ml-2 text-xs font-normal text-kidoo-500">(você)</span> : null}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    {canManageMembers && !locked ? (
                      <RoleSelect
                        action={changeMemberRoleAction}
                        memberId={m.id}
                        roleId={m.roleId}
                        roles={assignableRoles}
                      />
                    ) : (
                      <Badge tone="outline">{m.roleName}</Badge>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={m.status === "active" ? "success" : "warning"}>
                      {m.status === "active" ? "Ativo" : "Suspenso"}
                    </Badge>
                  </Td>
                  <Td className="text-kidoo-500">{formatDate(m.createdAt)}</Td>
                  {canManageMembers ? (
                    <Td>
                      <div className="flex items-start justify-end gap-1">
                        {locked ? null : m.status === "active" ? (
                          <InlineActionButton
                            action={suspendMemberAction}
                            fields={{ memberId: m.id }}
                            confirmMessage={`Suspender o acesso de ${m.fullName || "este usuário"}?`}
                          >
                            Suspender
                          </InlineActionButton>
                        ) : (
                          <InlineActionButton action={reactivateMemberAction} fields={{ memberId: m.id }}>
                            Reativar
                          </InlineActionButton>
                        )}
                        {locked ? null : (
                          <InlineActionButton
                            action={removeMemberAction}
                            fields={{ memberId: m.id }}
                            variant="danger-outline"
                            confirmMessage={`Remover ${m.fullName || "este usuário"} da empresa?`}
                          >
                            Remover
                          </InlineActionButton>
                        )}
                      </div>
                    </Td>
                  ) : null}
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      {canInvite ? (
        <Card>
          <CardHeader>
            <CardTitle>Convidar usuário</CardTitle>
            <CardDescription>
              O convite gera um link pessoal válido por 7 dias, vinculado ao e-mail informado. O envio automático por
              e-mail será habilitado quando o provedor de e-mail for configurado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <InviteForm roles={assignableRoles.map((r) => ({ id: r.id, name: r.name }))} />
            {invitations.length > 0 ? (
              <div className="border-t border-kidoo-100 pt-4">
                <p className="mb-2 text-xs font-medium tracking-wide text-kidoo-500 uppercase">Convites pendentes</p>
                <ul className="divide-y divide-kidoo-100">
                  {invitations.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-kidoo-900">{i.email}</p>
                        <p className="text-xs text-kidoo-500">
                          {i.roleName} · {i.state === "expired" ? "expirou em" : "expira em"} {formatDate(i.expiresAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {i.state === "expired" ? <Badge tone="warning">Expirado</Badge> : <Badge>Pendente</Badge>}
                        <InlineActionButton action={revokeInvitationAction} fields={{ invitationId: i.id }}>
                          Cancelar
                        </InlineActionButton>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Equipes</CardTitle>
          <CardDescription>Agrupe atendentes por área (ex.: Comercial, Financeiro, Suporte).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {canManageTeams ? <CreateTeamForm /> : null}
          {teams.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="Nenhuma equipe criada"
              description="Equipes serão usadas para direcionar conversas e canais aos atendentes certos."
              className="py-8"
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {teams.map((t) => {
                const inTeam = new Set(t.members.map((tm) => tm.userId));
                const candidates = activeMembers
                  .filter((m) => !inTeam.has(m.userId))
                  .map((m) => ({ userId: m.userId, name: m.fullName || "Usuário sem nome" }));
                return (
                  <li key={t.id} className="rounded-xl border border-kidoo-200/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-kidoo-950">{t.name}</h3>
                        {t.description ? <p className="mt-0.5 text-sm text-kidoo-500">{t.description}</p> : null}
                      </div>
                      {canManageTeams ? (
                        <InlineActionButton
                          action={deleteTeamAction}
                          fields={{ teamId: t.id }}
                          variant="danger-outline"
                          confirmMessage={`Excluir a equipe ${t.name}?`}
                        >
                          Excluir
                        </InlineActionButton>
                      ) : null}
                    </div>
                    {t.members.length === 0 ? (
                      <p className="mt-3 text-sm text-kidoo-500">Sem membros.</p>
                    ) : (
                      <ul className="mt-3 space-y-1.5">
                        {t.members.map((tm) => (
                          <li key={tm.userId} className="flex items-center justify-between gap-2 text-sm">
                            <span className="flex items-center gap-2 text-kidoo-800">
                              <Avatar name={tm.fullName} className="size-6 text-[0.625rem]" />
                              {tm.fullName || "Usuário sem nome"}
                            </span>
                            {canManageTeams ? (
                              <InlineActionButton
                                action={removeTeamMemberAction}
                                fields={{ teamId: t.id, userId: tm.userId }}
                              >
                                Remover
                              </InlineActionButton>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    {canManageTeams ? (
                      <div className="mt-3 border-t border-kidoo-100 pt-3">
                        <AddTeamMemberForm teamId={t.id} candidates={candidates} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <TeamContent />
    </Suspense>
  );
}
