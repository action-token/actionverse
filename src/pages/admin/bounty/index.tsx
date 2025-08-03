"use client"

import { useCallback, useState } from "react"
import Image from "next/image"
import toast from "react-hot-toast"
import { useModal } from "~/lib/state/augmented-reality/use-modal-store"
import type React from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/shadcn/ui/dialog"
import { Button } from "~/components/shadcn/ui/button"
import { api } from "~/utils/api"
import { Badge } from "~/components/shadcn/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/shadcn/ui/table"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { Edit, Trash2 } from "lucide-react"
import { submitSignedXDRToServer4User } from "package/connect_wallet/src/lib/stellar/trx/payment_fb_g"
import { Preview } from "~/components/common/quill-preview"
import { BountyTypes } from "~/types/bounty/bounty-type"
import AdminLayout from "~/components/layout/root/AdminLayout"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { useEditBuyModalStore } from "~/components/store/edit-bounty-modal-store"

const Bounty = () => {
    const { setData, setIsOpen } = useEditBuyModalStore()
    const [loadingBountyId, setLoadingBountyId] = useState<number | null>(null)
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; bounty: BountyTypes | null }>({
        isOpen: false,
        bounty: null,
    })

    const utils = api.useUtils()
    const getAllBounty = api.bounty.Bounty.getAllBounties.useInfiniteQuery(
        { limit: 10 },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor,
        },
    )

    const DeleteMutation = api.bounty.Bounty.deleteBounty.useMutation({
        onSuccess: async () => {
            toast.success("Bounty Deleted")
            await utils.bounty.Bounty.getAllBounties.refetch()
        },
    })

    const GetDeleteXDR = api.bounty.Bounty.getDeleteXdr.useMutation({
        onSuccess: async (data, variables) => {
            if (data) {
                setLoadingBountyId(variables.bountyId)
                const res = await submitSignedXDRToServer4User(data)
                if (res) {
                    DeleteMutation.mutate({
                        BountyId: GetDeleteXDR.variables?.bountyId ?? 0,
                    })
                } else {
                    setLoadingBountyId(null)
                }
            }
        },
        onError: (error) => {
            setLoadingBountyId(null)
            toast.error(error.message)
        },
    })

    const handleDelete = useCallback((bounty: BountyTypes) => {
        setDeleteConfirmation({ isOpen: true, bounty })
    }, [])

    const confirmDelete = useCallback(() => {
        if (deleteConfirmation.bounty) {
            const { priceInBand, id, creatorId } = deleteConfirmation.bounty
            setLoadingBountyId(id)
            GetDeleteXDR.mutate({ prize: priceInBand, bountyId: id, creatorId })
        }
        setDeleteConfirmation({ isOpen: false, bounty: null })
    }, [deleteConfirmation.bounty, GetDeleteXDR])

    const formatTitle = (title: string) => {
        return title.length > 70 ? title.slice(0, 70) + "..." : title
    }

    const renderBountyRow = (bounty: BountyTypes) => (
        <TableRow key={bounty.id}>
            <TableCell>
                <div className="flex items-center gap-3">
                    {bounty.imageUrls && (
                        <Image
                            src={bounty.imageUrls[0] ?? "/images/logo.png"}
                            height={36}
                            width={36}
                            alt={bounty.title}
                            className="rounded-full object-cover h-12 w-12"
                        />
                    )}
                    <span className="font-semibold">{formatTitle(bounty.title)}</span>
                </div>
            </TableCell>
            <TableCell>
                <Preview value={bounty.description.slice(0, 50)} />
            </TableCell>
            <TableCell>
                <Badge
                    variant={bounty.status === "PENDING" ? "secondary" : bounty.status === "APPROVED" ? "default" : "destructive"}
                >
                    {bounty.status}
                </Badge>
            </TableCell>

            <TableCell>
                <div className="flex space-x-2">
                    <Button size="icon" variant="ghost" onClick={() => {
                        setData(bounty.id)
                        setIsOpen(true)
                    }
                    }>
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        disabled={loadingBountyId === bounty.id || bounty.BountyWinner.length > 0}
                        onClick={() => handleDelete(bounty)}
                    >
                        {loadingBountyId === bounty.id ? (
                            <Skeleton className="h-4 w-4 rounded-full" />
                        ) : (
                            <Trash2 className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    )

    const renderSkeletonRow = () => (
        <TableRow>
            <TableCell>
                <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <Skeleton className="h-4 w-40" />
                </div>
            </TableCell>
            <TableCell>
                <Skeleton className="h-4 w-60" />
            </TableCell>

            <TableCell>
                <Skeleton className="h-6 w-20" />
            </TableCell>
            <TableCell>
                <div className="flex space-x-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                </div>
            </TableCell>
        </TableRow>
    )

    return (
        <AdminLayout>
            <Card>
                <CardContent className="min-h-screen">

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Title</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Winning Status</TableHead>
                                <TableHead>Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {getAllBounty.isLoading
                                ? [...Array({ length: 20 })].map(() => renderSkeletonRow())
                                : getAllBounty.data?.pages.map((page) => page.bounties.map((bounty) => renderBountyRow(bounty)))}
                        </TableBody>
                    </Table>

                    {getAllBounty.hasNextPage && (
                        <div className="mt-4 flex justify-center">
                            <Button onClick={() => void getAllBounty.fetchNextPage()} disabled={getAllBounty.isFetchingNextPage}>
                                {getAllBounty.isFetchingNextPage ? <Skeleton className="h-4 w-20" /> : "Load More"}
                            </Button>
                        </div>
                    )}

                    <DeleteConfirmationDialog
                        isOpen={deleteConfirmation.isOpen}
                        onClose={() => setDeleteConfirmation({ isOpen: false, bounty: null })}
                        onConfirm={confirmDelete}
                        title={deleteConfirmation.bounty?.title ?? ""}
                    />

                </CardContent>
            </Card>
        </AdminLayout>
    )
}

interface DeleteConfirmationDialogProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
}

export const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Confirm Deletion</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete the bounty <b>{title}</b>? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline"
                        className="shadow-sm shadow-foreground"
                        onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        className="shadow-sm shadow-foreground"

                        variant="destructive" onClick={onConfirm}>
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}



export default Bounty

