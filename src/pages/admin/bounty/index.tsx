"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Database,
  Loader2,
  RefreshCw,
  Shield,
  Timer,
} from "lucide-react"

import { clientsign, WalletType } from "package/connect_wallet"
import { submitSignedXDRToServer4User } from "package/connect_wallet/src/lib/stellar/trx/payment_fb_g"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/shadcn/ui/table"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { api } from "~/utils/api"
import AdminLayout from "~/components/layout/root/AdminLayout"

const DAY_IN_LEDGERS = 17280

function formatTTL(remainingLedgers: number | undefined) {
  if (remainingLedgers === undefined || remainingLedgers === null) return "Unknown"
  if (remainingLedgers <= 0) return "Expired"
  const days = remainingLedgers / DAY_IN_LEDGERS
  return `${Math.max(0, Math.floor(days))} days`
}

function ttlBadgeClass(remainingLedgers: number | undefined) {
  if (remainingLedgers === undefined || remainingLedgers === null) return "bg-secondary text-secondary-foreground"
  if (remainingLedgers <= 0) return "bg-destructive text-destructive-foreground"
  if (remainingLedgers < DAY_IN_LEDGERS * 30) return "bg-amber-500 text-white"
  return "bg-emerald-500 text-white"
}

function LoadingCard() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  )
}

