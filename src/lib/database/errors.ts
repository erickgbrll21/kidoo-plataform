/**
 * Traduz as exceções de negócio levantadas pelas funções/gatilhos SQL
 * (`raise exception 'codigo'`) em mensagens para o usuário.
 */
const MESSAGES: Record<string, string> = {
  not_authenticated: "Sua sessão expirou. Entre novamente.",
  invalid_name: "Nome inválido.",
  invalid_slug: "Identificador inválido: use 3 a 50 letras minúsculas, números e hífens.",
  slug_taken: "Este identificador já está em uso. Escolha outro.",
  owner_required: "Apenas proprietários podem conceder, alterar ou remover o papel de proprietário.",
  last_owner: "A empresa precisa ter ao menos um proprietário ativo.",
  member_limit_reached: "O limite de usuários do seu plano foi atingido.",
  role_not_in_organization: "Este papel não pertence à sua empresa.",
  invalid_expiration: "Validade do convite inválida.",
  invitation_invalid: "Este convite é inválido, expirou ou já foi utilizado.",
  invitation_email_mismatch: "Este convite foi enviado para outro e-mail. Entre com a conta convidada.",
  email_not_confirmed: "Confirme seu e-mail antes de aceitar o convite.",
  already_member: "Você já faz parte desta empresa.",
  organization_unavailable: "Esta empresa está indisponível.",
};

export type DbErrorLike = { message?: string; code?: string } | null | undefined;

export function dbErrorCode(error: DbErrorLike): string | null {
  const text = error?.message ?? "";
  for (const code of Object.keys(MESSAGES)) {
    if (text.includes(code)) return code;
  }
  return null;
}

export function dbErrorMessage(error: DbErrorLike, fallback = "Não foi possível concluir a operação."): string {
  const code = dbErrorCode(error);
  if (code) return MESSAGES[code]!;
  if (error?.code === "42501") return "Você não tem permissão para executar esta ação.";
  if (error?.code === "23505") return "Já existe um registro com estes dados.";
  return fallback;
}
