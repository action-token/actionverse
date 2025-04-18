"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "react-hot-toast"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "~/components/shadcn/ui/card"
import { Input } from "~/components/shadcn/ui/input"
import { Button } from "~/components/shadcn/ui/button"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Label } from "~/components/shadcn/ui/label"
import { Loader2, Plus } from "lucide-react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/shadcn/ui/dialog"
import { api } from "~/utils/api"
import AdminLayout from "~/components/layout/root/AdminLayout"
import { CuratedItems } from "~/pages/marketplace"
import { MoreAssetsSkeleton } from "~/components/common/grid-loading"
import Asset from "~/components/common/admin-asset"

const AdminAssetFormSchema = z.object({
    logoUrl: z.string().url(),
    code: z
        .string()
        .min(4, { message: "Must be a minimum of 4 characters" })
        .max(12, { message: "Must be a maximum of 12 characters" }),
    issuer: z.string(),
    description: z.string(),
    link: z.string().url(),
    tags: z.string(),
    litemint: z.string().optional(),
    stellarx: z.string().optional(),
    stellarterm: z.string().optional(),
})

type WalletAsset = z.infer<typeof AdminAssetFormSchema>

const WalletList = () => {
    const curatedItems = api.wallate.asset.getBancoinAssets.useInfiniteQuery(
        { limit: 10 },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor,
        },
    );
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<WalletAsset>({
        resolver: zodResolver(AdminAssetFormSchema),
    })

    const assetAdd = api.wallate.asset.addAsset.useMutation({
        onSuccess: () => {
            setIsDialogOpen(false)
            reset()
            toast.success("Asset added successfully")
        },
        onError: (error) => {
            toast.error(error.message)
        },

    })

    const onSubmit = (data: WalletAsset) => {
        assetAdd.mutate(data)
    }

    return (
        <AdminLayout>
            <Card className="w-full">
                <CardHeader className="bg-primary rounded-lg">
                    <CardTitle className="flex items-center justify-between">
                        <p>Wallet Assets</p>
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="shadow-sm shadow-foreground">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Wallet Asset
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl overflow-y-auto max-h-[80vh]">
                                <DialogHeader>
                                    <DialogTitle>Add New Wallet Asset</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="logo">Logo Image URL</Label>
                                            <Input
                                                id="logo"
                                                {...register("logoUrl")}
                                                placeholder="https://example.com/logo.png"
                                                className={errors.logoUrl ? "border-red-500" : ""}
                                            />
                                            {errors.logoUrl && (
                                                <p className="text-sm text-red-500">{errors.logoUrl.message}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="assetCode">Asset Code</Label>
                                            <Input
                                                id="assetCode"
                                                {...register("code")}
                                                placeholder="e.g., BTC, ETH"
                                                className={errors.code ? "border-red-500" : ""}
                                            />
                                            {errors.code && (
                                                <p className="text-sm text-red-500">{errors.code.message}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="issuerAddress">Issuer Address</Label>
                                            <Input
                                                id="issuerAddress"
                                                {...register("issuer")}
                                                placeholder="Stellar address"
                                                className={errors.issuer ? "border-red-500" : ""}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="link">Website Link</Label>
                                            <Input
                                                id="link"
                                                {...register("link")}
                                                placeholder="https://project-website.com"
                                                className={errors.link ? "border-red-500" : ""}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="description">Description</Label>
                                        <Textarea
                                            id="description"
                                            {...register("description")}
                                            placeholder="Enter asset description (max 180 characters)"
                                            className={errors.description ? "border-red-500" : ""}
                                            maxLength={180}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="tags">Tags</Label>
                                        <Input
                                            id="tags"
                                            {...register("tags")}
                                            placeholder="e.g., defi, gaming, nft (comma separated)"
                                            className={errors.tags ? "border-red-500" : ""}
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-lg font-medium">Additional Marketplace Links</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="litemintLink">Litemint</Label>
                                                <Input
                                                    id="litemintLink"
                                                    {...register("litemint")}
                                                    placeholder="Optional"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="stellarXLink">StellarX</Label>
                                                <Input
                                                    id="stellarXLink"
                                                    {...register("stellarx")}
                                                    placeholder="Optional"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="stellarTermLink">StellarTerm</Label>
                                                <Input
                                                    id="stellarTermLink"
                                                    {...register("stellarterm")}
                                                    placeholder="Optional"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <button type="submit" className="hidden">Submit</button>
                                </form>
                                <DialogFooter>
                                    <Button
                                        onClick={() => {
                                            setIsDialogOpen(false)
                                            reset()
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button

                                        onClick={handleSubmit(onSubmit)}
                                        className="bg-primary"
                                    >
                                        {assetAdd.isLoading ? <Loader2 className="animate-spin" /> : "Add Asset"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>

                        </Dialog>

                    </CardTitle>
                    <CardDescription>Manage your wallet assets and add new ones.</CardDescription>

                </CardHeader>
                <CardContent className="p-0">
                    <div className="flex h-[calc(100vh-20vh)] flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md">
                        {curatedItems.isLoading && (
                            <MoreAssetsSkeleton className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5" />
                        )}
                        {
                            curatedItems.data?.pages[0]?.assets.length === 0 && (
                                <div className="flex items-center justify-center h-full flex-col gap-2">
                                    <h1 className="text-lg font-bold ">No Curated Items</h1>

                                </div>
                            )
                        }
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5">
                            {curatedItems.data?.pages.map((page, pageIndex) =>
                                page.assets.map((item, index) => (
                                    <Asset
                                        key={`music-${pageIndex}-${index}`}
                                        asset={item}
                                    />
                                )),
                            )}

                        </div>
                        {curatedItems.hasNextPage && (
                            <Button
                                className="flex w-1/2 items-center justify-center  shadow-sm shadow-black md:w-1/4"
                                onClick={() => void curatedItems.fetchNextPage()}
                                disabled={curatedItems.isFetchingNextPage}
                            >
                                {curatedItems.isFetchingNextPage ? "Loading more..." : "Load More"}
                            </Button>
                        )}
                    </div>

                </CardContent>



            </Card>
        </AdminLayout>
    )
}

export default WalletList

