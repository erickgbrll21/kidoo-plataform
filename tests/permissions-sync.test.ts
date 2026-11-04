import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@/lib/auth/permissions";

/** Garante que o catálogo TypeScript espelha as permissões semeadas na migration. */
describe("catálogo de permissões", () => {
  it("coincide com public.permissions da migration", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261104120000_identity_and_tenancy.sql"), "utf8");
    const block = sql.slice(sql.indexOf("insert into public.permissions"));
    const end = block.indexOf(";");
    const keys = [...block.slice(0, end).matchAll(/\('([a-z_]+\.[a-z_]+)'/g)].map((m) => m[1]!);

    expect([...keys].sort()).toEqual([...PERMISSIONS].sort());
  });
});
