import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-400",
  {
    variants: {
      variant: {
        default:
          "border border-cyan-400/60 bg-cyan-950/40 text-cyan-200 shadow-[0_0_8px_rgba(82,210,246,0.2)]",
        secondary:
          "border border-gray-700 bg-gray-900/60 text-gray-300",
        destructive:
          "border border-red-500/60 bg-red-950/40 text-red-300",
        outline:
          "border border-cyan-500/40 text-cyan-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
