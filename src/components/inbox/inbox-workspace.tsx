import { ConversationList } from "@/components/inbox/conversation-list";
import { ContactSidebar } from "@/components/inbox/contact-sidebar";
import { ConversationThread, ThreadEmpty } from "@/components/inbox/conversation-thread";
import { InboxFilters } from "@/components/inbox/inbox-filters";
import { InboxPoller } from "@/components/inbox/inbox-poller";
import type { InboxAgentOption } from "@/services/inbox/agents";
import type { ConversationListItem, InboxChannelOption } from "@/services/inbox/list";
import type { InboxThread } from "@/services/inbox/thread";

export function InboxWorkspace({
  conversations,
  channels,
  agents,
  thread,
  canReply,
  canAssign,
}: {
  conversations: ConversationListItem[];
  channels: InboxChannelOption[];
  agents: InboxAgentOption[];
  thread: InboxThread | null;
  canReply: boolean;
  canAssign: boolean;
}) {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-xl border border-kidoo-200 bg-white shadow-card">
      <InboxPoller enabled />
      <InboxFilters channels={channels} agents={agents} canAssign={canAssign} />

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)_minmax(14rem,18rem)]">
        <section className="flex min-h-[20rem] flex-col border-r border-kidoo-100 lg:min-h-0">
          <div className="border-b border-kidoo-100 px-3 py-2 text-xs font-medium tracking-wide text-kidoo-500 uppercase">
            Conversas · {conversations.length}
          </div>
          <ConversationList items={conversations} />
        </section>

        <section className="min-h-[24rem] lg:min-h-0">
          {thread ? (
            <ConversationThread thread={thread} agents={agents} canReply={canReply} canAssign={canAssign} />
          ) : (
            <ThreadEmpty />
          )}
        </section>

        <ContactSidebar thread={thread} />
      </div>
    </div>
  );
}
