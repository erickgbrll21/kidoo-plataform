"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { addTeamMemberAction, createTeamAction, inviteMemberAction } from "@/app/(dashboard)/equipe/actions";
import { ActionMessage, Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionState } from "@/lib/actions";

const idle: ActionState = {};
const err = (s: ActionState, k: string) => s.fieldErrors?.[k]?.[0];

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="mt-2 flex items-center gap-2">
      <Input readOnly value={link} aria-label="Link do convite" className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <Button
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

export function InviteForm({ roles }: { roles: Array<{ id: string; name: string }> }) {
  const [state, action] = React.useActionState(inviteMemberAction, idle);
  const link = state.ok ? state.data?.link : undefined;
  const defaultRole = roles.find((r) => r.name.toLowerCase().startsWith("atend"))?.id ?? roles[0]?.id;

  return (
    <div>
      <form action={action} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-start" noValidate>
        <Field label="E-mail do convidado" htmlFor="invite-email" error={err(state, "email")}>
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="pessoa@empresa.com.br"
            defaultValue={state.ok ? "" : state.values?.email}
            key={state.ok ? `ok-${link}` : state.values?.email}
            aria-invalid={!!err(state, "email") || undefined}
            aria-describedby={err(state, "email") ? "invite-email-error" : undefined}
          />
        </Field>
        <Field label="Papel" htmlFor="invite-role" error={err(state, "roleId")}>
          <Select id="invite-role" name="roleId" defaultValue={state.values?.roleId ?? defaultRole}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:pt-[1.625rem]">
          <SubmitButton pendingLabel="Criando…" className="w-full sm:w-auto">
            Criar convite
          </SubmitButton>
        </div>
      </form>
      <div className="mt-3">
        {link ? (
          <Alert tone="success">
            {state.message}
            <CopyLink link={link} />
          </Alert>
        ) : (
          <ActionMessage state={state} />
        )}
      </div>
    </div>
  );
}

export function CreateTeamForm() {
  const [state, action] = React.useActionState(createTeamAction, idle);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[14rem_1fr_auto] sm:items-start" noValidate>
      <Field label="Nome da equipe" htmlFor="team-name" error={err(state, "name")}>
        <Input
          id="team-name"
          name="name"
          required
          placeholder="Ex.: Comercial"
          defaultValue={state.ok ? "" : state.values?.name}
          key={state.ok ? `ok-${state.message}` : state.values?.name}
          aria-invalid={!!err(state, "name") || undefined}
        />
      </Field>
      <Field label="Descrição (opcional)" htmlFor="team-description" error={err(state, "description")}>
        <Textarea
          id="team-description"
          name="description"
          rows={1}
          className="min-h-10"
          defaultValue={state.ok ? "" : state.values?.description}
          key={state.ok ? `ok2-${state.message}` : state.values?.description}
        />
      </Field>
      <div className="sm:pt-[1.625rem]">
        <SubmitButton pendingLabel="Criando…" className="w-full sm:w-auto">
          Criar equipe
        </SubmitButton>
      </div>
      <div className="sm:col-span-3">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

export function AddTeamMemberForm({
  teamId,
  candidates,
}: {
  teamId: string;
  candidates: Array<{ userId: string; name: string }>;
}) {
  const [state, action] = React.useActionState(addTeamMemberAction, idle);
  if (candidates.length === 0) return null;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="teamId" value={teamId} />
      <Select name="userId" required aria-label="Adicionar usuário à equipe" className="h-8 w-52 py-0 text-[0.8125rem]" defaultValue="">
        <option value="" disabled>
          Adicionar usuário…
        </option>
        {candidates.map((c) => (
          <option key={c.userId} value={c.userId}>
            {c.name}
          </option>
        ))}
      </Select>
      <SubmitButton size="sm" variant="secondary">
        Adicionar
      </SubmitButton>
      {state.message && !state.ok ? (
        <p role="alert" className="w-full text-xs font-medium text-danger">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
