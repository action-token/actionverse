"use client"
import { cn } from "~/lib/utils"
import { Card, CardContent } from "~/components/shadcn/ui/card"

type Category = "CHRISTMAS" | "EVERYDAY" | "BIRTHDAY"

interface StyleStepProps {
  category: Category
  onSelect: (style: string) => void
  onBack: () => void
}

const styles = {
  CHRISTMAS: [
    { id: "winter-wonderland", name: "Winter Wonderland", preview: "Snowy magical landscape", icon: "❄️" },
    { id: "santas-workshop", name: "Santa's Workshop", preview: "Cozy workshop with elves", icon: "🎅" },
    { id: "cozy-fireplace", name: "Cozy Fireplace", preview: "Warm holiday hearth", icon: "🔥" },
    { id: "gingerbread-village", name: "Gingerbread Village", preview: "Sweet candy houses", icon: "🍬" },
    { id: "nutcracker-magic", name: "Nutcracker Magic", preview: "Classic holiday tale", icon: "🩰" },
    { id: "reindeer-flight", name: "Reindeer Flight", preview: "Magical flying scene", icon: "🦌" },
  ],
  EVERYDAY: [
    { id: "congrats", name: "Congrats", preview: "Celebration and achievement", icon: "🎉" },
    { id: "get-well-soon", name: "Get Well Soon", preview: "Healing and recovery", icon: "💊" },
    { id: "thank-you", name: "Thank You", preview: "Gratitude and appreciation", icon: "🙏" },
    { id: "thinking-of-you", name: "Thinking of You", preview: "Caring and remembrance", icon: "💭" },
    { id: "good-luck", name: "Good Luck", preview: "Fortune and success", icon: "🍀" },
    { id: "just-because", name: "Just Because", preview: "No reason needed", icon: "✨" },
  ],
  BIRTHDAY: [
    { id: "party-time", name: "Party Time", preview: "Fun celebration vibes", icon: "🥳" },
    { id: "cake-celebration", name: "Cake Celebration", preview: "Sweet birthday treats", icon: "🍰" },
    { id: "golden-birthday", name: "Golden Birthday", preview: "Elegant and special", icon: "🏅" },
    { id: "kids-party", name: "Kids Party", preview: "Playful and colorful", icon: "🎈" },
    { id: "milestone-birthday", name: "Milestone Birthday", preview: "Big number celebration", icon: "🎂" },
    { id: "surprise-party", name: "Surprise Party", preview: "Unexpected joy", icon: "🎁" },
  ],
}

export function StyleStep({ category, onSelect, onBack }: StyleStepProps) {
  const categoryStyles = styles[category]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Pick your style</h1>
        <p className="text-lg text-muted-foreground">Choose a visual theme for your {category.toLowerCase()} card</p>
      </div>

      {/* Style grid */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        {categoryStyles.map((styleOption, index) => (
          <Card
            key={styleOption.id}
            onClick={() => onSelect(styleOption.id)}
            className={cn("cursor-pointer hover:shadow-lg transition-shadow w-64")}
          >
            {/* Preview image / icon area */}
            <CardContent className="p-0 ">
              <div
                className={cn(
                  "flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary/5 to-accent/5 h-32",
                )}
              >
                <span className="text-4xl">{(styleOption).icon ?? "🎨"}</span>
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-foreground">{styleOption.name}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{styleOption.preview}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
