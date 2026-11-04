import type { Metadata } from "next";
import { Contact } from "lucide-react";
import { GuardedModule } from "@/components/layout/guarded-module";

export const metadata: Metadata = { title: "Contatos" };

export default function ContactsPage() {
  return (
    <GuardedModule
      permission="contacts.read"
      title="Contatos"
      description="Base de contatos e histórico de relacionamento."
      icon={Contact}
      phase="Fase 6"
      requires="Sincronização de contatos e conversas com o Chatwoot (Fase 3)."
      capabilities={[
        "Cadastro, edição e busca de contatos",
        "Etiquetas, observações e origem do lead",
        "Histórico de conversas e oportunidades associadas",
      ]}
    />
  );
}
