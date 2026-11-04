import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/database/server";
import { isSupabaseConfigured } from "@/lib/env";
import { safeRedirectPath } from "@/lib/security/safe-redirect";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Destino dos links enviados por e-mail (confirmação de cadastro, recuperação de senha).
 * Suporta o fluxo por `token_hash` (recomendado) e o fluxo PKCE por `code`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next"), "/dashboard");
  const invalid = () => NextResponse.redirect(new URL("/login?erro=link-invalido", origin));

  if (!isSupabaseConfigured()) return NextResponse.redirect(new URL("/login", origin));

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  try {
    const supabase = await createClient();

    if (tokenHash && type && OTP_TYPES.includes(type)) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) return NextResponse.redirect(new URL(next, origin));
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, origin));
    }
  } catch (err) {
    console.error("[auth/confirm] falha ao validar o link", err);
  }

  return invalid();
}
