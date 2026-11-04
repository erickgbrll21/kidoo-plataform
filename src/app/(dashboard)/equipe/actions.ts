"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  authorizeAction,
  fail,
  fieldErrorsOf,
  formObject,
  keepValues,
  succeed,
  type ActionState,
} from "@/lib/actions";
import { publicEnv } from "@/lib/env";
import { rateLimit } from "@/lib/security/rate-limit";
import {
  changeRoleSchema,
  invitationIdSchema,
  inviteSchema,
  memberIdSchema,
  teamIdSchema,
  teamMemberSchema,
  teamSchema,
} from "@/lib/validations/team";
import {
  addTeamMember,
  createInvitation,
  createTeam,
  deleteTeam,
  removeMember,
  removeTeamMember,
  revokeInvitation,
  setMemberStatus,
  updateMemberRole,
} from "@/services/team/service";

const done = (message: string) => {
  revalidatePath("/equipe");
  return succeed(message);
};

function invalid(error: z.ZodError, fallback = "Dados inválidos.") {
  return fail(fallback, { fieldErrors: fieldErrorsOf(error) });
}

// ---- Convites ----------------------------------------------------------------

export async function inviteMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("team.invite");
  if (!auth.ok) return auth.state;
  const values = keepValues(formData, ["email", "roleId"]);

  const parsed = inviteSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ...invalid(parsed.error, "Verifique os campos."), values };

  const limit = await rateLimit({ key: `invite:user:${auth.ctx.user.id}`, max: 30, windowSeconds: 3600 });
  if (!limit.allowed) return fail("Muitos convites em pouco tempo. Tente novamente mais tarde.", { values });

  // organization_id vem do contexto do servidor — nunca do formulário.
  const result = await createInvitation({
    organizationId: auth.ctx.organization.id,
    invitedBy: auth.ctx.user.id,
    email: parsed.data.email,
    roleId: parsed.data.roleId,
  });
  if (!result.ok) return fail(result.error, { values });

  const link = `${publicEnv().NEXT_PUBLIC_APP_URL}/convite/${result.data.token}`;
  revalidatePath("/equipe");
  return succeed("Convite criado. Copie o link abaixo e envie ao convidado — ele só é exibido agora.", {
    data: { link },
  });
}

export async function revokeInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("team.invite");
  if (!auth.ok) return auth.state;
  const parsed = invitationIdSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const result = await revokeInvitation(auth.ctx.organization.id, parsed.data.invitationId);
  return result.ok ? done("Convite cancelado.") : fail(result.error);
}

// ---- Membros -----------------------------------------------------------------

export async function changeMemberRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("team.manage_members");
  if (!auth.ok) return auth.state;
  const parsed = changeRoleSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const result = await updateMemberRole(auth.ctx.organization.id, parsed.data.memberId, parsed.data.roleId);
  return result.ok ? done("Papel atualizado.") : fail(result.error);
}

export async function suspendMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("team.manage_members");
  if (!auth.ok) return auth.state;
  const parsed = memberIdSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const result = await setMemberStatus(auth.ctx.organization.id, parsed.data.memberId, "suspended");
  return result.ok ? done("Acesso suspenso.") : fail(result.error);
}

export async function reactivateMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("team.manage_members");
  if (!auth.ok) return auth.state;
  const parsed = memberIdSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const result = await setMemberStatus(auth.ctx.organization.id, parsed.data.memberId, "active");
  return result.ok ? done("Acesso reativado.") : fail(result.error);
}

export async function removeMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("team.manage_members");
  if (!auth.ok) return auth.state;
  const parsed = memberIdSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const result = await removeMember(auth.ctx.organization.id, parsed.data.memberId);
  return result.ok ? done("Membro removido.") : fail(result.error);
}

// ---- Equipes -----------------------------------------------------------------

export async function createTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("team.manage_teams");
  if (!auth.ok) return auth.state;
  const values = keepValues(formData, ["name", "description"]);
  const parsed = teamSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ...invalid(parsed.error, "Verifique os campos."), values };

  const result = await createTeam(auth.ctx.organization.id, parsed.data.name, parsed.data.description);
  return result.ok ? done("Equipe criada.") : fail(result.error, { values });
}

export async function deleteTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("team.manage_teams");
  if (!auth.ok) return auth.state;
  const parsed = teamIdSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const result = await deleteTeam(auth.ctx.organization.id, parsed.data.teamId);
  return result.ok ? done("Equipe excluída.") : fail(result.error);
}

export async function addTeamMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("team.manage_teams");
  if (!auth.ok) return auth.state;
  const parsed = teamMemberSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, "Selecione um usuário.");

  // a FK composta (organization_id, user_id) no banco impede vincular usuário de outra empresa
  const result = await addTeamMember(auth.ctx.organization.id, parsed.data.teamId, parsed.data.userId);
  return result.ok ? done("Usuário adicionado à equipe.") : fail(result.error);
}

export async function removeTeamMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("team.manage_teams");
  if (!auth.ok) return auth.state;
  const parsed = teamMemberSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const result = await removeTeamMember(auth.ctx.organization.id, parsed.data.teamId, parsed.data.userId);
  return result.ok ? done("Usuário removido da equipe.") : fail(result.error);
}
