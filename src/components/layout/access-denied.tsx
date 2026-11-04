import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "./empty-state";

export function AccessDenied({ what = "esta área" }: { what?: string }) {
  return (
    <Card>
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description={`Seu papel nesta empresa não permite acessar ${what}. Fale com um administrador se precisar de acesso.`}
      />
    </Card>
  );
}
