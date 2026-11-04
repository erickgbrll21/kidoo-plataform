import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingForm } from "@/components/auth/auth-forms";
import { FocusPage } from "@/components/layout/focus-page";
import { getTenantContext } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Cadastrar empresa" };

async function OnboardingContent({ searchParams }: { searchParams: PageProps<"/onboarding">["searchParams"] }) {
  const ctx = await getTenantContext();
  if (ctx.status === "anonymous") redirect("/login?next=/onboarding");

  // Quem já pertence a uma empresa só chega aqui voluntariamente (?nova=1)
  const params = await searchParams;
  if (ctx.status === "ready" && params.nova !== "1") redirect("/dashboard");

  return (
    <FocusPage email={ctx.user.email}>
      <h1 className="text-2xl font-semibold tracking-tight text-kidoo-950">Cadastre sua empresa</h1>
      <p className="mt-1.5 mb-6 text-sm text-kidoo-500">
        Cada empresa tem um ambiente isolado na KIDOO HUB: equipe, canais, contatos e agentes próprios. Você será o
        proprietário.
      </p>
      <OnboardingForm />
    </FocusPage>
  );
}

export default function OnboardingPage(props: PageProps<"/onboarding">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-kidoo-50" aria-hidden />}>
      <OnboardingContent searchParams={props.searchParams} />
    </Suspense>
  );
}
