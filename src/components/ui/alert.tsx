import * as React from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm animate-fade-in", {
  variants: {
    tone: {
      info: "border-kidoo-200 bg-kidoo-50 text-kidoo-800",
      success: "border-success/20 bg-success-soft text-success",
      warning: "border-warning/25 bg-warning-soft text-warning",
      danger: "border-danger/20 bg-danger-soft text-danger",
    },
  },
  defaultVariants: { tone: "info" },
});

const icons = { info: Info, success: CheckCircle2, warning: TriangleAlert, danger: AlertCircle } as const;

export function Alert({
  className,
  tone = "info",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  const Icon = icons[tone ?? "info"];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Mostra o resultado de uma Server Action (useActionState). */
export function ActionMessage({ state }: { state: { ok?: boolean; message?: string } }) {
  if (!state.message) return null;
  return <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>;
}
