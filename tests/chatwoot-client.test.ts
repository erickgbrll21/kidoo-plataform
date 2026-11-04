import { describe, expect, it } from "vitest";
import { CHATWOOT_TOKEN_HEADER } from "@/lib/integrations/chatwoot/client";

describe("Chatwoot client", () => {
  it("usa o header com hífen exigido pelo Nginx (underscores_in_headers off)", () => {
    expect(CHATWOOT_TOKEN_HEADER).toBe("api-access-token");
    expect(CHATWOOT_TOKEN_HEADER.includes("_")).toBe(false);
  });
});
