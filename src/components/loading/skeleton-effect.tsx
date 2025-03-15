import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { cn } from "~/lib/utils"

interface SkeletonEffectProps {
    className?: string
    count?: number
    variant?: "avatar" | "card" | "text" | "button" | "creator"
}

export function SkeletonEffect({ className, count = 1, variant = "text" }: SkeletonEffectProps) {
    const renderSkeleton = () => {
        switch (variant) {
            case "avatar":
                return <Skeleton className="h-12 w-12 rounded-full" />
            case "card":
                return (
                    <div className="space-y-3">
                        <Skeleton className="h-40 w-full rounded-lg" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                )
            case "button":
                return <Skeleton className="h-10 w-20 rounded-md" />
            case "creator":
                return (
                    <div className="flex w-full items-center gap-2">
                        <Skeleton className="h-14 w-14 rounded-full" />
                        <div className="flex flex-col gap-2">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-3 w-10" />
                        </div>
                    </div>
                )
            case "text":
            default:
                return <Skeleton className="h-4 w-full" />
        }
    }

    return (
        <div className={cn("space-y-2", className)}>
            {Array.from({ length: count }).map((_, index) => (
                <div key={index}>{renderSkeleton()}</div>
            ))}
        </div>
    )
}

