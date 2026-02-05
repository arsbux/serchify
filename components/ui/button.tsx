import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gray-900 text-white shadow-md hover:bg-gray-800 hover:shadow-lg focus-visible:ring-gray-900",
        primary:
          "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30 hover:from-blue-700 hover:to-indigo-700 focus-visible:ring-blue-500",
        destructive:
          "bg-red-600 text-white shadow-md shadow-red-500/25 hover:bg-red-700 hover:shadow-lg hover:shadow-red-500/30 focus-visible:ring-red-500",
        outline:
          "border-2 border-gray-200 bg-white shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:shadow focus-visible:ring-gray-400",
        secondary:
          "bg-gray-100 text-gray-900 shadow-sm hover:bg-gray-200 hover:shadow focus-visible:ring-gray-400",
        ghost:
          "hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-gray-400",
        link:
          "text-blue-600 underline-offset-4 hover:underline hover:text-blue-700 focus-visible:ring-blue-500",
        success:
          "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md shadow-green-500/25 hover:shadow-lg hover:shadow-green-500/30 hover:from-green-600 hover:to-emerald-700 focus-visible:ring-green-500",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-lg px-4 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
        icon: "h-10 w-10",
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
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
