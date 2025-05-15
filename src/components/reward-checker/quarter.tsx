"use client"

import { Loader2, Search, Award, RefreshCw, ExternalLink } from "lucide-react"
import { useState } from "react"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/shadcn/ui/table"
import { Badge } from "~/components/shadcn/ui/badge"
import { z } from "zod"
import { create } from "zustand"
import { api } from "~/utils/api"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../shadcn/ui/select"
import type { QuarterReward } from "@prisma/client"
import { motion, AnimatePresence } from "framer-motion"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import toast from "react-hot-toast"

const quarterRewardDataSchema = z.object({
  accountId: z.string(),
  action: z.number(),
})

type QuarterRewardData = z.infer<typeof quarterRewardDataSchema>

interface AppState {
  reward?: { date: string; rewardedAt?: Date; data: QuarterRewardData[] }
  setReward: (value?: {
    date: string
    rewardedAt?: Date
    data: QuarterRewardData[]
  }) => void
  currentReward?: { date: string; data: QuarterRewardData[] }
  setCurrentReward: (value: {
    date: string
    data: QuarterRewardData[]
  }) => void
}

const useStore = create<AppState>((set) => ({
  setReward: (value) => set({ reward: value }),
  setCurrentReward: (value) => set({ currentReward: value }),
}))

export function QuarterRewards() {
  const { reward, currentReward } = useStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [filteredData, setFilteredData] = useState<QuarterRewardData[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a wallet address")
      return
    }

    setIsSearching(true)
    setHasSearched(true)

    // Filter data based on search query
    if (reward?.data) {
      const results = reward.data.filter((item) => item.accountId.toLowerCase().includes(searchQuery.toLowerCase()))

      setFilteredData(results)

      setTimeout(() => {
        setIsSearching(false)
        if (results.length > 0) {
          toast.success(`Found ${results.length} matching results`)
        } else {
          toast.error("No matching results found")
        }
      }, 500)
    } else {
      setIsSearching(false)
      toast.error("No data available to search")
    }
  }

  const handleSync = () => {
    toast.success("Data synchronized successfully")
  }

  const handleDownload = () => {
    toast.success("Download started")
  }

  // Determine which data to display - either filtered results or all data
  const displayData = hasSearched && searchQuery.trim() !== "" ? filteredData : reward?.data ?? []

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
            <Input
              placeholder="Search by wallet address"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (e.target.value === "") {
                  setHasSearched(false)
                }
              }}
              className="pl-10"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
            {isSearching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              "Search"
            )}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <YearQuarterSelect />
          <div className="flex gap-2">
            {currentReward?.date === reward?.date ? (
              <Button variant="outline" onClick={handleSync} className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Sync Data
              </Button>
            ) : (
              <Button variant="outline" onClick={handleDownload} className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Download
              </Button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isSearching ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </motion.div>
        ) : displayData.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-md border"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Wallet Address</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead className="text-right">Reward</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayData
                  .sort((a, b) => b.action - a.action)
                  .map((row, index) => (
                    <TableRow key={index} className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-mono text-xs truncate max-w-[300px]">{row.accountId}</TableCell>
                      <TableCell>{row.action}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="font-medium">
                          {20}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </motion.div>
        ) : hasSearched ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="rounded-full bg-muted p-3 mb-4">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No matching results</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Try a different search term or clear the search field to see all data.
            </p>
          </motion.div>
        ) : !reward?.data ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="rounded-full bg-muted p-3 mb-4">
              <Award className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No reward data found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              There is no reward data available for the selected period.
            </p>
          </motion.div>
        ) : reward.data.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="rounded-full bg-muted p-3 mb-4">
              <Award className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No reward data available</h3>
            <p className="text-sm text-muted-foreground mt-1">This period contains no quarter reward data.</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}

export function YearQuarterSelect() {
  const { setReward, reward, setCurrentReward } = useStore()

  const rewards = api.action.checker.getAllQuarterRewards.useQuery(undefined, {
    onSuccess(data) {
      if (data && data.length > 0) {
        const first = data[0]
        if (first) {
          const date = getYearQuarter(first)
          try {
            const parsedData = quarterRewardDataSchema.array().parse(first.data ?? [])

            setCurrentReward({
              date,
              data: parsedData,
            })

            setReward({
              date,
              rewardedAt: first.rewardedAt ?? undefined,
              data: parsedData,
            })
          } catch (error) {
            console.error("Error parsing reward data:", error)
            // Set empty data on parse error
            setCurrentReward({
              date,
              data: [],
            })
            setReward({
              date,
              rewardedAt: first.rewardedAt ?? undefined,
              data: [],
            })
          }
        }
      } else {
        // Handle empty data array
        setCurrentReward({
          date: "No data",
          data: [],
        })
        setReward({
          date: "No data",
          data: [],
        })
      }
    },
    onError(error) {
      console.error("Error fetching quarter rewards:", error)
      toast.error("Failed to fetch quarter rewards data")
    },
  })

  const handleSelect = (value: string) => {
    const reward = rewards.data?.find((reward) => getYearQuarter(reward) == value)
    if (reward) {
      try {
        const data = quarterRewardDataSchema.array().parse(reward.data ?? [])
        setReward({
          date: value,
          rewardedAt: reward.rewardedAt ?? undefined,
          data,
        })
      } catch (error) {
        console.error("Error parsing reward data:", error)
        toast.error("Error loading reward data")
        setReward({
          date: value,
          rewardedAt: reward.rewardedAt ?? undefined,
          data: [],
        })
      }
    }
  }

  return (
    <div className="w-full sm:w-[240px]">
      {rewards.isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : rewards.isError ? (
        <div className="text-sm text-red-500">Error loading data</div>
      ) : (
        <Select onValueChange={handleSelect} value={reward?.date}>
          <SelectTrigger id="year-quarter-select" className="w-full">
            <SelectValue placeholder="Select year and quarter" />
          </SelectTrigger>
          <SelectContent>
            {rewards.data && rewards.data.length > 0 ? (
              rewards.data.map((option) => (
                <SelectItem key={option.id} value={getYearQuarter(option)}>
                  {getYearQuarter(option)}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="no-data" disabled>
                No data available
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

function getYearQuarter(data: QuarterReward) {
  return `${data.year}-Q${data.quarter}`
}
