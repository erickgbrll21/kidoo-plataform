/**
 * Aceita somente caminhos internos ("/algo"). Bloqueia URLs absolutas,
 * protocol-relative ("//host"), barras invertidas e caracteres de controle
 * (vetores clássicos de open redirect).
 */
export function safeRedirectPath(input: string | null | undefined, fallback = "/dashboard"): string {
  if (!input) return fallback;
  if (input.length > 512) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(input)) return fallback;
  if (!input.startsWith("/") || input.startsWith("//")) return fallback;
  try {
    const url = new URL(input, "http://internal.invalid");
    if (url.origin !== "http://internal.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
