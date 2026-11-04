"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeAction, fail, fieldErrorsOf, formObject, keepValues, succeed, type ActionState } from "@/lib/actions";
import { getSessionUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/database/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { passwordSchema } from "@/lib/validations/auth";
import { updateOrganizationSchema, updateProfileSchema } from "@/lib/validations/team";
import { updateOrganizationName } from "@/services/organizations/service";

export async function updateOrganizationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("org.update");
  if (!auth.ok) return auth.state;
  const values = keepValues(formData, ["name"]);

  const parsed = updateOrganizationSchema.safeParse(formObject(formData));
  if (!parsed.success) return fail("Verifique os campos.", { fieldErrors: fieldErrorsOf(parsed.error), values });

  const result = await updateOrganizationName(auth.ctx.organization.id, parsed.data.name);
  if (!result.ok) return fail(result.error, { values });

  revalidatePath("/", "layout");
  return succeed("Dados da empresa atualizados.");
}

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail("Sua sessão expirou. Entre novamente.");
  const values = keepValues(formData, ["fullName"]);

  const parsed = updateProfileSchema.safeParse(formObject(formData));
  if (!parsed.success) return fail("Verifique os campos.", { fieldErrors: fieldErrorsOf(parsed.error), values });

  const supabase = await createClient();
  // RLS + grant de coluna: o usuário só altera o próprio full_name
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", user.id)
    .select("id");
  if (error || !data?.length) return fail("Não foi possível atualizar o perfil.", { values });

  revalidatePath("/", "layout");
  return succeed("Perfil atualizado.");
}

const changePasswordSchema = z
  .object({ current: z.string().min(1, "Informe a senha atual.").max(72), password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não conferem." });

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail("Sua sessão expirou. Entre novamente.");

  const parsed = changePasswordSchema.safeParse(formObject(formData));
  if (!parsed.success) return fail("Verifique os campos.", { fieldErrors: fieldErrorsOf(parsed.error) });

  const limit = await rateLimit({ key: `pwd-change:user:${user.id}`, max: 5, windowSeconds: 900 });
  if (!limit.allowed) return fail("Muitas tentativas. Aguarde alguns minutos.");

  const supabase = await createClient();
  // reautenticação: confirma a senha atual antes de trocar
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current,
  });
  if (reauthError) return fail("Senha atual incorreta.", { fieldErrors: { current: ["Senha atual incorreta."] } });

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return fail("Escolha uma senha diferente da atual.");
    if (error.code === "weak_password") return fail("Senha muito fraca. Escolha uma senha mais forte.");
    return fail("Não foi possível alterar a senha.");
  }
  return succeed("Senha alterada com sucesso.");
}
