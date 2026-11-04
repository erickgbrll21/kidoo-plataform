import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-kidoo-100 text-kidoo-600">
        <Icon className="size-6" aria-hidden />
      </span>
      <h3 className="text-base font-semibold text-kidoo-900">{title}</h3>
      {description ? <p className="mt-1.5 max-w-md text-sm text-kidoo-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
