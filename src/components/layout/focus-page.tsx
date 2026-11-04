import * as React from "react";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/session";
import { Logo } from "./logo";

/** Página de tela cheia (onboarding, convite, conta suspensa) com cabeçalho mínimo e saída da conta. */
export function FocusPage({
  children,
  email,
  width = "max-w-md",
}: {
  children: React.ReactNode;
  email?: string;
  width?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-kidoo-50">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo />
        {email ? (
          <form action={signOutAction} className="flex items-center gap-3 text-sm text-kidoo-500">
            <span className="hidden sm:inline">{email}</span>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium text-kidoo-700 transition-colors hover:bg-kidoo-100"
            >
              <LogOut className="size-4" aria-hidden />
              Sair
            </button>
          </form>
        ) : null}
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className={`w-full ${width} animate-fade-up rounded-(--radius-card) border border-kidoo-200/80 bg-white p-7 shadow-pop sm:p-8`}>
          {children}
        </div>
      </main>
    </div>
  );
}
