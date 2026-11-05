"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, fieldErrorsOf, formObject, succeed, type ActionState } from "@/lib/actions";
import { getSessionUser, isPlatformAdmin } from "@/lib/auth/dal";
import { retryDeadWebhookEvent, setTenantStatus } from "@/services/admin/service";

const schema = z.object({ organizationId: z.uuid({ error: "Empresa inválida." }) });
const webhookSchema = z.object({ eventId: z.uuid({ error: "Evento inválido." }) });

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || !(await isPlatformAdmin())) return null;
  return user;
}

async function change(formData: FormData, status: "active" | "suspended"): Promise<ActionState> {
  // Server Actions são endpoints públicos: a verificação de administrador é refeita aqui.
  const user = await requireAdmin();
  if (!user) return fail("Acesso negado.");

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

export async function retryDeadWebhookAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requireAdmin())) return fail("Acesso negado.");

  const parsed = webhookSchema.safeParse(formObject(formData));
  if (!parsed.success) return fail("Evento inválido.", { fieldErrors: fieldErrorsOf(parsed.error) });

  const result = await retryDeadWebhookEvent(parsed.data.eventId);
  if (!result.ok) return fail(result.error ?? "Não foi possível reenfileirar.");

  revalidatePath("/admin");
  return succeed("Evento reenfileirado. O cron processará em até alguns minutos.");
}
