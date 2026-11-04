import { Logo } from "@/components/layout/logo";
import { SetupRequired } from "@/components/layout/setup-required";
import { isSupabaseConfigured } from "@/lib/env";

const highlights = [
  "Vários números de WhatsApp em um único painel",
  "Agentes de IA com transferência para a equipe",
  "CRM e funil de vendas integrados à conversa",
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  if (!isSupabaseConfigured()) return <SetupRequired />;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-kidoo-900 p-12 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -bottom-32 size-[28rem] rounded-full border border-white/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -bottom-12 size-[18rem] rounded-full border border-white/10"
        />
        <Logo tone="light" />
        <div className="relative max-w-md">
          <p className="text-xs font-medium tracking-[0.3em] text-kidoo-300">BUILD. AUTOMATE. GROW.</p>
          <h2 className="mt-5 text-3xl leading-tight font-semibold tracking-tight text-balance">
            Atendimento, vendas e IA na mesma operação.
          </h2>
          <ul className="mt-8 space-y-3.5">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-kidoo-200">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-kidoo-300" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-kidoo-400">KIDOO HUB · Plataforma de atendimento e automação</p>
      </aside>
      <main className="flex flex-col px-6 py-8 sm:px-10">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10 animate-fade-up">{children}</div>
      </main>
    </div>
  );
}
