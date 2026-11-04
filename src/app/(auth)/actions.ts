"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fail, fieldErrorsOf, formObject, keepValues, succeed, type ActionState } from "@/lib/actions";
import { ACTIVE_ORG_COOKIE, getSessionUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/database/server";
import { publicEnv } from "@/lib/env";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { safeRedirectPath } from "@/lib/security/safe-redirect";
import { shortHash } from "@/lib/security/tokens";
import {
  createOrganizationSchema,
  forgotPasswordSchema,
  loginSchema,
  organizationNameSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validations/auth";
import { createOrganization } from "@/services/organizations/service";

const TEN_MIN = 600;

function tooMany(retryAfterSeconds: number, values?: Record<string, string>) {
  const min = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return fail(`Muitas tentativas. Tente novamente em ${min} min.`, { values });
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = keepValues(formData, ["email"]);
  const parsed = loginSchema.safeParse(formObject(formData));
  if (!parsed.success) return fail("Verifique os campos.", { fieldErrors: fieldErrorsOf(parsed.error), values });

  const { email, password, next } = parsed.data;
  const ip = await getClientIp();
  const [byIp, byEmail] = await Promise.all([
    rateLimit({ key: `login:ip:${ip}`, max: 30, windowSeconds: TEN_MIN }),
    rateLimit({ key: `login:email:${shortHash(email)}`, max: 8, windowSeconds: TEN_MIN }),
  ]);
  if (!byIp.allowed || !byEmail.allowed) {
    return tooMany(Math.max(byIp.retryAfterSeconds, byEmail.retryAfterSeconds), values);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return fail("Confirme seu e-mail para entrar. Verifique sua caixa de entrada.", { values });
    }
    // mensagem genérica: não revela se a conta existe
    return fail("E-mail ou senha incorretos.", { values });
  }

  redirect(safeRedirectPath(next));
}

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = keepValues(formData, ["fullName", "email", "companyName"]);
  const parsed = signupSchema.safeParse(formObject(formData));
  if (!parsed.success) return fail("Verifique os campos.", { fieldErrors: fieldErrorsOf(parsed.error), values });

  const { fullName, email, password, companyName, next } = parsed.data;
  const ip = await getClientIp();
  const limit = await rateLimit({ key: `signup:ip:${ip}`, max: 6, windowSeconds: 3600 });
  if (!limit.allowed) return tooMany(limit.retryAfterSeconds, values);

  const supabase = await createClient();
  const appUrl = publicEnv().NEXT_PUBLIC_APP_URL;
  const nextPath = safeRedirectPath(next, "/onboarding");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, ...(companyName ? { company_name: companyName } : {}) },
      emailRedirectTo: `${appUrl}/auth/confirm?next=${encodeURIComponent(nextPath)}`,
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return fail("Senha muito fraca. Escolha uma senha mais forte.", { values });
    }
    console.error("[signup]", error.code, error.message);
    return fail("Não foi possível criar a conta agora. Tente novamente.", { values });
  }

  // Confirmação de e-mail desativada no projeto: já existe sessão.
  if (data.session) redirect(nextPath);

  // Mesma resposta para e-mails novos e já cadastrados (sem enumeração de contas).
  return succeed("Quase lá! Enviamos um link de confirmação para o seu e-mail. Abra-o para ativar a conta.");
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = keepValues(formData, ["email"]);
  const parsed = forgotPasswordSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return fail("Informe um e-mail válido.", { fieldErrors: fieldErrorsOf(parsed.error), values });
  }

  const ip = await getClientIp();
  const [byIp, byEmail] = await Promise.all([
    rateLimit({ key: `reset:ip:${ip}`, max: 10, windowSeconds: 3600 }),
    rateLimit({ key: `reset:email:${shortHash(parsed.data.email)}`, max: 3, windowSeconds: 3600 }),
  ]);
  if (!byIp.allowed || !byEmail.allowed) {
    return tooMany(Math.max(byIp.retryAfterSeconds, byEmail.retryAfterSeconds), values);
  }

  const supabase = await createClient();
  const appUrl = publicEnv().NEXT_PUBLIC_APP_URL;
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/auth/confirm?next=${encodeURIComponent("/redefinir-senha")}`,
  });

  return succeed("Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(formObject(formData));
  if (!parsed.success) return fail("Verifique os campos.", { fieldErrors: fieldErrorsOf(parsed.error) });

  const user = await getSessionUser();
  if (!user) return fail("O link expirou. Solicite uma nova redefinição de senha.");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return fail("Escolha uma senha diferente da atual.");
    if (error.code === "weak_password") return fail("Senha muito fraca. Escolha uma senha mais forte.");
    return fail("Não foi possível redefinir a senha. Solicite um novo link.");
  }
  redirect("/dashboard");
}

export async function createOrganizationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = keepValues(formData, ["name", "slug"]);
  const user = await getSessionUser();
  if (!user) return fail("Sua sessão expirou. Entre novamente.", { values });

  // o schema pode lançar (slugify gera slug inválido para nomes sem letras): tratamos como erro de campo
  let parsedInput: { name: string; slug: string };
  try {
    parsedInput = createOrganizationSchema.parse(formObject(formData));
  } catch {
    const nameCheck = organizationNameSchema.safeParse(formData.get("name"));
    return fail("Verifique os campos.", {
      fieldErrors: nameCheck.success
        ? { slug: ["Identificador inválido: use 3 a 50 letras minúsculas, números e hífens."] }
        : { name: [nameCheck.error.issues[0]?.message ?? "Nome inválido."] },
      values,
    });
  }

  const limit = await rateLimit({ key: `org-create:user:${user.id}`, max: 5, windowSeconds: 3600 });
  if (!limit.allowed) return tooMany(limit.retryAfterSeconds, values);

  const result = await createOrganization(parsedInput);
  if (!result.ok) {
    return fail(result.error, {
      values,
      ...(result.error.toLowerCase().includes("identificador") ? { fieldErrors: { slug: [result.error] } } : {}),
    });
  }

  (await cookies()).set(ACTIVE_ORG_COOKIE, result.data.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/dashboard");
}
