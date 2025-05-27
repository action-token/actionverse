"use client"
import { Award, Ban, Calendar, Check, Copy, Download, History, Loader2, Search, Settings, Shield } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/shadcn/ui/table"
import { AnimatePresence, motion } from "framer-motion"
import toast from "react-hot-toast"
import { Badge } from "~/components/shadcn/ui/badge"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { api } from "~/utils/api"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/shadcn/ui/dialog"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/shadcn/ui/tooltip"
import { z } from "zod"
import { create } from "zustand"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/shadcn/ui/select"
import type { QuarterReward } from "@prisma/client"
import { AnimatedSyncButton } from "../../trigger/animated-sync-button"
import { useRealtimeRun } from "@trigger.dev/react-hooks"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// Types and schemas
const quarterRewardDataSchema = z.object({
  accountId: z.string(),
  action: z.number(),
})

type QuarterRewardData = z.infer<typeof quarterRewardDataSchema>

interface QuarterRewardWithDistribution extends QuarterRewardData {
  distributedAmount: number
}

interface QuarterDistributionData {
  users: QuarterRewardWithDistribution[]
  totalActions: number
}

// Store for quarter rewards
interface QuarterRewardStore {
  reward?: { date: string; rewardedAt?: Date; data: QuarterRewardData[] }
  setReward: (value?: { date: string; rewardedAt?: Date; data: QuarterRewardData[] }) => void
  currentReward?: { date: string; data: QuarterRewardData[] }
  setCurrentReward: (value: { date: string; data: QuarterRewardData[] }) => void
}

const useQuarterStore = create<QuarterRewardStore>((set) => ({
  setReward: (value) => set({ reward: value }),
  setCurrentReward: (value) => set({ currentReward: value }),
}))

