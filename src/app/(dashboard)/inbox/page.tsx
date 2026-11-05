import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { InboxWorkspace } from "@/components/inbox/inbox-workspace";
import { SyncInboxButton } from "@/components/inbox/sync-button";
import { AccessDenied } from "@/components/layout/access-denied";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { can, requireTenantContext } from "@/lib/auth/dal";
import { isChatwootConfigured } from "@/lib/env";
import { getMyChatwootUserId, listAssignableAgents } from "@/services/inbox/agents";
import { listConversations, listInboxChannels, type InboxStatus } from "@/services/inbox/list";
import { getConversationThread } from "@/services/inbox/thread";
import { getChatwootAccountStatus } from "@/services/chatwoot/provision";

export const metadata: Metadata = { title: "Inbox" };

type Search = {
  c?: string;
  status?: string;
  inbox?: string;
  assignee?: string;
};

function parseStatus(raw: string | undefined): InboxStatus | "all" {
  if (!raw || raw === "all") return raw === "all" ? "all" : "open";
  if (raw === "open" || raw === "resolved" || raw === "pending" || raw === "snoozed") return raw;
  return "open";
}

function parseAssignee(raw: string | undefined): "all" | "me" | "unassigned" | number {
  if (!raw || raw === "all") return "all";
  if (raw === "me" || raw === "unassigned") return raw;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : "all";
}

async function InboxContent({ searchParams }: { searchParams: Promise<Search> }) {
  await connection();
  const ctx = await requireTenantContext();
  if (!can(ctx, "inbox.read")) return <AccessDenied what="a Inbox" />;

  const params = await searchParams;
  const orgId = ctx.organization.id;
  const status = parseStatus(params.status);
  const inboxRaw = params.inbox ? Number(params.inbox) : null;
  const inboxId = inboxRaw != null && Number.isFinite(inboxRaw) ? inboxRaw : null;
  const assignee = parseAssignee(params.assignee);
  const selectedId = params.c ? Number(params.c) : null;

  const [myCwId, channels, agents, chatwoot] = await Promise.all([
    getMyChatwootUserId(orgId, ctx.user.id),
    listInboxChannels(orgId),
    listAssignableAgents(orgId),
    getChatwootAccountStatus(orgId),
  ]);

  const conversations = await listConversations(orgId, {
    status,
    inboxId,
    assignee,
    myChatwootUserId: myCwId,
  });

  const thread =
    selectedId != null && Number.isFinite(selectedId)
      ? await getConversationThread(orgId, selectedId)
      : null;

  const chatwootReady = isChatwootConfigured() && chatwoot?.status === "active";

  return (
    <div className="animate-fade-up space-y-4">
      <PageHeader
        title="Inbox"
        description={
          chatwootReady
            ? "Atendimento unificado — espelho local com mensagens via Chatwoot."
            : "Provisionar o Chatwoot em Configurações e conectar um canal em Canais para receber conversas."
        }
        actions={<SyncInboxButton />}
      />
      <InboxWorkspace
        conversations={conversations}
        channels={channels}
        agents={agents}
        thread={thread}
        canReply={can(ctx, "inbox.reply")}
        canAssign={can(ctx, "inbox.assign")}
      />
    </div>
  );
}

export default function InboxPage(props: PageProps<"/inbox">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-[70vh] w-full" />
        </div>
      }
    >
      <InboxContent searchParams={props.searchParams as Promise<Search>} />
    </Suspense>
  );
}
