"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Plus, QrCode, Trash2, Edit, ExternalLink, Calendar, Box, ChevronDown, ChevronUp, X } from "lucide-react"
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/shadcn/ui/collapsible"

interface DescriptionField {
    id: string
    title: string
    content: string
    isCollapsed: boolean
    order: number
}

export default function OrganizationQRPage() {
    const { data: session } = useSession()
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [selectedQRItem, setSelectedQRItem] = useState<QRItem | null>(null)
    const [isQRModalOpen, setIsQRModalOpen] = useState(false)
    const [progress, setProgress] = useState(0)
    const [formData, setFormData] = useState({
        title: "",
        modelUrl: "",
        externalLink: "",
        startDate: "",
        endDate: "",
    })

    const [descriptions, setDescriptions] = useState<DescriptionField[]>([
        { id: "temp-1", title: "", content: "", isCollapsed: false, order: 1 },
    ])

    const [errors, setErrors] = useState<{
        title?: string
        descriptions?: Record<string, { title?: string; content?: string }>
        modelUrl?: string
        startDate?: string
        endDate?: string
    }>({})
    // API calls
    const qrItems = api.qr.getQRItems.useQuery(undefined, {
        enabled: !!session?.user?.id,
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
    const createQRItem = api.qr.createQRItem.useMutation({
        onSuccess: () => {
            toast.success("QR item created successfully!")
            resetForm()

        },
        onError: (error) => {
            toast.error(error.message)
        },
    })

    const resetForm = () => {
        setFormData({
            title: "",
            modelUrl: "",
            externalLink: "",
            startDate: "",
            endDate: "",
        })
        setDescriptions([{ id: "temp-1", title: "", content: "", isCollapsed: false, order: 1 }])
        setErrors({})
    }

    const validateForm = (): boolean => {
        const newErrors: typeof errors = {}

        // Validate main title
        if (!formData.title.trim()) {
            newErrors.title = "Title is required"
        } else if (formData.title.length > 100) {
            newErrors.title = "Title must be 100 characters or less"
        }

        // Validate descriptions
        const descriptionErrors: Record<string, { title?: string; content?: string }> = {}
        let hasValidDescription = false

        descriptions.forEach((desc) => {
            const descError: { title?: string; content?: string } = {}

            // Validate description title
            if (!desc.title.trim()) {
                descError.title = "Description title is required"
            } else if (desc.title.length > 50) {
                descError.title = "Description title must be 50 characters or less"
            }

            // Validate description content - UPDATED TO USE CHARACTER LIMIT
            if (!desc.content.trim()) {
                descError.content = "Description content cannot be empty"
            } else {
                const charCount = desc.content.length
                if (charCount > 600) {
                    descError.content = `Description must be 600 characters or less (current: ${charCount} characters)`
                } else if (desc.title.trim()) {
                    hasValidDescription = true
                }
            }

            if (descError.title ?? descError.content) {
                descriptionErrors[desc.id] = descError
            }
        })

        if (!hasValidDescription) {
            newErrors.descriptions = descriptionErrors
        } else if (Object.keys(descriptionErrors).length > 0) {
            newErrors.descriptions = descriptionErrors
        }

        // Validate model URL
        if (!formData.modelUrl) {
            newErrors.modelUrl = "3D Model is required"
        }

        // Validate dates
        if (!formData.startDate) {
            newErrors.startDate = "Start date is required"
        }
        if (!formData.endDate) {
            newErrors.endDate = "End date is required"
        }
        if (formData.startDate && formData.endDate && new Date(formData.startDate) >= new Date(formData.endDate)) {
            newErrors.endDate = "End date must be after start date"
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (!validateForm()) {
            toast.error("Please fix the errors in the form")
            return
        }

        // Prepare descriptions data for the new schema
        const validDescriptions = descriptions
            .filter((desc) => desc.title.trim() && desc.content.trim())
            .sort((a, b) => a.order - b.order)
            .map((desc) => ({
                title: desc.title.trim(),
                content: desc.content.trim(),
                order: desc.order,
            }))

        createQRItem.mutate({
            title: formData.title,
            descriptions: validDescriptions,
            modelUrl: formData.modelUrl,
            externalLink: formData.externalLink || undefined,
            startDate: new Date(formData.startDate),
            endDate: new Date(formData.endDate),
        })
    }


    const addDescription = () => {
        if (descriptions.length >= 4) {
            toast.error("Maximum 4 descriptions allowed")
            return
        }

        // Collapse all existing descriptions
        const updatedDescriptions = descriptions.map((desc) => ({
            ...desc,
            isCollapsed: true,
        }))

        // Find the next order number
        const nextOrder = Math.max(...descriptions.map((d) => d.order)) + 1

        // Add new description
        const newDescription: DescriptionField = {
            id: `temp-${Date.now()}`,
            title: "",
            content: "",
            isCollapsed: false,
            order: nextOrder,
        }

        setDescriptions([...updatedDescriptions, newDescription])
    }

    const removeDescription = (id: string) => {
        if (descriptions.length <= 1) {
            toast.error("At least one description is required")
            return
        }

        const remainingDescriptions = descriptions.filter((desc) => desc.id !== id)

        // Reorder remaining descriptions to fill gaps
        const reorderedDescriptions = remainingDescriptions
            .sort((a, b) => a.order - b.order)
            .map((desc, index) => ({
                ...desc,
                order: index + 1,
            }))

        setDescriptions(reorderedDescriptions)

        // Clear errors for removed description
        if (errors.descriptions) {
            const newDescriptionErrors = { ...errors.descriptions }
            delete newDescriptionErrors[id]
            setErrors({
                ...errors,
                descriptions: Object.keys(newDescriptionErrors).length > 0 ? newDescriptionErrors : undefined,
            })
        }
    }

    const updateDescription = (id: string, field: "title" | "content", value: string) => {
        setDescriptions(descriptions.map((desc) => (desc.id === id ? { ...desc, [field]: value } : desc)))

        // Clear error for this description field if it's now valid
        if (errors.descriptions?.[id]?.[field]) {
            const newDescriptionErrors = { ...errors.descriptions }
            if (field === "title" && value.trim() && value.length <= 50) {
                delete newDescriptionErrors[id]?.title
            } else if (field === "content" && value.trim() && value.length <= 600) {
                // UPDATED TO USE CHARACTER LIMIT
                delete newDescriptionErrors[id]?.content
            }

            // Clean up empty error objects
            if (newDescriptionErrors[id] && !newDescriptionErrors[id]?.title && !newDescriptionErrors[id]?.content) {
                delete newDescriptionErrors[id]
            }

            setErrors({
                ...errors,
                descriptions: Object.keys(newDescriptionErrors).length > 0 ? newDescriptionErrors : undefined,
            })
        }
    }

    const toggleDescriptionCollapse = (id: string) => {
        setDescriptions(descriptions.map((desc) => (desc.id === id ? { ...desc, isCollapsed: !desc.isCollapsed } : desc)))
    }

    const getDescriptionDisplayTitle = (desc: DescriptionField): string => {
        if (desc.title.trim()) {
            return desc.title.trim()
        }
        return `Description ${desc.order}`
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
                            {/* Main Title */}
                            <div className="space-y-2">
                                <Label htmlFor="title">Main Title *</Label>
                                <Input
                                    id="title"
                                    value={formData.title}
                                    onChange={(e) => {
                                        setFormData((prev) => ({ ...prev, title: e.target.value }))
                                        if (errors.title) {
                                            setErrors({ ...errors, title: undefined })
                                        }
                                    }}
                                    placeholder="Enter main item title"
                                    className={errors.title ? "border-red-500" : ""}
                                />
                                {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
                            </div>

                            {/* Descriptions */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>Descriptions * (Max 4, 600 characters each)</Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addDescription}
                                        disabled={descriptions.length >= 4}
                                        className="gap-2"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Description
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    {descriptions
                                        .sort((a, b) => a.order - b.order)
                                        .map((desc) => (
                                            <Card key={desc.id} className={errors.descriptions?.[desc.id] ? "border-red-500" : ""}>
                                                <Collapsible open={!desc.isCollapsed} onOpenChange={() => toggleDescriptionCollapse(desc.id)}>
                                                    <CardHeader className="pb-3">
                                                        <div className="flex items-center justify-between">
                                                            <CardTitle className="text-sm font-medium">
                                                                <span className="text-muted-foreground">#{desc.order}</span> {getDescriptionDisplayTitle(desc)}
                                                                {desc.content.trim() && (
                                                                    <span className="ml-2 text-xs text-muted-foreground">({desc.content.length} chars)</span>
                                                                )}
                                                            </CardTitle>
                                                            <div className="flex items-center gap-2">
                                                                <CollapsibleTrigger asChild>
                                                                    <Button variant="ghost" size="sm">
                                                                        {desc.isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                                                                    </Button>
                                                                </CollapsibleTrigger>
                                                                {descriptions.length > 1 && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => removeDescription(desc.id)}
                                                                        className="text-red-500 hover:text-red-700"
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </CardHeader>
                                                    <CollapsibleContent>
                                                        <CardContent className="pt-0 space-y-4">
                                                            {/* Description Title */}
                                                            <div className="space-y-2">
                                                                <Label htmlFor={`desc-title-${desc.id}`}>Description Title *</Label>
                                                                <Input
                                                                    id={`desc-title-${desc.id}`}
                                                                    value={desc.title}
                                                                    onChange={(e) => updateDescription(desc.id, "title", e.target.value)}
                                                                    placeholder={`Enter title for description ${desc.order}`}
                                                                    className={errors.descriptions?.[desc.id]?.title ? "border-red-500" : ""}
                                                                />
                                                                {errors.descriptions?.[desc.id]?.title && (
                                                                    <p className="text-sm text-red-500">{errors.descriptions[desc.id]?.title}</p>
                                                                )}
                                                                <div className="text-xs text-muted-foreground">Characters: {desc.title.length}/50</div>
                                                            </div>

                                                            {/* Description Content */}
                                                            <div className="space-y-2">
                                                                <Label htmlFor={`desc-content-${desc.id}`}>Description Content *</Label>
                                                                <Textarea
                                                                    id={`desc-content-${desc.id}`}
                                                                    value={desc.content}
                                                                    onChange={(e) => updateDescription(desc.id, "content", e.target.value)}
                                                                    placeholder={`Enter content for ${desc.title || `description ${desc.order}`}...`}
                                                                    rows={4}
                                                                    className={errors.descriptions?.[desc.id]?.content ? "border-red-500" : ""}
                                                                    maxLength={600} // Add HTML maxLength attribute for additional UX
                                                                />
                                                                {errors.descriptions?.[desc.id]?.content && (
                                                                    <p className="text-sm text-red-500">{errors.descriptions[desc.id]?.content}</p>
                                                                )}
                                                                <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                                    <span className={desc.content.length > 600 ? "text-red-500 font-medium" : ""}>
                                                                        Characters: {desc.content.length}/600
                                                                    </span>
                                                                    <span>
                                                                        {desc.content.length > 600 && (
                                                                            <span className="text-red-500">Exceeds limit by {desc.content.length - 600}</span>
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </CollapsibleContent>
                                                </Collapsible>
                                            </Card>
                                        ))}
                                </div>
                            </div>

                            {/* 3D Model Upload */}
                            <div className="space-y-2">
                                <Label>3D Model * (GLB)</Label>
                                <div className="flex items-center gap-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleModelUpload}
                                        className={`gap-2 bg-transparent ${errors.modelUrl ? "border-red-500" : ""}`}
                                    >
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
                                <UploadS3Button
                                    id="qr-model-upload"
                                    variant="hidden"
                                    endpoint="modelUploader"
                                    onBeforeUploadBegin={(file) => {
                                        if (!file.name.endsWith(".glb")) {
                                            toast.error("Invalid file type. Please upload a .glb file.")
                                            return undefined
                                        }
                                        return file
                                    }}
                                    onUploadProgress={(progress) => {
                                        setProgress(progress)
                                    }}
                                    onClientUploadComplete={(file) => {
                                        if (!file) {
                                            toast.error("No file uploaded")
                                            return
                                        }
                                        setFormData((prev) => ({ ...prev, modelUrl: file.url }))
                                        toast.success("3D Model uploaded successfully!")
                                    }}
                                />
                                {progress > 0 && (
                                    <div className="mt-2">
                                        <div className="text-sm text-muted-foreground">Uploading: {Math.round(progress)}%</div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                                            <div
                                                className="bg-blue-600 h-2.5 rounded-full"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                                {errors.modelUrl && <p className="text-sm text-red-500">{errors.modelUrl}</p>}
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
                                        onChange={(e) => {
                                            setFormData((prev) => ({ ...prev, startDate: e.target.value }))
                                            if (errors.startDate) {
                                                setErrors({ ...errors, startDate: undefined })
                                            }
                                        }}
                                        className={errors.startDate ? "border-red-500" : ""}
                                    />
                                    {errors.startDate && <p className="text-sm text-red-500">{errors.startDate}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="endDate">End Date *</Label>
                                    <Input
                                        id="endDate"
                                        type="datetime-local"
                                        value={formData.endDate}
                                        onChange={(e) => {
                                            setFormData((prev) => ({ ...prev, endDate: e.target.value }))
                                            if (errors.endDate) {
                                                setErrors({ ...errors, endDate: undefined })
                                            }
                                        }}
                                        className={errors.endDate ? "border-red-500" : ""}
                                    />
                                    {errors.endDate && <p className="text-sm text-red-500">{errors.endDate}</p>}
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="flex justify-end gap-3">
                                <Button type="button" variant="outline" onClick={() => {
                                    setIsCreateDialogOpen(false)
                                    resetForm()
                                }}>
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
                                    <CardDescription className="mt-1">
                                        {item.descriptions && item.descriptions.length > 0 ? (
                                            <div className="space-y-1">
                                                <div className="font-medium text-sm">
                                                    {item.descriptions.sort((a, b) => a.order - b.order)[0]?.title}
                                                </div>
                                                <div>
                                                    {item.descriptions[0]?.content && item.descriptions[0].content.length > 100
                                                        ? `${item.descriptions[0].content.slice(0, 100)}...`
                                                        : item.descriptions[0]?.content}
                                                </div>
                                                {item.descriptions.length > 1 && (
                                                    <div className="text-xs text-muted-foreground">
                                                        +{item.descriptions.length - 1} more description
                                                        {item.descriptions.length > 2 ? "s" : ""}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            "No descriptions available"
                                        )}
                                    </CardDescription>
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
