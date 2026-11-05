import { Suspense } from "react";
import { connection } from "next/server";
import { AppShell } from "@/components/layout/app-shell";
import { SetupRequired } from "@/components/layout/setup-required";
import { ShellSkeleton } from "@/components/layout/shell-skeleton";
import { isPlatformAdmin, requireTenantContext } from "@/lib/auth/dal";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Casca autenticada. A leitura de cookies/sessão acontece DENTRO do Suspense, para que
 * o skeleton seja servido imediatamente (Cache Components / prefetch parcial).
 *
 * `connection()` marca request-time: o JWT do Supabase usa Date.now() e não pode
 * participar do prerender estático / Instant Navigations.
 */
async function Shell({ children }: { children: React.ReactNode }) {
  await connection();
  const [ctx, platformAdmin] = await Promise.all([requireTenantContext(), isPlatformAdmin()]);

  return (
    <AppShell
      user={{ fullName: ctx.user.fullName, email: ctx.user.email }}
      organization={{ id: ctx.organization.id, name: ctx.organization.name }}
      roleName={ctx.role.name}
      memberships={ctx.memberships
        .filter((m) => m.status === "active")
        .map((m) => ({ organizationId: m.organizationId, name: m.name, roleName: m.roleName }))}
      permissions={[...ctx.permissions]}
      isPlatformAdmin={platformAdmin}
    >
      {children}
    </AppShell>
  );
}

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  if (!isSupabaseConfigured()) return <SetupRequired />;
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
