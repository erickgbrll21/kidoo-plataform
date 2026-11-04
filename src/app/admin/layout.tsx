import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { SetupRequired } from "@/components/layout/setup-required";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePlatformAdmin } from "@/lib/auth/dal";
import { isSupabaseConfigured } from "@/lib/env";

async function AdminGate({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  return <>{children}</>;
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  if (!isSupabaseConfigured()) return <SetupRequired />;
  return (
    <div className="min-h-dvh bg-kidoo-50">
      <header className="flex h-16 items-center justify-between border-b border-kidoo-200/70 bg-white px-6 sm:px-10">
        <div className="flex items-center gap-3">
          <Logo />
          <Badge tone="brand">Administração</Badge>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-kidoo-600 hover:text-kidoo-950"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Voltar ao painel
        </Link>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-10">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </main>
    </div>
  );
}
