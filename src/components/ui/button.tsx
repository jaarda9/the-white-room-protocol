import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-xs font-mono font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border border-cyan-400/80 bg-cyan-950/60 text-cyan-200 hover:bg-cyan-400 hover:text-black shadow-[0_0_10px_rgba(82,210,246,0.2)]",
        destructive:
          "border border-red-500/80 bg-red-950/60 text-red-200 hover:bg-red-500 hover:text-white",
        outline:
          "border border-cyan-500/40 bg-black/40 text-gray-300 hover:border-cyan-400 hover:text-cyan-200 hover:bg-cyan-500/10",
        secondary:
          "border border-gray-700 bg-gray-900/60 text-gray-200 hover:bg-gray-800",
        ghost:
          "hover:bg-cyan-500/10 hover:text-cyan-200 text-gray-400",
        link:
          "text-cyan-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8 text-sm",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
