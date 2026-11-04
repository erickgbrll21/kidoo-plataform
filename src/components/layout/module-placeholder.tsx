import type { LucideIcon } from "lucide-react";
import { CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "./page-header";

/**
 * Página de módulo ainda não implementado. Deliberadamente NÃO exibe dados
 * fictícios: descreve o que o módulo fará e do que ele depende.
 */
export function ModulePlaceholder({
  title,
  description,
  icon: Icon,
  phase,
  capabilities,
  requires,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  phase: string;
  capabilities: string[];
  requires: string;
}) {
  return (
    <div className="animate-fade-up">
      <PageHeader title={title} description={description} actions={<Badge tone="warning">{phase}</Badge>} />
      <Card>
        <CardContent className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-kidoo-700 text-white">
              <Icon className="size-5" aria-hidden />
            </span>
            <h2 className="text-lg font-semibold tracking-tight text-kidoo-950">Em construção</h2>
            <p className="mt-1.5 max-w-lg text-sm text-kidoo-500">
              Este módulo faz parte do roteiro de implementação e ainda não está disponível. Nenhum dado de exemplo é
              exibido para evitar informações enganosas.
            </p>
            <p className="mt-4 text-sm text-kidoo-700">
              <span className="font-medium">Depende de:</span> {requires}
            </p>
          </div>
          <div>
            <p className="mb-3 text-xs font-medium tracking-wide text-kidoo-500 uppercase">O que estará aqui</p>
            <ul className="space-y-2.5">
              {capabilities.map((c) => (
                <li key={c} className="flex items-start gap-2.5 text-sm text-kidoo-800">
                  <CircleDashed className="mt-0.5 size-4 shrink-0 text-kidoo-400" aria-hidden />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
