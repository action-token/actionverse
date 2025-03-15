import { SkeletonEffect } from "./skeleton-effect";

export function CreatorListSkeleton() {
    return (
        <div className="flex w-full flex-col gap-2 p-1">
            {Array.from({ length: 5 }).map((_, index) => (
                <SkeletonEffect key={index} variant="creator" />
            ))}
        </div>
    )
}

