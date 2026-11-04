"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_ORG_COOKIE, getTenantContext } from "@/lib/auth/dal";
import { createClient } from "@/lib/database/server";
import { organizationIdSchema } from "@/lib/validations/team";

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(ACTIVE_ORG_COOKIE);
  redirect("/login");
}

/**
 * Troca a empresa ativa. O cookie é só preferência: só é gravado se o usuário
 * for, de fato, membro ativo da empresa (verificado no banco via RLS).
 */
export async function switchOrganizationAction(formData: FormData) {
  const parsed = organizationIdSchema.safeParse({ organizationId: formData.get("organizationId") });
  if (!parsed.success) redirect("/dashboard");

  const ctx = await getTenantContext();
  if (ctx.status !== "ready") redirect("/login");

  const target = ctx.memberships.find((m) => m.organizationId === parsed.data.organizationId);
  if (!target) redirect("/dashboard"); // ID de outra empresa: ignorado silenciosamente

  (await cookies()).set(ACTIVE_ORG_COOKIE, target.organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/dashboard");
}
