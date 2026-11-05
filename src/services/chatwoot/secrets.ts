import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { EnvError, serverEnv } from "@/lib/env";
import { createServiceClient } from "@/lib/database/service";
import { decryptSecret, encryptSecret, keyRingFromEnv } from "@/lib/security/crypto";

function ring() {
  const env = serverEnv();
  if (!env.KIDOO_ENCRYPTION_KEY) {
    throw new EnvError("KIDOO_ENCRYPTION_KEY é obrigatória para cifrar tokens de integração.");
  }
  return keyRingFromEnv({
    KIDOO_ENCRYPTION_KEY: env.KIDOO_ENCRYPTION_KEY,
    KIDOO_ENCRYPTION_KEY_ID: env.KIDOO_ENCRYPTION_KEY_ID,
  });
}

export function aadFor(organizationId: string, purpose: string, resourceKey = "") {
  return resourceKey
    ? `org:${organizationId}:${purpose}:${resourceKey}`
    : `org:${organizationId}:${purpose}`;
}

export async function storeSecret(input: {
  organizationId: string;
  purpose: "chatwoot_account_token" | "chatwoot_webhook" | "meta_whatsapp" | "zapi_instance" | "ai_provider";
  plaintext: string;
  /** Diferencia vários segredos do mesmo purpose (ex.: phone_number_id). */
  resourceKey?: string;
}): Promise<{ id: string }> {
  const resourceKey = input.resourceKey ?? "";
  const aad = aadFor(input.organizationId, input.purpose, resourceKey);
  const ciphertext = encryptSecret(input.plaintext, ring(), aad);
  const db = createServiceClient();
  const { data, error } = await db
    .from("integration_secrets")
    .upsert(
      {
        organization_id: input.organizationId,
        purpose: input.purpose,
        resource_key: resourceKey,
        ciphertext,
        key_id: ring().current,
        aad,
        rotated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,purpose,resource_key" },
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

export async function deleteSecret(secretId: string): Promise<void> {
  const db = createServiceClient();
  await db.from("integration_secrets").delete().eq("id", secretId);
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
