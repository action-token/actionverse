import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "~/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/60 ",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/60",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        warm: "bg-[#F2994A] text-white hover:bg-[#E07C24]",
        warmOutline: "border-2 border-[#F2994A] text-[#F2994A] hover:bg-[#F2994A] hover:text-white",
        warmGhost: "text-[#F2994A] hover:bg-[#F2994A]/10",

        // Cool palette variants
        cool: "bg-[#56CCF2] text-white hover:bg-[#2D9CDB]",
        coolOutline: "border-2 border-[#56CCF2] text-[#56CCF2] hover:bg-[#56CCF2] hover:text-white",
        coolGhost: "text-[#56CCF2] hover:bg-[#56CCF2]/10",

        // Vibrant palette variants
        vibrant: "bg-[#6FCF97] text-white hover:bg-[#27AE60]",
        vibrantOutline: "border-2 border-[#6FCF97] text-[#6FCF97] hover:bg-[#6FCF97] hover:text-white",
        vibrantGhost: "text-[#6FCF97] hover:bg-[#6FCF97]/10",

        // Golden palette variants
        golden: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))/90]",
        goldenOutline:
          "border-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))]",
        goldenGhost: "text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10",

        // Special effect variants
        glow: "bg-[#BB86FC] text-white hover:bg-[#BB86FC]/90 shadow-lg shadow-[#BB86FC]/50 hover:shadow-[#BB86FC]/80",
        neon: "bg-black text-[#39FF14] border-2 border-[#39FF14] hover:bg-[#39FF14] hover:text-black transition-all duration-300 shadow-[0_0_10px_#39FF14]",
        gradient: "bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white hover:from-[#FF4B2B] hover:to-[#FF416C]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
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
