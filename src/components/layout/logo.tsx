import { cn } from "@/lib/utils";

/** Marca KIDOO HUB. `tone="light"` para fundos escuros. */
export function Logo({ tone = "dark", className, showWordmark = true }: { tone?: "dark" | "light"; className?: string; showWordmark?: boolean }) {
  const light = tone === "light";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="size-8" role="img" aria-label="KIDOO HUB">
        <rect width="32" height="32" rx="9" className={light ? "fill-white" : "fill-kidoo-700"} />
        <path
          d="M10.5 8.5v15M10.5 16.2l9.2-7.7M13.6 14l6.2 9.5"
          fill="none"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={light ? "stroke-kidoo-900" : "stroke-white"}
        />
      </svg>
      {showWordmark ? (
        <span className="flex items-baseline gap-1.5 leading-none">
          <span className={cn("text-[1.05rem] font-semibold tracking-[0.14em]", light ? "text-white" : "text-kidoo-900")}>KIDOO</span>
          <span className={cn("text-[0.65rem] font-medium tracking-[0.28em]", light ? "text-kidoo-300" : "text-kidoo-500")}>HUB</span>
        </span>
      ) : null}
    </span>
  );
}
