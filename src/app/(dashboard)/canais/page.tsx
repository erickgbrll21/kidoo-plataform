import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { ChannelsPanel } from "@/components/channels/channels-panel";
import { PageHeader } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/layout/access-denied";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { can, requireTenantContext } from "@/lib/auth/dal";
import { isChatwootConfigured } from "@/lib/env";
import { getChatwootAccountStatus } from "@/services/chatwoot/provision";
import { getEffectiveLimits } from "@/services/organizations/service";
import { listWhatsappConnections } from "@/services/whatsapp/list";

export const metadata: Metadata = { title: "Canais" };

const limitText = (v: number | null | undefined) => (v == null ? "Ilimitado" : String(v));

async function ChannelsContent() {
  // Request-time: evita Date.now() (JWT Supabase / etc.) no prerender estático.
  await connection();
  const ctx = await requireTenantContext();
  if (!can(ctx, "channels.read")) return <AccessDenied what="os canais" />;

  const orgId = ctx.organization.id;
  const [connections, limits, chatwoot] = await Promise.all([
    listWhatsappConnections(orgId),
    getEffectiveLimits(orgId),
    getChatwootAccountStatus(orgId),
  ]);

  const chatwootReady = isChatwootConfigured() && chatwoot?.status === "active";

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        title="Canais"
        description="Números de WhatsApp via Z-API, com Inbox correspondente no Chatwoot."
      />

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp (Z-API)</CardTitle>
          <CardDescription>
            Informe Instance ID, Token e Client-Token do painel Z-API. O navegador nunca chama a Z-API — só o servidor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChannelsPanel
            connections={connections}
            canManage={can(ctx, "channels.manage")}
            chatwootReady={Boolean(chatwootReady)}
            limitLabel={limitText(limits?.max_whatsapp_numbers)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function ChannelsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <ChannelsContent />
    </Suspense>
  );
}
