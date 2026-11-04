import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { chatwootEnv } from "@/lib/env";
import { createServiceClient } from "@/lib/database/service";
import { decryptSecret, encryptSecret, keyRingFromEnv } from "@/lib/security/crypto";

function ring() {
  const env = chatwootEnv();
  return keyRingFromEnv({
    KIDOO_ENCRYPTION_KEY: env.encryptionKey,
    KIDOO_ENCRYPTION_KEY_ID: env.encryptionKeyId,
  });
}

export function aadFor(organizationId: string, purpose: string) {
  return `org:${organizationId}:${purpose}`;
}

export async function storeSecret(input: {
  organizationId: string;
  purpose: "chatwoot_account_token" | "chatwoot_webhook" | "meta_whatsapp" | "ai_provider";
  plaintext: string;
}): Promise<{ id: string }> {
  const aad = aadFor(input.organizationId, input.purpose);
  const ciphertext = encryptSecret(input.plaintext, ring(), aad);
  const db = createServiceClient();
  const { data, error } = await db
    .from("integration_secrets")
    .upsert(
      {
        organization_id: input.organizationId,
        purpose: input.purpose,
        ciphertext,
        key_id: ring().current,
        aad,
        rotated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,purpose" },
    )
    .select("id")
    .single();
  if (error || !data) throw new Error(`Falha ao gravar segredo: ${error?.message}`);
  return { id: data.id as string };
}

export async function readSecret(secretId: string, organizationId: string, purpose: string): Promise<string> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("integration_secrets")
    .select("ciphertext, aad, purpose, organization_id")
    .eq("id", secretId)
    .maybeSingle();
  if (error || !data) throw new Error("Segredo não encontrado.");
  if (data.organization_id !== organizationId || data.purpose !== purpose) {
    throw new Error("Segredo não pertence a este contexto.");
  }
  return decryptSecret(data.ciphertext as string, ring(), data.aad as string);
}

export function generateWebhookSecret() {
  return randomBytes(32).toString("base64url");
}

export function hashWebhookSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

/** Comparação em tempo constante do token de webhook (query/path). */
export function webhookSecretMatches(provided: string, expectedPlaintext: string) {
  const a = Buffer.from(hashWebhookSecret(provided));
  const b = Buffer.from(hashWebhookSecret(expectedPlaintext));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
