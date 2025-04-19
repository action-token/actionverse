"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import {
    CheckCircle2,
    Globe,
    Twitter,
    Instagram,
    Calendar,
    Camera,
    ChevronDown,
    ChevronUp,
    ArrowLeft,
    ArrowRight,
    Edit,
    Save,
    X,
} from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Slider } from "~/components/shadcn/ui/slider"
import { Input } from "~/components/shadcn/ui/input"
import { Textarea } from "~/components/shadcn/ui/textarea"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/shadcn/ui/dropdown-menu"
import { cn } from "~/lib/utils"
import { toast } from "~/components/shadcn/ui/use-toast"
import { api } from "~/utils/api"
import { UploadS3Button } from "../common/upload-button"
import ChartWidget from "./chart-widget"
import CustomAvatar from "../common/custom-avatar"
import LyricsWidget from "./lyrics-widget"
import type { CreatorWithPageAsset, Theme } from "~/types/organization/dashboard"
import CustomHTMLWidget from "./custom-html-widget"
import CalendarWidget from "./calendar-widget"

// Add a global style fix at the top of the component to ensure proper z-index and backdrop for all popover/sheet components

// Add this right after the imports, before the component definition
const GLOBAL_STYLES = `
  .popover-content, 
  .dropdown-content {
    z-index: 9999 !important;
    background-color: var(--background) !important;
    color: var(--foreground) !important;
    border: 1px solid var(--border) !important;
  }
  
  [data-radix-popper-content-wrapper] {
    z-index: 9999 !important;
  }
`

// Define types for the widget settings
interface CoverProfileSettings {
    displayMode: "standard" | "sidebar" | "hero" | "minimal" | "band"
    coverHeight: number
    profilePosition: "left" | "center" | "right"
    sidebarPosition: "left" | "right"
    coverOverlayOpacity: number
    coverOverlayColor: string
    coverTextOverlay: string
    coverTextPosition: "top" | "center" | "bottom"
    coverTextAlignment: "left" | "center" | "right"
    coverTextColor: string
    coverTextSize: number
    heroProfileSize: number
    heroContentPosition: "over" | "below"
    height?: "SS" | "S" | "M" | "L" | "XL" | "2XL" | "3XL" | "4XL"
    width?: "SS" | "S" | "M" | "L" | "XL" | "2XL" | "3XL" | "4XL"
}

// Define default settings
const DEFAULT_SETTINGS: CoverProfileSettings = {
    displayMode: "standard",
    coverHeight: 180,
    profilePosition: "left",
    sidebarPosition: "left",
    coverOverlayOpacity: 0,
    coverOverlayColor: "#000000",
    coverTextOverlay: "",
    coverTextPosition: "center",
    coverTextAlignment: "center",
    coverTextColor: "#ffffff",
    coverTextSize: 32,
    heroProfileSize: 120,
    heroContentPosition: "over",
    height: "M",
    width: "L",
}

// Define types for the component props
interface CoverProfileWidgetProps {
    editMode?: boolean
    profileEditMode?: boolean
    setProfileEditMode?: (editMode: boolean) => void
    theme?: Theme
    onDragOver?: (e: React.DragEvent) => void
    onDragEnter?: (e: React.DragEvent) => void
    onDragLeave?: (e: React.DragEvent) => void
    onDrop?: (e: React.DragEvent, targetId: string) => void
    widgetId?: string
    settings?: Partial<CoverProfileSettings>
    onSettingsChange?: (settings: CoverProfileSettings) => void
    creatorData: CreatorWithPageAsset
    showDefaultValues?: boolean
}

