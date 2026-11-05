import "server-only";
import { isChatwootConfigured, publicEnv } from "@/lib/env";
import { createServiceClient } from "@/lib/database/service";
import { createApiInbox, deleteInbox } from "@/lib/integrations/chatwoot";
import {
  ZapiApiError,
  getDeviceInfo,
  getInstanceStatus,
  setReceivedWebhook,
  type ZapiCredentials,
} from "@/lib/integrations/zapi";
import { getAccountAccessToken } from "@/services/chatwoot/provision";
import { generateWebhookSecret, storeSecret } from "@/services/chatwoot/secrets";
import type { Result } from "@/services/organizations/service";

export type ConnectZapiInput = {
  organizationId: string;
  userId: string;
  instanceId: string;
  token: string;
  clientToken: string;
  displayPhoneNumber?: string;
};

function normalizePhone(raw: string) {
  return raw.replace(/\D/g, "");
}

/**
 * Conecta uma instância Z-API: valida status → cifra credenciais →
 * configura webhook HTTPS → cria Inbox API no Chatwoot.
 */
export async function connectZapiInstance(input: ConnectZapiInput): Promise<Result<{ connectionId: string }>> {
  if (!isChatwootConfigured()) return { ok: false, error: "Chatwoot não está configurado." };

  const account = await getAccountAccessToken(input.organizationId);
  if (!account) {
    return { ok: false, error: "Provisiona a conta Chatwoot em Configurações antes de conectar WhatsApp." };
  }

  const appUrl = publicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (!appUrl.startsWith("https://") && !appUrl.includes("localhost")) {
    return { ok: false, error: "NEXT_PUBLIC_APP_URL precisa ser HTTPS público para webhooks da Z-API." };
  }

  const creds: ZapiCredentials = {
    instanceId: input.instanceId.trim(),
    token: input.token.trim(),
    clientToken: input.clientToken.trim(),
  };

  const db = createServiceClient();
  let connectionId: string | null = null;
  let createdInboxId: number | null = null;

  try {
    const status = await getInstanceStatus(creds);
    if (!status.connected) {
      return {
        ok: false,
        error: status.error || "Instância Z-API desconectada. Escaneie o QR Code no painel da Z-API.",
      };
    }

    let display = input.displayPhoneNumber?.trim() || "";
    let verifiedName: string | null = null;
    try {
      const device = await getDeviceInfo(creds);
      if (!display && device.phone) display = normalizePhone(device.phone);
      verifiedName = device.name ?? device.device?.name ?? null;
    } catch {
      /* device é opcional */
    }
    if (!display) display = creds.instanceId;

    const webhookPlain = generateWebhookSecret();
    const secretPayload = JSON.stringify({
      instanceId: creds.instanceId,
      token: creds.token,
      clientToken: creds.clientToken,
    });

    const tokenSecret = await storeSecret({
      organizationId: input.organizationId,
      purpose: "zapi_instance",
      plaintext: secretPayload,
      resourceKey: creds.instanceId,
    });
    const webhookSecret = await storeSecret({
      organizationId: input.organizationId,
      purpose: "chatwoot_webhook",
      plaintext: webhookPlain,
      resourceKey: `zapi:${creds.instanceId}`,
    });

    const { data: conn, error: connError } = await db
      .from("whatsapp_connections")
      .insert({
        organization_id: input.organizationId,
        provider: "zapi",
        zapi_instance_id: creds.instanceId,
        display_phone_number: display,
        verified_name: verifiedName,
        status: "pending",
        token_secret_id: tokenSecret.id,
        webhook_secret_id: webhookSecret.id,
        connected_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (connError || !conn) {
      if (connError?.message?.includes("whatsapp_limit_reached") || connError?.code === "P0001") {
        return { ok: false, error: "Limite de números WhatsApp do plano atingido." };
      }
      if (connError?.code === "23505") {
        return { ok: false, error: "Esta instância Z-API já está conectada." };
      }
      throw new Error(connError?.message ?? "Falha ao gravar conexão.");
    }
    connectionId = conn.id as string;

    const webhookUrl = `${appUrl}/api/webhooks/zapi/${encodeURIComponent(creds.instanceId)}?t=${encodeURIComponent(webhookPlain)}`;
    // Em localhost o HTTPS da Z-API falha — ainda assim grava a URL esperada em produção
    if (appUrl.startsWith("https://")) {
      await setReceivedWebhook(creds, webhookUrl);
    }

    const inbox = await createApiInbox(account.accountId, account.token, {
      name: verifiedName ? `WhatsApp · ${verifiedName}` : `WhatsApp · ${display}`,
      webhookUrl: undefined,
    });
    createdInboxId = inbox.id;

    const { error: inboxError } = await db.from("chatwoot_inboxes").insert({
      organization_id: input.organizationId,
      chatwoot_account_id: account.accountId,
      chatwoot_inbox_id: inbox.id,
      name: inbox.name ?? display,
      channel_type: "whatsapp",
      status: "active",
      connection_id: connectionId,
    });
    if (inboxError) throw new Error(inboxError.message);

    await db
      .from("whatsapp_connections")
      .update({ status: "active", last_error: null })
      .eq("id", connectionId);

    await db.rpc("write_audit_log", {
      p_organization_id: input.organizationId,
      p_actor_user_id: input.userId,
      p_action: "whatsapp.connected",
      p_resource_type: "whatsapp_connection",
      p_resource_id: connectionId,
      p_metadata: { provider: "zapi", instance_id: creds.instanceId, display },
      p_actor_type: "user",
    });

    return { ok: true, data: { connectionId } };
  } catch (err) {
    const message =
      err instanceof ZapiApiError
        ? `Z-API: ${err.message}`
        : err instanceof Error
          ? err.message
          : "Falha ao conectar Z-API.";

    console.error("[whatsapp.zapi.connect]", input.organizationId, message);

    if (createdInboxId && account) {
      try {
        await deleteInbox(account.accountId, createdInboxId, account.token);
      } catch (e) {
        console.error("[whatsapp.zapi.connect] rollback inbox", e);
      }
    }
    if (connectionId) {
      await db
        .from("whatsapp_connections")
        .update({ status: "error", last_error: message.slice(0, 500) })
        .eq("id", connectionId);
      await db.from("chatwoot_inboxes").delete().eq("connection_id", connectionId);
    }

    return { ok: false, error: message };
  }
}
