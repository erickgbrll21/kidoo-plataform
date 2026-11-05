import { Suspense } from "react";
import type { ComponentProps } from "react";
import { connection } from "next/server";
import { can, requireTenantContext } from "@/lib/auth/dal";
import type { Permission } from "@/lib/auth/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { AccessDenied } from "./access-denied";
import { ModulePlaceholder } from "./module-placeholder";

type Props = ComponentProps<typeof ModulePlaceholder> & { permission: Permission };

async function Guard({ permission, ...placeholder }: Props) {
  await connection();
  const ctx = await requireTenantContext();
  if (!can(ctx, permission)) return <AccessDenied what={`o módulo ${placeholder.title}`} />;
  return <ModulePlaceholder {...placeholder} />;
}

/** Módulo ainda não implementado, mas já protegido pela permissão que o módulo exigirá. */
export function GuardedModule(props: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <Guard {...props} />
    </Suspense>
  );
}
