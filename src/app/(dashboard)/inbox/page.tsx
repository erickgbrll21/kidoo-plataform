import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { GuardedModule } from "@/components/layout/guarded-module";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <GuardedModule
      permission="inbox.read"
      title="Inbox"
      description="Central de atendimento unificada para todos os seus números."
      icon={Inbox}
      phase="Fase 5"
      requires="Integração com o Chatwoot (Fase 3) e conexão de números de WhatsApp (Fase 4)."
      capabilities={[
        "Lista de conversas com filtros por canal, status e responsável",
        "Histórico, envio de mensagens e anexos",
        "Painel do contato com etiquetas e oportunidades",
        "Atribuição, transferência de equipe e resolução",
        "Indicador de atendimento por IA ou humano",
      ]}
    />
  );
}
