import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { sessionCookieOptions } from "./cookies";

/**
 * Renova a sessão (refresh de token) a cada requisição e devolve o usuário.
 * Importante: usa `getUser()` (valida no servidor Auth), não só decodifica o JWT.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return {
      response,
      user: null as { id: string } | null,
      configured: false,
      withSessionCookies: (target: NextResponse) => target,
    };
  }

  const env = publicEnv();
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, sessionCookieOptions(options));
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    response,
    user: user ? { id: user.id } : null,
    configured: true,
    /** Copia cookies renovados para uma resposta de redirect. */
    withSessionCookies(target: NextResponse) {
      for (const c of response.cookies.getAll()) target.cookies.set(c);
      return target;
    },
  };
}
