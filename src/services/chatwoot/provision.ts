import "server-only";
import { isChatwootConfigured, publicEnv } from "@/lib/env";
import { createServiceClient } from "@/lib/database/service";
import {
  ChatwootApiError,
  createAccountUser,
  createPlatformAccount,
  createPlatformUser,
  createWebhook,
  deletePlatformAccount,
  deletePlatformUser,
  generateServicePassword,
} from "@/lib/integrations/chatwoot";
import type { Result } from "@/services/organizations/service";
import { generateWebhookSecret, readSecret, storeSecret } from "./secrets";

export type ChatwootAccountRow = {
  id: string;
  organization_id: string;
  chatwoot_account_id: number | null;
  service_agent_id: number | null;
  account_token_secret_id: string | null;
  webhook_secret_id: string | null;
  status: "pending" | "active" | "error" | "disabled";
  last_error: string | null;
  provisioned_at: string | null;
  chatwoot_webhook_id: number | null;
};

/**
 * Provisiona (ou reutiliza) a conta Chatwoot da empresa:
 * Account → User de serviço → AccountUser admin → token cifrado → Webhook.
 * Compensa Account/User se falhar no meio.
 */
export async function provisionChatwootAccount(input: {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
}): Promise<Result<ChatwootAccountRow>> {
  if (!isChatwootConfigured()) {
    return { ok: false, error: "Chatwoot não está configurado neste ambiente." };
  }

  const db = createServiceClient();
  const { data: existing } = await db
    .from("chatwoot_accounts")
    .select("*")
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (existing && existing.status === "active" && existing.chatwoot_account_id) {
    return { ok: true, data: existing as ChatwootAccountRow };
  }

  await db.from("chatwoot_accounts").upsert(
    {
      organization_id: input.organizationId,
      status: "pending",
      last_error: null,
    },
    { onConflict: "organization_id" },
  );

  let createdAccountId: number | null = null;
  let createdUserId: number | null = null;

  try {
    const account = await createPlatformAccount({
      name: input.organizationName.slice(0, 80),
      locale: "pt_BR",
    });
    createdAccountId = account.id;

    const email = `cw+${input.organizationSlug.slice(0, 40)}.${input.organizationId.replace(/-/g, "").slice(0, 12)}@kidoohub.internal`;
    const password = generateServicePassword();
    const user = await createPlatformUser({
      name: `KIDOO · ${input.organizationName}`.slice(0, 80),
      email,
      password,
      customAttributes: {
        kidoo_organization_id: input.organizationId,
        kidoo_role: "service_agent",
      },
    });
    createdUserId = user.id;
    if (!user.access_token) throw new Error("Chatwoot não devolveu access_token do usuário de serviço.");

    await createAccountUser(account.id, user.id, "administrator");

    const tokenSecret = await storeSecret({
      organizationId: input.organizationId,
      purpose: "chatwoot_account_token",
      plaintext: user.access_token,
    });

    const webhookPlain = generateWebhookSecret();
    const webhookSecret = await storeSecret({
      organizationId: input.organizationId,
      purpose: "chatwoot_webhook",
      plaintext: webhookPlain,
    });

    const appUrl = publicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    const webhookUrl = `${appUrl}/api/webhooks/chatwoot?t=${encodeURIComponent(webhookPlain)}`;
    const webhook = await createWebhook(account.id, user.access_token, { url: webhookUrl });

    const { data, error } = await db
      .from("chatwoot_accounts")
      .update({
        chatwoot_account_id: account.id,
        service_agent_id: user.id,
        account_token_secret_id: tokenSecret.id,
        webhook_secret_id: webhookSecret.id,
        chatwoot_webhook_id: webhook.id,
        status: "active",
        last_error: null,
        provisioned_at: new Date().toISOString(),
      })
      .eq("organization_id", input.organizationId)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Falha ao gravar chatwoot_accounts.");

    await db.rpc("write_audit_log", {
      p_organization_id: input.organizationId,
      p_actor_user_id: null,
      p_action: "chatwoot.account_provisioned",
      p_resource_type: "chatwoot_account",
      p_resource_id: String(account.id),
      p_metadata: { chatwoot_account_id: account.id },
      p_actor_type: "system",
    });

    return { ok: true, data: data as ChatwootAccountRow };
  } catch (err) {
    const message =
      err instanceof ChatwootApiError
        ? `Chatwoot: ${err.message}`
        : err instanceof Error
          ? err.message
          : "Falha ao provisionar Chatwoot.";

    console.error("[chatwoot.provision]", input.organizationId, message);

    if (createdAccountId) {
      try {
        await deletePlatformAccount(createdAccountId);
      } catch (e) {
        console.error("[chatwoot.provision] rollback account", e);
      }
    }
    if (createdUserId) {
      try {
        await deletePlatformUser(createdUserId);
      } catch (e) {
        console.error("[chatwoot.provision] rollback user", e);
      }
    }

    await db
      .from("chatwoot_accounts")
      .update({
        status: "error",
        last_error: message.slice(0, 500),
      })
      .eq("organization_id", input.organizationId);

    return { ok: false, error: message };
  }
}

export async function getChatwootAccountStatus(organizationId: string): Promise<ChatwootAccountRow | null> {
  const db = createServiceClient();
  const { data } = await db.from("chatwoot_accounts").select("*").eq("organization_id", organizationId).maybeSingle();
  return (data as ChatwootAccountRow | null) ?? null;
}

/** Token de Application API da conta (descriptografado). Somente server-side. */
export async function getAccountAccessToken(organizationId: string): Promise<{
  accountId: number;
  token: string;
} | null> {
  const row = await getChatwootAccountStatus(organizationId);
  if (!row || row.status !== "active" || !row.chatwoot_account_id || !row.account_token_secret_id) return null;
  const token = await readSecret(row.account_token_secret_id, organizationId, "chatwoot_account_token");
  return { accountId: row.chatwoot_account_id, token };
}
