import { createHash, randomBytes } from "node:crypto";

/** Token aleatório de 256 bits (URL-safe) e seu hash SHA-256 (único valor persistido). */
export function generateToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Hash curto e estável para compor chaves (evita PII em tabelas auxiliares). */
export function shortHash(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 24);
}