export default function AdminBountyTTL() {
  const router = useRouter()
  const utils = api.useContext()
  const admin = api.wallate.admin.checkAdmin.useQuery()

  const [extendingBountyId, setExtendingBountyId] = useState<string | null>(null)
  const [extendingWinnerId, setExtendingWinnerId] = useState<string | null>(null)
  const [extendingInstance, setExtendingInstance] = useState(false)

  const instanceTTL = api.bounty.Bounty.getAdminContractInstanceTTL.useQuery()
  const bountyList = api.bounty.Bounty.getAdminBountyList.useQuery({ limit: 50 })

  const bountyIds = bountyList.data?.items.map((b) => b.id) ?? []

  const bountyTTLs = api.useQueries((t) =>
    bountyIds.map((id) =>
      t.bounty.Bounty.getAdminBountyTTL({ bountyId: id }, { staleTime: 30_000 })
    )
  )

  const extendBountyXdr = api.bounty.Bounty.getAdminExtendBountyTTLXDR.useMutation()
  const extendWinnerXdr = api.bounty.Bounty.getAdminExtendWinnerAwardTTLXDR.useMutation()
  const extendInstanceXdr = api.bounty.Bounty.getAdminExtendInstanceTTLXDR.useMutation()

  async function signAndSubmit(xdr: string) {
    const result = await clientsign({
      presignedxdr: xdr,
      pubkey: "admin",
      walletType: WalletType.isAdmin,
    })

    // clientsign returns `false` when walletType/pubkey is missing or the
    // wallet refused to sign, and `undefined` for some wallet signing errors.
    if (!result) throw new Error("Signing failed")

    // For WalletType.isAdmin (and custodial/google/facebook/email flows),
    // clientsign already submits the XDR via submitSignedXDRToServer4User
    // and returns an object: { success: true, message: string, hash: string }.
    if (
      typeof result === "object" &&
      "success" in result &&
      result.success === true
    ) {
      return result as { success: true; message: string; hash: string }
    }

    throw new Error("Unexpected signing result")
  }

  async function handleExtendBounty(bountyId: string) {
    setExtendingBountyId(bountyId)
    const toastId = toast.loading("Building extend transaction...")
    try {
      const { xdr } = await extendBountyXdr.mutateAsync({ bountyId })
      toast.loading("Signing with admin wallet...", { id: toastId })
      const result = await signAndSubmit(xdr)
      if (result) {
        toast.success("Bounty TTL extended", { id: toastId })
        await utils.bounty.Bounty.getAdminBountyTTL.invalidate({ bountyId })
      } else {
        toast.error("Transaction submission failed", { id: toastId })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error"
      toast.error(message, { id: toastId })
    } finally {
      setExtendingBountyId(null)
    }
  }

  async function handleExtendWinner(bountyId: string, winnerId: string) {
    setExtendingWinnerId(winnerId)
    const toastId = toast.loading("Building winner award extend transaction...")
    try {
      const { xdr } = await extendWinnerXdr.mutateAsync({ bountyId, winnerId })
      toast.loading("Signing with admin wallet...", { id: toastId })
      const result = await signAndSubmit(xdr)
      if (result) {
        toast.success("Winner award TTL extended", { id: toastId })
      } else {
        toast.error("Transaction submission failed", { id: toastId })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error"
      toast.error(message, { id: toastId })
    } finally {
      setExtendingWinnerId(null)
    }
  }

  async function handleExtendInstance() {
    setExtendingInstance(true)
    const toastId = toast.loading("Building instance extend transaction...")
    try {
      const { xdr } = await extendInstanceXdr.mutateAsync()
      toast.loading("Signing with admin wallet...", { id: toastId })
      const result = await signAndSubmit(xdr)
      if (result) {
        toast.success("Contract instance TTL extended", { id: toastId })
        await utils.bounty.Bounty.getAdminContractInstanceTTL.invalidate()
      } else {
        toast.error("Transaction submission failed", { id: toastId })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error"
      toast.error(message, { id: toastId })
    } finally {
      setExtendingInstance(false)
    }
  }

  if (admin.isLoading) {
    return (
      <AdminLayout>
        <div className="container mx-auto py-8 px-4">
          <LoadingCard />
        </div>
      </AdminLayout>
    )
  }

  if (!admin.data) {
    return (
      <AdminLayout>
        <div className="container mx-auto py-8 px-4">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Shield className="h-5 w-5" />
                Access Denied
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">You do not have permission to view this page.</p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="container mx-auto min-h-screen py-8 px-4 space-y-8">
        <div className="flex flex-col space-y-2 max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold tracking-tight">Bounty Escrow TTL</h1>
          <p className="text-muted-foreground text-lg">
            Monitor and extend the on-chain lifetime of the bounty escrow contract and its data.
          </p>
        </div>

        <Card className="shadow-md">
          <CardHeader className="border-b bg-muted/40">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Database className="h-6 w-6 text-primary" />
              Contract Instance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {instanceTTL.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : instanceTTL.error ? (
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <span>Could not read contract instance TTL.</span>
              </div>
            ) : instanceTTL.data ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarClock className="h-4 w-4" />
                    <span>Live until ledger</span>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {instanceTTL.data.liveUntilLedger}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span className="text-lg font-medium">
                      {formatTTL(instanceTTL.data.remainingLedgers)} remaining
                    </span>
                    <Badge className={ttlBadgeClass(instanceTTL.data.remainingLedgers)}>
                      {instanceTTL.data.remainingLedgers <= 0
                        ? "Expired"
                        : instanceTTL.data.remainingLedgers < DAY_IN_LEDGERS * 30
                          ? "Needs attention"
                          : "Healthy"}
                    </Badge>
                  </div>
                </div>
                <Button
                  onClick={handleExtendInstance}
                  disabled={extendingInstance}
                  className="min-w-[160px]"
                >
                  {extendingInstance ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Timer className="mr-2 h-4 w-4" />
                  )}
                  Extend Instance
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="h-5 w-5" />
                <span>Contract instance entry not found on-chain.</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="border-b bg-muted/40">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">Bounty Entries</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void bountyList.refetch()
                  void instanceTTL.refetch()
                }}
                disabled={bountyList.isRefetching}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${bountyList.isRefetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {bountyList.isLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : bountyList.data?.items.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <CheckCircle2 className="mx-auto h-10 w-10 mb-3 text-muted-foreground/60" />
                <p>No bounties found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">ID</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Creator</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>TTL</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bountyList.data?.items.map((bounty, idx) => {
                      const ttlQuery = bountyTTLs[idx]
                      const remaining = ttlQuery?.data?.remainingLedgers
                      return (
                        <TableRow key={bounty.id}>
                          <TableCell className="font-medium">{bounty.id}</TableCell>
                          <TableCell className="max-w-xs truncate">{bounty.title}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {bounty.user.name ?? bounty.user.id.slice(0, 8)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{bounty.status}</Badge>
                          </TableCell>
                          <TableCell>
                            {ttlQuery?.isLoading ? (
                              <Skeleton className="h-4 w-20" />
                            ) : ttlQuery?.error ? (
                              <span className="text-muted-foreground text-sm">Unavailable</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{formatTTL(remaining)}</span>
                                <Badge className={ttlBadgeClass(remaining)}>
                                  {remaining === undefined
                                    ? "Unknown"
                                    : remaining <= 0
                                      ? "Expired"
                                      : remaining < DAY_IN_LEDGERS * 30
                                        ? "Short"
                                        : "OK"}
                                </Badge>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleExtendBounty(bounty.id)}
                                disabled={extendingBountyId === bounty.id}
                              >
                                {extendingBountyId === bounty.id ? (
                                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                ) : (
                                  <Timer className="mr-2 h-3 w-3" />
                                )}
                                Extend
                              </Button>
                              {bounty.winners.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleExtendWinner(bounty.id, bounty.winners[0]!.userId)}
                                  disabled={extendingWinnerId === bounty.winners[0]!.userId}
                                >
                                  {extendingWinnerId === bounty.winners[0]!.userId ? (
                                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                  ) : (
                                    <CalendarClock className="mr-2 h-3 w-3" />
                                  )}
                                  Award
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
