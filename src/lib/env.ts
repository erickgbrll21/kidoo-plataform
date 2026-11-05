import { z } from "zod";

/**
 * Variáveis de ambiente validadas sob demanda (lazy).
 * Não validamos no import para que `next build` funcione sem segredos —
 * a falha acontece, de forma explícita, no primeiro uso real.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  // Chave pública (publishable/anon). Nunca use a service role aqui.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  /** 32 bytes em base64 — cifra tokens de integrações (Chatwoot/Z-API/IA). */
  KIDOO_ENCRYPTION_KEY: z.string().optional(),
  KIDOO_ENCRYPTION_KEY_ID: z.string().default("v1"),
  /** Instância Chatwoot self-hosted (Fase 3). Ausente = integração desligada. */
  CHATWOOT_BASE_URL: z.string().url().optional(),
  CHATWOOT_PLATFORM_TOKEN: z.string().min(10).optional(),
  CHATWOOT_VERSION: z.string().default("4.18.0"),
  /** Protege rotas de reprocessamento de webhooks / cron. */
  CRON_SECRET: z.string().min(16).optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

function format(err: z.ZodError) {
  return err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}

export function isSupabaseConfigured(): boolean {
  return publicSchema.safeParse(readPublicRaw()).success;
}

function readPublicRaw() {
  // Referências literais: o Next só inlina NEXT_PUBLIC_* quando acessadas por nome.
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined,
  };
}

export function publicEnv(): PublicEnv {
  const parsed = publicSchema.safeParse(readPublicRaw());
  if (!parsed.success) {
    throw new EnvError(
      `Configuração do Supabase ausente ou inválida (${format(parsed.error)}). Veja docs/SETUP.md.`,
    );
  }
  return parsed.data;
}

export function serverEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new EnvError(`Configuração de servidor ausente ou inválida (${format(parsed.error)}). Veja docs/SETUP.md.`);
  }
  return parsed.data;
}

export function isServiceRoleConfigured(): boolean {
  return serverSchema.safeParse(process.env).success;
}

/** Chatwoot só é considerado configurado com URL + Platform Token. */
export function isChatwootConfigured(): boolean {
  const env = process.env;
  return Boolean(env.CHATWOOT_BASE_URL && env.CHATWOOT_PLATFORM_TOKEN);
}

export function chatwootEnv() {
  const env = serverEnv();
  if (!env.CHATWOOT_BASE_URL || !env.CHATWOOT_PLATFORM_TOKEN) {
    throw new EnvError("Chatwoot não configurado (CHATWOOT_BASE_URL / CHATWOOT_PLATFORM_TOKEN). Veja docs/SETUP.md.");
  }
  if (!env.KIDOO_ENCRYPTION_KEY) {
    throw new EnvError("KIDOO_ENCRYPTION_KEY é obrigatória para cifrar tokens do Chatwoot.");
  }
  return {
    baseUrl: env.CHATWOOT_BASE_URL.replace(/\/$/, ""),
    platformToken: env.CHATWOOT_PLATFORM_TOKEN,
    version: env.CHATWOOT_VERSION,
    encryptionKey: env.KIDOO_ENCRYPTION_KEY,
    encryptionKeyId: env.KIDOO_ENCRYPTION_KEY_ID,
  };
}
