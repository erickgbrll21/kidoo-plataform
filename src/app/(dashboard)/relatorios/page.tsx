import type { Metadata } from "next";
import { ChartColumn } from "lucide-react";
import { GuardedModule } from "@/components/layout/guarded-module";

export const metadata: Metadata = { title: "Relatórios" };

export default function ReportsPage() {
  return (
    <GuardedModule
      permission="reports.read"
      title="Relatórios"
      description="Indicadores de atendimento, equipe, IA e vendas."
      icon={ChartColumn}
      phase="Fases 5 a 9"
      requires="Dados reais de conversas (Fases 3 a 5) e oportunidades (Fase 6)."
      capabilities={[
        "Volume de mensagens e conversas por canal",
        "Tempo de resposta e conversas resolvidas",
        "Desempenho de atendentes e de agentes de IA",
        "Conversão de leads e desempenho comercial",
      ]}
    />
  );
}
