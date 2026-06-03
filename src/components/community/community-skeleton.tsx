"use client"

import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { Card, CardContent, CardFooter, CardHeader } from "~/components/shadcn/ui/card"

export function CommunitySkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-0">
        <Skeleton className="h-32 w-full" />
      </CardHeader>
      <CardContent className="pt-8 pb-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-1 h-4 w-2/3" />
        <div className="mt-3 flex gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardContent>
      <CardFooter className="border-t px-4 py-3">
        <div className="flex -space-x-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-6 rounded-full" />
          ))}
        </div>
      </CardFooter>
    </Card>
  )
}

export function CommunitySkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <CommunitySkeleton key={i} />
      ))}
    </div>
  )
}
