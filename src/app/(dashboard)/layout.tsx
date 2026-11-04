import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SetupRequired } from "@/components/layout/setup-required";
import { ShellSkeleton } from "@/components/layout/shell-skeleton";
import { isPlatformAdmin, requireTenantContext } from "@/lib/auth/dal";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Casca autenticada. A leitura de cookies/sessão acontece DENTRO do Suspense, para que
 * o skeleton seja servido imediatamente (Cache Components / prefetch parcial).
 */
async function Shell({ children }: { children: React.ReactNode }) {
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
