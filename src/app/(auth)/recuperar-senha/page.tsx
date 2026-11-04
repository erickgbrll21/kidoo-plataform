import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-kidoo-950">Recuperar senha</h1>
      <p className="mt-1.5 mb-6 text-sm text-kidoo-500">
        Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.
      </p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-kidoo-600">
        <Link href="/login" className="font-medium text-kidoo-900 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
