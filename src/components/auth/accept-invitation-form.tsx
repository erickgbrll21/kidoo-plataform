"use client";

import * as React from "react";
import { acceptInvitationAction } from "@/app/convite/[token]/actions";
import { ActionMessage } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionState } from "@/lib/actions";

export function AcceptInvitationForm({ token, organizationName }: { token: string; organizationName: string }) {
  const [state, action] = React.useActionState(acceptInvitationAction, {} as ActionState);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <ActionMessage state={state} />
      <SubmitButton size="lg" className="w-full" pendingLabel="Entrando na empresa…">
        Entrar em {organizationName}
      </SubmitButton>
    </form>
  );
}
