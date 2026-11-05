"use client";

import { useEffect, useState } from "react";

/**
 * Formata ISO no cliente após montar — evita Date.now()/new Date no prerender
 * (Cache Components / Instant Navigations do Next 16).
 */
export function LocalDateTime({ value, fallback = "—" }: { value: string | null | undefined; fallback?: string }) {
  const [label, setLabel] = useState(fallback);

  useEffect(() => {
    if (!value) {
      setLabel(fallback);
      return;
    }
    setLabel(new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }));
  }, [value, fallback]);

  return <span suppressHydrationWarning>{label}</span>;
}
