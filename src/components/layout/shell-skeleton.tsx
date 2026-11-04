import { Skeleton } from "@/components/ui/skeleton";

/** Casca estática exibida enquanto o contexto da empresa é carregado (mantém o app com sensação instantânea). */
export function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy aria-label="Carregando">
      <aside className="hidden w-64 shrink-0 flex-col gap-3 bg-kidoo-900 p-4 lg:flex">
        <Skeleton className="h-9 w-32 bg-white/10" />
        <Skeleton className="mt-4 h-10 w-full bg-white/10" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full bg-white/5" />
        ))}
      </aside>
      <div className="flex-1">
        <div className="h-16 border-b border-kidoo-200/70 bg-white" />
        <div className="space-y-4 p-8">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
          <div className="grid gap-4 pt-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
