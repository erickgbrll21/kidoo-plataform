import { DatabaseZap } from "lucide-react";
import { Logo } from "./logo";

/** Exibida quando o Supabase ainda não foi configurado (variáveis de ambiente ausentes). */
export function SetupRequired() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-16">
      <Logo />
      <span className="mt-10 flex size-11 items-center justify-center rounded-xl bg-kidoo-100 text-kidoo-700">
        <DatabaseZap className="size-5" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-kidoo-950">Configuração pendente</h1>
      <p className="mt-2 text-sm text-kidoo-600">
        A aplicação ainda não está conectada a um projeto Supabase. Defina as variáveis abaixo em{" "}
        <code className="rounded bg-kidoo-100 px-1 py-0.5 font-mono text-xs">.env.local</code> e reinicie o servidor.
      </p>
      <ul className="mt-5 space-y-1.5 rounded-lg border border-kidoo-200 bg-kidoo-50 p-4 font-mono text-xs text-kidoo-800">
        <li>NEXT_PUBLIC_SUPABASE_URL</li>
        <li>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</li>
        <li>SUPABASE_SERVICE_ROLE_KEY</li>
        <li>NEXT_PUBLIC_APP_URL</li>
      </ul>
      <p className="mt-4 text-sm text-kidoo-500">
        O passo a passo completo (incluindo as migrations) está em{" "}
        <code className="rounded bg-kidoo-100 px-1 py-0.5 font-mono text-xs">docs/SETUP.md</code>.
      </p>
    </main>
  );
}
