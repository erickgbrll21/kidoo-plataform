"use client";

import * as React from "react";
import { Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ButtonProps } from "@/components/ui/button";
import type { ActionState } from "@/lib/actions";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const idle: ActionState = {};

function Feedback({ state }: { state: ActionState }) {
  if (!state.message || state.ok) return null;
  return (
    <p role="alert" className="mt-1 max-w-56 text-xs font-medium text-danger">
      {state.message}
    </p>
  );
}

/** Botão que dispara uma Server Action com campos ocultos, confirmação opcional e erro inline. */
export function InlineActionButton({
  action,
  fields,
  children,
  confirmMessage,
  variant = "ghost",
  size = "sm",
}: {
  action: ServerAction;
  fields: Record<string, string>;
  children: React.ReactNode;
  confirmMessage?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const [state, formAction] = React.useActionState(action, idle);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton variant={variant} size={size}>
        {children}
      </SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

/** Seletor de papel que envia automaticamente ao mudar. */
export function RoleSelect({
  action,
  memberId,
  roleId,
  roles,
  disabled,
}: {
  action: ServerAction;
  memberId: string;
  roleId: string;
  roles: Array<{ id: string; name: string }>;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = React.useActionState(action, idle);
  const formRef = React.useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="memberId" value={memberId} />
      <Select
        name="roleId"
        defaultValue={roleId}
        key={roleId}
        disabled={disabled || pending}
        aria-label="Papel do membro"
        className="h-8 w-40 py-0 text-[0.8125rem]"
        onChange={() => formRef.current?.requestSubmit()}
      >
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </Select>
      <Feedback state={state} />
    </form>
  );
}
