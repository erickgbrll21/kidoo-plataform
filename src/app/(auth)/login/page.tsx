import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { LoginForm } from "@/components/auth/auth-forms";
import { safeRedirectPath } from "@/lib/security/safe-redirect";

export const metadata: Metadata = { title: "Entrar" };

const NOTICES: Record<string, string> = {
  "link-invalido": "Este link é inválido ou expirou. Solicite um novo.",
};

async function LoginContent({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeRedirectPath(params.next, "") : "";
  const notice = typeof params.erro === "string" ? NOTICES[params.erro] : undefined;

  return (
    <>
      {notice ? (
        <Alert tone="warning" className="mb-4">
          {notice}
        </Alert>
      ) : null}
      <LoginForm next={next || undefined} />
      <p className="mt-6 text-center text-sm text-kidoo-600">
        Ainda não tem conta?{" "}
        <Link
          href={next ? `/cadastro?next=${encodeURIComponent(next)}` : "/cadastro"}
          className="font-medium text-kidoo-900 hover:underline"
        >
          Criar conta
        </Link>
      </p>
    </>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-kidoo-950">Entrar na KIDOO HUB</h1>
      <p className="mt-1.5 mb-6 text-sm text-kidoo-500">Acesse o ambiente da sua empresa.</p>
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <LoginContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
