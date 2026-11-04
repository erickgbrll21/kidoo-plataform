import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifra de segredos de integração (tokens Chatwoot/Meta/IA) — AES-256-GCM.
 * Formato: `v1:<keyId>:<iv>:<tag>:<ciphertext>` (base64url). O `keyId` permite rotação:
 * novas gravações usam a chave atual; leituras escolhem a chave pelo id.
 *
 * `aad` (dados autenticados adicionais) amarra o segredo ao seu dono
 * (ex.: `org:<uuid>:chatwoot`), impedindo que um texto cifrado seja
 * "transplantado" para outro tenant.
 */

export type KeyRing = { current: string; keys: Record<string, Buffer> };

export function keyRingFromEnv(env: { KIDOO_ENCRYPTION_KEY?: string; KIDOO_ENCRYPTION_KEY_ID?: string }): KeyRing {
  const raw = env.KIDOO_ENCRYPTION_KEY;
  if (!raw) throw new Error("KIDOO_ENCRYPTION_KEY não configurada");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("KIDOO_ENCRYPTION_KEY deve ter 32 bytes (base64)");
  const id = env.KIDOO_ENCRYPTION_KEY_ID ?? "v1";
  return { current: id, keys: { [id]: key } };
}

export function encryptSecret(plaintext: string, ring: KeyRing, aad: string): string {
  const key = ring.keys[ring.current];
  if (!key) throw new Error("chave de cifra atual indisponível");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", ring.current, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(":");
}

export function decryptSecret(payload: string, ring: KeyRing, aad: string): string {
  const [version, keyId, iv, tag, ct] = payload.split(":");
  if (version !== "v1" || !keyId || !iv || !tag || !ct) throw new Error("formato de segredo inválido");
  const key = ring.keys[keyId];
  if (!key) throw new Error(`chave de cifra "${keyId}" indisponível`);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
