"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Building2,
  Check,
  ChevronsUpDown,
  Contact,
  Inbox,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Radio,
  Settings,
  ChartColumn,
  UsersRound,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { Popover } from "./popover";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { signOutAction, switchOrganizationAction } from "@/app/actions/session";

type NavItem = { href: string; label: string; icon: LucideIcon; permission?: string };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox, permission: "inbox.read" },
  { href: "/canais", label: "Canais", icon: Radio, permission: "channels.read" },
  { href: "/contatos", label: "Contatos", icon: Contact, permission: "contacts.read" },
  { href: "/crm", label: "CRM", icon: Kanban, permission: "crm.read" },
  { href: "/agentes-ia", label: "Agentes IA", icon: Bot, permission: "agents.read" },
  { href: "/automacoes", label: "Automações", icon: Workflow, permission: "automations.read" },
  { href: "/relatorios", label: "Relatórios", icon: ChartColumn, permission: "reports.read" },
  { href: "/equipe", label: "Equipe", icon: UsersRound },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export type ShellProps = {
  user: { fullName: string; email: string };
  organization: { id: string; name: string };
  roleName: string;
  memberships: Array<{ organizationId: string; name: string; roleName: string }>;
  permissions: string[];
  isPlatformAdmin: boolean;
  children: React.ReactNode;
};

export function AppShell({ user, organization, roleName, memberships, permissions, isPlatformAdmin, children }: ShellProps) {
  const pathname = usePathname();
  // O menu móvel guarda a rota em que foi aberto: ao navegar, deixa de corresponder e fecha sozinho.
  const [drawerPath, setDrawerPath] = React.useState<string | null>(null);
  const drawer = drawerPath === pathname;
  const setDrawer = React.useCallback((open: boolean) => setDrawerPath(open ? pathname : null), [pathname]);
  React.useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer, setDrawer]);

  const allowed = new Set(permissions);
  const items = NAV.filter((i) => !i.permission || allowed.has(i.permission));

  const nav = (
    <nav aria-label="Navegação principal" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-white/12 text-white" : "text-kidoo-300 hover:bg-white/6 hover:text-white",
            )}
          >
            <item.icon className={cn("size-[1.05rem] shrink-0", active ? "text-white" : "text-kidoo-400 group-hover:text-kidoo-200")} aria-hidden />
            {item.label}
          </Link>
        );
      })}
      {isPlatformAdmin ? (
        <Link
          href="/admin"
          className="mt-4 flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-kidoo-300 transition-colors hover:bg-white/6 hover:text-white"
        >
          <Building2 className="size-[1.05rem] text-kidoo-400" aria-hidden />
          Admin KIDOO
        </Link>
      ) : null}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col bg-kidoo-900">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo tone="light" />
        <button
          type="button"
          onClick={() => setDrawer(false)}
          className="rounded-md p-1.5 text-kidoo-300 hover:bg-white/10 lg:hidden"
          aria-label="Fechar menu"
        >
          <X className="size-5" />
        </button>
      </div>
      {nav}
      <div className="border-t border-white/10 p-4 text-[0.6875rem] tracking-[0.2em] text-kidoo-400 uppercase">
        Build. Automate. Grow.
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-kidoo-50/60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {drawer ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-kidoo-950/50 animate-fade-in" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-pop animate-fade-in">{sidebar}</aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-kidoo-200/70 bg-white/85 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="rounded-md p-2 text-kidoo-700 hover:bg-kidoo-100 lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </button>

          <OrganizationSwitcher current={organization} memberships={memberships} />

          <div className="ml-auto">
            <UserMenu user={user} roleName={roleName} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

function OrganizationSwitcher({
  current,
  memberships,
}: {
  current: { id: string; name: string };
  memberships: ShellProps["memberships"];
}) {
  return (
    <Popover
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          className="flex h-10 max-w-[16rem] items-center gap-2.5 rounded-lg border border-kidoo-200 bg-white px-2.5 text-sm font-medium text-kidoo-900 transition-colors hover:border-kidoo-300 hover:bg-kidoo-50"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-kidoo-700 text-[0.65rem] font-semibold text-white">
            {current.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="truncate">{current.name}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-kidoo-400" aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <div role="menu" className="space-y-0.5">
          <p className="px-2.5 pt-1.5 pb-1 text-xs font-medium tracking-wide text-kidoo-500 uppercase">Empresas</p>
          {memberships.map((m) => {
            const active = m.organizationId === current.id;
            return (
              <form key={m.organizationId} action={switchOrganizationAction}>
                <input type="hidden" name="organizationId" value={m.organizationId} />
                <button
                  type="submit"
                  role="menuitem"
                  onClick={close}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-kidoo-50"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-kidoo-100 text-[0.65rem] font-semibold text-kidoo-700">
                    {m.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-kidoo-900">{m.name}</span>
                    <span className="block truncate text-xs text-kidoo-500">{m.roleName}</span>
                  </span>
                  {active ? <Check className="size-4 text-kidoo-700" aria-hidden /> : null}
                </button>
              </form>
            );
          })}
          <div className="my-1 border-t border-kidoo-100" />
          <Link
            href="/onboarding?nova=1"
            role="menuitem"
            onClick={close}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-kidoo-700 hover:bg-kidoo-50"
          >
            <Plus className="size-4" aria-hidden /> Nova empresa
          </Link>
        </div>
      )}
    </Popover>
  );
}

function UserMenu({ user, roleName }: { user: ShellProps["user"]; roleName: string }) {
  const label = user.fullName || user.email;
  return (
    <Popover
      align="right"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Menu do usuário"
          className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition-colors hover:bg-kidoo-100"
        >
          <Avatar name={label} className="size-9" />
          <ChevronsUpDown className="hidden size-3.5 text-kidoo-400 sm:block" aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <div role="menu">
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-semibold text-kidoo-900">{label}</p>
            <p className="truncate text-xs text-kidoo-500">{user.email}</p>
            <Badge className="mt-2" tone="outline">
              {roleName}
            </Badge>
          </div>
          <div className="my-1 border-t border-kidoo-100" />
          <Link
            href="/configuracoes/perfil"
            role="menuitem"
            onClick={close}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-kidoo-800 hover:bg-kidoo-50"
          >
            <Settings className="size-4 text-kidoo-500" aria-hidden /> Meu perfil
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-kidoo-800 hover:bg-kidoo-50"
            >
              <LogOut className="size-4 text-kidoo-500" aria-hidden /> Sair
            </button>
          </form>
        </div>
      )}
    </Popover>
  );
}
