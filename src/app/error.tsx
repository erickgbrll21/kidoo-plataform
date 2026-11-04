"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-start justify-center px-6">
      <span className="flex size-11 items-center justify-center rounded-xl bg-danger-soft text-danger">
        <TriangleAlert className="size-5" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-kidoo-950">Algo deu errado</h1>
      <p className="mt-1.5 text-sm text-kidoo-500">
        Não foi possível carregar esta página. Tente novamente; se o problema persistir, contate o suporte
        {error.digest ? ` informando o código ${error.digest}` : ""}.
      </p>
      <Button className="mt-5" onClick={reset}>
        Tentar novamente
      </Button>
    </main>
  );
}
