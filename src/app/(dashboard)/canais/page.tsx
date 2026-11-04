import type { Metadata } from "next";
import { Radio } from "lucide-react";
import { GuardedModule } from "@/components/layout/guarded-module";

export const metadata: Metadata = { title: "Canais" };

export default function ChannelsPage() {
  return (
    <GuardedModule
      permission="channels.read"
      title="Canais"
      description="Números de WhatsApp e caixas de entrada da sua empresa."
      icon={Radio}
      phase="Fase 4"
      requires="App da Meta com Embedded Signup configurado e Chatwoot provisionado (Fases 3 e 4)."
      capabilities={[
        "Conectar vários números pelo fluxo oficial da Meta",
        "Status da conexão, data de conexão e última sincronização",
        "Agente de IA e horários de atendimento por número",
        "Desconexão segura e controle de limites do plano",
      ]}
    />
  );
}
