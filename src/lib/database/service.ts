import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * ⚠️  CLIENTE SERVICE ROLE — IGNORA RLS.
 *
 * Uso permitido APENAS em código sem usuário (webhooks, jobs, provisionamento) ou
 * em operações administrativas da plataforma, sempre com `organization_id`
 * resolvido no servidor a partir do mapeamento seguro — NUNCA a partir do payload
 * do navegador. Qualquer novo uso deve passar por revisão.
 */
export function createServiceClient() {
  const url = publicEnv().NEXT_PUBLIC_SUPABASE_URL;
  const key = serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
