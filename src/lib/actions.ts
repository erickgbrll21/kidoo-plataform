import "server-only";
import { z } from "zod";
import { getTenantContext, type TenantContext } from "@/lib/auth/dal";
import type { Permission } from "@/lib/auth/permissions";

/** Estado devolvido por Server Actions (compatível com useActionState). */
export type ActionState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Dado efêmero retornado ao cliente (ex.: link de convite exibido uma única vez). */
  data?: Record<string, string>;
  /** Valores (não sensíveis) reenviados ao formulário após erro, pois o React reseta o <form>. */
  values?: Record<string, string>;
};

/** Copia campos NÃO sensíveis do formulário para reexibição. Nunca inclua senhas. */
export function keepValues(formData: FormData, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = formData.get(k);
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export const fail = (message: string, extra: Partial<ActionState> = {}): ActionState => ({
  ok: false,
  message,
  ...extra,
});
export const succeed = (message: string, extra: Partial<ActionState> = {}): ActionState => ({
  ok: true,
  message,
  ...extra,
});

export function fieldErrorsOf(error: z.ZodError): Record<string, string[] | undefined> {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

export function formObject(formData: FormData) {
  const out: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of formData.entries()) {
    if (!k.startsWith("$ACTION")) out[k] = v;
  }
  return out;
}

export type Authorized = { ok: true; ctx: TenantContext } | { ok: false; state: ActionState };

/**
 * Autoriza uma Server Action: sessão válida + empresa ativa + permissão.
 * O contexto é resolvido NO SERVIDOR; nunca aceite organization_id do formulário.
 */
export async function authorizeAction(permission?: Permission): Promise<Authorized> {
  const ctx = await getTenantContext();
  if (ctx.status !== "ready") return { ok: false, state: fail("Sua sessão expirou. Entre novamente.") };
  if (ctx.organization.status !== "active") {
    return { ok: false, state: fail("Esta empresa está suspensa. Entre em contato com o suporte KIDOO.") };
  }
  if (permission && !ctx.permissions.has(permission)) {
    return { ok: false, state: fail("Você não tem permissão para executar esta ação.") };
  }
  return { ok: true, ctx };
}
