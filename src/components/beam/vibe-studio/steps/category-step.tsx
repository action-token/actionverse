"use client"
import { Snowflake, Heart, Cake } from "lucide-react"
import { cn } from "~/lib/utils"

type Category = "CHRISTMAS" | "EVERYDAY" | "BIRTHDAY"

interface CategoryStepProps {
  onSelect: (category: Category) => void
  onBack: () => void
}

const categories = [
  {
    id: "CHRISTMAS" as Category,
    name: "Christmas",
    description: "Festive holiday magic",
    icon: Snowflake,
    color: "from-red-500/10 to-green-500/10",
    iconColor: "text-red-500",
    borderHover: "hover:border-red-500/50",
  },
  {
    id: "EVERYDAY" as Category,
    name: "Everyday",
    description: "For any moment",
    icon: Heart,
    color: "from-primary/10 to-accent/10",
    iconColor: "text-primary",
    borderHover: "hover:border-primary/50",
  },
  {
    id: "BIRTHDAY" as Category,
    name: "Birthday",
    description: "Celebrate in style",
    icon: Cake,
    color: "from-pink-500/10 to-amber-500/10",
    iconColor: "text-pink-500",
    borderHover: "hover:border-pink-500/50",
  },
]

export function CategoryStep({ onSelect, onBack }: CategoryStepProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">What&apos;s the occasion?</h1>
        <p className="text-lg text-muted-foreground">Choose a category to get started with your card</p>
      </div>

      {/* Category cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={cn(
              "group relative overflow-hidden rounded-2xl border-2 border-border bg-card p-8 text-left transition-all duration-300",
              cat.borderHover,
              "hover:shadow-xl hover:-translate-y-1",
            )}
          >
            {/* Background gradient */}
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                cat.color,
              )}
            />

            {/* Content */}
            <div className="relative space-y-4">
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-xl bg-background transition-transform duration-300 group-hover:scale-110",
                  cat.iconColor,
                )}
              >
                <cat.icon className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground">{cat.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{cat.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