export default function CoverProfileWidget({
    editMode = false,
    profileEditMode = false,
    setProfileEditMode,
    theme,
    onDragOver,
    onDragEnter,
    onDragLeave,
    onDrop,
    widgetId = "cover-profile",
    settings = {},
    onSettingsChange,
    creatorData,
    showDefaultValues = false,
}: CoverProfileWidgetProps) {
    // Create a ref to track if settings have been initialized
    const settingsInitialized = useRef(false)
    // Create a ref to track if we're currently updating settings
    const isUpdatingSettings = useRef(false)

    // Create a ref to track if we're in a controlled resize operation
    const isResizing = useRef(false)

    // Create a ref to store the timeout ID for debounced settings updates
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Add this new ref at the top of the component with the other refs:
    const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Add these new refs near the top of the component with the other refs
    const heightControlsButtonRef = useRef<HTMLButtonElement>(null)
    const heightControlsPanelRef = useRef<HTMLDivElement>(null)

    // Merge default settings with provided settings
    const mergedSettings = { ...DEFAULT_SETTINGS, ...settings }

    // State for widget settings
    const [widgetSettings, setWidgetSettings] = useState<CoverProfileSettings>(mergedSettings)

    // State for UI controls
    const [showHeightControls, setShowHeightControls] = useState(false)

    // Sample creator data for edit mode
    const SAMPLE_CREATOR_DATA = {
        id: "creator-123",
        name: "Alex Rivera",
        bio: "Digital artist specializing in abstract art and NFT collections. Creating at the intersection of art and technology.",
        website: "https://alexrivera.art",
        twitter: "alexriveraart",
        instagram: "alexrivera.art",
        profileUrl: "/placeholder.svg?height=200&width=200",
        coverUrl: "/placeholder.svg?height=400&width=1200",
        approved: true,
        joinedAt: "2023-01-15T00:00:00.000Z",
        pageAsset: { code: "SOL" },
        customPageAssetCodeIssuer: null,
        _count: {
            followers: 1248,
            posts: 87,
            assets: 24,
            revenue: 3500,
        },
    }

    // State for profile editing
    // Profile editing state
    const [editedProfile, setEditedProfile] = useState({
        name: creatorData.name ?? "",
        bio: creatorData.bio ?? "",
        website: creatorData.website ?? "",
        twitter: creatorData.twitter ?? "",
        instagram: creatorData.instagram ?? "",
    })
    const [showSuccessMessage, setShowSuccessMessage] = useState(false)

    const [formErrors, setFormErrors] = useState({
        name: "",
        bio: "",
        website: "",
        twitter: "",
        instagram: "",
    })
    // Cancel profile editing
    const handleCancelEditProfile = () => {
        setEditedProfile({
            name: creatorData.name ?? "",
            bio: creatorData.bio ?? "",
            website: creatorData.website ?? "",
            twitter: creatorData.twitter ?? "",
            instagram: creatorData.instagram ?? "",
        })
        setFormErrors({
            name: "",
            bio: "",
            website: "",
            twitter: "",
            instagram: "",
        })
        setProfileEditMode?.(false)
    }
    // Update profile info mutation
    const UpdateCreatorProfileInfo = api.fan.creator.updateCreatorProfileInfo.useMutation({
        onSuccess: () => {
            toast({
                title: "Profile updated",
                description: "Your profile information has been updated successfully.",
            })

            setShowSuccessMessage(true)
            setTimeout(() => setShowSuccessMessage(false), 3000)
        },
        onError: (error) => {
            toast({
                title: "Error updating profile",
                description: error.message,
                variant: "destructive",
            })
        },
    })
    const updateProfileMutation = api.fan.creator.changeCreatorProfilePicture.useMutation({
        onSuccess: () => {
            toast({
                title: "Profile picture updated",
                description: "Your profile picture has been updated successfully.",
            })
        },
    })
    const coverChangeMutation = api.fan.creator.changeCreatorCoverPicture.useMutation({
        onSuccess: () => {
            toast({
                title: "Cover picture updated",
                description: "Your cover picture has been updated successfully.",
            })
        },
    })

    // Apply settings when they change from props
    useEffect(() => {
        if (!settingsInitialized.current && Object.keys(settings).length > 0) {
            setWidgetSettings({ ...DEFAULT_SETTINGS, ...settings })
            settingsInitialized.current = true
        }
    }, [settings])

    // Improve the resize functionality to reduce lag
    // Find the updateSetting function and replace it with this optimized version:

    const updateSetting = <K extends keyof CoverProfileSettings>(key: K, value: CoverProfileSettings[K]) => {
        // Skip if we're currently resizing (prevents feedback loops)
        if (isResizing.current && (key === "coverHeight" || key === "heroProfileSize")) {
            // Use requestAnimationFrame for smoother visual updates during resize
            requestAnimationFrame(() => {
                setWidgetSettings((prev) => ({ ...prev, [key]: value }))
            })
            return
        }

        // Update local state immediately
        setWidgetSettings((prev) => ({ ...prev, [key]: value }))

        // Debounce the settings update to parent component
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current)
        }

        updateTimeoutRef.current = setTimeout(() => {
            if (onSettingsChange && !isUpdatingSettings.current) {
                isUpdatingSettings.current = true
                onSettingsChange({ ...widgetSettings, [key]: value })

                // Reset the updating flag after a short delay
                setTimeout(() => {
                    isUpdatingSettings.current = false
                }, 100)
            }
        }, 300)
    }

    // Start resize operation
    const startResize = () => {
        isResizing.current = true
    }

    // Modify the endResize function to NOT hide the controls automatically
    // Replace the endResize function with this:

    const endResize = () => {
        isResizing.current = false

        // Update settings after resize is complete
        if (onSettingsChange) {
            onSettingsChange(widgetSettings)
        }

        // Do NOT hide height controls automatically
        // The controls will remain visible until user clicks outside
    }

    // Handle profile save
    const handleSaveProfile = () => {
        UpdateCreatorProfileInfo.mutate({
            name: editedProfile.name,
            bio: editedProfile.bio,
            website: editedProfile.website,
            twitter: editedProfile.twitter,
            instagram: editedProfile.instagram,
        })
    }

    // Handle drag events
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        if (onDragOver) onDragOver(e)
    }

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault()
        if (onDragEnter) onDragEnter(e)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        if (onDragLeave) onDragLeave(e)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        if (onDrop) onDrop(e, widgetId)
    }

    // Remove the click-outside detection useEffect since we want the controls to hide automatically
    // Replace the existing useEffect for cleanup with this simpler version
    useEffect(() => {
        return () => {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current)
            }
            if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current)
            }
        }
    }, [])

    // Then, add a proper click-outside detection mechanism
    // Add this useEffect after the other useEffect hooks:

    useEffect(() => {
        // Function to handle clicks outside the height controls
        const handleClickOutside = (event: MouseEvent) => {
            if (
                showHeightControls &&
                heightControlsButtonRef.current &&
                heightControlsPanelRef.current &&
                !heightControlsButtonRef.current.contains(event.target as Node) &&
                !heightControlsPanelRef.current.contains(event.target as Node)
            ) {
                setShowHeightControls(false)
            }
        }

        // Add event listener
        document.addEventListener("mousedown", handleClickOutside)

        // Clean up
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [showHeightControls])

    // Use the appropriate data source based on showDefaultValues
    const displayData = creatorData

    // Render the widget based on display mode
    const renderWidget = () => {
        switch (widgetSettings.displayMode) {
            case "standard":
                return renderStandardMode()
            case "sidebar":
                return renderSidebarMode()
            case "hero":
                return renderHeroMode()
            case "minimal":
                return renderMinimalMode()
            case "band":
                return renderBandMode()
            default:
                return renderStandardMode()
        }
    }

    // Render standard display mode
    const renderStandardMode = () => (
        <>
            {/* Cover Photo with Profile */}
            <div
                className="relative"
                style={{ height: `${widgetSettings.coverHeight}px` }}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="absolute inset-0 overflow-hidden">
                    <Image src={displayData.coverUrl ?? "/placeholder.svg"} alt="Cover" fill className="object-cover" priority />
                    {/* Cover overlay */}
                    {widgetSettings.coverOverlayOpacity > 0 && (
                        <div
                            className="absolute inset-0"
                            style={{
                                backgroundColor: widgetSettings.coverOverlayColor,
                                opacity: widgetSettings.coverOverlayOpacity,
                            }}
                        />
                    )}
                </div>

                {/* Profile Image - Positioned to overlap with cover */}
                <div
                    className={`absolute -bottom-16 z-10 ${widgetSettings.profilePosition === "left"
                        ? "left-6"
                        : widgetSettings.profilePosition === "right"
                            ? "right-6"
                            : "left-1/2 transform -translate-x-1/2"
                        }`}
                >
                    <div className="relative">
                        <div className="h-32 w-32 rounded-full overflow-hidden border-4 border-background shadow-xl">
                            <CustomAvatar url={displayData.profileUrl} className="h-full w-full border-2 border-background" />
                        </div>

                        {displayData.approved && (
                            <div className="absolute bottom-1 right-1 bg-primary text-primary-foreground rounded-full p-1 shadow-lg">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                        )}

                        {profileEditMode && (
                            <Button
                                onClick={() => document.getElementById("profile-upload")?.click()}
                                variant="secondary"
                                size="sm"
                                className="absolute bottom-0 right-0 h-8 w-8 p-0 rounded-full"
                            >
                                <Camera className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Edit controls for cover photo */}
                {(editMode ?? profileEditMode) && (
                    <>
                        {profileEditMode && (
                            <Button
                                onClick={() => document.getElementById("cover-upload")?.click()}
                                variant="secondary"
                                size="sm"
                                className="absolute top-2 right-2 gap-1"
                            >
                                <Camera className="h-4 w-4" />
                                <span>Change Cover</span>
                            </Button>
                        )}

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="secondary" size="sm" className="absolute top-2 left-2">
                                    Profile Position
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-background border border-border z-50">
                                <DropdownMenuItem onClick={() => updateSetting("profilePosition", "left")}>Left</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateSetting("profilePosition", "center")}>Center</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateSetting("profilePosition", "right")}>Right</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        {!profileEditMode && (
                            <Button
                                variant="secondary"
                                size="sm"
                                className={`absolute bottom-2 ${widgetSettings.profilePosition === "right" ? "left-2" : "right-2"}`}
                                onClick={() => setShowHeightControls(!showHeightControls)}
                                ref={heightControlsButtonRef}
                            >
                                {showHeightControls ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                <span className="ml-1">Height</span>
                            </Button>
                        )}

                        {showHeightControls && (
                            <div
                                className={`absolute bottom-12 ${widgetSettings.profilePosition === "right" ? "left-2" : "right-2"} bg-background/90 backdrop-blur-sm p-3 rounded-md shadow-md w-48`}
                                ref={heightControlsPanelRef}
                            >
                                <Slider
                                    value={[widgetSettings.coverHeight]}
                                    min={120}
                                    max={400}
                                    step={10}
                                    onValueChange={(value) => {
                                        startResize()
                                        // Use a less frequent update interval during active resize
                                        const newHeight = value[0] ?? DEFAULT_SETTINGS.coverHeight
                                        // Only update if the change is significant (5px or more)
                                        if (Math.abs(newHeight - widgetSettings.coverHeight) >= 5) {
                                            updateSetting("coverHeight", newHeight)
                                        }
                                    }}
                                    className="mb-1"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>120px</span>
                                    <span>{widgetSettings.coverHeight}px</span>
                                    <span>400px</span>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Profile Info */}
            <div
                className="pt-20 px-6 pb-4 flex flex-col"
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {(profileEditMode ?? profileEditMode) ? (
                    <div className="flex flex-col space-y-4">
                        <Input
                            value={editedProfile.name}
                            onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                            className="text-2xl font-bold"
                        />
                        <Textarea
                            value={editedProfile.bio ?? ""}
                            onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                            className="resize-none"
                            rows={3}
                        />
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleCancelEditProfile}>
                                Cancel
                            </Button>
                            <Button onClick={handleSaveProfile}>Save</Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <div className="flex items-center justify-between">
                            <h2
                                className="text-2xl font-bold flex items-center gap-1"
                                style={{ fontFamily: theme?.font?.heading ?? "inherit" }}
                            >
                                {editedProfile.name}
                                {displayData.approved && <CheckCircle2 className="h-5 w-5 text-primary" />}
                            </h2>
                        </div>
                        <p className="mt-1 text-muted-foreground line-clamp-2">{editedProfile.bio}</p>
                    </div>
                )}

                <div className="mt-4 space-y-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {displayData.website && (
                        <div>
                            <Link
                                href={displayData.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
                            >
                                <Globe className="h-4 w-4 mr-2" />
                                <span className="truncate">{displayData.website.replace(/(^\w+:|^)\/\//, "")}</span>
                            </Link>
                        </div>
                    )}
                    {displayData.twitter && (
                        <div>
                            <Link
                                href={`https://twitter.com/${displayData.twitter}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center text-sm text-muted-foreground hover:text-[#1DA1F2] transition-colors"
                            >
                                <Twitter className="h-4 w-4 mr-2" />
                                <span className="truncate">@{displayData.twitter}</span>
                            </Link>
                        </div>
                    )}
                    {displayData.instagram && (
                        <div>
                            <Link
                                href={`https://instagram.com/${displayData.instagram}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center text-sm text-muted-foreground hover:text-[#E1306C] transition-colors"
                            >
                                <Instagram className="h-4 w-4 mr-2" />
                                <span className="truncate">@{displayData.instagram}</span>
                            </Link>
                        </div>
                    )}

                    <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-2" />
                        <span>Joined {new Date(displayData.joinedAt).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
        </>
    )

    // Render sidebar display mode
    const renderSidebarMode = () => (
        <div
            className="flex flex-col h-full"
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Full-width cover photo */}
            <div className="relative" style={{ height: `${widgetSettings.coverHeight}px` }}>
                <div className="absolute inset-0 overflow-hidden">
                    <Image src={displayData.coverUrl ?? "/placeholder.svg"} alt="Cover" fill className="object-cover" priority />
                    {/* Cover overlay */}
                    {widgetSettings.coverOverlayOpacity > 0 && (
                        <div
                            className="absolute inset-0"
                            style={{
                                backgroundColor: widgetSettings.coverOverlayColor,
                                opacity: widgetSettings.coverOverlayOpacity,
                            }}
                        />
                    )}

                    {/* Text overlay */}
                    {widgetSettings.coverTextOverlay && (
                        <div
                            className="absolute w-full px-6"
                            style={{
                                top:
                                    widgetSettings.coverTextPosition === "top"
                                        ? "20px"
                                        : widgetSettings.coverTextPosition === "bottom"
                                            ? `${widgetSettings.coverHeight - 60}px`
                                            : `${widgetSettings.coverHeight / 2 - 20}px`,
                                textAlign: widgetSettings.coverTextAlignment,
                                color: widgetSettings.coverTextColor,
                                fontSize: `${widgetSettings.coverTextSize}px`,
                                fontFamily: theme?.font?.heading ?? "inherit",
                                fontWeight: "bold",
                                textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                                zIndex: 5,
                            }}
                        >
                            {widgetSettings.coverTextOverlay}
                        </div>
                    )}
                </div>

                {/* Edit controls for cover photo */}
                {(editMode ?? profileEditMode) && (
                    <>
                        {profileEditMode && (
                            <Button
                                onClick={() => document.getElementById("cover-upload")?.click()}
                                variant="secondary"
                                size="sm"
                                className="absolute top-2 right-2 gap-1"
                            >
                                <Camera className="h-4 w-4" />
                                <span>Change Cover</span>
                            </Button>
                        )}

                        {!profileEditMode && (
                            <Button
                                variant="secondary"
                                size="sm"
                                className="absolute bottom-2 right-2"
                                onClick={() => setShowHeightControls(!showHeightControls)}
                                ref={heightControlsButtonRef}
                            >
                                {showHeightControls ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                <span className="ml-1">Height</span>
                            </Button>
                        )}

                        {showHeightControls && (
                            <div
                                className="absolute bottom-12 right-2 bg-background/90 backdrop-blur-sm p-3 rounded-md shadow-md w-48"
                                ref={heightControlsPanelRef}
                            >
                                <Slider
                                    value={[widgetSettings.coverHeight]}
                                    min={120}
                                    max={400}
                                    step={10}
                                    onValueChange={(value) => {
                                        startResize()
                                        // Use a less frequent update interval during active resize
                                        const newHeight = value[0] ?? DEFAULT_SETTINGS.coverHeight
                                        // Only update if the change is significant (5px or more)
                                        if (Math.abs(newHeight - widgetSettings.coverHeight) >= 5) {
                                            updateSetting("coverHeight", newHeight)
                                        }
                                    }}
                                    className="mb-1"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>120px</span>
                                    <span>{widgetSettings.coverHeight}px</span>
                                    <span>400px</span>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Content area with sidebar */}
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar - can be positioned left or right */}
                <div
                    className={cn(
                        "w-64 bg-card border-r border-border p-4 flex flex-col",
                        widgetSettings.sidebarPosition === "right" && "order-last border-l border-r-0",
                    )}
                    style={{
                        borderWidth: theme?.style?.borderWidth ? `${theme.style.borderWidth}px` : undefined,
                        boxShadow:
                            theme?.style?.shadowSize === "sm"
                                ? "0 1px 2px rgba(0,0,0,0.05)"
                                : theme?.style?.shadowSize === "md"
                                    ? "0 4px 6px -1px rgba(0,0,0,0.1)"
                                    : theme?.style?.shadowSize === "lg"
                                        ? "0 10px 15px -3px rgba(0,0,0,0.1)"
                                        : "none",
                    }}
                >
                    {/* Profile Image */}
                    <div className="flex flex-col items-center">
                        <div className="relative">
                            <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-background shadow-xl">
                                <Image
                                    src={displayData.profileUrl ?? "/placeholder.svg"}
                                    alt={profileEditMode ? editedProfile.name : displayData.name}
                                    width={96}
                                    height={96}
                                    className="h-full w-full object-cover"
                                />
                            </div>

                            {displayData.approved && (
                                <div className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1 shadow-lg">
                                    <CheckCircle2 className="h-4 w-4" />
                                </div>
                            )}

                            {profileEditMode && (
                                <Button
                                    onClick={() => document.getElementById("profile-upload")?.click()}
                                    variant="secondary"
                                    size="sm"
                                    className="absolute bottom-0 right-0 h-8 w-8 p-0 rounded-full"
                                >
                                    <Camera className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        {(profileEditMode ?? profileEditMode) ? (
                            <div className="w-full mt-3 space-y-2">
                                <Input
                                    value={editedProfile.name}
                                    onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                                    className="text-center"
                                />
                                <Textarea
                                    value={editedProfile.bio ?? ""}
                                    onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                                    className="resize-none text-center"
                                    rows={3}
                                />
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={handleCancelEditProfile} className="flex-1">
                                        Cancel
                                    </Button>
                                    <Button
                                        disabled={
                                            UpdateCreatorProfileInfo.isLoading ??
                                            !!formErrors.name ??
                                            !!formErrors.bio ??
                                            !!formErrors.website ??
                                            !!formErrors.twitter ??
                                            !!formErrors.instagram
                                        }
                                        size="sm"
                                        onClick={handleSaveProfile}
                                        className="flex-1"
                                    >
                                        Save
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h2
                                    className="text-lg font-bold mt-3 flex items-center gap-1"
                                    style={{ fontFamily: theme?.font?.heading ?? "inherit" }}
                                >
                                    {editedProfile.name}
                                    {displayData.approved && <CheckCircle2 className="h-4 w-4 text-primary" />}
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground text-center line-clamp-3">{editedProfile.bio}</p>
                            </>
                        )}
                    </div>

                    <div className="mt-6 space-y-3 flex-1">
                        {displayData.website && (
                            <div>
                                <Link
                                    href={displayData.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
                                >
                                    <Globe className="h-4 w-4 mr-2" />
                                    <span className="truncate">{displayData.website.replace(/(^\w+:|^)\/\//, "")}</span>
                                </Link>
                            </div>
                        )}
                        {displayData.twitter && (
                            <div>
                                <Link
                                    href={`https://twitter.com/${displayData.twitter}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center text-sm text-muted-foreground hover:text-[#1DA1F2] transition-colors"
                                >
                                    <Twitter className="h-4 w-4 mr-2" />
                                    <span className="truncate">@{displayData.twitter}</span>
                                </Link>
                            </div>
                        )}
                        {displayData.instagram && (
                            <div>
                                <Link
                                    href={`https://instagram.com/${displayData.instagram}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center text-sm text-muted-foreground hover:text-[#E1306C] transition-colors"
                                >
                                    <Instagram className="h-4 w-4 mr-2" />
                                    <span className="truncate">@{displayData.instagram}</span>
                                </Link>
                            </div>
                        )}

                        <div className="flex items-center text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4 mr-2" />
                            <span>Joined {new Date(displayData.joinedAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                <div className="w-full">
                    <ChartWidget />
                </div>
            </div>
        </div>
    )

    // Render hero display mode
    const renderHeroMode = () => (
        <div
            className="flex flex-col h-full"
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Full-height cover photo with centered content */}
            <div
                className="relative flex flex-col items-center justify-center"
                style={{
                    height: `${widgetSettings.coverHeight}px`,
                    padding:
                        theme?.style?.contentDensity === "compact"
                            ? "1rem"
                            : theme?.style?.contentDensity === "spacious"
                                ? "3rem"
                                : "2rem",
                }}
            >
                <div className="absolute inset-0 overflow-hidden">
                    <Image src={displayData.coverUrl ?? "/placeholder.svg"} alt="Cover" fill className="object-cover" priority />
                    {/* Cover overlay */}
                    {widgetSettings.coverOverlayOpacity > 0 && (
                        <div
                            className="absolute inset-0"
                            style={{
                                backgroundColor: widgetSettings.coverOverlayColor,
                                opacity: widgetSettings.coverOverlayOpacity,
                            }}
                        />
                    )}
                </div>

                {/* Text overlay */}
                {widgetSettings.coverTextOverlay && (
                    <div
                        className="absolute w-full px-6"
                        style={{
                            top: "20px",
                            textAlign: widgetSettings.coverTextAlignment,
                            color: widgetSettings.coverTextColor,
                            fontSize: `${widgetSettings.coverTextSize}px`,
                            fontFamily: theme?.font?.heading ?? "inherit",
                            fontWeight: "bold",
                            textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                            zIndex: 5,
                        }}
                    >
                        {widgetSettings.coverTextOverlay}
                    </div>
                )}

                {/* Centered profile content */}
                {widgetSettings.heroContentPosition === "over" && (
                    <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto">
                        <div className="relative">
                            <div
                                className="rounded-full overflow-hidden border-4 border-background shadow-xl"
                                style={{
                                    height: `${widgetSettings.heroProfileSize}px`,
                                    width: `${widgetSettings.heroProfileSize}px`,
                                }}
                            >
                                <Image
                                    src={displayData.profileUrl ?? "/placeholder.svg"}
                                    alt={profileEditMode ? editedProfile.name : displayData.name}
                                    width={widgetSettings.heroProfileSize}
                                    height={widgetSettings.heroProfileSize}
                                    className="h-full w-full object-cover"
                                />
                            </div>

                            {displayData.approved && (
                                <div className="absolute bottom-1 right-1 bg-primary text-primary-foreground rounded-full p-1 shadow-lg">
                                    <CheckCircle2 className="h-5 w-5" />
                                </div>
                            )}

                            {profileEditMode && (
                                <Button
                                    onClick={() => document.getElementById("profile-upload")?.click()}
                                    variant="secondary"
                                    size="sm"
                                    className="absolute bottom-0 right-0 h-8 w-8 p-0 rounded-full"
                                >
                                    <Camera className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        {(profileEditMode ?? profileEditMode) ? (
                            <div className="mt-4 w-full space-y-2">
                                <Input
                                    value={editedProfile.name}
                                    onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                                    className="text-center text-white bg-transparent border-white/30"
                                />
                                <Textarea
                                    value={editedProfile.bio ?? ""}
                                    onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                                    className="resize-none text-center text-white bg-transparent border-white/30"
                                    rows={3}
                                />
                                <div className="flex gap-2 justify-center">
                                    <Button variant="outline" onClick={handleCancelEditProfile}>
                                        Cancel
                                    </Button>
                                    <Button
                                        disabled={
                                            UpdateCreatorProfileInfo.isLoading ??
                                            !!formErrors.name ??
                                            !!formErrors.bio ??
                                            !!formErrors.website ??
                                            !!formErrors.twitter ??
                                            !!formErrors.instagram
                                        }
                                        onClick={handleSaveProfile}
                                    >
                                        Save
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h2
                                    className="text-3xl font-bold mt-4 text-white flex items-center justify-center gap-1"
                                    style={{
                                        fontFamily: theme?.font?.heading ?? "inherit",
                                        textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                                    }}
                                >
                                    {editedProfile.name}
                                    {displayData.approved && <CheckCircle2 className="h-5 w-5 text-primary" />}
                                </h2>
                                <p className="mt-2 text-white/90 max-w-lg" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                                    {editedProfile.bio}
                                </p>

                                <div className="mt-6 flex gap-4 flex-wrap justify-center">
                                    {displayData.website && (
                                        <Link
                                            href={displayData.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center text-sm text-white/80 hover:text-white transition-colors"
                                        >
                                            <Globe className="h-4 w-4 mr-2" />
                                            <span>{displayData.website.replace(/(^\w+:|^)\/\//, "")}</span>
                                        </Link>
                                    )}
                                    {displayData.twitter && (
                                        <Link
                                            href={`https://twitter.com/${displayData.twitter}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center text-sm text-white/80 hover:text-white transition-colors"
                                        >
                                            <Twitter className="h-4 w-4 mr-2" />
                                            <span>@{displayData.twitter}</span>
                                        </Link>
                                    )}
                                    {displayData.instagram && (
                                        <Link
                                            href={`https://instagram.com/${displayData.instagram}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center text-sm text-white/80 hover:text-white transition-colors"
                                        >
                                            <Instagram className="h-4 w-4 mr-2" />
                                            <span>@{displayData.instagram}</span>
                                        </Link>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Edit controls for cover photo */}
                {(editMode ?? profileEditMode) && (
                    <>
                        {profileEditMode && (
                            <Button
                                onClick={() => document.getElementById("cover-upload")?.click()}
                                variant="secondary"
                                size="sm"
                                className="absolute top-2 right-2 gap-1"
                            >
                                <Camera className="h-4 w-4" />
                                <span>Change Cover</span>
                            </Button>
                        )}

                        {!profileEditMode && (
                            <Button
                                variant="secondary"
                                size="sm"
                                className="absolute bottom-2 right-2"
                                onClick={() => setShowHeightControls(!showHeightControls)}
                                ref={heightControlsButtonRef}
                            >
                                {showHeightControls ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                <span className="ml-1">Height</span>
                            </Button>
                        )}

                        {showHeightControls && (
                            <div
                                className="absolute bottom-12 right-2 bg-background/90 backdrop-blur-sm p-3 rounded-md shadow-md w-48"
                                ref={heightControlsPanelRef}
                            >
                                <Slider
                                    value={[widgetSettings.coverHeight]}
                                    min={200}
                                    max={600}
                                    step={20}
                                    onValueChange={(value) => {
                                        startResize()
                                        // Use a less frequent update interval during active resize
                                        const newHeight = value[0] ?? DEFAULT_SETTINGS.coverHeight
                                        // Only update if the change is significant (5px or more)
                                        if (Math.abs(newHeight - widgetSettings.coverHeight) >= 5) {
                                            updateSetting("coverHeight", newHeight)
                                        }
                                    }}
                                    className="mb-1"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>200px</span>
                                    <span>{widgetSettings.coverHeight}px</span>
                                    <span>600px</span>
                                </div>
                            </div>
                        )}

                        {widgetSettings.heroContentPosition === "over" && (
                            <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm p-2 rounded-md shadow-md">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs">Profile Size:</span>
                                    <Slider
                                        value={[widgetSettings.heroProfileSize]}
                                        min={80}
                                        max={200}
                                        step={10}
                                        onValueChange={(value) => {
                                            startResize()
                                            // Use a less frequent update interval during active resize
                                            const newSize = value[0] ?? DEFAULT_SETTINGS.heroProfileSize
                                            // Only update if the change is significant (5px or more)
                                            if (Math.abs(newSize - widgetSettings.heroProfileSize) >= 5) {
                                                updateSetting("heroProfileSize", newSize)
                                            }
                                        }}
                                        className="w-24"
                                    />
                                    <span className="text-xs">{widgetSettings.heroProfileSize}px</span>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Content below cover for "below" mode */}
            {widgetSettings.heroContentPosition === "below" && (
                <div
                    className="flex-1 p-6 flex flex-col items-center text-center"
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className="relative -mt-16 z-10 mb-4">
                        <div
                            className="rounded-full overflow-hidden border-4 border-background shadow-xl"
                            style={{
                                height: `${widgetSettings.heroProfileSize}px`,
                                width: `${widgetSettings.heroProfileSize}px`,
                            }}
                        >
                            <Image
                                src={displayData.profileUrl ?? "/placeholder.svg"}
                                alt={profileEditMode ? editedProfile.name : displayData.name}
                                width={widgetSettings.heroProfileSize}
                                height={widgetSettings.heroProfileSize}
                                className="h-full w-full object-cover"
                            />
                        </div>

                        {displayData.approved && (
                            <div className="absolute bottom-1 right-1 bg-primary text-primary-foreground rounded-full p-1 shadow-lg">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                        )}

                        {profileEditMode && (
                            <Button
                                onClick={() => document.getElementById("profile-upload")?.click()}
                                variant="secondary"
                                size="sm"
                                className="absolute bottom-0 right-0 h-8 w-8 p-0 rounded-full"
                            >
                                <Camera className="h-4 w-4" />
                            </Button>
                        )}

                        {editMode && (
                            <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 bg-background/90 backdrop-blur-sm p-2 rounded-md shadow-md">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs">Profile Size:</span>
                                    <Slider
                                        value={[widgetSettings.heroProfileSize]}
                                        min={80}
                                        max={200}
                                        step={10}
                                        onValueChange={(value) => {
                                            startResize()
                                            // Use a less frequent update interval during active resize
                                            const newSize = value[0] ?? DEFAULT_SETTINGS.heroProfileSize
                                            // Only update if the change is significant (5px or more)
                                            if (Math.abs(newSize - widgetSettings.heroProfileSize) >= 5) {
                                                updateSetting("heroProfileSize", newSize)
                                            }
                                        }}
                                        className="w-24"
                                    />
                                    <span className="text-xs">{widgetSettings.heroProfileSize}px</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {(profileEditMode ?? profileEditMode) ? (
                        <div className="w-full max-w-md space-y-2">
                            <Input
                                value={editedProfile.name}
                                onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                                className="text-center"
                            />
                            <Textarea
                                value={editedProfile.bio ?? ""}
                                onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                                className="resize-none text-center"
                                rows={3}
                            />
                            <div className="flex gap-2 justify-center">
                                <Button variant="outline" onClick={handleCancelEditProfile}>
                                    Cancel
                                </Button>
                                <Button
                                    disabled={
                                        UpdateCreatorProfileInfo.isLoading ??
                                        !!formErrors.name ??
                                        !!formErrors.bio ??
                                        !!formErrors.website ??
                                        !!formErrors.twitter ??
                                        !!formErrors.instagram
                                    }
                                    onClick={handleSaveProfile}
                                >
                                    Save
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h2
                                className="text-3xl font-bold flex items-center justify-center gap-1"
                                style={{ fontFamily: theme?.font?.heading ?? "inherit" }}
                            >
                                {editedProfile.name}
                                {displayData.approved && <CheckCircle2 className="h-5 w-5 text-primary" />}
                            </h2>
                            <p className="mt-2 text-muted-foreground max-w-lg">{editedProfile.bio}</p>

                            <div className="mt-6 flex gap-4 flex-wrap justify-center">
                                {displayData.website && (
                                    <Link
                                        href={displayData.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
                                    >
                                        <Globe className="h-4 w-4 mr-2" />
                                        <span>{displayData.website.replace(/(^\w+:|^)\/\//, "")}</span>
                                    </Link>
                                )}
                                {displayData.twitter && (
                                    <Link
                                        href={`https://twitter.com/${displayData.twitter}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center text-sm text-muted-foreground hover:text-[#1DA1F2] transition-colors"
                                    >
                                        <Twitter className="h-4 w-4 mr-2" />
                                        <span>@{displayData.twitter}</span>
                                    </Link>
                                )}
                                {displayData.instagram && (
                                    <Link
                                        href={`https://instagram.com/${displayData.instagram}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center text-sm text-muted-foreground hover:text-[#E1306C] transition-colors"
                                    >
                                        <Instagram className="h-4 w-4 mr-2" />
                                        <span>@{displayData.instagram}</span>
                                    </Link>
                                )}
                            </div>
                        </>
                    )}

                    <CalendarWidget />
                </div>
            )}
        </div>
    )

    // Render minimal display mode
    const renderMinimalMode = () => (
        <div
            className="h-full flex flex-col"
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="relative" style={{ height: `${widgetSettings.coverHeight}px` }}>
                <div className="absolute inset-0 overflow-hidden">
                    <Image src={displayData.coverUrl ?? "/placeholder.svg"} alt="Cover" fill className="object-cover" priority />
                    {/* Cover overlay */}
                    {widgetSettings.coverOverlayOpacity > 0 && (
                        <div
                            className="absolute inset-0"
                            style={{
                                backgroundColor: widgetSettings.coverOverlayColor,
                                opacity: widgetSettings.coverOverlayOpacity,
                            }}
                        />
                    )}

                    {/* Text overlay */}
                    {widgetSettings.coverTextOverlay && (
                        <div
                            className="absolute w-full px-6"
                            style={{
                                top:
                                    widgetSettings.coverTextPosition === "top"
                                        ? "20px"
                                        : widgetSettings.coverTextPosition === "bottom"
                                            ? `${widgetSettings.coverHeight - 60}px`
                                            : `${widgetSettings.coverHeight / 2 - 20}px`,
                                textAlign: widgetSettings.coverTextAlignment,
                                color: widgetSettings.coverTextColor,
                                fontSize: `${widgetSettings.coverTextSize}px`,
                                fontFamily: theme?.font?.heading ?? "inherit",
                                fontWeight: "bold",
                                textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                                zIndex: 5,
                            }}
                        >
                            {widgetSettings.coverTextOverlay}
                        </div>
                    )}
                </div>

                {/* Minimal profile info overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 flex items-center">
                    <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-white/50 mr-3">
                        <CustomAvatar url={displayData.profileUrl ?? "/placeholder.svg"} className="h-full w-full object-cover" />
                    </div>

                    <div className="flex-1">
                        <h2
                            className="text-white text-lg font-bold flex items-center gap-1"
                            style={{
                                fontFamily: theme?.font?.heading ?? "inherit",
                                textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                            }}
                        >
                            {profileEditMode ? (
                                <Input
                                    value={editedProfile.name}
                                    onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                                    className="h-7 text-white bg-black/30 border-white/30"
                                />
                            ) : (
                                <>
                                    {editedProfile.name}
                                    {displayData.approved && <CheckCircle2 className="h-4 w-4 text-primary" />}
                                </>
                            )}
                        </h2>

                        <div className="flex gap-3 text-white/80 text-xs">
                            {displayData.twitter && (
                                <Link
                                    href={`https://twitter.com/${displayData.twitter}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center hover:text-white transition-colors"
                                >
                                    <Twitter className="h-3 w-3 mr-1" />
                                    <span>@{displayData.twitter}</span>
                                </Link>
                            )}
                            {displayData.instagram && (
                                <Link
                                    href={`https://instagram.com/${displayData.instagram}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center hover:text-white transition-colors"
                                >
                                    <Instagram className="h-3 w-3 mr-1" />
                                    <span>@{displayData.instagram}</span>
                                </Link>
                            )}
                        </div>
                    </div>

                    {profileEditMode && (
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                                setProfileEditMode?.(false)
                            }}
                        >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                        </Button>
                    )}

                    {profileEditMode && (
                        <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={handleCancelEditProfile}>
                                <X className="h-3 w-3" />
                            </Button>
                            <Button
                                disabled={
                                    UpdateCreatorProfileInfo.isLoading ??
                                    !!formErrors.name ??
                                    !!formErrors.bio ??
                                    !!formErrors.website ??
                                    !!formErrors.twitter ??
                                    !!formErrors.instagram
                                }
                                size="sm"
                                onClick={handleSaveProfile}
                            >
                                <Save className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* Edit controls for cover photo */}
                {(editMode ?? profileEditMode) && (
                    <>
                        {profileEditMode && (
                            <Button
                                onClick={() => document.getElementById("cover-upload")?.click()}
                                variant="secondary"
                                size="sm"
                                className="absolute top-2 right-2 gap-1"
                            >
                                <Camera className="h-4 w-4" />
                                <span>Change Cover</span>
                            </Button>
                        )}

                        {!profileEditMode && (
                            <Button
                                variant="secondary"
                                size="sm"
                                className="absolute bottom-2 right-2"
                                onClick={() => setShowHeightControls(!showHeightControls)}
                                ref={heightControlsButtonRef}
                            >
                                {showHeightControls ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                <span className="ml-1">Height</span>
                            </Button>
                        )}

                        {showHeightControls && (
                            <div
                                className="absolute top-12 left-2 bg-background/90 backdrop-blur-sm p-3 rounded-md shadow-md w-48"
                                ref={heightControlsPanelRef}
                            >
                                <Slider
                                    value={[widgetSettings.coverHeight]}
                                    min={120}
                                    max={400}
                                    step={10}
                                    onValueChange={(value) => {
                                        startResize()
                                        // Use a less frequent update interval during active resize
                                        const newHeight = value[0] ?? DEFAULT_SETTINGS.coverHeight
                                        // Only update if the change is significant (5px or more)
                                        if (Math.abs(newHeight - widgetSettings.coverHeight) >= 5) {
                                            updateSetting("coverHeight", newHeight)
                                        }
                                    }}
                                    className="mb-1"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>120px</span>
                                    <span>{widgetSettings.coverHeight}px</span>
                                    <span>400px</span>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Bio section (collapsible in minimal mode) */}
            {profileEditMode ? (
                <div className="p-4">
                    <Textarea
                        value={editedProfile.bio ?? ""}
                        onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                        className="resize-none"
                        rows={3}
                        placeholder="Enter your bio"
                    />
                </div>
            ) : (
                <div className="p-4 text-sm text-muted-foreground">{editedProfile.bio}</div>
            )}

            {/* Content area for widgets */}
            <LyricsWidget />
        </div>
    )

    // Render band display mode
    const renderBandMode = () => (
        <div
            className="h-full flex flex-col"
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Full-width cover photo with band name overlay */}
            <div className="relative" style={{ height: `${widgetSettings.coverHeight}px` }}>
                <div className="absolute inset-0 overflow-hidden">
                    <Image src={displayData.coverUrl ?? "/placeholder.svg"} alt="Cover" fill className="object-cover" priority />
                    {/* Cover overlay */}
                    <div
                        className="absolute inset-0"
                        style={{
                            backgroundColor: "rgba(0,0,0,0.5)",
                            opacity: 0.7,
                        }}
                    />

                    {/* Band name overlay */}
                    <div
                        className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
                        style={{
                            textShadow: "0 2px 4px rgba(0,0,0,0.8)",
                        }}
                    >
                        {(profileEditMode ?? profileEditMode) ? (
                            <div className=" mt-3 space-y-2">
                                <Input
                                    value={editedProfile.name}
                                    onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                                    className="text-center"
                                />
                                <Textarea
                                    value={editedProfile.bio ?? ""}
                                    onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                                    className="resize-none text-center"
                                    rows={3}
                                />
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-center text-center">
                                    <h1
                                        className="text-4xl md:text-6xl font-bold text-white mb-2"
                                        style={{ fontFamily: theme?.font?.heading ?? "inherit" }}
                                    >
                                        {profileEditMode ? editedProfile.name : displayData.name}
                                    </h1>
                                    {displayData.approved && (
                                        <div className="bg-primary text-primary-foreground rounded-full p-1 mb-2">
                                            <CheckCircle2 className="h-5 w-5" />
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        <p className="text-white/90 max-w-2xl text-lg">{profileEditMode ? editedProfile.bio : displayData.bio}</p>

                        {/* Social links */}
                        <div className="flex gap-4 mt-4">
                            {displayData.website && (
                                <Button variant="outline" size="sm" className="bg-black/30 text-white border-white/30" asChild>
                                    <a href={displayData.website} target="_blank" rel="noopener noreferrer">
                                        <Globe className="h-4 w-4 mr-2" />
                                        Website
                                    </a>
                                </Button>
                            )}
                            {displayData.twitter && (
                                <Button variant="outline" size="sm" className="bg-black/30 text-white border-white/30" asChild>
                                    <a href={`https://twitter.com/${displayData.twitter}`} target="_blank" rel="noopener noreferrer">
                                        <Twitter className="h-4 w-4 mr-2" />
                                        Twitter
                                    </a>
                                </Button>
                            )}
                            {displayData.instagram && (
                                <Button variant="outline" size="sm" className="bg-black/30 text-white border-white/30" asChild>
                                    <a href={`https://instagram.com/${displayData.instagram}`} target="_blank" rel="noopener noreferrer">
                                        <Instagram className="h-4 w-4 mr-2" />
                                        Instagram
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Edit controls for cover photo */}
                {(editMode ?? profileEditMode) && (
                    <>
                        {profileEditMode && (
                            <Button
                                onClick={() => document.getElementById("cover-upload")?.click()}
                                variant="secondary"
                                size="sm"
                                className="absolute top-2 right-2 gap-1"
                            >
                                <Camera className="h-4 w-4" />
                                <span>Change Cover</span>
                            </Button>
                        )}

                        {!profileEditMode && (
                            <Button
                                variant="secondary"
                                size="sm"
                                className="absolute bottom-2 right-2"
                                onClick={() => setShowHeightControls(!showHeightControls)}
                                ref={heightControlsButtonRef}
                            >
                                {showHeightControls ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                <span className="ml-1">Height</span>
                            </Button>
                        )}

                        {showHeightControls && (
                            <div
                                className="absolute bottom-12 right-2 bg-background/90 backdrop-blur-sm p-3 rounded-md shadow-md w-48"
                                ref={heightControlsPanelRef}
                            >
                                <Slider
                                    value={[widgetSettings.coverHeight]}
                                    min={200}
                                    max={600}
                                    step={20}
                                    onValueChange={(value) => {
                                        startResize()
                                        // Use a less frequent update interval during active resize
                                        const newHeight = value[0] ?? DEFAULT_SETTINGS.coverHeight
                                        // Only update if the change is significant (5px or more)
                                        if (Math.abs(newHeight - widgetSettings.coverHeight) >= 5) {
                                            updateSetting("coverHeight", newHeight)
                                        }
                                    }}
                                    className="mb-1"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>200px</span>
                                    <span>{widgetSettings.coverHeight}px</span>
                                    <span>600px</span>
                                </div>
                            </div>
                        )}

                        {profileEditMode && (
                            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                                <Button variant="outline" onClick={handleCancelEditProfile}>
                                    Cancel
                                </Button>
                                <Button
                                    disabled={
                                        UpdateCreatorProfileInfo.isLoading ??
                                        !!formErrors.name ??
                                        !!formErrors.bio ??
                                        !!formErrors.website ??
                                        !!formErrors.twitter ??
                                        !!formErrors.instagram
                                    }
                                    onClick={handleSaveProfile}
                                >
                                    Save
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Content area for widgets */}
            <div
                className="flex-1"
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <CustomHTMLWidget />
            </div>
        </div>
    )

    return (
        <div
            className="h-full flex flex-col"
            style={{
                fontFamily: theme?.font?.body ?? "inherit",
                borderRadius: theme?.style?.borderRadius ? `${theme.style.borderRadius}px` : undefined,
                overflow: "hidden",
            }}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-widget-id={widgetId}
        >
            {/* Add global styles to fix z-index and backdrop issues */}
            <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLES }} />

            {/* Edit mode controls */}
            {editMode && (
                <div className="bg-muted/30 p-2 flex flex-wrap justify-end items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                Display Mode: {widgetSettings.displayMode.charAt(0).toUpperCase() + widgetSettings.displayMode.slice(1)}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-background border border-border z-50">
                            <DropdownMenuItem onClick={() => updateSetting("displayMode", "standard")}>Standard</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateSetting("displayMode", "sidebar")}>Sidebar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateSetting("displayMode", "hero")}>Hero</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateSetting("displayMode", "minimal")}>Minimal</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateSetting("displayMode", "band")}>Band</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {widgetSettings.displayMode === "sidebar" && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                updateSetting("sidebarPosition", widgetSettings.sidebarPosition === "left" ? "right" : "left")
                            }
                        >
                            Sidebar: {widgetSettings.sidebarPosition === "left" ? "Left" : "Right"}
                            {widgetSettings.sidebarPosition === "left" ? (
                                <ArrowLeft className="ml-2 h-4 w-4" />
                            ) : (
                                <ArrowRight className="ml-2 h-4 w-4" />
                            )}
                        </Button>
                    )}

                    {widgetSettings.displayMode === "hero" && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    Content: {widgetSettings.heroContentPosition === "over" ? "Over Cover" : "Below Cover"}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-background border border-border z-50">
                                <DropdownMenuItem onClick={() => updateSetting("heroContentPosition", "over")}>
                                    Over Cover
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateSetting("heroContentPosition", "below")}>
                                    Below Cover
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            )}
            {profileEditMode && (
                <UploadS3Button
                    endpoint="coverUploader"
                    variant="hidden"
                    id="cover-upload"
                    onClientUploadComplete={(res) => {
                        const fileUrl = res.url
                        coverChangeMutation.mutate(fileUrl)
                    }}
                    onUploadError={(error: Error) => {
                        toast({
                            title: "Upload Error",
                            description: error.message,
                            variant: "destructive",
                        })
                    }}
                />
            )}
            <UploadS3Button
                endpoint="profileUploader"
                variant="hidden"
                id="profile-upload"
                onClientUploadComplete={(res) => {
                    const fileUrl = res.url
                    updateProfileMutation.mutate(fileUrl)
                }}
                onUploadError={(error: Error) => {
                    toast({
                        title: "Upload Error",
                        description: error.message,
                        variant: "destructive",
                    })
                }}
            />
            {/* Render the appropriate display mode */}
            {renderWidget()}
        </div>
    )
}
