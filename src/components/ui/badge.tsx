import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--brand)] text-[oklch(0.08_0.01_260)]",
        secondary:
          "border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)]",
        success:
          "border-transparent bg-[var(--success)] text-[oklch(0.08_0.01_260)]",
        warning:
          "border-transparent bg-[var(--warning)] text-[oklch(0.08_0.01_260)]",
        destructive:
          "border-transparent bg-[var(--error)] text-white",
        outline:
          "border-[var(--glass-border-strong)] text-[var(--text-secondary)] bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
