/**
 * Catálogo de permissões — ESPELHO de `public.permissions` no banco.
 * `tests/permissions-sync.test.ts` falha se as listas divergirem.
 * A autorização real é feita no banco (RLS) e no servidor; isto serve para
 * tipagem e para esconder elementos de UI que o usuário não poderia usar.
 */
export const PERMISSIONS = [
  "org.update",
  "team.invite",
  "team.manage_members",
  "team.manage_teams",
  "channels.read",
  "channels.manage",
  "inbox.read",
  "inbox.reply",
  "inbox.assign",
  "contacts.read",
  "contacts.write",
  "contacts.delete",
  "crm.read",
  "crm.write",
  "crm.manage",
  "agents.read",
  "agents.manage",
  "automations.read",
  "automations.manage",
  "reports.read",
  "audit.read",
  "billing.manage",
  "settings.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type SystemRoleKey = "owner" | "admin" | "manager" | "agent" | "viewer";

export const ROLE_LABELS: Record<SystemRoleKey, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  manager: "Gestor",
  agent: "Atendente",
  viewer: "Leitor",
};
