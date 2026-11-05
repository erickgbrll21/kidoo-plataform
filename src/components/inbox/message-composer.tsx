"use client";

import * as React from "react";
import { useActionState } from "react";
import { sendInboxReplyAction } from "@/app/(dashboard)/inbox/actions";
import { ActionMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionState } from "@/lib/actions";

const initial: ActionState = {};

export function MessageComposer({ conversationId }: { conversationId: number }) {
  const [state, action] = useActionState(sendInboxReplyAction, initial);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [asPrivate, setAsPrivate] = React.useState(false);

  React.useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setAsPrivate(false);
    }
  }, [state.ok, state.message]);

  return (
    <form ref={formRef} action={action} className="space-y-2 border-t border-kidoo-100 bg-white p-3">
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="asPrivate" value={asPrivate ? "1" : "0"} />
      <Textarea
        name="content"
        required
        rows={3}
        placeholder={asPrivate ? "Nota interna (só a equipe vê)…" : "Escreva uma resposta…"}
        className="min-h-[4.5rem] resize-none"
        aria-invalid={Boolean(state.fieldErrors?.content)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-kidoo-600">
          <input
            type="checkbox"
            checked={asPrivate}
            onChange={(e) => setAsPrivate(e.target.checked)}
            className="rounded border-kidoo-300"
          />
          Nota interna
        </label>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => formRef.current?.reset()}>
            Limpar
          </Button>
          <SubmitButton size="sm">{asPrivate ? "Salvar nota" : "Enviar"}</SubmitButton>
        </div>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}
