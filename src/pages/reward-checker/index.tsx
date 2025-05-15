"use client"

import { useMutation } from "@tanstack/react-query"
import {
    ChevronRight,
    Loader2,
    Search,
    Wallet,
    Award,
    BarChart3,
    RefreshCw,
    Info,
    Copy,
    ExternalLink,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useDebounce } from "~/hooks/use-debounce"
import { Button } from "~/components/shadcn/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "~/components/shadcn/ui/dialog"
import { Input } from "~/components/shadcn/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/shadcn/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { NftHolder, server } from "~/lib/stellar/action-token"
import { getPlotsByHolder, type HolderWithPlots, holderWithPlotsSchema } from "~/lib/stellar/action-token/script"
import { StellarAccount } from "~/lib/stellar/marketplace/test/Account"

import toast from "react-hot-toast"
import { create } from "zustand"
import { api } from "~/utils/api"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/shadcn/ui/select"
import { QuarterRewards } from "~/components/reward-checker/quarter"
import { Badge } from "~/components/shadcn/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { Avatar, AvatarFallback } from "~/components/shadcn/ui/avatar"

interface AppState {
    isOpen: boolean
    selectedRow?: HolderWithPlots
    setIsOpen: (value: boolean) => void
    setSelectedRow: (row: HolderWithPlots) => void
    reward?: { date: string; rewardedAt?: Date; data: HolderWithPlots[] }
    setReward: (value?: {
        date: string
        rewardedAt?: Date
        data: HolderWithPlots[]
    }) => void
    currentReward?: { date: string; data: HolderWithPlots[] }
    setCurrentReward: (value: { date: string; data: HolderWithPlots[] }) => void
}

const useStore = create<AppState>((set) => ({
    isOpen: false,
    setIsOpen: (value) => set({ isOpen: value }),
    setSelectedRow: (row) => set({ selectedRow: row }),
    setReward: (value) => set({ reward: value }),
    setCurrentReward: (value) => set({ currentReward: value }),
}))

