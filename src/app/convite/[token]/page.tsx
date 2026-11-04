import type { Metadata } from "next";
import { Suspense } from "react";
import { MailWarning } from "lucide-react";
import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";
import { FocusPage } from "@/components/layout/focus-page";
import { Alert } from "@/components/ui/alert";
import { requireUser } from "@/lib/auth/dal";
import { previewInvitation } from "@/services/team/service";

export const metadata: Metadata = { title: "Convite" };

const UNAVAILABLE: Record<string, string> = {
  expired: "Este convite expirou. Peça um novo convite ao administrador da empresa.",
  revoked: "Este convite foi cancelado pelo administrador da empresa.",
  accepted: "Este convite já foi utilizado.",
  unavailable: "Este convite é inválido ou não está mais disponível.",
};

async function InviteContent({ params }: { params: PageProps<"/convite/[token]">["params"] }) {
  const { token } = await params;
  const user = await requireUser(`/convite/${token}`);
  const preview = /^[A-Za-z0-9_-]{20,100}$/.test(token) ? await previewInvitation(token) : null;

  return (
    <FocusPage email={user.email}>
      {!preview || preview.status !== "valid" ? (
        <>
          <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-warning-soft text-warning">
            <MailWarning className="size-5" aria-hidden />
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-kidoo-950">Convite indisponível</h1>
          <p className="mt-1.5 text-sm text-kidoo-500">{UNAVAILABLE[preview?.status ?? "unavailable"]}</p>
        </>
      ) : !preview.email_matches ? (
        <>
          <h1 className="text-xl font-semibold tracking-tight text-kidoo-950">Convite para outra conta</h1>
          <p className="mt-1.5 text-sm text-kidoo-500">
            Este convite para <strong className="text-kidoo-800">{preview.organization_name}</strong> foi enviado para
            outro e-mail. Você está conectado como <strong className="text-kidoo-800">{user.email}</strong>. Saia e
            entre com a conta convidada.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold tracking-tight text-kidoo-950">Você foi convidado</h1>
          <p className="mt-1.5 mb-5 text-sm text-kidoo-500">
            Entre na empresa <strong className="text-kidoo-800">{preview.organization_name}</strong> com o papel de{" "}
            <strong className="text-kidoo-800">{preview.role_name}</strong>.
          </p>
          {user.emailConfirmed ? null : (
            <Alert tone="warning" className="mb-4">
              Confirme seu e-mail antes de aceitar o convite.
            </Alert>
          )}
          <AcceptInvitationForm token={token} organizationName={preview.organization_name} />
        </>
      )}
    </FocusPage>
  );
}

export default function InvitePage(props: PageProps<"/convite/[token]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-kidoo-50" aria-hidden />}>
      <InviteContent params={props.params} />
    </Suspense>
  );
}
