import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import { sessionCookieOptions } from "./cookies";

/**
 * Cliente Supabase com a SESSÃO DO USUÁRIO (RLS aplicada).
 * É o cliente padrão para qualquer leitura/escrita feita em nome de um usuário.
 */
export async function createClient() {
  // `cookies()` primeiro: torna a rota dinâmica antes de qualquer validação, de modo que
  // o pré-render (build) nunca execute este código nem exija variáveis de ambiente.
  const cookieStore = await cookies();
  const env = publicEnv();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, sessionCookieOptions(options));
          }
        } catch {
          // Chamado a partir de um Server Component (cookies são somente leitura).
          // O proxy.ts renova a sessão, então é seguro ignorar.
        }
      },
    },
  });
}
