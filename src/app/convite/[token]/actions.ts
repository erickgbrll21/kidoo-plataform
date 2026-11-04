"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, formObject, type ActionState } from "@/lib/actions";
import { ACTIVE_ORG_COOKIE, getSessionUser } from "@/lib/auth/dal";
import { rateLimit } from "@/lib/security/rate-limit";
import { acceptInvitation } from "@/services/team/service";

const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,100}$/);

export async function acceptInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ token: inviteTokenSchema }).safeParse(formObject(formData));
  if (!parsed.success) return fail("Convite inválido.");

  const user = await getSessionUser();
  if (!user) return fail("Sua sessão expirou. Entre novamente.");

  // freia tentativa de adivinhar tokens
  const limit = await rateLimit({ key: `invite-accept:user:${user.id}`, max: 10, windowSeconds: 600 });
  if (!limit.allowed) return fail("Muitas tentativas. Aguarde alguns minutos.");

  const result = await acceptInvitation(parsed.data.token);
  if (!result.ok) return fail(result.error);

  (await cookies()).set(ACTIVE_ORG_COOKIE, result.data.organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/dashboard");
}
