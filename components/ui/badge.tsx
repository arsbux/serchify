import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-gray-900 text-white shadow-sm hover:bg-gray-800",
        secondary:
          "border-transparent bg-gray-100 text-gray-700 hover:bg-gray-200",
        destructive:
          "border-transparent bg-red-100 text-red-700 shadow-sm hover:bg-red-200",
        outline:
          "border-gray-200 text-gray-700 bg-white hover:bg-gray-50",
        success:
          "border-transparent bg-green-100 text-green-700 shadow-sm hover:bg-green-200",
        warning:
          "border-transparent bg-amber-100 text-amber-700 shadow-sm hover:bg-amber-200",
        info:
          "border-transparent bg-blue-100 text-blue-700 shadow-sm hover:bg-blue-200",
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
