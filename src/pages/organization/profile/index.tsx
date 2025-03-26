"use client"

import React, { useEffect } from "react"
import { useState, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import {
    ImageIcon,
    Grid3X3,
    Calendar,
    Twitter,
    Instagram,
    Globe,
    CheckCircle2,
    Edit,
    Plus,
    Eye,
    Camera,
    X,
    DollarSign,
    Menu,
    Users,
    ChevronUp,
    ChevronDown,
    ArrowDownFromLine,
} from "lucide-react"

import { Button } from "~/components/shadcn/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Input } from "~/components/shadcn/ui/input"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Label } from "~/components/shadcn/ui/label"
import { Separator } from "~/components/shadcn/ui/separator"
import { cn } from "~/lib/utils"
import { api } from "~/utils/api"
import ArtistDashboardSkeleton from "~/components/creator/artist-profile-loading"
import NotFound from "~/pages/404"
import CustomAvatar from "~/components/common/custom-avatar"
import { useCreatePostModalStore } from "~/components/store/create-post-modal-store"
import { useSession } from "next-auth/react"
import PostCard from "~/components/post/post-card"
import { UploadS3Button } from "~/components/common/upload-button"
import toast from "react-hot-toast"
import { useAddSubsciptionModalStore } from "~/components/store/add-subscription-modal-store"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { MoreAssetsSkeleton } from "~/components/common/grid-loading"
import MarketAssetComponent from "~/components/common/market-asset"
import { useNFTCreateModalStore } from "~/components/store/nft-create-modal-store"
import { Badge } from "~/components/shadcn/ui/badge"
import { SubscriptionContextMenu } from "~/components/common/subscripton-context"

const isValidUrl = (string: string) => {
    try {
        const url = new URL(string)
        return url.protocol === "http:" || url.protocol === "https:"
    } catch (_) {
        return false
    }
}

export default function ArtistDashboard() {
    const session = useSession()

    const [activeTab, setActiveTab] = useState("posts")
    const [isEditingProfile, setIsEditingProfile] = useState(false)
    const [expandedPackage, setExpandedPackage] = useState<number | null>(null)
    const [showSuccessMessage, setShowSuccessMessage] = useState(false)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isScrolled, setIsScrolled] = useState(false)
    const [scrollProgress, setScrollProgress] = useState(0)
    const { setIsOpen: setIsPostModalOpen } = useCreatePostModalStore()
    const { openForCreate, openForEdit } = useAddSubsciptionModalStore()
    const { setIsOpen: setIsNFTModalOpen } = useNFTCreateModalStore()

    const contentRef = useRef<HTMLDivElement>(null)

    // API calls
    const creator = api.fan.creator.meCreator.useQuery()
    const subscriptionPackages = api.fan.creator.getCreatorPackages.useQuery()
    const updateProfileMutation = api.fan.creator.changeCreatorProfilePicture.useMutation({
        onSuccess: () => {
            toast.success("Profile Picture changed successfully")
            creator.refetch()
        },
    })
    const coverChangeMutation = api.fan.creator.changeCreatorCoverPicture.useMutation({
        onSuccess: () => {
            toast.success("Cover Changed Successfully")
            creator.refetch()
        },
    })
    const allCreatedPost = api.fan.post.getPosts.useInfiniteQuery(
        {
            pubkey: session.data?.user.id ?? "",
            limit: 10,
        },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor,

        },
    )
    const creatorNFT = api.marketplace.market.getCreatorNftsByCreatorID.useInfiniteQuery(
        { limit: 10, creatorId: session.data?.user.id ?? "" },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor,
        },
    )


    // Profile editing state
    const [editedProfile, setEditedProfile] = useState({
        name: creator.data?.name ?? "",
        bio: creator.data?.bio ?? "",
        website: creator.data?.website ?? "",
        twitter: creator.data?.twitter ?? "",
        instagram: creator.data?.instagram ?? "",
    })

    const [formErrors, setFormErrors] = useState({
        name: "",
        bio: "",
        website: "",
        twitter: "",
        instagram: "",
    })

    // Update profile info mutation
    const UpdateCreatorProfileInfo = api.fan.creator.updateCreatorProfileInfo.useMutation({
        onSuccess: () => {
            toast.success("Profile Updated Successfully")
            creator.refetch()
            setShowSuccessMessage(true)
            setTimeout(() => setShowSuccessMessage(false), 3000)
        },
        onError: (error) => {
            toast.error(`Error updating profile: ${error.message}`)
        },
    })

    // Cancel profile editing
    const cancelProfileEditing = () => {
        setEditedProfile({
            name: creator.data?.name ?? "",
            bio: creator.data?.bio ?? "",
            website: creator.data?.website ?? "",
            twitter: creator.data?.twitter ?? "",
            instagram: creator.data?.instagram ?? "",
        })
        setFormErrors({
            name: "",
            bio: "",
            website: "",
            twitter: "",
            instagram: "",
        })
        setIsEditingProfile(false)
    }

    // Save profile changes
    const saveProfileChanges = () => {
        setIsEditingProfile(false)
        UpdateCreatorProfileInfo.mutate({
            name: editedProfile.name,
            bio: editedProfile.bio,
            website: editedProfile.website,
            twitter: editedProfile.twitter,
            instagram: editedProfile.instagram,
        })
    }

    // Toggle package expansion
    const togglePackageExpansion = (id: number) => {
        if (expandedPackage === id) {
            setExpandedPackage(null)
        } else {
            setExpandedPackage(id)
        }
    }

    useEffect(() => {
        const handleScroll = () => {
            if (contentRef.current) {
                const scrollPosition = contentRef.current.scrollTop
                const scrollThreshold = 100

                if (scrollPosition > scrollThreshold) {
                    setIsScrolled(true)
                    setScrollProgress(Math.min(1, (scrollPosition - scrollThreshold) / 50))
                } else {
                    setIsScrolled(false)
                    setScrollProgress(0)
                }
            }
        }

        // Add event listener to the content div instead of window
        const currentContentRef = contentRef.current
        if (currentContentRef) {
            currentContentRef.addEventListener("scroll", handleScroll)
        }

        // Clean up
        return () => {
            if (currentContentRef) {
                currentContentRef.removeEventListener("scroll", handleScroll)
            }
        }
    }, [])

    // Toggle sidebar on mobile
    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen)
    }

    if (creator.isLoading) {
        return <ArtistDashboardSkeleton />
    }

    if (!creator.data) {
        return <NotFound />
    }

    return (
        <div className="flex flex-col h-screen  bg-background">
            {/* Success Message */}
            {showSuccessMessage && (
                <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Profile updated successfully!</span>
                </div>
            )}

            {/* Header with Cover Image */}
            <div className="w-full  relative transition-all duration-500"
                style={{
                    height: isScrolled ? "0px" : "200px",

                }}
            >
                <div className="relative w-full h-full">
                    <Image
                        src={
                            creator.data.coverUrl?.length === 0 || creator.data.coverUrl === null
                                ? "/placeholder.svg?height=400&width=1200"
                                : creator.data.coverUrl
                        }
                        alt={`${creator.data.name}'s cover`}
                        fill
                        className="object-cover"
                        priority
                    />


                    {/* Mobile Menu Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 left-2 md:hidden z-20 text-white hover:bg-background/20"
                        onClick={toggleSidebar}
                    >
                        <ArrowDownFromLine className="h-5 w-5" />
                    </Button>

                    {/* Edit Profile Button - Only visible when not editing */}
                    {!isEditingProfile ? (
                        <Button
                            variant="secondary"
                            size="sm"
                            className="absolute top-4 right-4 gap-1"
                            onClick={() => setIsEditingProfile(true)}
                        >
                            <Edit className="h-4 w-4" />
                            <span className="hidden sm:inline">Edit Profile</span>
                        </Button>
                    ) : (
                        <Button
                            variant="secondary"
                            size="sm"
                            className="absolute bottom-4 right-4 gap-1"
                            disabled={coverChangeMutation.isLoading}
                            onClick={() => document.getElementById("cover-upload")?.click()}
                        >
                            <Camera className="h-4 w-4" />
                            <span className="hidden sm:inline">Change Cover</span>
                        </Button>
                    )}

                    {isEditingProfile && (
                        <UploadS3Button
                            endpoint="coverUploader"
                            variant="hidden"
                            id="cover-upload"
                            onClientUploadComplete={(res) => {
                                const fileUrl = res.url
                                coverChangeMutation.mutate(fileUrl)
                            }}
                            onUploadError={(error: Error) => {
                                toast.error(`ERROR! ${error.message}`)
                            }}
                        />
                    )}
                </div>
                <header
                    className={cn(
                        "absolute top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-primary/20 shadow-md h-14 transition-all duration-500 flex items-center justify-between px-4",
                        isScrolled ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0",
                    )}
                    style={{
                        transform: isScrolled ? `translateY(0)` : `translateY(-100%)`,
                        opacity: scrollProgress,
                    }}
                >
                    <div className="flex items-center gap-3">
                        <CustomAvatar url={creator.data.profileUrl} className="h-9 w-9 border-2 border-background" />
                        <div className="flex flex-col">
                            <span className="font-semibold text-sm flex items-center gap-1">
                                {creator.data.name}
                                {creator.data.approved && <CheckCircle2 className="h-3 w-3 text-primary" />}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {isEditingProfile ? "Editing Profile" : "Artist Dashboard"}
                            </span>
                        </div>
                    </div>
                    {isEditingProfile ? (
                        <div className="flex items-center gap-2 mb-8">
                            <Button variant="outline" size="sm" className="gap-1" onClick={cancelProfileEditing}>
                                <X className="h-3 w-3" />
                                <span>Cancel</span>
                            </Button>
                            <Button
                                size="sm"
                                className="gap-1"
                                onClick={saveProfileChanges}
                                disabled={
                                    UpdateCreatorProfileInfo.isLoading ??
                                    !!formErrors.name ??
                                    !!formErrors.bio ??
                                    !!formErrors.website ??
                                    !!formErrors.twitter ??
                                    !!formErrors.instagram
                                }
                            >
                                <CheckCircle2 className="h-3 w-3" />
                                <span>{UpdateCreatorProfileInfo.isLoading ? "Saving..." : "Save"}</span>
                            </Button>
                        </div>
                    ) : (
                        <Button variant="outline" size="sm" className="gap-1" onClick={() => setIsEditingProfile(true)}>
                            <Edit className="h-3 w-3" />
                            <span>Edit Profile</span>
                        </Button>
                    )}
                </header>
            </div>

            {/* Main Content Area with Responsive Sidebar */}
            <div className="flex flex-1 overflow-hidden ">
                {/* Left Sidebar - Fixed on desktop, slide-in on mobile */}
                <div
                    className={cn(
                        "w-[300px] shrink-0 border-r bg-card h-full absolute md:relative transition-transform duration-500 z-40",
                        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
                    )}
                >
                    {/* Close button for mobile sidebar */}
                    <Button variant="ghost" size="icon" className="absolute top-2 right-2 md:hidden" onClick={toggleSidebar}>
                        <X className="h-5 w-5" />
                    </Button>

                    <div className="h-full flex flex-col p-6 overflow-auto pb-32">
                        <div className="flex flex-col items-center pt-4">
                            {/* Profile Image */}
                            <div className="relative">
                                <CustomAvatar
                                    url={creator.data?.profileUrl}
                                    className="h-24 w-24 border-4 border-background shadow-xl"
                                />

                                {creator.data.approved && (
                                    <div className="absolute bottom-1 right-1 bg-primary text-primary-foreground rounded-full p-1 shadow-lg">
                                        <CheckCircle2 className="h-4 w-4" />
                                    </div>
                                )}

                                {/* Edit Profile Image Button */}
                                {isEditingProfile && (
                                    <>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="absolute -bottom-2 -right-2 h-8 w-8 p-0 rounded-full"
                                            disabled={updateProfileMutation.isLoading}
                                            onClick={() => document.getElementById("profile-upload")?.click()}
                                        >
                                            <Camera className="h-4 w-4" />
                                        </Button>
                                        <UploadS3Button
                                            endpoint="profileUploader"
                                            variant="hidden"
                                            id="profile-upload"
                                            onClientUploadComplete={(res) => {
                                                const fileUrl = res.url
                                                updateProfileMutation.mutate(fileUrl)
                                            }}
                                            onUploadError={(error: Error) => {
                                                toast.error(`ERROR! ${error.message}`)
                                            }}
                                        />
                                    </>
                                )}
                            </div>

                            {/* Profile Info */}
                            <div className="mt-4 text-center w-full">
                                {isEditingProfile ? (
                                    <Input
                                        value={editedProfile.name}
                                        onChange={(e) => {
                                            const value = e.target.value
                                            setEditedProfile({ ...editedProfile, name: value })
                                            setFormErrors({
                                                ...formErrors,
                                                name: value.length > 99 ? "Name must be less than 99 characters" : "",
                                            })
                                        }}
                                        className={cn("text-center font-bold text-xl mb-1", formErrors.name && "border-destructive")}
                                        maxLength={99}
                                    />
                                ) : (
                                    <h1 className="text-xl md:text-2xl font-bold flex items-center justify-center gap-1">
                                        {creator.data.name}
                                        {creator.data.approved && <CheckCircle2 className="h-4 w-4 text-primary" />}
                                    </h1>
                                )}

                                {isEditingProfile ? (
                                    <div className="mt-3">
                                        <Label htmlFor="bio" className="text-sm">
                                            Bio
                                        </Label>
                                        <Textarea
                                            id="bio"
                                            value={editedProfile.bio}
                                            onChange={(e) => {
                                                const value = e.target.value
                                                setEditedProfile({ ...editedProfile, bio: value })
                                                const wordCount = value.trim().split(/\s+/).length
                                                setFormErrors({
                                                    ...formErrors,
                                                    bio: wordCount > 200 ? "Bio must be less than 200 words" : "",
                                                })
                                            }}
                                            className={cn("mt-1 resize-none", formErrors.bio && "border-destructive")}
                                            rows={3}
                                        />
                                        {formErrors.bio && <p className="text-xs text-destructive mt-1">{formErrors.bio}</p>}
                                    </div>
                                ) : (
                                    <p className="mt-3 text-sm text-muted-foreground">
                                        {creator.data?.bio && creator.data.bio.length > 0 ? creator.data.bio : "No bio provided"}
                                    </p>
                                )}
                            </div>
                        </div>

                        <Separator className="my-6" />

                        {/* Profile Stats */}
                        <div className="grid grid-cols-3 gap-2 w-full">
                            <div className="text-center p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer">
                                <p className="text-xl font-bold">{creator.data._count.followers ?? 0}</p>
                                <p className="text-xs text-muted-foreground">Followers</p>
                            </div>
                            <div className="text-center p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer">
                                <p className="text-xl font-bold">{creator.data._count.posts ?? 0}</p>
                                <p className="text-xs text-muted-foreground">Posts</p>
                            </div>
                            <div className="text-center p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer">
                                <p className="text-xl font-bold">{creator.data._count.assets ?? 0}</p>
                                <p className="text-xs text-muted-foreground">NFTs</p>
                            </div>
                        </div>

                        <Separator className="my-6" />

                        {/* Social Links */}
                        {isEditingProfile ? (
                            <div className="w-full space-y-4">
                                <div>
                                    <Label htmlFor="website" className="text-sm">
                                        Website
                                    </Label>
                                    <div className="flex items-center mt-1">
                                        <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                                        <Input
                                            id="website"
                                            value={editedProfile.website}
                                            onChange={(e) => {
                                                const value = e.target.value
                                                setEditedProfile({ ...editedProfile, website: value })

                                                // URL validation
                                                if (value && !isValidUrl(value)) {
                                                    setFormErrors({
                                                        ...formErrors,
                                                        website: "Please enter a valid URL",
                                                    })
                                                } else {
                                                    setFormErrors({
                                                        ...formErrors,
                                                        website: "",
                                                    })
                                                }
                                            }}
                                            placeholder="https://yourwebsite.com"
                                            className={formErrors.website ? "border-destructive" : ""}
                                        />
                                    </div>
                                    {formErrors.website && <p className="text-xs text-destructive mt-1">{formErrors.website}</p>}
                                </div>
                                <div>
                                    <Label htmlFor="twitter" className="text-sm">
                                        Twitter
                                    </Label>
                                    <div className="flex items-center mt-1">
                                        <Twitter className="h-4 w-4 mr-2 text-muted-foreground" />
                                        <Input
                                            id="twitter"
                                            value={editedProfile.twitter}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/^@/, "") // Remove @ if user types it
                                                setEditedProfile({ ...editedProfile, twitter: value })

                                                // Twitter handle validation
                                                if (value && !/^[A-Za-z0-9_]{1,15}$/.test(value)) {
                                                    setFormErrors({
                                                        ...formErrors,
                                                        twitter: "Twitter handle must be 1-15 alphanumeric characters or underscores",
                                                    })
                                                } else {
                                                    setFormErrors({
                                                        ...formErrors,
                                                        twitter: "",
                                                    })
                                                }
                                            }}
                                            placeholder="username"
                                            className={formErrors.twitter ? "border-destructive" : ""}
                                        />
                                    </div>
                                    {formErrors.twitter && <p className="text-xs text-destructive mt-1">{formErrors.twitter}</p>}
                                </div>
                                <div>
                                    <Label htmlFor="instagram" className="text-sm">
                                        Instagram
                                    </Label>
                                    <div className="flex items-center mt-1">
                                        <Instagram className="h-4 w-4 mr-2 text-muted-foreground" />
                                        <Input
                                            id="instagram"
                                            value={editedProfile.instagram}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/^@/, "") // Remove @ if user types it
                                                setEditedProfile({ ...editedProfile, instagram: value })

                                                // Instagram handle validation
                                                if (value && !/^[A-Za-z0-9._]{1,30}$/.test(value)) {
                                                    setFormErrors({
                                                        ...formErrors,
                                                        instagram: "Instagram handle must be 1-30 alphanumeric characters, periods, or underscores",
                                                    })
                                                } else {
                                                    setFormErrors({
                                                        ...formErrors,
                                                        instagram: "",
                                                    })
                                                }
                                            }}
                                            placeholder="username"
                                            className={formErrors.instagram ? "border-destructive" : ""}
                                        />
                                    </div>
                                    {formErrors.instagram && <p className="text-xs text-destructive mt-1">{formErrors.instagram}</p>}
                                </div>
                            </div>
                        ) : (
                            <div className="w-full space-y-3">
                                {creator.data.website && (
                                    <div>
                                        <Link
                                            href={creator.data.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
                                        >
                                            <Globe className="h-4 w-4 mr-2" />
                                            <span>{creator.data.website.replace(/(^\w+:|^)\/\//, "")}</span>
                                        </Link>
                                    </div>
                                )}
                                {creator.data.twitter && (
                                    <div>
                                        <Link
                                            href={`https://twitter.com/${creator.data.twitter}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center text-sm text-muted-foreground hover:text-[#1DA1F2] transition-colors"
                                        >
                                            <Twitter className="h-4 w-4 mr-2" />
                                            <span>@{creator.data.twitter}</span>
                                        </Link>
                                    </div>
                                )}
                                {creator.data.instagram && (
                                    <div>
                                        <Link
                                            href={`https://instagram.com/${creator.data.instagram}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center text-sm text-muted-foreground hover:text-[#E1306C] transition-colors"
                                        >
                                            <Instagram className="h-4 w-4 mr-2" />
                                            <span>@{creator.data.instagram}</span>
                                        </Link>
                                    </div>
                                )}

                                <div className="flex items-center text-sm text-muted-foreground">
                                    <Calendar className="h-4 w-4 mr-2" />
                                    <span>Joined {new Date(creator.data.joinedAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        )}

                        {/* Edit Profile Buttons */}
                        {isEditingProfile && (
                            <div className="flex gap-2 mt-6 w-full mb-8">
                                <Button variant="outline" className="flex-1" onClick={cancelProfileEditing}>
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={saveProfileChanges}
                                    disabled={
                                        UpdateCreatorProfileInfo.isLoading ??
                                        !!formErrors.name ??
                                        !!formErrors.bio ??
                                        !!formErrors.website ??
                                        !!formErrors.twitter ??
                                        !!formErrors.instagram
                                    }
                                >
                                    {UpdateCreatorProfileInfo.isLoading ? "Saving..." : "Save"}
                                </Button>
                            </div>
                        )}

                        {/* Sidebar Footer */}
                        <div className="mt-auto pt-6">
                            <Button variant="outline" className="w-full" asChild>
                                <Link href={`/organization/${creator.data.id}`}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Public Profile
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Overlay for mobile sidebar */}
                {isSidebarOpen && (
                    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-10 md:hidden" onClick={toggleSidebar} />
                )}

                {/* Right Content Area - Scrollable */}
                <div className="flex-1 relative">
                    <div ref={contentRef} className="absolute inset-0 overflow-auto">
                        <div className="p-1 md:p-6 pb-20">
                            {/* Dashboard Header */}
                            <div className="flex items-center justify-between mb-8">
                                <h1 className="text-2xl md:text-3xl font-bold">Artist Dashboard</h1>
                                <div className="flex items-center gap-2">
                                    <Button size="sm" className="h-9 md:h-10" onClick={() => setIsPostModalOpen(true)}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        <span className="hidden sm:inline">Create Post</span>
                                        <span className="sm:hidden">Post</span>
                                    </Button>
                                </div>
                            </div>

                            {/* Stats Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Followers</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center">
                                            <Users className="h-5 w-5 text-muted-foreground mr-2" />
                                            <div className="text-2xl font-bold">{creator.data._count.followers ?? 0}</div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Posts</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center">
                                            <Grid3X3 className="h-5 w-5 text-muted-foreground mr-2" />
                                            <div className="text-2xl font-bold">{creator.data._count.posts ?? 0}</div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Total NFTs</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center">
                                            <ImageIcon className="h-5 w-5 text-muted-foreground mr-2" />
                                            <div className="text-2xl font-bold">{creator.data._count.assets ?? 0}</div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center">
                                            <DollarSign className="h-5 w-5 text-muted-foreground mr-2" />
                                            <div className="text-2xl font-bold">-</div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                            {/* Subscription Packages Section */}
                            <div className="mb-8">
                                {
                                    subscriptionPackages.data && subscriptionPackages.data?.length > 0 && (
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="text-xl font-bold">Subscription Packages</h2>
                                            <Button size="sm" onClick={() => openForCreate({
                                                customPageAsset: creator.data?.customPageAssetCodeIssuer,
                                                pageAsset: creator.data?.pageAsset,
                                            })}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                Create New Package
                                            </Button>
                                        </div>
                                    )
                                }

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {subscriptionPackages.isLoading && <SubscriptionPackagesSkeleton />}
                                    {
                                        subscriptionPackages.data?.length === 0 && (
                                            <div className="text-center py-12 bg-muted/30 rounded-lg">
                                                <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                                <h3 className="text-lg font-medium mb-2">No Subscription Packages Found</h3>
                                                <p className="text-muted-foreground mb-4">Start creating subscription packages for your followers</p>
                                                <Button onClick={() => openForCreate({
                                                    customPageAsset: creator.data?.customPageAssetCodeIssuer,
                                                    pageAsset: creator.data?.pageAsset,
                                                })}>
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    Create New Package
                                                </Button>
                                            </div>
                                        )
                                    }
                                    {subscriptionPackages.data?.map((pkg) => (
                                        <Card
                                            key={pkg.id}
                                            className={cn(
                                                "relative overflow-hidden h-full border-2 hover:shadow-md transition-all duration-200",
                                                pkg.popular ? "border-primary" : "border-border",
                                                !pkg.isActive && "opacity-60",
                                                expandedPackage === pkg.id && "ring-2 ring-primary",
                                            )}
                                        >
                                            <div className={cn("h-2", pkg.color)} />
                                            <CardHeader className="pb-2 w-full">
                                                <div className="flex justify-between w-full">
                                                    <div className="flex flex-col w-full">
                                                        <CardTitle className="w-full">
                                                            <div className="flex items-center gap-2 justify-between  w-full">
                                                                <span>  {pkg.name}</span>
                                                                <SubscriptionContextMenu
                                                                    creatorId={pkg.creatorId}
                                                                    subscription={pkg}
                                                                    pageAsset={creator.data?.pageAsset}
                                                                    customPageAsset={creator.data?.customPageAssetCodeIssuer}

                                                                />
                                                            </div>

                                                        </CardTitle>
                                                        <div className="flex items-baseline mt-2">
                                                            <span className="text-3xl font-bold">{pkg.price}</span>
                                                            <span className="text-muted-foreground ml-1">
                                                                {creator.data?.pageAsset
                                                                    ? creator.data?.pageAsset.code
                                                                    : creator.data?.customPageAssetCodeIssuer?.split("-")[0]}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {pkg.popular && (
                                                    <div className="absolute top-0 right-0">
                                                        <div className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                                                            POPULAR
                                                        </div>
                                                    </div>
                                                )}
                                                <CardDescription className="mt-2">{pkg.description}</CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4 pb-2">
                                                <ul className="space-y-2">
                                                    {pkg.features
                                                        .slice(0, expandedPackage === pkg.id ? pkg.features.length : 3)
                                                        .map((feature, i) => (
                                                            <li key={i} className="flex items-start gap-2">
                                                                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                                                <span>{feature}</span>
                                                            </li>
                                                        ))}
                                                </ul>

                                                {pkg.features.length > 3 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="w-full text-xs"
                                                        onClick={() => togglePackageExpansion(pkg.id)}
                                                    >
                                                        {expandedPackage === pkg.id ? (
                                                            <>
                                                                <ChevronUp className="h-4 w-4 mr-1" />
                                                                Show Less
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ChevronDown className="h-4 w-4 mr-1" />
                                                                Show All Features
                                                            </>
                                                        )}
                                                    </Button>
                                                )}
                                            </CardContent>
                                            <CardFooter>
                                                <div className="flex items-center justify-between w-full">
                                                    <Badge variant={pkg.isActive ? "default" : "outline"}>
                                                        {pkg.isActive ? "Active" : "Inactive"}
                                                    </Badge>
                                                </div>
                                            </CardFooter>
                                        </Card>
                                    ))}
                                </div>
                            </div>

                            {/* Content Tabs */}
                            <div>
                                <Tabs defaultValue="posts" value={activeTab} onValueChange={setActiveTab} className="w-full">
                                    <TabsList className="grid grid-cols-2 w-full sm:w-[300px] mb-6">
                                        <TabsTrigger value="posts" className="flex items-center gap-2">
                                            <Grid3X3 className="h-4 w-4" />
                                            <span>Posts</span>
                                        </TabsTrigger>
                                        <TabsTrigger value="nfts" className="flex items-center gap-2">
                                            <ImageIcon className="h-4 w-4" />
                                            <span>NFTs</span>
                                        </TabsTrigger>
                                    </TabsList>

                                    {/* Posts Tab */}
                                    <TabsContent value="posts" className="space-y-6  mb-16 ">
                                        <div className="flex justify-between items-center">
                                            <h2 className="text-xl font-bold">Your Posts</h2>
                                            <Button size="sm" onClick={() => setIsPostModalOpen(true)}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                Create New Post
                                            </Button>
                                        </div>

                                        <div className="space-y-6 ">
                                            {allCreatedPost.isLoading && (
                                                <div className="space-y-4 ">
                                                    {[1, 2, 3].map((i) => (
                                                        <Card key={i} className="overflow-hidden">
                                                            <CardHeader>
                                                                <Skeleton className="h-6 w-1/3 mb-2" />
                                                                <Skeleton className="h-4 w-1/4" />
                                                            </CardHeader>
                                                            <CardContent>
                                                                <Skeleton className="h-4 w-full mb-2" />
                                                                <Skeleton className="h-4 w-full mb-2" />
                                                                <Skeleton className="h-4 w-2/3 mb-4" />
                                                                <Skeleton className="h-48 w-full rounded-md mb-4" />
                                                            </CardContent>
                                                        </Card>
                                                    ))}
                                                </div>
                                            )}

                                            {allCreatedPost.data?.pages.map((page, i) => (
                                                <React.Fragment key={i}>
                                                    {page.posts.map((post) => (

                                                        <PostCard
                                                            key={post.id}
                                                            post={post}
                                                            creator={post.creator}
                                                            likeCount={post._count.likes}
                                                            commentCount={post._count.comments}
                                                            locked={post.subscription ? true : false}
                                                            show={true}
                                                            media={post.medias}
                                                        />

                                                    ))}
                                                </React.Fragment>
                                            ))}

                                            {allCreatedPost.hasNextPage && (
                                                <Button
                                                    variant="outline"
                                                    className="w-full"
                                                    onClick={() => allCreatedPost.fetchNextPage()}
                                                    disabled={allCreatedPost.isFetchingNextPage}
                                                >
                                                    {allCreatedPost.isFetchingNextPage ? "Loading more..." : "Load More Posts"}
                                                </Button>
                                            )}

                                            {allCreatedPost.data?.pages[0]?.posts.length === 0 && (
                                                <div className="text-center py-12 bg-muted/30 rounded-lg">
                                                    <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                                    <h3 className="text-lg font-medium mb-2">No Posts Yet</h3>
                                                    <p className="text-muted-foreground mb-4">Start creating content for your followers</p>
                                                    <Button onClick={() => setIsPostModalOpen(true)}>
                                                        <Plus className="h-4 w-4 mr-2" />
                                                        Create Your First Post
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </TabsContent>

                                    {/* NFTs Tab */}
                                    <TabsContent value="nfts">
                                        <div className="flex justify-between items-center mb-6">
                                            <h2 className="text-xl font-bold">Your NFT Collection</h2>
                                            <Button onClick={() => setIsNFTModalOpen(true)}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                Create New NFT
                                            </Button>
                                        </div>

                                        <div className="min-h-[calc(100vh-20vh)] flex flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md">
                                            {creatorNFT.isLoading && (
                                                <MoreAssetsSkeleton className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4 xl:grid-cols-5" />
                                            )}

                                            {creatorNFT.data?.pages[0]?.nfts.length === 0 && (
                                                <div className="h-full flex items-center justify-center flex-col text-lg font-bold">
                                                    <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                                    <h3 className="text-lg font-medium mb-2">No NFTs Found</h3>
                                                    <p className="text-muted-foreground mb-4">Start creating your NFT collection</p>
                                                    <Button onClick={() => setIsNFTModalOpen(true)}>
                                                        <Plus className="h-4 w-4 mr-2" />
                                                        Create Your First NFT
                                                    </Button>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4 xl:grid-cols-5">
                                                {creatorNFT.data?.pages.map((items, itemIndex) =>
                                                    items.nfts.map((item, index) => (
                                                        <MarketAssetComponent key={`music-${itemIndex}-${index}`} item={item} />
                                                    )),
                                                )}
                                            </div>

                                            {creatorNFT.hasNextPage && (
                                                <Button
                                                    className="flex w-1/2 items-center justify-center shadow-sm shadow-black md:w-1/4"
                                                    onClick={() => creatorNFT.fetchNextPage()}
                                                    disabled={creatorNFT.isFetchingNextPage}
                                                >
                                                    {creatorNFT.isFetchingNextPage ? "Loading more..." : "Load More"}
                                                </Button>
                                            )}
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function SubscriptionPackagesSkeleton() {
    // Create an array of 3 items to represent the loading cards
    const skeletonCards = Array(3).fill(null)

    return (
        <>
            {skeletonCards.map((_, index) => (
                <div key={index}>
                    <Card className="relative overflow-hidden h-full border-2 hover:shadow-md transition-all duration-200">
                        <div className="h-2 bg-muted" />
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div className="w-full">
                                    <Skeleton className="h-6 w-3/4 mb-2" />
                                    <div className="flex items-baseline mt-2">
                                        <Skeleton className="h-8 w-20" />
                                        <Skeleton className="h-4 w-12 ml-1" />
                                    </div>
                                </div>
                                <Skeleton className="h-8 w-8 rounded-full" />
                            </div>
                            <Skeleton className="h-4 w-full mt-2" />
                        </CardHeader>
                        <CardContent className="space-y-4 pb-2">
                            <div className="space-y-2">
                                {Array(4)
                                    .fill(null)
                                    .map((_, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <Skeleton className="h-5 w-5 rounded-full shrink-0 mt-0.5" />
                                            <Skeleton className="h-4 w-full" />
                                        </div>
                                    ))}
                            </div>
                            <Skeleton className="h-8 w-full" />
                        </CardContent>
                        <CardFooter>
                            <div className="flex items-center justify-between w-full">
                                <Skeleton className="h-5 w-16" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            ))}
        </>
    )
}

