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
  /** 32 bytes em base64 — cifra tokens de integrações (Chatwoot/Meta/IA). */
  KIDOO_ENCRYPTION_KEY: z.string().optional(),
  KIDOO_ENCRYPTION_KEY_ID: z.string().default("v1"),
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
