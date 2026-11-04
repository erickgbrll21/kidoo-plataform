import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignupForm } from "@/components/auth/auth-forms";
import { safeRedirectPath } from "@/lib/security/safe-redirect";

export const metadata: Metadata = { title: "Criar conta" };

async function SignupContent({ searchParams }: { searchParams: PageProps<"/cadastro">["searchParams"] }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeRedirectPath(params.next, "") : "";

  return (
    <>
      <SignupForm next={next || undefined} />
      <p className="mt-6 text-center text-sm text-kidoo-600">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-kidoo-900 hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}

export default function SignupPage(props: PageProps<"/cadastro">) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-kidoo-950">Crie sua conta</h1>
      <p className="mt-1.5 mb-6 text-sm text-kidoo-500">
        Em seguida você cadastra sua empresa e já pode convidar a equipe.
      </p>
      <Suspense fallback={<div className="h-80" aria-hidden />}>
        <SignupContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