function UserDialog() {
    const { setSelectedRow, selectedRow, isOpen, setIsOpen } = useStore()

    if (!selectedRow) return null

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success("Copied to clipboard")
    }
    const totalReward = selectedRow.plotBal * selectedRow.plots.length

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Info className="h-5 w-5 text-primary" />
                        Account Details
                    </DialogTitle>
                    <DialogDescription>Detailed information about this account and its assets.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    {/* Account Info */}
                    <div className="rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                            <div className="font-medium text-sm text-muted-foreground">Public Key</div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => copyToClipboard(selectedRow.pubkey)}
                                    title="Copy to clipboard"
                                >
                                    <Copy className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() =>
                                        window.open(`https://stellar.expert/explorer/public/account/${selectedRow.pubkey}`, "_blank")
                                    }
                                    title="View on Stellar Explorer"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                        <div className="mt-1 break-all text-sm">{selectedRow.pubkey}</div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="p-3">
                                <CardTitle className="text-sm">Plot Balance</CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 pt-0">
                                <div className="text-2xl font-bold">{selectedRow.plotBal}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="p-3">
                                <CardTitle className="text-sm">Plot Count</CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 pt-0">
                                <div className="text-2xl font-bold">{selectedRow.plots.length}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="p-3">
                                <CardTitle className="text-sm">Total Reward</CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 pt-0">
                                <div className="text-2xl font-bold text-primary">{totalReward.toFixed(2)}</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Plot NFTs */}
                    {selectedRow.plots.length > 0 && (
                        <div className="space-y-2">
                            <div className="font-medium flex items-center justify-between">
                                <span>Plot NFTs</span>
                                <Badge variant="outline">{selectedRow.plots.length} plots</Badge>
                            </div>

                            {selectedRow.plots.length <= 10 ? (
                                <div className="max-h-60 overflow-y-auto rounded-md border p-2">
                                    {selectedRow.plots.map((plot, index) => {
                                        // Handle different plot data formats
                                        let plotDetails;
                                        if (typeof plot === "object" && plot !== null) {
                                            // For object format (with asset_code, asset_issuer, balance)
                                            plotDetails = (
                                                <div className="space-y-1 text-sm">
                                                    <div className="flex justify-start items-center gap-2">
                                                        <span className="text-muted-foreground">Code:</span>
                                                        <span className="font-medium">{plot.asset_code}</span>
                                                    </div>
                                                    <div className="flex justify-start items-center gap-2">
                                                        <span className="text-muted-foreground">Issuer:</span>
                                                        <span className="font-mono text-xs truncate ">{plot.asset_issuer}</span>
                                                    </div>
                                                    <div className="flex justify-start items-center gap-2">
                                                        <span className="text-muted-foreground">Balance:</span>
                                                        <span>{plot.balance}</span>
                                                    </div>
                                                </div>
                                            );
                                        } else {
                                            // For string or other primitive values
                                            plotDetails = <Badge variant="outline">{String(plot)}</Badge>;
                                        }

                                        return (
                                            <div key={index} className={`py-2 px-1 border-b last:border-0  rounded-sm
                                                ${index % 2 === 0 ? "bg-secondary" : "bg-muted/5"}`}>

                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-medium">Plot #{index + 1}</span>
                                                </div>
                                                {plotDetails}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Plot #</TableHead>
                                                    <TableHead>Code</TableHead>
                                                    <TableHead>Issuer</TableHead>
                                                    <TableHead className="text-right">Balance</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody className="max-h-60 overflow-y-auto">
                                                {selectedRow.plots.slice(0, 50).map((plot, index) => {
                                                    // Handle different plot data formats
                                                    if (typeof plot === "object" && plot !== null && 'asset_code' in plot) {
                                                        return (
                                                            <TableRow key={index}>
                                                                <TableCell className="py-2">{index + 1}</TableCell>
                                                                <TableCell className="py-2">{plot.asset_code}</TableCell>
                                                                <TableCell className="py-2 font-mono text-xs truncate max-w-[200px]">
                                                                    {plot.asset_issuer}
                                                                </TableCell>
                                                                <TableCell className="py-2 text-right">{plot.balance}</TableCell>
                                                            </TableRow>
                                                        );
                                                    } else {
                                                        return (
                                                            <TableRow key={index}>
                                                                <TableCell className="py-2">{index + 1}</TableCell>
                                                                <TableCell className="py-2 font-mono text-xs" colSpan={3}>
                                                                    {String(plot)}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    }
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    {selectedRow.plots.length > 50 && (
                                        <div className="text-center text-sm text-muted-foreground">
                                            Showing 50 of {selectedRow.plots.length} plots
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <DialogFooter className="sm:justify-start">
                    <Button variant="secondary" onClick={() => setIsOpen(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function AssetChecker() {
    return (
        <div className="container mx-auto p-4 space-y-6 h-screen">
            <div className="flex flex-col space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Asset Checker</h1>
                <p className="text-muted-foreground">Check and manage your Stellar blockchain assets and rewards</p>
            </div>

            <Card>
                <CardContent className="p-6">
                    <Tabs defaultValue="checker" className="w-full">
                        <TabsList className="grid w-full grid-cols-4 mb-6">
                            <TabsTrigger value="checker" className="flex items-center gap-2">
                                <Wallet className="h-4 w-4" />
                                <span>Checker</span>
                            </TabsTrigger>
                            <TabsTrigger value="assetHolder" className="flex items-center gap-2">
                                <BarChart3 className="h-4 w-4" />
                                <span>Asset Holder</span>
                            </TabsTrigger>
                            <TabsTrigger value="originRewards" className="flex items-center gap-2">
                                <Award className="h-4 w-4" />
                                <span>Origin Rewards</span>
                            </TabsTrigger>
                            <TabsTrigger value="quarterRewards" className="flex items-center gap-2">
                                <Award className="h-4 w-4" />
                                <span>Quarter Rewards</span>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="checker" className="mt-0">
                            <Checker />
                        </TabsContent>

                        <TabsContent value="assetHolder" className="mt-0">
                            <AssetHolders />
                        </TabsContent>

                        <TabsContent value="originRewards" className="mt-0">
                            <OriginRewards />
                        </TabsContent>

                        <TabsContent value="quarterRewards" className="mt-0">
                            <QuarterRewards />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <UserDialog />
        </div>
    )
}

function Checker() {
    const [checkerSearch, setCheckerSearch] = useState("")
    const [tokens, setToken] = useState<
        {
            asset_code: string
            asset_issuer: string
            balance: string
        }[]
    >([])

    const wallet = useMutation(
        async () => {
            const acc = await StellarAccount.create(checkerSearch)
            return acc.getNfts()
        },
        {
            onSuccess: (data) => {
                setToken(data)
                if (data.length > 0) {
                    toast.success(`Found ${data.length} assets`)
                } else {
                    toast.error("No assets found for this wallet")
                }
            },
            onError: (error) => {
                console.error("Error fetching wallet data", error)
                toast.error("Failed to fetch wallet data")
            },
        },
    )

    const handleSearch = () => {
        if (!checkerSearch.trim()) {
            toast.error("Please enter a wallet address")
            return
        }
        wallet.mutate()
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <div className="flex flex-col space-y-4">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Search className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                        placeholder="Enter wallet address"
                        value={checkerSearch}
                        onChange={(e) => setCheckerSearch(e.target.value)}
                        className="pl-10"
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                </div>
                <Button
                    onClick={handleSearch}
                    disabled={wallet.isLoading || !checkerSearch.trim()}
                    className="w-full sm:w-auto self-end"
                >
                    {wallet.isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Searching...
                        </>
                    ) : (
                        "Search Wallet"
                    )}
                </Button>
            </div>

            <AnimatePresence>
                {wallet.isLoading ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                                <Skeleton className="h-12 w-12 rounded-full" />
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </motion.div>
                ) : tokens.length > 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="rounded-md border"
                    >
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Asset</TableHead>
                                    <TableHead>Asset Issuer</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tokens.map((row, index) => (
                                    <TableRow key={index} className="hover:bg-muted/50 transition-colors">
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback className="bg-primary/10 text-primary">
                                                        {row.asset_code.substring(0, 2)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {row.asset_code}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs truncate max-w-[200px]">{row.asset_issuer}</TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="outline">{row.balance}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </motion.div>
                ) : checkerSearch && !wallet.isLoading ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center p-8 text-center"
                    >
                        <div className="rounded-full bg-muted p-3 mb-4">
                            <Wallet className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium">No assets found</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            This wallet doesn{"'t"} have any assets or the address may be incorrect.
                        </p>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </motion.div>
    )
}

type AssetType = { code: string; issuer: string }

function AssetHolders() {
    const [assetHolderSearch, setAssetHolderSearch] = useState("")
    const [suggestions, setSuggestions] = useState<AssetType[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const debouncedSearch = useDebounce(assetHolderSearch, 300)

    const [holderData, setHolderData] = useState<{ pubkey: string; amount: number; rank: number }[]>([])

    const holder = useMutation(
        async () => {
            const [assetCode, assetIssuer] = assetHolderSearch.split("-")
            if (!assetCode || !assetIssuer) return
            const holder = await NftHolder.initiate({
                code: assetCode,
                issuer: assetIssuer,
            })
            return holder.getHolders()
        },
        {
            onSuccess: (data) => {
                if (data) {
                    setHolderData(data)
                    toast.success(`Found ${data.length} holders`)
                }
            },
            onError: () => {
                toast.error("Failed to fetch holder data")
            },
        },
    )

    function handleSearch() {
        if (!assetHolderSearch.includes("-")) {
            toast.error("Please select an asset from the suggestions")
            return
        }
        holder.mutate()
    }

    useEffect(() => {
        const fetchAssetSuggestions = async () => {
            if (debouncedSearch.length < 2) {
                setSuggestions([])
                return
            }

            setIsLoading(true)
            try {
                const data = await server.assets().forCode(debouncedSearch).limit(5).call()
                const assets = data.records.map((record) => ({
                    code: record.asset_code,
                    issuer: record.asset_issuer,
                }))
                setSuggestions(assets)
            } catch (error) {
                console.error("Error fetching asset suggestions:", error)
                setSuggestions([])
            } finally {
                setIsLoading(false)
            }
        }

        fetchAssetSuggestions()
    }, [debouncedSearch])

    function handleSuggestionClick(suggestion: AssetType): void {
        setSuggestions([])
        setAssetHolderSearch(`${suggestion.code}-${suggestion.issuer}`)
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <div className="flex flex-col space-y-4">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Search className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                        placeholder="Search for an asset (e.g. XLM, USDC)"
                        value={assetHolderSearch}
                        onChange={(e) => setAssetHolderSearch(e.target.value)}
                        className="pl-10"
                    />
                    {(suggestions.length > 0 || isLoading) && (
                        <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-lg">
                            {isLoading ? (
                                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Searching assets...
                                </div>
                            ) : (
                                suggestions.map((suggestion, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.15, delay: index * 0.05 }}
                                        className="flex cursor-pointer items-center justify-between p-3 hover:bg-muted transition-colors"
                                        onClick={() => handleSuggestionClick(suggestion)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback className="bg-primary/10 text-primary">
                                                    {suggestion.code.substring(0, 2)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="font-medium">{suggestion.code}</div>
                                                <div className="text-xs text-muted-foreground truncate max-w-[300px]">{suggestion.issuer}</div>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </motion.div>
                                ))
                            )}
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setAssetHolderSearch("")}
                        disabled={!assetHolderSearch || holder.isLoading}
                    >
                        Clear
                    </Button>
                    <Button onClick={handleSearch} disabled={holder.isLoading || !assetHolderSearch.includes("-")}>
                        {holder.isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Searching...
                            </>
                        ) : (
                            "Find Holders"
                        )}
                    </Button>
                </div>
            </div>

            <AnimatePresence>
                {holder.isLoading ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                        {[1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </motion.div>
                ) : holderData.length > 0 ? (
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
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {holderData.map((row, index) => (
                                    <TableRow key={index} className="hover:bg-muted/50 transition-colors">
                                        <TableCell className="font-medium">{index + 1}</TableCell>
                                        <TableCell className="font-mono text-xs truncate max-w-[300px]">{row.pubkey}</TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="outline">{row.amount}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </motion.div>
                ) : assetHolderSearch.includes("-") && !holder.isLoading ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center p-8 text-center"
                    >
                        <div className="rounded-full bg-muted p-3 mb-4">
                            <BarChart3 className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium">No holders found</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            This asset doesn{"'t"} have any holders or the asset information may be incorrect.
                        </p>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </motion.div>
    )
}

function OriginRewards() {
    const assetsFetch = useMutation(() => getPlotsByHolder(), {
        onSuccess: (data) => {
            console.log("data", data)
            addData.mutate({ data })
        },
    })

    const { isOpen, setIsOpen, setSelectedRow, reward, currentReward } = useStore()
    const admin = api.wallate.admin.checkAdmin.useQuery(undefined, {
        refetchOnWindowFocus: false,
    });
    const addData = api.action.checker.addOriginRewardData.useMutation({
        onSuccess: () => {
            toast.success("Data added successfully")
        },
        onError: (error) => {
            toast.error("Error adding data")
            console.error("Error adding data", error)
        },
    })

    function handleRowClick(row: HolderWithPlots): void {
        setSelectedRow(row)
        setIsOpen(true)
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <YearMonthSelect />
                    <div className="flex gap-2">
                        {currentReward?.date === reward?.date ? (
                            <Button variant="outline" onClick={() => assetsFetch.mutate()} className="flex items-center gap-2">
                                {assetsFetch.isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-4 w-4" />
                                )}
                                Sync Data
                            </Button>
                        ) : (
                            <Button variant="outline" className="flex items-center gap-2">
                                <ExternalLink className="h-4 w-4" />
                                Download
                            </Button>
                        )}
                    </div>
                </div>
                {
                    admin.data?.id && (
                        <GiftAction />
                    )
                }
            </div>

            <AnimatePresence>
                {!reward?.data ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                        {[1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </motion.div>
                ) : reward.data.length > 0 ? (
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
                                    <TableHead>Plot Token Amount</TableHead>
                                    <TableHead>Plot NFT Count</TableHead>
                                    <TableHead className="text-right">Total Reward</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reward.data
                                    .sort((a, b) => b.plotBal * b.plots.length - a.plotBal * a.plots.length)
                                    .map((row, index) => (
                                        <TableRow
                                            key={index}
                                            onClick={() => handleRowClick(row)}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        >
                                            <TableCell className="font-medium">{index + 1}</TableCell>
                                            <TableCell className="font-mono text-xs truncate max-w-[200px]">{row.pubkey}</TableCell>
                                            <TableCell>{row.plotBal}</TableCell>
                                            <TableCell>{row.plots.length}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant="outline" className="font-medium">
                                                    {(row.plotBal * row.plots.length).toFixed(4)}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    </motion.div>
                ) : (
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
                )}
            </AnimatePresence>
        </motion.div>
    )
}

function GiftAction() {
    const { reward } = useStore()

    if (reward?.rewardedAt) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-md border border-green-200">
                <Award className="h-4 w-4" />
                <span className="text-sm font-medium">Rewarded on: {reward.rewardedAt.toLocaleDateString()}</span>
            </div>
        )
    }

    if (reward && !reward.rewardedAt) {
        return (
            <Button className="flex items-center gap-2">
                <Award className="h-4 w-4" />
                Distribute Rewards
            </Button>
        )
    }

    return null
}

export function YearMonthSelect() {
    const { setReward, reward, setCurrentReward } = useStore()

    const rewards = api.action.checker.getAllOriginRewards.useQuery(undefined, {
        onSuccess(data) {
            const first = data[0]
            if (first) {
                setCurrentReward({
                    date: first.monthYear,
                    data: holderWithPlotsSchema.array().parse(first.data),
                })

                setReward({
                    date: first.monthYear,
                    rewardedAt: first.rewardedAt ?? undefined,
                    data: holderWithPlotsSchema.array().parse(first.data),
                })
            }
        },
    })

    const handleSelect = (value: string) => {
        const reward = rewards.data?.find((reward) => {
            console.log("reward", typeof reward.monthYear)
            return reward.monthYear === value
        })
        if (reward) {
            const jsonData = reward.data
            const data = holderWithPlotsSchema.array().parse(jsonData)
            setReward({
                date: value,
                rewardedAt: reward.rewardedAt ?? undefined,
                data,
            })
        }
    }

    return (
        <div className="w-full sm:w-[240px]">
            {rewards.isLoading ? (
                <Skeleton className="h-10 w-full" />
            ) : (
                <Select onValueChange={handleSelect} value={reward?.date}>
                    <SelectTrigger id="year-month-select" className="w-full">
                        <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                        {rewards.data?.map((option) => (
                            <SelectItem key={option.id} value={option.monthYear}>
                                {option.monthYear}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
        </div>
    )
}
