"use client";

import * as React from "react";
import { connectZapiAction } from "@/app/(dashboard)/canais/actions";
import { ActionMessage } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionState } from "@/lib/actions";

const idle: ActionState = {};

function err(state: ActionState, key: string) {
  return state.fieldErrors?.[key]?.[0];
}

export function ConnectZapiForm({ disabledReason }: { disabledReason?: string | null }) {
  const [state, action] = React.useActionState(connectZapiAction, idle);

  if (disabledReason) {
    return <p className="text-sm text-kidoo-500">{disabledReason}</p>;
  }

  return (
    <form action={action} className="grid max-w-xl gap-4">
      <Field label="Instance ID" htmlFor="zapi-instance" error={err(state, "instanceId")}>
        <Input
          id="zapi-instance"
          name="instanceId"
          required
          autoComplete="off"
          defaultValue={state.values?.instanceId ?? ""}
          placeholder="ID da instância no painel Z-API"
        />
      </Field>
      <Field label="Token da instância" htmlFor="zapi-token" error={err(state, "token")}>
        <Input id="zapi-token" name="token" type="password" required autoComplete="off" placeholder="Token da instância" />
      </Field>
      <Field label="Client-Token (conta)" htmlFor="zapi-client" error={err(state, "clientToken")}>
        <Input
          id="zapi-client"
          name="clientToken"
          type="password"
          required
          autoComplete="off"
          placeholder="Security → Account security token"
        />
      </Field>
      <Field label="Número (opcional)" htmlFor="zapi-phone" error={err(state, "displayPhoneNumber")}>
        <Input
          id="zapi-phone"
          name="displayPhoneNumber"
          autoComplete="off"
          defaultValue={state.values?.displayPhoneNumber ?? ""}
          placeholder="5511999999999 — se vazio, busca na Z-API"
        />
      </Field>
      <ActionMessage state={state} />
      <div>
        <SubmitButton pendingLabel="Conectando…">Conectar instância Z-API</SubmitButton>
      </div>
      <p className="text-xs text-kidoo-500">
        Tokens ficam cifrados no servidor. Em produção, a KIDOO configura o webhook HTTPS automaticamente na Z-API
        (`Ao receber`).
      </p>
    </form>
  );
}
