"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Plus, QrCode, Trash2, Edit, ExternalLink, Calendar, Box } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/shadcn/ui/dialog"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Badge } from "~/components/shadcn/ui/badge"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { api } from "~/utils/api"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import { UploadS3Button } from "~/components/common/upload-button"
import { format } from "date-fns"
import QRCodeModal from "~/components/modal/qr-code-modal"
import { QRItem } from "~/types/organization/qr"


export default function OrganizationQRPage() {
    const { data: session } = useSession()
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [selectedQRItem, setSelectedQRItem] = useState<QRItem | null>(null)
    const [isQRModalOpen, setIsQRModalOpen] = useState(false)
    const [progress, setProgress] = useState(0)
    // Form state
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        modelUrl: "",
        externalLink: "",
        startDate: "",
        endDate: "",
    })

    const fileInputRef = useRef<HTMLInputElement>(null)

    // API calls
    const qrItems = api.qr.getQRItems.useQuery(undefined, {
        enabled: !!session?.user?.id,
    })

    const createQRItem = api.qr.createQRItem.useMutation({
        onSuccess: () => {
            toast.success("QR item created successfully!")
            setIsCreateDialogOpen(false)
            resetForm()
            qrItems.refetch()
        },
        onError: (error) => {
            toast.error(error.message)
        },
    })

    const deleteQRItem = api.qr.deleteQRItem.useMutation({
        onSuccess: () => {
            toast.success("QR item deleted successfully!")
            qrItems.refetch()
        },
        onError: (error) => {
            toast.error(error.message)
        },
    })

    const resetForm = () => {
        setFormData({
            title: "",
            description: "",
            modelUrl: "",
            externalLink: "",
            startDate: "",
            endDate: "",
        })
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.title || !formData.description || !formData.startDate || !formData.endDate || !formData.modelUrl) {
            toast.error("Please fill in all required fields")
            return
        }

        if (new Date(formData.startDate) >= new Date(formData.endDate)) {
            toast.error("End date must be after start date")
            return
        }

        createQRItem.mutate({
            title: formData.title,
            description: formData.description,
            modelUrl: formData.modelUrl,
            externalLink: formData.externalLink || undefined,
            startDate: new Date(formData.startDate),
            endDate: new Date(formData.endDate),
        })
    }

    const handleModelUpload = () => {
        // Trigger the hidden file input
        const hiddenInput = document.getElementById("qr-model-upload") as HTMLInputElement
        if (hiddenInput) {
            hiddenInput.click()
        }
    }

    const handleViewQR = (item: QRItem) => {
        setSelectedQRItem(item)
        setIsQRModalOpen(true)
    }

    const isItemActive = (item: QRItem) => {
        const now = new Date()
        return now >= new Date(item.startDate) && now <= new Date(item.endDate)
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">QR Code Management</h1>
                    <p className="text-muted-foreground mt-2">Create and manage QR codes for your 3D models and content</p>
                </div>

                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Add QR Item
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Create New QR Item</DialogTitle>
                            <DialogDescription>Add a new item that will generate a QR code for sharing</DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Title */}
                            <div className="space-y-2">
                                <Label htmlFor="title">Title *</Label>
                                <Input
                                    id="title"
                                    value={formData.title}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                                    placeholder="Enter item title"
                                    required
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <Label htmlFor="description">Description *</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                                    placeholder="Enter item description"
                                    rows={3}
                                    required
                                />
                            </div>

                            {/* 3D Model Upload */}
                            <div className="space-y-2">
                                <Label>3D Model</Label>
                                <div className="flex items-center gap-4">
                                    <Button type="button" variant="outline" onClick={handleModelUpload} className="gap-2 bg-transparent">
                                        <Box className="h-4 w-4" />
                                        {formData.modelUrl ? "Change Model" : "Upload 3D Model"}
                                    </Button>

                                    {formData.modelUrl && (
                                        <div className="flex items-center gap-2 text-sm text-green-600">
                                            <Box className="h-4 w-4" />
                                            Model uploaded successfully
                                        </div>
                                    )}
                                </div>

                                {/* Hidden upload component */}
                                <UploadS3Button
                                    id="qr-model-upload"
                                    endpoint="modelUploader"
                                    variant="hidden"
                                    onUploadProgress={(progress => {
                                        console.log(`Upload progress: ${progress}%`)
                                        setProgress(progress)
                                    })}
                                    onClientUploadComplete={(file) => {
                                        setProgress(0)
                                        setFormData((prev) => ({ ...prev, modelUrl: file.url }))
                                        toast.success("3D model uploaded successfully!")

                                    }}
                                    onUploadError={(error) => {
                                        toast.error("Failed to upload 3D model")
                                        console.error(error)
                                    }}
                                />
                                {
                                    progress > 0 && (
                                        <div className="mt-2">
                                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500 transition-all duration-300"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-muted-foreground">{progress}% uploaded</span>
                                        </div>
                                    )
                                }
                            </div>

                            {/* External Link */}
                            <div className="space-y-2">
                                <Label htmlFor="externalLink">External Link (Optional)</Label>
                                <Input
                                    id="externalLink"
                                    type="url"
                                    value={formData.externalLink}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, externalLink: e.target.value }))}
                                    placeholder="https://example.com"
                                />
                            </div>

                            {/* Date Range */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="startDate">Start Date *</Label>
                                    <Input
                                        id="startDate"
                                        type="datetime-local"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="endDate">End Date *</Label>
                                    <Input
                                        id="endDate"
                                        type="datetime-local"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="flex justify-end gap-3">
                                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={createQRItem.isLoading}>
                                    {createQRItem.isLoading ? "Creating..." : "Create QR Item"}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* QR Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {qrItems.isLoading && (
                    <>
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <Card key={i}>
                                <CardHeader>
                                    <Skeleton className="h-6 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                </CardHeader>
                                <CardContent>
                                    <Skeleton className="h-4 w-full mb-2" />
                                    <Skeleton className="h-4 w-2/3 mb-4" />
                                    <div className="flex gap-2">
                                        <Skeleton className="h-8 w-20" />
                                        <Skeleton className="h-8 w-20" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </>
                )}

                {qrItems.data?.map((item) => (
                    <Card key={item.id} className="relative">
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <CardTitle className="text-lg">{item.title}</CardTitle>
                                    <CardDescription className="mt-1">{item.description}</CardDescription>
                                </div>
                                <Badge variant={isItemActive(item) ? "default" : "secondary"}>
                                    {isItemActive(item) ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {/* Item Details */}
                            <div className="space-y-2 text-sm">
                                {item.modelUrl && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Box className="h-4 w-4" />
                                        <span>3D Model included</span>
                                    </div>
                                )}

                                {item.externalLink && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <ExternalLink className="h-4 w-4" />
                                        <span>External link included</span>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Calendar className="h-4 w-4" />
                                    <span>
                                        {format(new Date(item.startDate), "MMM dd")} - {format(new Date(item.endDate), "MMM dd, yyyy")}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-2">
                                <Button size="sm" variant="outline" onClick={() => handleViewQR(item)} className="gap-1 flex-1">
                                    <QrCode className="h-4 w-4" />
                                    View QR
                                </Button>

                                {/* <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        // TODO: Implement edit functionality
                                        toast.info("Edit functionality coming soon!")
                                    }}
                                >
                                    <Edit className="h-4 w-4" />
                                </Button> */}

                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        if (confirm("Are you sure you want to delete this QR item?")) {
                                            deleteQRItem.mutate({ id: item.id })
                                        }
                                    }}
                                    disabled={deleteQRItem.isLoading}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {qrItems.data?.length === 0 && !qrItems.isLoading && (
                    <div className="col-span-full">
                        <Card className="p-12 text-center">
                            <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">No QR Items Yet</h3>
                            <p className="text-muted-foreground mb-4">Create your first QR item to get started</p>
                            <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                                <Plus className="h-4 w-4" />
                                Add Your First QR Item
                            </Button>
                        </Card>
                    </div>
                )}
            </div>

            {/* QR Code Modal */}
            {selectedQRItem && (
                <QRCodeModal
                    isOpen={isQRModalOpen}
                    onClose={() => {
                        setIsQRModalOpen(false)
                        setSelectedQRItem(null)
                    }}
                    qrItem={selectedQRItem}
                />
            )}
        </div>
    )
}
