"use client"

import { useSession } from "next-auth/react"
import Image from "next/image"
import { api } from "~/utils/api"
import { Dialog, DialogContent } from "~/components/shadcn/ui/dialog"
import { z } from "zod"
import { addrShort } from "~/utils/utils"
import Link from "next/link"
import { useRouter } from "next/router"
import { useModal } from "~/lib/state/augmented-reality/use-modal-store"
import { Badge } from "~/components/shadcn/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { ScrollArea } from "~/components/shadcn/ui/scroll-area"
import { ExternalLink, Info } from "lucide-react"
import { SparkleEffect } from "../common/modal-common-button"
import { AdminAssetWithTag } from "~/types/market/admin-asset-tag-type"

import { Card, CardContent, CardFooter } from "~/components/shadcn/ui/card";
import { Button } from "../shadcn/ui/button"
import clsx from "clsx"
import { useAdminAssetModalStore } from "../store/admin-assetview-store"

interface ViewAdminAssetProps {
    isOpen: boolean
    setIsOpen: (open: boolean) => void
    data: AdminAssetWithTag
}



export default function ViewAdminAsset({ }) {
    const { setIsOpen, data, isOpen } = useAdminAssetModalStore()

    const handleClose = () => {
        setIsOpen(false)
    }



    if (!data) return null

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-3xl overflow-hidden p-0 [&>button]:rounded-full [&>button]:border [&>button]:border-black [&>button]:bg-white [&>button]:text-black">
                <div className="grid grid-cols-2 md:grid-cols-7">
                    {/* Left Column - Product Image */}
                    <Card className=" overflow-y-auto   bg-[#1e1f22] md:col-span-3">
                        <CardContent className="p-0">
                            {/* Image Container */}
                            <div className="relative aspect-square bg-[#1e1f22]">
                                <SparkleEffect />
                                <img
                                    src={data.logoUrl}
                                    alt={data.logoUrl}
                                    width={1000}
                                    height={1000}
                                    className="h-full w-full object-cover"
                                />
                            </div>

                            {/* Content */}
                            <div className="space-y-3 p-4">
                                <h2 className="text-xl font-bold text-white">
                                    {data.code}
                                </h2>

                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <span className="h-auto p-0 text-xs text-[#00a8fc]">
                                        {addrShort(data.adminId, 5)}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-1 p-2">
                            <Link
                                className="w-full"
                                href={data.StellarTerm ?? ""}
                            >
                                <Button className="w-full" variant="outline">
                                    View on StellarTerm
                                </Button>
                            </Link>
                            <Link
                                className="w-full"
                                href={data.Litemint ?? ""}
                            >
                                <Button className="w-full" variant="outline">
                                    View on Litemint
                                </Button>
                            </Link>
                            <Link
                                className="w-full"
                                href={data.StellarX ?? ""}
                            >
                                <Button className="w-full" variant="outline">
                                    View on StellarX
                                </Button>
                            </Link>
                        </CardFooter>
                    </Card>

                    {/* Right Column - Bundle Info */}
                    <div className=" rounded-sm bg-gray-300 p-1   md:col-span-4">
                        <img
                            src={data.logoUrl}
                            alt={data.logoUrl}
                            width={1000}
                            height={1000}
                            className={clsx("h-full w-full object-cover ")}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}


