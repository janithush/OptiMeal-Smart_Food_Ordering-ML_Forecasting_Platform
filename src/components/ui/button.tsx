import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)] cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--brand)] text-[oklch(0.08_0.01_260)] hover:bg-[var(--brand-muted)] active:scale-[0.98] shadow-sm hover:shadow-[var(--shadow-glow)]",
        secondary:
          "glass glass-hover text-[var(--text-primary)] hover:text-white",
        outline:
          "border border-[var(--glass-border-strong)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] hover:text-white hover:border-[var(--brand)]",
        ghost:
          "text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] hover:text-white",
        destructive:
          "bg-[var(--error)] text-white hover:opacity-90",
        link:
          "text-[var(--brand)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm:      "h-8 rounded-md px-3 text-xs",
        lg:      "h-12 rounded-lg px-8 text-base",
        icon:    "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
