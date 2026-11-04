import type { CookieOptions } from "@supabase/ssr";

/**
 * Cookies de sessão: httpOnly (inacessíveis a JavaScript — mitiga roubo por XSS),
 * secure em produção e SameSite=Lax. O navegador nunca manipula tokens: login,
 * logout e renovação acontecem no servidor (Server Actions + proxy).
 */
export function sessionCookieOptions(options: CookieOptions = {}): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}
