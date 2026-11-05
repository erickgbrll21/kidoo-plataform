"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { syncInboxAction } from "@/app/(dashboard)/inbox/actions";
import { Button } from "@/components/ui/button";

export function SyncInboxButton() {
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(() => {
          void syncInboxAction();
        })
      }
    >
      <RefreshCw className={pending ? "animate-spin" : undefined} />
      {pending ? "Sincronizando…" : "Sincronizar"}
    </Button>
  );
}
