"use client"

import { useEffect, useRef } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/shadcn/ui/select"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { holderWithPlotsSchema } from "~/lib/stellar/action-token/script"
import { api } from "~/utils/api"
import { useRewardStore } from "./store"

export function YearMonthSelect() {
  const { setReward, reward, setCurrentReward } = useRewardStore()
  const hasInitialized = useRef(false)

  const rewards = api.action.checker.getAllOriginRewards.useQuery(undefined, {
    refetchOnWindowFocus: false,
  })

  // Sort rewards by date (newest first)
  const sortedRewards = rewards.data?.slice().sort((a, b) => {
    // Convert YYYY-MM format to Date for proper comparison
    const dateA = new Date(a.monthYear + "-01")
    const dateB = new Date(b.monthYear + "-01")
    return dateB.getTime() - dateA.getTime() // Newest first
  })

  // Handle initial data load separately from the query
  useEffect(() => {
    if (sortedRewards && sortedRewards.length > 0 && !hasInitialized.current && !reward?.date) {
      const first = sortedRewards[0] // This will be the newest date
      if (first) {
        try {
          const parsedData = holderWithPlotsSchema.array().parse(first.data)

          setCurrentReward({
            date: first.monthYear,
            data: parsedData,
          })

          setReward({
            date: first.monthYear,
            rewardedAt: first.rewardedAt ?? undefined,
            data: parsedData,
          })

          hasInitialized.current = true
        } catch (error) {
          console.error("Error parsing initial reward data:", error)
        }
      }
    }
  }, [sortedRewards, reward?.date, setReward, setCurrentReward])

  const handleSelect = (value: string) => {
    const selectedReward = sortedRewards?.find((reward) => {
      return reward.monthYear === value
    })

    if (selectedReward) {
      try {
        const parsedData = holderWithPlotsSchema.array().parse(selectedReward.data)
        setReward({
          date: value,
          rewardedAt: selectedReward.rewardedAt ?? undefined,
          data: parsedData,
        })
      } catch (error) {
        console.error("Error parsing selected reward data:", error)
      }
    }
  }

  return (
    <div className="w-full sm:w-[240px]">
      {rewards.isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : rewards.error ? (
        <div className="text-sm text-red-500">Error loading periods</div>
      ) : (
        <Select onValueChange={handleSelect} value={reward?.date ?? ""}>
          <SelectTrigger id="year-month-select" className="w-full">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {sortedRewards && sortedRewards.length > 0 ? (
              sortedRewards.map((option) => (
                <SelectItem key={option.id} value={option.monthYear}>
                  {option.monthYear}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="no-data" disabled>
                No periods available
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
