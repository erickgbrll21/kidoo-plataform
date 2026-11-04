import * as React from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-lg border border-kidoo-200 bg-white px-3 text-sm text-kidoo-950 placeholder:text-kidoo-400 transition-[border-color,box-shadow] duration-150 hover:border-kidoo-300 focus-visible:border-kidoo-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kidoo-600/10 disabled:cursor-not-allowed disabled:bg-kidoo-50 disabled:text-kidoo-500 aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/10";

export function Input({ className, type = "text", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type={type} className={cn(control, "h-10", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, "h-10 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-24 py-2", className)} {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-kidoo-800", className)} {...props} />;
}

/** Campo com rótulo, dica e mensagem de erro acessíveis. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error ? <p className="text-xs text-kidoo-500">{hint}</p> : null}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
