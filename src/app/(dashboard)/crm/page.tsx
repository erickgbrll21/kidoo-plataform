import type { Metadata } from "next";
import { Kanban } from "lucide-react";
import { GuardedModule } from "@/components/layout/guarded-module";

export const metadata: Metadata = { title: "CRM" };

export default function CrmPage() {
  return (
    <GuardedModule
      permission="crm.read"
      title="CRM"
      description="Funil de vendas e oportunidades comerciais."
      icon={Kanban}
      phase="Fase 6"
      requires="Módulo de contatos (Fase 6)."
      capabilities={[
        "Pipeline visual com etapas personalizadas",
        "Oportunidades com valor, responsável e previsão de fechamento",
        "Histórico de atividades e vínculo com contatos e conversas",
      ]}
    />
  );
}
