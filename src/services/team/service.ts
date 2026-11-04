import "server-only";
import { createClient } from "@/lib/database/server";
import { dbErrorMessage } from "@/lib/database/errors";
import { generateToken, hashToken } from "@/lib/security/tokens";
import type { Result } from "@/services/organizations/service";

const INVITE_TTL_DAYS = 7;

export type MemberRow = {
  id: string;
  userId: string;
  status: "active" | "suspended";
  roleId: string;
  roleKey: string;
  roleName: string;
  fullName: string;
  createdAt: string;
};

export type RoleOption = { id: string; key: string; name: string; description: string };

export type InvitationRow = {
  id: string;
  email: string;
  roleName: string;
  expiresAt: string;
  createdAt: string;
  state: "pending" | "expired";
};

export type TeamRow = {
  id: string;
  name: string;
  description: string;
  members: Array<{ userId: string; fullName: string; isLead: boolean }>;
};

export async function listRoles(organizationId: string): Promise<RoleOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("roles")
    .select("id, key, name, description, is_system")
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    .order("is_system", { ascending: false })
    .order("created_at", { ascending: true });
  const order = ["owner", "admin", "manager", "agent", "viewer"];
  return ((data ?? []) as RoleOption[]).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

export async function listMembers(organizationId: string): Promise<MemberRow[]> {
  const supabase = await createClient();
  const { data: members, error } = await supabase
    .from("organization_members")
    .select("id, user_id, status, role_id, created_at, role:roles(key, name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (error || !members) return [];

  const userIds = members.map((m) => m.user_id as string);
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string) || ""]));

  return members.map((m) => {
    const role = m.role as unknown as { key: string; name: string } | null;
    return {
      id: m.id as string,
      userId: m.user_id as string,
      status: m.status as "active" | "suspended",
      roleId: m.role_id as string,
      roleKey: role?.key ?? "",
      roleName: role?.name ?? "",
      fullName: names.get(m.user_id as string) ?? "",
      createdAt: m.created_at as string,
    };
  });
}

export async function updateMemberRole(organizationId: string, memberId: string, roleId: string): Promise<Result<null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .update({ role_id: roleId })
    .eq("id", memberId)
    .eq("organization_id", organizationId)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, error: "Não foi possível alterar este membro (sem permissão ou é a sua própria conta)." };
  return { ok: true, data: null };
}

export async function setMemberStatus(
  organizationId: string,
  memberId: string,
  status: "active" | "suspended",
): Promise<Result<null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .update({ status })
    .eq("id", memberId)
    .eq("organization_id", organizationId)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, error: "Não foi possível alterar este membro (sem permissão ou é a sua própria conta)." };
  return { ok: true, data: null };
}

export async function removeMember(organizationId: string, memberId: string): Promise<Result<null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", memberId)
    .eq("organization_id", organizationId)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, error: "Não foi possível remover este membro." };
  return { ok: true, data: null };
}

export async function listInvitations(organizationId: string): Promise<InvitationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invitations")
    .select("id, email, expires_at, created_at, role:roles(name)")
    .eq("organization_id", organizationId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  const now = Date.now();
  return (data ?? []).map((i) => ({
    id: i.id as string,
    email: i.email as string,
    roleName: (i.role as unknown as { name: string } | null)?.name ?? "",
    expiresAt: i.expires_at as string,
    createdAt: i.created_at as string,
    state: new Date(i.expires_at as string).getTime() > now ? ("pending" as const) : ("expired" as const),
  }));
}

/**
 * Cria o convite. O token em claro é devolvido UMA vez (para montar o link);
 * apenas o hash SHA-256 fica no banco.
 */
export async function createInvitation(input: {
  organizationId: string;
  invitedBy: string;
  email: string;
  roleId: string;
}): Promise<Result<{ token: string }>> {
  const supabase = await createClient();
  const { token, hash } = generateToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("invitations").insert({
    organization_id: input.organizationId,
    email: input.email,
    role_id: input.roleId,
    token_hash: hash,
    invited_by: input.invitedBy,
    expires_at: expiresAt,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe um convite pendente para este e-mail." };
    return { ok: false, error: dbErrorMessage(error, "Não foi possível criar o convite.") };
  }
  return { ok: true, data: { token } };
}

export async function revokeInvitation(organizationId: string, invitationId: string): Promise<Result<null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("organization_id", organizationId)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, error: "Convite não encontrado." };
  return { ok: true, data: null };
}

export type InvitationPreview = {
  organization_name: string;
  role_name: string;
  email: string;
  status: "valid" | "expired" | "revoked" | "accepted" | "unavailable";
  email_matches: boolean;
};

export async function previewInvitation(token: string): Promise<InvitationPreview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_invitation_preview", { p_token_hash: hashToken(token) });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as InvitationPreview | undefined) ?? null;
}

export async function acceptInvitation(token: string): Promise<Result<{ organizationId: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token_hash: hashToken(token) });
  if (error || !data) return { ok: false, error: dbErrorMessage(error, "Não foi possível aceitar o convite.") };
  return { ok: true, data: { organizationId: data as string } };
}

// ---- Equipes -------------------------------------------------------------

export async function listTeams(organizationId: string): Promise<TeamRow[]> {
  const supabase = await createClient();
  const [{ data: teams }, { data: links }] = await Promise.all([
    supabase.from("teams").select("id, name, description").eq("organization_id", organizationId).order("name"),
    supabase.from("team_members").select("team_id, user_id, is_lead").eq("organization_id", organizationId),
  ]);
  const userIds = [...new Set((links ?? []).map((l) => l.user_id as string))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] as Array<{ id: string; full_name: string }> };
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string) || ""]));

  return (teams ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    description: (t.description as string) ?? "",
    members: (links ?? [])
      .filter((l) => l.team_id === t.id)
      .map((l) => ({ userId: l.user_id as string, fullName: names.get(l.user_id as string) ?? "", isLead: Boolean(l.is_lead) })),
  }));
}

export async function createTeam(organizationId: string, name: string, description: string): Promise<Result<null>> {
  const supabase = await createClient();
  const { error } = await supabase.from("teams").insert({ organization_id: organizationId, name, description });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe uma equipe com este nome." };
    return { ok: false, error: dbErrorMessage(error, "Não foi possível criar a equipe.") };
  }
  return { ok: true, data: null };
}

export async function deleteTeam(organizationId: string, teamId: string): Promise<Result<null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .delete()
    .eq("id", teamId)
    .eq("organization_id", organizationId)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, error: "Equipe não encontrada." };
  return { ok: true, data: null };
}

export async function addTeamMember(organizationId: string, teamId: string, userId: string): Promise<Result<null>> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("team_members")
    .insert({ organization_id: organizationId, team_id: teamId, user_id: userId });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Este usuário já está na equipe." };
    if (error.code === "23503") return { ok: false, error: "Usuário ou equipe inválidos." };
    return { ok: false, error: dbErrorMessage(error) };
  }
  return { ok: true, data: null };
}

export async function removeTeamMember(organizationId: string, teamId: string, userId: string): Promise<Result<null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_members")
    .delete()
    .eq("organization_id", organizationId)
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, error: "Vínculo não encontrado." };
  return { ok: true, data: null };
}
