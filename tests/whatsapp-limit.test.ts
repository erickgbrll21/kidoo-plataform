import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, errorOf, type Db } from "./helpers/db";

let db: Db;
let orgId: string;
let ownerId: string;

beforeAll(async () => {
  db = await createTestDb();
  ownerId = await db.createUser("wa-owner@example.com", { name: "Owner WA" });
  orgId = await db.createOrg(ownerId, "Empresa WA", "empresa-wa");
  await db.admin(
    `update public.subscriptions
     set plan_key = 'starter', limit_overrides = '{"max_whatsapp_numbers": 1}'::jsonb
     where organization_id = $1`,
    [orgId],
  );
});

afterAll(async () => {
  await db.pg.close();
});

describe("limite de WhatsApp Z-API (trigger)", () => {
  it("permite a primeira conexão ativa", async () => {
    const rows = await db.admin<{ id: string }>(
      `insert into public.whatsapp_connections
         (organization_id, provider, zapi_instance_id, display_phone_number, status)
       values ($1, 'zapi', 'inst-1', '5511999990001', 'active')
       returning id`,
      [orgId],
    );
    expect(rows).toHaveLength(1);
  });

  it("bloqueia a segunda conexão no limite do plano", async () => {
    const err = await errorOf(
      db.admin(
        `insert into public.whatsapp_connections
           (organization_id, provider, zapi_instance_id, display_phone_number, status)
         values ($1, 'zapi', 'inst-2', '5511999990002', 'active')`,
        [orgId],
      ),
    );
    expect(err).toMatch(/whatsapp_limit_reached/);
  });

  it("zapi_instance_id é único globalmente", async () => {
    const otherOwner = await db.createUser("wa-other@example.com", { name: "Other" });
    const otherOrg = await db.createOrg(otherOwner, "Outra WA", "outra-wa");
    const err = await errorOf(
      db.admin(
        `insert into public.whatsapp_connections
           (organization_id, provider, zapi_instance_id, display_phone_number, status)
         values ($1, 'zapi', 'inst-1', '5511999990001', 'active')`,
        [otherOrg],
      ),
    );
    expect(err).toMatch(/duplicate|unique/i);
  });
});
