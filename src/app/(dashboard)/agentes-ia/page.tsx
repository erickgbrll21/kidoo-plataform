import type { Metadata } from "next";
import { Bot } from "lucide-react";
import { GuardedModule } from "@/components/layout/guarded-module";

export const metadata: Metadata = { title: "Agentes IA" };

export default function AgentsPage() {
  return (
    <GuardedModule
      permission="agents.read"
      title="Agentes IA"
      description="Assistentes inteligentes por canal, com transferência para a equipe."
      icon={Bot}
      phase="Fase 7"
      requires="Chaves de API dos provedores (Claude, OpenAI, Gemini) e canais conectados (Fase 4)."
      capabilities={[
        "Vários agentes com instruções, objetivos e base de conhecimento",
        "Escolha de provedor e modelo, com limites de uso",
        "Associação de agentes diferentes a números diferentes",
        "Regras de transferência para atendentes humanos e histórico de execuções",
      ]}
    />
  );
}
