import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { getSessionUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Redefinir senha" };

/** O link do e-mail (via /auth/confirm) cria uma sessão de recuperação; sem ela, não há o que redefinir. */
async function ResetContent() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <>
        <Alert tone="warning">O link de redefinição é inválido ou expirou.</Alert>
        <p className="mt-6 text-center text-sm text-kidoo-600">
          <Link href="/recuperar-senha" className="font-medium text-kidoo-900 hover:underline">
            Solicitar novo link
          </Link>
        </p>
      </>
    );
  }
  return <ResetPasswordForm />;
}

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-kidoo-950">Criar nova senha</h1>
      <p className="mt-1.5 mb-6 text-sm text-kidoo-500">Escolha uma senha forte que você não use em outros serviços.</p>
      <Suspense fallback={<div className="h-48" aria-hidden />}>
        <ResetContent />
      </Suspense>
    </>
  );
}