function TableSkeleton({
  rows = 5,
  showDistributedAmount = false,
}: { rows?: number; showDistributedAmount?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="overflow-hidden rounded-md border bg-card/50 shadow-sm"
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>
                <Skeleton className="h-5 w-12" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-5 w-32" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-5 w-20" />
              </TableHead>
              <TableHead className="text-right">
                <Skeleton className="ml-auto h-5 w-16" />
              </TableHead>
              {showDistributedAmount && (
                <TableHead className="text-right">
                  <Skeleton className="ml-auto h-5 w-20" />
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array(rows)
              .fill(0)
              .map((_, index) => (
                <TableRow key={index} className={index % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                  <TableCell>
                    <Skeleton className="h-5 w-8" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-36" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-10" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-5 w-14" />
                  </TableCell>
                  {showDistributedAmount && (
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-5 w-16" />
                    </TableCell>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  )
}

function DistributionInfoSkeleton() {
  return (
    <Card className="mb-6 bg-card/50">
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-8 w-20" />
          </div>
          <div className="rounded-lg border bg-card p-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-6 w-16" />
          </div>
          <div className="rounded-lg border bg-card p-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-5 w-32" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function HistorySkeleton() {
  return (
    <div className="space-y-4">
      {Array(3)
        .fill(0)
        .map((_, i) => (
          <Card key={i} className="bg-card/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-5 w-32" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border bg-card p-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-2 h-8 w-20" />
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-2 h-8 w-20" />
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-2 h-5 w-32" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
    </div>
  )
}

export function AdminQuarterRewards() {
  const { reward, currentReward, setReward, setCurrentReward } = useQuarterStore()
  const [activeTab, setActiveTab] = useState("current")
  const [balanceAmount, setBalanceAmount] = useState("")
  const [isSettingBalance, setIsSettingBalance] = useState(false)
  const [blockReason, setBlockReason] = useState("")
  const [selectedUserForBlock, setSelectedUserForBlock] = useState<string | null>(null)
  const [isBlockReasonDialogOpen, setIsBlockReasonDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredUsers, setFilteredUsers] = useState<QuarterRewardData[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  const [triggerTask, setTriggerTask] = useState<{
    runId: string
    token: string
  }>()

  const admin = api.wallate.admin.checkAdmin.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  })

  const trigger = api.trigger.tirggerQuarterTask.useMutation({
    onSuccess: (res) => {
      setTriggerTask({
        runId: res.id,
        token: res.publicAccessToken,
      })
    },
  })

  // Get realtime status for the running task
  const { run: realtimeRun } = useRealtimeRun(triggerTask?.runId ?? "", {
    accessToken: triggerTask?.token ?? "",
    enabled: !!triggerTask?.runId && !!triggerTask?.token,
  })

  // API calls
  const rewardHistory = api.action.checker.getAllQuarterRewards.useQuery(undefined, {
    refetchOnWindowFocus: false,
  })

  const blockedUsers = api.action.checker.getBlockedUsers.useQuery(undefined, {
    refetchOnWindowFocus: false,
    enabled: activeTab === "blocked",
  })



  const distributeRewards = api.action.checker.distributeQuarterRewards.useMutation({
    onSuccess: () => {
      toast.success("Rewards distributed successfully")

      rewardHistory.refetch()
    },
    onError: (error) => {
      toast.error("Error distributing rewards")
      console.error("Error distributing rewards", error)
    },
  })

  const blockUser = api.action.checker.blockQuarterUser.useMutation({
    onSuccess: () => {
      toast.success("User blocked successfully")
      setIsBlockReasonDialogOpen(false)
      setSelectedUserForBlock(null)
      setBlockReason("")
      blockedUsers.refetch()
    },
    onError: (error) => {
      toast.error("Error blocking user")
      console.error("Error blocking user", error)
    },
  })

  const unblockUser = api.action.checker.unQuarterblockUser.useMutation({
    onSuccess: () => {
      toast.success("User unblocked successfully")
      blockedUsers.refetch()
    },
    onError: (error) => {
      toast.error("Error unblocking user")
      console.error("Error unblocking user", error)
    },
  })

  // Filter users based on search query and blocked status
  useEffect(() => {
    if (!reward?.data) {
      setFilteredUsers([])
      return
    }

    // First filter out blocked users
    const nonBlockedUsers = reward.data.filter((user) => !isUserBlocked(user.accountId))

    if (!searchQuery.trim()) {
      setFilteredUsers(nonBlockedUsers)
      return
    }

    const filtered = nonBlockedUsers.filter((user) => user.accountId.toLowerCase().includes(searchQuery.toLowerCase()))
    setFilteredUsers(filtered)
  }, [searchQuery, reward?.data, blockedUsers.data])

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

      setFilteredUsers(results)

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
    trigger.mutate()
    toast.success("Data synchronized successfully")
  }

  const handleDistribute = () => {
    if (currentQuarterInfo) {
      distributeRewards.mutate({
        year: currentQuarterInfo.year,
        quarter: currentQuarterInfo.quarter,
      })
    } else {
      toast.error("No current quarter reward data available")
    }
  }


  function handleBlockUser() {
    if (!selectedUserForBlock) {
      toast.error("No user selected")
      return
    }

    blockUser.mutate({
      walletAddress: selectedUserForBlock,
      reason: blockReason,
    })
  }

  async function handleDownload() {
    if (!currentQuarterInfo || !reward?.data) {
      toast.error("No data available for download")
      return
    }

    try {
      const nonBlockedData: QuarterRewardWithDistribution[] = reward.data
        .filter((user) => !isUserBlocked(user.accountId))
        .map((user) => {
          const distributedAmount = (user.action / 1000)


          return {
            ...user,
            distributedAmount,
          }
        })

      await generateQuarterRewardPDF(currentQuarterInfo, nonBlockedData)
      toast.success("PDF downloaded successfully")
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast.error("Failed to generate PDF")
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success("Address copied to clipboard")
  }

  // Format number with commas and fixed decimal places
  function formatNumber(num: number, decimals = 4): string {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }

  // Format date to a readable format
  function formatDate(date: Date | string): string {
    const dateObj = typeof date === "string" ? new Date(date) : date
    return dateObj.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Get current quarter reward info
  const currentQuarterInfo = useMemo(() => {
    if (!rewardHistory.data || !reward?.date) return null
    return rewardHistory.data.find((r) => getYearQuarter(r) === reward.date)
  }, [rewardHistory.data, reward?.date])

  // Check if a user is blocked
  const isUserBlocked = (walletAddress: string) => {
    return blockedUsers.data?.some((user) => user.walletAddress === walletAddress)
  }

  // Get blocked user info
  const getBlockedUserInfo = (walletAddress: string) => {
    return blockedUsers.data?.find((user) => user.walletAddress === walletAddress)
  }

  // Calculate distributed amounts
  const distributionData: QuarterDistributionData = useMemo(() => {
    if (!filteredUsers.length) {
      return { users: filteredUsers.map((u) => ({ ...u, distributedAmount: 0 })), totalActions: 0, hasBalance: false }
    }

    // Calculate total actions for all non-blocked users
    const totalActions = filteredUsers.reduce((sum, user) => sum + user.action, 0)

    // Calculate distributed amount for each user: (actions / 1000) * proportional share
    const usersWithDistribution = filteredUsers.map((user) => {
      const distributedAmount =
        totalActions > 0 ? (user.action / 1000) : 0

      return {
        ...user,
        distributedAmount,
      }
    })

    return {
      users: usersWithDistribution,
      totalActions,

    }
  }, [filteredUsers])

  // Determine which data to display - either filtered results or all data
  const displayData = hasSearched && searchQuery.trim() !== "" ? filteredUsers : (reward?.data ?? [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Card className="bg-card/50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <TabsList className="mb-0">
                  <TabsTrigger value="current" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Current</span>
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    <span>History</span>
                  </TabsTrigger>
                  {admin.data?.id && (
                    <TabsTrigger value="blocked" className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span>User Management</span>
                    </TabsTrigger>
                  )}
                </TabsList>

                {activeTab === "current" && (
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
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
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {activeTab === "current" && (
                  <>
                    <YearQuarterSelect />
                    <div className="flex gap-2">
                      <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()} size="sm" className="h-9">
                        {isSearching ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Searching...
                          </>
                        ) : (
                          "Search"
                        )}
                      </Button>

                      {currentReward?.date === reward?.date ? (
                        <AnimatedSyncButton
                          onClick={handleSync}
                          isLoading={trigger.isLoading || realtimeRun?.status === "EXECUTING"}
                          status={
                            realtimeRun
                              ? {
                                status: realtimeRun.status,
                                createdAt: realtimeRun.createdAt.toISOString(),
                                updatedAt: realtimeRun.updatedAt.toISOString(),
                                runId: realtimeRun.id,
                              }
                              : undefined
                          }
                          disabled={trigger.isLoading}
                        />
                      ) : (
                        <Button variant="outline" onClick={handleDownload} className="flex items-center gap-2" size="sm">
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      )}
                    </div>
                  </>
                )}

              </div>
            </div>
          </CardContent>
        </Card>

        <TabsContent value="current" className="mt-6">
          {currentQuarterInfo && (
            <Card className="mb-6 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Distribution Information</CardTitle>
                <CardDescription>Current quarter distribution details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

                  <div className="rounded-lg border bg-card p-3">
                    <div className="text-sm font-medium text-muted-foreground">Eligible Users</div>
                    <div className="mt-1 text-2xl font-bold">{distributionData.users.length}</div>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="text-sm font-medium text-muted-foreground">Status</div>
                    <div className="mt-1">
                      {currentQuarterInfo.isDistributed ? (
                        <Badge className="font-medium">Distributed</Badge>
                      ) : (
                        <Badge variant="outline" className="font-medium">
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="text-sm font-medium text-muted-foreground">Last Updated</div>
                    <div className="mt-1 text-sm">{formatDate(currentQuarterInfo.lastUpdatedAt)}</div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                {currentQuarterInfo.isDistributed ? (
                  <Button variant="outline" className="flex items-center gap-2" onClick={handleDownload}>
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                ) : (
                  <div>
                    <Button
                      className="flex items-center gap-2"
                      disabled={distributeRewards.isLoading}
                      onClick={handleDistribute}
                    >
                      {distributeRewards.isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Award className="h-4 w-4" />
                      )}
                      Distribute Rewards
                    </Button>

                  </div>
                )}
              </CardFooter>
            </Card>
          )}

          <AnimatePresence>
            {isSearching ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2 rounded-md border p-4 bg-card/50 shadow-sm"
              >
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </motion.div>
            ) : displayData.length > 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-hidden rounded-md border bg-card/50 shadow-sm"
              >
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-[80px] font-semibold">Rank</TableHead>
                        <TableHead className="font-semibold">Wallet Address</TableHead>
                        <TableHead className="font-semibold text-center">Actions</TableHead>
                        <TableHead className="text-right font-semibold">Reward Ratio</TableHead>

                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {distributionData.users
                        .sort((a, b) => b.action - a.action)
                        .map((row, index) => (
                          <TableRow
                            key={index}
                            className={`cursor-pointer transition-colors hover:bg-muted/50 ${index % 2 === 0 ? "bg-white" : "bg-muted/20"
                              }`}
                          >
                            <TableCell className="font-medium">{index + 1}</TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <TableCell className="max-w-[200px] truncate font-mono text-xs">
                                    <div className="flex items-center gap-1">
                                      <span className="truncate">{row.accountId}</span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(row.accountId)
                                        }}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-mono text-xs">{row.accountId}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TableCell className="text-center font-medium">{formatNumber(row.action, 0)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className="font-medium">
                                {formatNumber(row.action / 1000)}
                              </Badge>
                            </TableCell>

                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </motion.div>
            ) : hasSearched ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center rounded-md border bg-card/50 p-8 text-center shadow-sm"
              >
                <div className="mb-4 rounded-full bg-muted p-3">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">No matching results</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a different search term or clear the search field to see all data.
                </p>
              </motion.div>

            ) : reward?.data.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center rounded-md border bg-card/50 p-8 text-center shadow-sm"
              >
                <div className="mb-4 rounded-full bg-muted p-3">
                  <Award className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">No reward data available</h3>
                <p className="mt-1 text-sm text-muted-foreground">This period contains no quarter reward data.</p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {rewardHistory.isLoading ? (
            <HistorySkeleton />
          ) : rewardHistory.data && rewardHistory.data.length > 0 ? (
            <div className="space-y-4">
              {rewardHistory.data.map((item) => (
                <Card key={item.id} className="bg-card/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{getYearQuarter(item)}</CardTitle>
                      <div className="flex items-center gap-2">
                        {item.isDistributed ? (
                          <Badge className="font-medium">
                            Distributed on {item.rewardedAt ? formatDate(item.rewardedAt) : "N/A"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="font-medium">
                            Pending
                          </Badge>
                        )}
                        {item.isDistributed && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                let rewardData: QuarterRewardData[] = []

                                if (item.data) {
                                  try {
                                    const rawData = item.data as unknown
                                    rewardData = quarterRewardDataSchema.array().parse(rawData)
                                  } catch (parseError) {
                                    console.error("Error parsing reward data:", parseError)
                                    toast.error("Invalid reward data format")
                                    return
                                  }
                                }

                                if (rewardData.length === 0) {
                                  toast.error("No reward data available for download")
                                  return
                                }

                                const nonBlockedData = rewardData.filter((user) => !isUserBlocked(user.accountId))
                                await generateQuarterRewardPDF(item, nonBlockedData)
                                toast.success("PDF downloaded successfully")
                              } catch (error) {
                                console.error("Error generating PDF:", error)
                                toast.error("Failed to generate PDF")
                              }
                            }}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            PDF
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="rounded-lg border bg-card p-3">

                        <div className="rounded-lg border bg-card p-3">
                          <div className="text-sm font-medium text-muted-foreground">Distributed Amount</div>
                          <div className="mt-1 text-2xl font-bold">
                            {
                              item.data
                                ? (() => {
                                  try {
                                    const parsedData = quarterRewardDataSchema.array().parse(item.data)
                                    return formatNumber(
                                      parsedData.reduce((sum, user) => sum + (user.action / 1000), 0),
                                      2,
                                    )
                                  } catch {
                                    return "N/A"
                                  }
                                })()
                                : "N/A"
                            }
                          </div>
                        </div>
                        <div className="rounded-lg border bg-card p-3">
                          <div className="text-sm font-medium text-muted-foreground">Last Updated</div>
                          <div className="mt-1 text-sm">{formatDate(item.lastUpdatedAt)}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-md border bg-card/50 p-8 text-center shadow-sm">
              <div className="mb-4 rounded-full bg-muted p-3">
                <History className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No history found</h3>
              <p className="mt-1 text-sm text-muted-foreground">There is no distribution history available.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="blocked" className="mt-6">
          {/* Block reason dialog */}
          <Dialog open={isBlockReasonDialogOpen} onOpenChange={setIsBlockReasonDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Block User</DialogTitle>
                <DialogDescription>Enter a reason for blocking this user from receiving rewards.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="wallet" className="text-right">
                    Wallet
                  </Label>
                  <div className="col-span-3 font-mono text-xs truncate">{selectedUserForBlock}</div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="reason" className="text-right">
                    Reason
                  </Label>
                  <Input
                    id="reason"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    className="col-span-3"
                    placeholder="Optional reason"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsBlockReasonDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleBlockUser} disabled={blockUser.isLoading}>
                  {blockUser.isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Blocking...
                    </>
                  ) : (
                    "Block User"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {!reward?.data ? (
            <TableSkeleton />
          ) : (
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Manage which users can receive rewards. Blocked users are excluded from distribution calculations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search by wallet address..."
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-semibold">Wallet Address</TableHead>
                        <TableHead className="font-semibold text-center">Actions</TableHead>
                        <TableHead className="font-semibold text-center">Reward Ratio</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="text-right font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reward.data && reward.data.length > 0 ? (
                        reward.data
                          .filter(
                            (user: QuarterRewardData) =>
                              !searchQuery.trim() || user.accountId.toLowerCase().includes(searchQuery.toLowerCase()),
                          )
                          .map((row: QuarterRewardData, index: number) => {
                            const isBlocked = isUserBlocked(row.accountId)
                            const blockedInfo = isBlocked ? getBlockedUserInfo(row.accountId) : null

                            return (
                              <TableRow
                                key={index}
                                className={`transition-colors hover:bg-muted/50 ${index % 2 === 0 ? "bg-white" : "bg-muted/20"
                                  }`}
                              >
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <TableCell className="max-w-[200px] truncate font-mono text-xs">
                                        <div className="flex items-center gap-1">
                                          <span className="truncate">{row.accountId}</span>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => copyToClipboard(row.accountId)}
                                          >
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="font-mono text-xs">{row.accountId}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TableCell className="text-center font-medium">{formatNumber(row.action, 0)}</TableCell>
                                <TableCell className="text-center font-medium">{formatNumber(row.action / 1000)}</TableCell>
                                <TableCell>
                                  {isBlocked ? (
                                    <Badge variant="destructive" className="font-medium">
                                      Blocked
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 font-medium">
                                      Active
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    {isBlocked ? (
                                      <div className="flex items-center gap-2">
                                        <div className="text-xs text-muted-foreground">
                                          {blockedInfo?.reason && `Reason: ${blockedInfo.reason}`}
                                        </div>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => unblockUser.mutate({ id: blockedInfo?.id ?? "" })}
                                          disabled={unblockUser.isLoading}
                                          className="h-8"
                                        >
                                          {unblockUser.isLoading ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <>
                                              <Check className="mr-1 h-3 w-3" />
                                              Unblock
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedUserForBlock(row.accountId)
                                          setIsBlockReasonDialogOpen(true)
                                        }}
                                        className="h-8"
                                      >
                                        <Ban className="mr-1 h-3 w-3" />
                                        Block
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center">
                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                              <Search className="mb-2 h-6 w-6" />
                              <p>No users found</p>
                              {searchQuery && (
                                <p className="text-sm">Try a different search term or clear the search</p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}

export function YearQuarterSelect() {
  const { setReward, reward, setCurrentReward } = useQuarterStore()

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
        <div className="w-full sm:w-[240px]">
          <Skeleton className="h-10 w-full" />
        </div>
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

async function generateQuarterRewardPDF(rewardData: QuarterReward, holders: {
  accountId: string;
  action: number;
}[]) {
  const doc = new jsPDF()

  // Set up the document
  const pageWidth = doc.internal.pageSize.width
  const margin = 20

  // Title
  doc.setFontSize(20)
  doc.setFont("helvetica", "bold")
  doc.text("Quarter Rewards Distribution Report", pageWidth / 2, 30, { align: "center" })

  // Subtitle
  doc.setFontSize(14)
  doc.setFont("helvetica", "normal")
  doc.text(`Period: ${getYearQuarter(rewardData)}`, pageWidth / 2, 45, { align: "center" })

  // Distribution Information
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text("Distribution Summary", margin, 65)

  doc.setFont("helvetica", "normal")
  const summaryData = [
    ["Distributed Amount:", rewardData.distributedAmount ? formatNumber(rewardData.distributedAmount) : "N/A"],
    ["Distribution Status:", rewardData.isDistributed ? "Completed" : "Pending"],
    ["Distribution Date:", rewardData.rewardedAt ? formatDate(rewardData.rewardedAt) : "N/A"],
    ["Last Updated:", formatDate(rewardData.lastUpdatedAt)],
    ["Total Recipients:", holders.length.toString()],
  ]

  let yPosition = 75
  summaryData.forEach(([label, value]) => {
    doc.text(label ?? "", margin, yPosition)
    doc.text(value ?? "", margin + 80, yPosition)
    yPosition += 8
  })

  // Calculate total actions for percentage calculation
  const totalActions = holders.reduce((sum, holder) => sum + holder.action, 0)

  // Sort holders by actions (descending)
  const sortedHolders = holders
    .sort((a, b) => b.action - a.action)
    .map((holder, index) => {
      const percentage = totalActions > 0 ? ((holder.action / totalActions) * 100).toFixed(2) : "0.00"

      const row = [
        (index + 1).toString(),
        truncateAddress(holder.accountId),
        formatNumber(holder.action, 0),
        `${percentage}%`,
        formatNumber(holder.action / 1000, 0),
      ]


      return row
    })

  // Prepare table headers
  const headers = ["Rank", "Wallet Address", "Actions", "Share %", "Distributed Amount"]



  // Rewards Table
  autoTable(doc, {
    head: [headers],
    body: sortedHolders,
    startY: yPosition + 15,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [71, 85, 105], // slate-600
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 15 }, // Rank
      1: { halign: "left", cellWidth: 35 }, // Wallet Address
      2: { halign: "right", cellWidth: 25 }, // Actions
      4: { halign: "right", cellWidth: 20 }, // Share %
      5: { halign: "right", cellWidth: 30 }, // Distributed Amount (if present)
    },
    margin: { left: margin, right: margin },
  })

  // Footer
  const finalY = ((doc as unknown) as {
    lastAutoTable: { finalY: number };
  }).lastAutoTable.finalY || yPosition + 100
  doc.setFontSize(8)
  doc.setFont("helvetica", "italic")
  doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, finalY + 20, { align: "center" })



  // Add page numbers if multiple pages
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, doc.internal.pageSize.height - 10, { align: "right" })
  }

  // Save the PDF
  const fileName = `quarter-rewards-${getYearQuarter(rewardData)}.pdf`
  doc.save(fileName)
}

function formatNumber(num: number, decimals = 4): string {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date
  return dateObj.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function truncateAddress(address: string, startChars = 8, endChars = 6): string {
  if (address.length <= startChars + endChars) {
    return address
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}
