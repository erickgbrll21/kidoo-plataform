import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-start justify-center px-6">
      <Logo />
      <p className="mt-10 text-sm font-medium text-kidoo-500">Erro 404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-kidoo-950">Página não encontrada</h1>
      <p className="mt-1.5 text-sm text-kidoo-500">O endereço não existe ou você não tem acesso a ele.</p>
      <Link href="/dashboard" className={buttonVariants({ className: "mt-5" })}>
        Ir para o painel
      </Link>
    </main>
  );
}
