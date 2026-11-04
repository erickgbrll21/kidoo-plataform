import type { Metadata } from "next";
import { Workflow } from "lucide-react";
import { GuardedModule } from "@/components/layout/guarded-module";

export const metadata: Metadata = { title: "Automações" };

export default function AutomationsPage() {
  return (
    <GuardedModule
      permission="automations.read"
      title="Automações"
      description="Fluxos automáticos disparados por mensagens, palavras-chave e horários."
      icon={Workflow}
      phase="Fase 8"
      requires="Webhooks do Chatwoot (Fase 3) e agentes de IA (Fase 7)."
      capabilities={[
        "Construtor visual de fluxos (React Flow)",
        "Gatilhos, condições, esperas e ações (mensagem, etiqueta, oportunidade, transferência)",
        "Motor de execução separado do editor, com registro de execuções",
      ]}
    />
  );
}
