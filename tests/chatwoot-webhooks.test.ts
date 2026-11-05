import { describe, expect, it } from "vitest";
import { buildWebhookIdempotencyKey } from "@/services/chatwoot/idempotency";
import type { ChatwootWebhookPayload } from "@/lib/integrations/chatwoot/types";

describe("buildWebhookIdempotencyKey", () => {
  const base: ChatwootWebhookPayload = {
    event: "message_created",
    account: { id: 4 },
    id: 100,
    updated_at: 1700000000,
  };

  it("é estável para o mesmo payload", () => {
    expect(buildWebhookIdempotencyKey(base)).toBe(buildWebhookIdempotencyKey({ ...base }));
  });

  it("muda quando o id do evento muda", () => {
    expect(buildWebhookIdempotencyKey(base)).not.toBe(buildWebhookIdempotencyKey({ ...base, id: 101 }));
  });

  it("isola contas diferentes (mesmo id de mensagem)", () => {
    const a = buildWebhookIdempotencyKey(base);
    const b = buildWebhookIdempotencyKey({ ...base, account: { id: 99 } });
    expect(a).not.toBe(b);
  });
});
