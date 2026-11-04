"use client";

import * as React from "react";
import {
  changePasswordAction,
  updateOrganizationAction,
  updateProfileAction,
} from "@/app/(dashboard)/configuracoes/actions";
import { ActionMessage } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionState } from "@/lib/actions";

const idle: ActionState = {};
const err = (s: ActionState, k: string) => s.fieldErrors?.[k]?.[0];

export function OrganizationForm({ name, slug, canEdit }: { name: string; slug: string; canEdit: boolean }) {
  const [state, action] = React.useActionState(updateOrganizationAction, idle);
  return (
    <form action={action} className="max-w-md space-y-4" noValidate>
      <Field label="Nome da empresa" htmlFor="org-name" error={err(state, "name")}>
        <Input
          id="org-name"
          name="name"
          required
          disabled={!canEdit}
          defaultValue={state.values?.name ?? name}
          key={`${name}-${state.values?.name}`}
          aria-invalid={!!err(state, "name") || undefined}
        />
      </Field>
      <Field label="Identificador" htmlFor="org-slug" hint="O identificador não pode ser alterado.">
        <Input id="org-slug" value={slug} readOnly disabled className="font-mono" />
      </Field>
      <ActionMessage state={state} />
      {canEdit ? <SubmitButton pendingLabel="Salvando…">Salvar alterações</SubmitButton> : null}
    </form>
  );
}

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, action] = React.useActionState(updateProfileAction, idle);
  return (
    <form action={action} className="max-w-md space-y-4" noValidate>
      <Field label="Nome" htmlFor="profile-name" error={err(state, "fullName")}>
        <Input
          id="profile-name"
          name="fullName"
          required
          autoComplete="name"
          defaultValue={state.values?.fullName ?? fullName}
          key={`${fullName}-${state.values?.fullName}`}
          aria-invalid={!!err(state, "fullName") || undefined}
        />
      </Field>
      <Field label="E-mail" htmlFor="profile-email" hint="O e-mail é usado para entrar e não pode ser alterado aqui.">
        <Input id="profile-email" value={email} readOnly disabled />
      </Field>
      <ActionMessage state={state} />
      <SubmitButton pendingLabel="Salvando…">Salvar perfil</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = React.useActionState(changePasswordAction, idle);
  const formRef = React.useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action} className="max-w-md space-y-4" noValidate>
      <Field label="Senha atual" htmlFor="pwd-current" error={err(state, "current")}>
        <Input id="pwd-current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field
        label="Nova senha"
        htmlFor="pwd-new"
        error={err(state, "password")}
        hint="Mínimo de 10 caracteres, com letras e números."
      >
        <Input id="pwd-new" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirmar nova senha" htmlFor="pwd-confirm" error={err(state, "confirm")}>
        <Input id="pwd-confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <ActionMessage state={state} />
      <SubmitButton pendingLabel="Alterando…">Alterar senha</SubmitButton>
    </form>
  );
}
