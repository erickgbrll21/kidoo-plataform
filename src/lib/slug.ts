/** "Empresa Ação & Cia" -> "empresa-acao-cia" (3–50 chars, compatível com a constraint do banco). */
export function slugify(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
  return base.length >= 3 ? base : `${base || "empresa"}-hub`.slice(0, 50);
}
