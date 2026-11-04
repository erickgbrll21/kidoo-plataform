/** Rótulos amigáveis para as ações registradas em `public.audit_logs`. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "organization.created": "Empresa criada",
  "member.added": "Membro adicionado",
  "member.updated": "Membro atualizado",
  "member.removed": "Membro removido",
  "invitation.created": "Convite enviado",
  "invitation.accepted": "Convite aceito",
  "invitation.revoked": "Convite cancelado",
  "organization.suspended": "Empresa suspensa pela KIDOO",
  "organization.reactivated": "Empresa reativada pela KIDOO",
};

export const auditLabel = (action: string) => AUDIT_ACTION_LABELS[action] ?? action;
