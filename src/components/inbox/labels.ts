import type { InboxStatus } from "@/services/inbox/list";

export function statusTone(status: InboxStatus | string): "success" | "warning" | "neutral" | "outline" {
  switch (status) {
    case "open":
      return "success";
    case "pending":
      return "warning";
    case "snoozed":
      return "outline";
    default:
      return "neutral";
  }
}

export function statusLabel(status: InboxStatus | string) {
  switch (status) {
    case "open":
      return "Aberta";
    case "pending":
      return "Pendente";
    case "snoozed":
      return "Adiada";
    case "resolved":
      return "Resolvida";
    default:
      return status;
  }
}
