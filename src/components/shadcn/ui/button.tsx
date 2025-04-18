import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "~/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/60 shadow-sm",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/60",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",

        // System color variants
        accent: "bg-accent text-accent-foreground hover:bg-accent/80 shadow-sm shadow-primary",
        accentOutline: "border-2 border-accent text-accent hover:bg-accent hover:text-accent-foreground",
        accentGhost: "text-accent hover:bg-accent/10",

        muted: "bg-muted text-muted-foreground hover:bg-muted/80",
        mutedOutline: "border-2 border-muted text-foreground hover:bg-muted hover:text-muted-foreground",
        mutedGhost: "text-muted-foreground hover:bg-muted/10",

        // Sidebar variants
        sidebar: "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/80",
        sidebarOutline: "border-2 border-sidebar-primary text-sidebar-primary hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
        sidebarGhost: "text-sidebar-primary hover:bg-sidebar-primary/10",

        sidebarAccent: "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/80",
        sidebarAccentOutline: "border-2 border-sidebar-accent text-sidebar-accent hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        sidebarAccentGhost: "text-sidebar-accent hover:bg-sidebar-accent/10",

        // Chart color variants
        chart1: "bg-[hsl(var(--chart-1))] text-background hover:bg-[hsl(var(--chart-1))]/80",
        chart2: "bg-[hsl(var(--chart-2))] text-background hover:bg-[hsl(var(--chart-2))]/80",
        chart3: "bg-[hsl(var(--chart-3))] text-background hover:bg-[hsl(var(--chart-3))]/80",
        chart4: "bg-[hsl(var(--chart-4))] text-background hover:bg-[hsl(var(--chart-4))]/80",
        chart5: "bg-[hsl(var(--chart-5))] text-background hover:bg-[hsl(var(--chart-5))]/80",

        // Special effect variants using design system colors
        glow: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/50 hover:shadow-primary/80",
        glassmorphic: "bg-background/10 backdrop-blur-md border border-border/20 text-foreground hover:bg-background/20",
        gradient: "bg-gradient-to-r from-primary to-accent text-primary-foreground hover:from-accent hover:to-primary",

        // Light/dark mode adaptive variants
        adaptive: "dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/80 bg-primary text-primary-foreground hover:bg-primary/80",
        adaptiveOutline: "dark:border-2 dark:border-accent dark:text-accent dark:hover:bg-accent dark:hover:text-accent-foreground border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground",
      },

      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        xl: "h-12 rounded-md px-10 text-base",
        icon: "h-10 w-10",
        creator: "h-14 ",
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