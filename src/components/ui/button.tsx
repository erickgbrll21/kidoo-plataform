import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-150 select-none disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-kidoo-700 text-white shadow-card hover:bg-kidoo-900",
        secondary: "bg-kidoo-100 text-kidoo-900 hover:bg-kidoo-200",
        outline: "border border-kidoo-200 bg-white text-kidoo-900 hover:bg-kidoo-50 hover:border-kidoo-300",
        ghost: "text-kidoo-700 hover:bg-kidoo-100",
        danger: "bg-danger text-white hover:bg-[#9a2f26]",
        "danger-outline": "border border-danger/30 bg-white text-danger hover:bg-danger-soft",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-11 px-5 text-[0.9375rem]",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
