import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PauseCircle } from "lucide-react";
import { switchOrganizationAction } from "@/app/actions/session";
import { FocusPage } from "@/components/layout/focus-page";
import { Button } from "@/components/ui/button";
import { getTenantContext } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Conta suspensa" };

async function SuspendedContent() {
  const ctx = await getTenantContext();
  if (ctx.status === "anonymous") redirect("/login");
  if (ctx.status === "no_organization") redirect("/onboarding");
  if (ctx.organization.status !== "suspended") redirect("/dashboard");

  const others = ctx.memberships.filter((m) => m.status === "active" && m.organizationId !== ctx.organization.id);

  return (
    <FocusPage email={ctx.user.email}>
      <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-warning-soft text-warning">
        <PauseCircle className="size-5" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold tracking-tight text-kidoo-950">Conta suspensa</h1>
      <p className="mt-1.5 text-sm text-kidoo-500">
        O acesso de <strong className="text-kidoo-800">{ctx.organization.name}</strong> está temporariamente suspenso.
        Entre em contato com o suporte da KIDOO HUB para regularizar a situação.
      </p>
      {others.length > 0 ? (
        <div className="mt-6 border-t border-kidoo-100 pt-5">
          <p className="mb-2 text-xs font-medium tracking-wide text-kidoo-500 uppercase">Acessar outra empresa</p>
          <ul className="space-y-2">
            {others.map((m) => (
              <li key={m.organizationId}>
                <form action={switchOrganizationAction}>
                  <input type="hidden" name="organizationId" value={m.organizationId} />
                  <Button type="submit" variant="outline" className="w-full justify-between">
                    {m.name}
                    <span className="text-xs font-normal text-kidoo-500">{m.roleName}</span>
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </FocusPage>
  );
}

export default function SuspendedPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-kidoo-50" aria-hidden />}>
      <SuspendedContent />
    </Suspense>
  );
}
