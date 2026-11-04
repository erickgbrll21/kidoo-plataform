"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import {
  createOrganizationAction,
  forgotPasswordAction,
  loginAction,
  resetPasswordAction,
  signupAction,
} from "@/app/(auth)/actions";
import { ActionMessage } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { slugify } from "@/lib/slug";
import type { ActionState } from "@/lib/actions";

const initial: ActionState = {};

function PasswordInput({
  id,
  name,
  autoComplete,
  invalid,
  describedBy,
  placeholder,
}: {
  id: string;
  name: string;
  autoComplete: string;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
}) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required
        className="pr-10"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-kidoo-400 transition-colors hover:text-kidoo-700"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

const err = (state: ActionState, key: string) => state.fieldErrors?.[key]?.[0];
const describe = (state: ActionState, key: string) => (err(state, key) ? `${key}-error` : undefined);

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = React.useActionState(loginAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <ActionMessage state={state} />
      <Field label="E-mail" htmlFor="email" error={err(state, "email")}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          key={state.values?.email}
          aria-invalid={!!err(state, "email") || undefined}
          aria-describedby={describe(state, "email")}
          placeholder="voce@empresa.com.br"
        />
      </Field>
      <Field label="Senha" htmlFor="password" error={err(state, "password")}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          invalid={!!err(state, "password")}
          describedBy={describe(state, "password")}
        />
      </Field>
      <div className="flex justify-end">
        <Link href="/recuperar-senha" className="text-sm font-medium text-kidoo-600 hover:text-kidoo-900 hover:underline">
          Esqueci minha senha
        </Link>
      </div>
      <SubmitButton size="lg" className="w-full" pendingLabel="Entrando…">
        Entrar
      </SubmitButton>
    </form>
  );
}

export function SignupForm({ next }: { next?: string }) {
  const [state, action] = React.useActionState(signupAction, initial);
  if (state.ok) {
    return <ActionMessage state={state} />;
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <ActionMessage state={state} />
      <Field label="Seu nome" htmlFor="fullName" error={err(state, "fullName")}>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          defaultValue={state.values?.fullName}
          key={`n-${state.values?.fullName}`}
          aria-invalid={!!err(state, "fullName") || undefined}
          aria-describedby={describe(state, "fullName")}
        />
      </Field>
      <Field label="E-mail profissional" htmlFor="email" error={err(state, "email")}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          key={`e-${state.values?.email}`}
          aria-invalid={!!err(state, "email") || undefined}
          aria-describedby={describe(state, "email")}
          placeholder="voce@empresa.com.br"
        />
      </Field>
      <Field
        label="Senha"
        htmlFor="password"
        error={err(state, "password")}
        hint="Mínimo de 10 caracteres, com letras e números."
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          invalid={!!err(state, "password")}
          describedBy={describe(state, "password")}
        />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingLabel="Criando conta…">
        Criar conta
      </SubmitButton>
      <p className="text-center text-xs text-kidoo-500">
        Ao criar sua conta você concorda com o tratamento dos seus dados conforme a LGPD.
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = React.useActionState(forgotPasswordAction, initial);
  if (state.ok) return <ActionMessage state={state} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <ActionMessage state={state} />
      <Field label="E-mail da conta" htmlFor="email" error={err(state, "email")}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          key={state.values?.email}
          aria-invalid={!!err(state, "email") || undefined}
          aria-describedby={describe(state, "email")}
        />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingLabel="Enviando…">
        Enviar link de redefinição
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = React.useActionState(resetPasswordAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <ActionMessage state={state} />
      <Field
        label="Nova senha"
        htmlFor="password"
        error={err(state, "password")}
        hint="Mínimo de 10 caracteres, com letras e números."
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          invalid={!!err(state, "password")}
          describedBy={describe(state, "password")}
        />
      </Field>
      <Field label="Confirmar nova senha" htmlFor="confirm" error={err(state, "confirm")}>
        <PasswordInput
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          invalid={!!err(state, "confirm")}
          describedBy={describe(state, "confirm")}
        />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingLabel="Salvando…">
        Salvar nova senha
      </SubmitButton>
    </form>
  );
}

export function OnboardingForm({ defaultName }: { defaultName?: string }) {
  const [state, action] = React.useActionState(createOrganizationAction, initial);
  const [name, setName] = React.useState(state.values?.name ?? defaultName ?? "");
  const [slug, setSlug] = React.useState(state.values?.slug ?? "");
  const [slugTouched, setSlugTouched] = React.useState(Boolean(state.values?.slug));
  const shownSlug = slugTouched ? slug : name.trim() ? slugify(name) : "";

  return (
    <form action={action} className="space-y-4" noValidate>
      <ActionMessage state={state} />
      <Field label="Nome da empresa" htmlFor="name" error={err(state, "name")}>
        <Input
          id="name"
          name="name"
          autoComplete="organization"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!err(state, "name") || undefined}
          aria-describedby={describe(state, "name")}
          placeholder="Ex.: Studio Aurora"
        />
      </Field>
      <Field
        label="Identificador"
        htmlFor="slug"
        error={err(state, "slug")}
        hint="Usado internamente e em links. Pode conter letras minúsculas, números e hífens."
      >
        <Input
          id="slug"
          name="slug"
          value={shownSlug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
          }}
          aria-invalid={!!err(state, "slug") || undefined}
          aria-describedby={describe(state, "slug")}
          className="font-mono"
          spellCheck={false}
          autoCapitalize="none"
        />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingLabel="Criando ambiente…">
        Criar empresa
      </SubmitButton>
    </form>
  );
}
