"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, fieldErrorsOf, formObject, succeed, type ActionState } from "@/lib/actions";
import { getSessionUser, isPlatformAdmin } from "@/lib/auth/dal";
import { setTenantStatus } from "@/services/admin/service";

const schema = z.object({ organizationId: z.uuid({ error: "Empresa inválida." }) });

async function change(formData: FormData, status: "active" | "suspended"): Promise<ActionState> {
  // Server Actions são endpoints públicos: a verificação de administrador é refeita aqui.
  const user = await getSessionUser();
  if (!user || !(await isPlatformAdmin())) return fail("Acesso negado.");

  const parsed = schema.safeParse(formObject(formData));
  if (!parsed.success) return fail("Empresa inválida.", { fieldErrors: fieldErrorsOf(parsed.error) });

  const result = await setTenantStatus(user.id, parsed.data.organizationId, status);
  if (!result.ok) return fail(result.error);

  revalidatePath("/admin");
  return succeed(status === "suspended" ? "Empresa suspensa." : "Empresa reativada.");
}

export async function suspendTenantAction(_prev: ActionState, formData: FormData) {
  return change(formData, "suspended");
}

export async function reactivateTenantAction(_prev: ActionState, formData: FormData) {
  return change(formData, "active");
}
