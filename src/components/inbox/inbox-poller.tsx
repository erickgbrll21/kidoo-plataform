"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Atualização leve até o Realtime Supabase (token curto) estar pronto. */
export function InboxPoller({ enabled, intervalMs = 12_000 }: { enabled: boolean; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs, router]);

  return null;
}
