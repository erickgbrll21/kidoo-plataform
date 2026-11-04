import { redirect } from "next/navigation";

/** A raiz apenas encaminha: o painel decide entre login, onboarding e dashboard. */
export default function Home() {
  redirect("/dashboard");
}
