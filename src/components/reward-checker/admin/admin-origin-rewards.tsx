"use client"

import { useMutation } from "@tanstack/react-query"
import {
  Award,
  Ban,
  Calendar,
  Check,
  Copy,
  ExternalLink,
  History,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  Shield,
} from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/shadcn/ui/table"
import { getPlotsByHolder, type HolderWithPlots } from "~/lib/stellar/action-token/script"

import { AnimatePresence, motion } from "framer-motion"
import toast from "react-hot-toast"
import { Badge } from "~/components/shadcn/ui/badge"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { api } from "~/utils/api"
import { useRewardStore } from "../store"
import { YearMonthSelect } from "../year-month-select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { useState, useEffect } from "react"
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
import { format } from "date-fns"
import { useMemo } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/shadcn/ui/tooltip"

function TableSkeleton({ rows = 5 }: { rows?: number }) {
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
                <Skeleton className="h-5 w-24" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-5 w-20" />
              </TableHead>
              <TableHead className="text-right">
                <Skeleton className="ml-auto h-5 w-16" />
              </TableHead>
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
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-10" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-5 w-14" />
                  </TableCell>
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

function UserManagementSkeleton() {
  return (
    <Card className="bg-card/50">
      <CardHeader>
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>
                  <Skeleton className="h-5 w-32" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-5 w-28" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-5 w-24" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-5 w-20" />
                </TableHead>
                <TableHead>
                  <Skeleton className="ml-auto h-5 w-24" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array(5)
                .fill(0)
                .map((_, index) => (
                  <TableRow key={index} className={index % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                    <TableCell>
                      <Skeleton className="h-5 w-36" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-10" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-8 w-20" />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminOriginRewards() {
  const assetsFetch = useMutation(() => getPlotsByHolder(), {
    onSuccess: (data) => {
      console.log("data", data)
      addData.mutate({ data })
    },
  })

  const { isOpen, setIsOpen, setSelectedRow, reward, currentReward } = useRewardStore()
  const [activeTab, setActiveTab] = useState("current")
  const [balanceAmount, setBalanceAmount] = useState("")
  const [isSettingBalance, setIsSettingBalance] = useState(false)
  const [blockReason, setBlockReason] = useState("")
  const [showBlockedUsers, setShowBlockedUsers] = useState(false)
  const [selectedUserForBlock, setSelectedUserForBlock] = useState<string | null>(null)
  const [isBlockReasonDialogOpen, setIsBlockReasonDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredUsers, setFilteredUsers] = useState<HolderWithPlots[]>([])

  const admin = api.wallate.admin.checkAdmin.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  })

  const addData = api.action.checker.addOriginRewardData.useMutation({
    onSuccess: () => {
      toast.success("Data added successfully")
    },
    onError: (error) => {
      toast.error("Error adding data")
      console.error("Error adding data", error)
    },
  })

  // New API calls for the updated features
  const rewardHistory = api.action.checker.getOriginRewardHistory.useQuery(undefined, {
    refetchOnWindowFocus: false,
  })

  const blockedUsers = api.action.checker.getBlockedUsers.useQuery(undefined, {
    refetchOnWindowFocus: false,
    enabled: showBlockedUsers || activeTab === "blocked",
  })

  const setBalance = api.action.checker.setOriginRewardBalance.useMutation({
    onSuccess: () => {
      toast.success("Balance set successfully")
      setIsSettingBalance(false)
      setBalanceAmount("")
      rewardHistory.refetch()
    },
    onError: (error) => {
      toast.error("Error setting balance")
      console.error("Error setting balance", error)
    },
  })

  const distributeRewards = api.action.checker.distributeOriginRewards.useMutation({
    onSuccess: () => {
      toast.success("Rewards distributed successfully")
      rewardHistory.refetch()
    },
    onError: (error) => {
      toast.error("Error distributing rewards")
      console.error("Error distributing rewards", error)
    },
  })

  const blockUser = api.action.checker.blockUser.useMutation({
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

  const unblockUser = api.action.checker.unblockUser.useMutation({
    onSuccess: () => {
      toast.success("User unblocked successfully")
      blockedUsers.refetch()
    },
    onError: (error) => {
      toast.error("Error unblocking user")
      console.error("Error unblocking user", error)
    },
  })

  // Filter users based on search query
  useEffect(() => {
    if (!reward?.data) {
      setFilteredUsers([])
      return
    }

    if (!searchQuery.trim()) {
      setFilteredUsers(reward.data)
      return
    }

    const filtered = reward.data.filter((user) => user.pubkey.toLowerCase().includes(searchQuery.toLowerCase()))
    setFilteredUsers(filtered)
  }, [searchQuery, reward?.data])

  function handleRowClick(row: HolderWithPlots): void {
    setSelectedRow(row)
    setIsOpen(true)
  }

  function handleSetBalance() {
    if (!balanceAmount || isNaN(Number.parseFloat(balanceAmount)) || Number.parseFloat(balanceAmount) <= 0) {
      toast.error("Please enter a valid balance amount")
      return
    }

    setBalance.mutate({
      monthYear: reward?.date ?? currentReward?.date ?? format(new Date(), "yyyy-MM"),
      amount: Number.parseFloat(balanceAmount),
    })
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

  function handleDistributeRewards() {
    if (!reward?.date) {
      toast.error("No reward period selected")
      return
    }

    distributeRewards.mutate({
      monthYear: reward.date,
    })
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

  // Check if previous month is distributed
  const canDistributeCurrent = useMemo(() => {
    if (!rewardHistory.data || rewardHistory.data.length === 0) return true

    const currentMonthIndex = rewardHistory.data.findIndex((r) => r.monthYear === reward?.date)
    if (currentMonthIndex <= 0) return true

    // Check if previous month is distributed
    return !!rewardHistory.data[currentMonthIndex - 1]?.isDistributed
  }, [rewardHistory.data, reward?.date])

  // Get current month reward info
  const currentMonthInfo = useMemo(() => {
    if (!rewardHistory.data || !reward?.date) return null
    return rewardHistory.data.find((r) => r.monthYear === reward.date)
  }, [rewardHistory.data, reward?.date])

  // Check if a user is blocked
  const isUserBlocked = (walletAddress: string) => {
    return blockedUsers.data?.some((user) => user.walletAddress === walletAddress)
  }

  // Get blocked user info
  const getBlockedUserInfo = (walletAddress: string) => {
    return blockedUsers.data?.find((user) => user.walletAddress === walletAddress)
  }

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
                    <TabsTrigger
                      value="blocked"
                      className="flex items-center gap-2"
                      onClick={() => setShowBlockedUsers(true)}
                    >
                      <Shield className="h-4 w-4" />
                      <span>User Management</span>
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {activeTab === "current" && (
                  <>
                    <YearMonthSelect />
                    <div className="flex gap-2">
                      {currentReward?.date === reward?.date ? (
                        <Button
                          variant="outline"
                          onClick={() => assetsFetch.mutate()}
                          className="flex items-center gap-2"
                          size="sm"
                        >
                          {assetsFetch.isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          Sync Data
                        </Button>
                      ) : (
                        <Button variant="outline" className="flex items-center gap-2" size="sm">
                          <ExternalLink className="h-4 w-4" />
                          Download
                        </Button>
                      )}
                    </div>
                  </>
                )}
                {admin.data?.id && activeTab === "current" && (
                  <Dialog open={isSettingBalance} onOpenChange={setIsSettingBalance}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Set Balance
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Set Distributable Balance</DialogTitle>
                        <DialogDescription>
                          Set the total distributable balance for {reward?.date ?? "current month"}.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="balance" className="text-right">
                            Balance
                          </Label>
                          <Input
                            id="balance"
                            type="number"
                            step="0.01"
                            min="0"
                            value={balanceAmount}
                            onChange={(e) => setBalanceAmount(e.target.value)}
                            className="col-span-3"
                            placeholder="Enter amount"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleSetBalance} disabled={setBalance.isLoading}>
                          {setBalance.isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Setting...
                            </>
                          ) : (
                            "Set Balance"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <TabsContent value="current" className="mt-6">
          {currentMonthInfo && (
            <Card className="mb-6 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Distribution Information</CardTitle>
                <CardDescription>Current month distribution details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border bg-card p-3">
                    <div className="text-sm font-medium text-muted-foreground">Total Balance</div>
                    <div className="mt-1 text-2xl font-bold">{formatNumber(currentMonthInfo.totalBalance)}</div>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="text-sm font-medium text-muted-foreground">Status</div>
                    <div className="mt-1">
                      {currentMonthInfo.isDistributed ? (
                        <Badge className="font-medium">
                          Distributed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-medium">
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="text-sm font-medium text-muted-foreground">Last Updated</div>
                    <div className="mt-1 text-sm">{formatDate(currentMonthInfo.lastUpdatedAt)}</div>
                  </div>
                </div>
              </CardContent>
              {admin.data?.id && !currentMonthInfo.isDistributed && (
                <CardFooter>
                  <Button
                    onClick={handleDistributeRewards}
                    disabled={distributeRewards.isLoading || !canDistributeCurrent}
                    className="flex items-center gap-2"
                  >
                    {distributeRewards.isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Award className="h-4 w-4" />
                    )}
                    Distribute Rewards
                    {!canDistributeCurrent && " (Previous month not distributed)"}
                  </Button>
                </CardFooter>
              )}
            </Card>
          )}

          <AnimatePresence>
            {!reward?.data ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {rewardHistory.isLoading ? <DistributionInfoSkeleton /> : null}
                <TableSkeleton />
              </motion.div>
            ) : reward.data.length > 0 ? (
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
                        <TableHead className="font-semibold">Plot Token Amount</TableHead>
                        <TableHead className="font-semibold">Plot NFT Count</TableHead>
                        <TableHead className="text-right font-semibold">Total Reward</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reward.data
                        .sort((a, b) => b.plotBal * b.plots.length - a.plotBal * a.plots.length)
                        .map((row, index) => (
                          <TableRow
                            key={index}
                            onClick={() => handleRowClick(row)}
                            className={`cursor-pointer transition-colors hover:bg-muted/50 ${index % 2 === 0 ? "bg-white" : "bg-muted/20"
                              }`}
                          >
                            <TableCell className="font-medium">{index + 1}</TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <TableCell className="max-w-[200px] truncate font-mono text-xs">
                                    <div className="flex items-center gap-1">
                                      <span className="truncate">{row.pubkey}</span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(row.pubkey)
                                        }}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-mono text-xs">{row.pubkey}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TableCell className="text-right font-medium">{formatNumber(row.plotBal)}</TableCell>
                            <TableCell className="text-center">{row.plots.length}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className="font-medium">
                                {formatNumber(row.plotBal * row.plots.length)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center rounded-md border bg-card/50 p-8 text-center shadow-sm"
              >
                <div className="mb-4 rounded-full bg-muted p-3">
                  <Award className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">No reward data found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  There is no reward data available for the selected period.
                </p>
              </motion.div>
            )}
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
                      <CardTitle className="text-lg">{item.monthYear}</CardTitle>
                      {item.isDistributed ? (
                        <Badge className="font-medium">
                          Distributed on {item.rewardedAt ? formatDate(item.rewardedAt) : "N/A"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-medium">
                          Pending
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="rounded-lg border bg-card p-3">
                        <div className="text-sm font-medium text-muted-foreground">Total Balance</div>
                        <div className="mt-1 text-2xl font-bold">{formatNumber(item.totalBalance)}</div>
                      </div>
                      <div className="rounded-lg border bg-card p-3">
                        <div className="text-sm font-medium text-muted-foreground">Distributed Amount</div>
                        <div className="mt-1 text-2xl font-bold">
                          {item.distributedAmount ? formatNumber(item.distributedAmount) : "-"}
                        </div>
                      </div>
                      <div className="rounded-lg border bg-card p-3">
                        <div className="text-sm font-medium text-muted-foreground">Last Updated</div>
                        <div className="mt-1 text-sm">{formatDate(item.lastUpdatedAt)}</div>
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
            <UserManagementSkeleton />
          ) : (
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage which users can receive rewards</CardDescription>
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
                        <TableHead className="font-semibold">Plot Token Amount</TableHead>
                        <TableHead className="font-semibold">Plot NFT Count</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="text-right font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((row, index) => {
                          const isBlocked = isUserBlocked(row.pubkey)
                          const blockedInfo = isBlocked ? getBlockedUserInfo(row.pubkey) : null

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
                                        <span className="truncate">{row.pubkey}</span>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => copyToClipboard(row.pubkey)}
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-mono text-xs">{row.pubkey}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TableCell className="text-right font-medium">{formatNumber(row.plotBal)}</TableCell>
                              <TableCell className="text-center">{row.plots.length}</TableCell>
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
                                        setSelectedUserForBlock(row.pubkey)
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

function GiftAction() {
  const { reward } = useRewardStore()

  if (reward?.rewardedAt) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-green-700 shadow-sm">
        <Award className="h-4 w-4" />
        <span className="text-sm font-medium">Rewarded on: {reward.rewardedAt.toLocaleDateString()}</span>
      </div>
    )
  }

  if (reward && !reward.rewardedAt) {
    return (
      <Button size="sm" className="flex items-center gap-2">
        <Award className="h-4 w-4" />
        Distribute Rewards
      </Button>
    )
  }

  return null
}
