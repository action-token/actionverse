"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Save, Plus, X, GripVertical, Link2, Unlink, Maximize2, Edit, Check, User, Trash2, Globe } from "lucide-react"

import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { toast } from "~/components/shadcn/ui/use-toast"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "~/components/shadcn/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/shadcn/ui/tooltip"
import { Switch } from "~/components/shadcn/ui/switch"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/shadcn/ui/dialog"

// Import components that can be added to dashboard
import StatsWidget from "~/components/widget/stats-widget"
import ProfileWidget from "~/components/widget/profile-widget"
import NFTGalleryWidget from "~/components/widget/nft-gallery-widget"
import RecentPostsWidget from "~/components/widget/recent-posts-widget"
import ChartWidget from "~/components/widget/chart-widget"
import CalendarWidget from "~/components/widget/calendar-widget"
import TodoWidget from "~/components/widget/todo-widget"
import CustomHTMLWidget from "~/components/widget/custom-html-widget"

// Import new widgets
import MusicPlayerWidget from "~/components/widget/music-player-widget"
import TourDatesWidget from "~/components/widget/tour-dates-widget"
import MembershipTiersWidget from "~/components/widget/membership-tiers-widget"
import MerchandiseWidget from "~/components/widget/merchandise-widget"
import BandMembersWidget from "~/components/widget/band-members-widget"
import VideoGalleryWidget from "~/components/widget/video-gallery-widget"
import NewsletterWidget from "~/components/widget/newsletter-widget"
import LyricsWidget from "~/components/widget/lyrics-widget"
import FanCommunityWidget from "~/components/widget/fan-community-widget"
import CoverProfileWidget from "~/components/widget/cover-profile-widget"

// Update imports at the top to include the new types
import { api } from "~/utils/api" // Adjust this import based on your tRPC setup
import type {
    CreatorWithPageAsset,
    GroupResizeState,
    SavedLayout,
    WidgetDefinition,
    WidgetItem,
    WidgetSettings,
} from "~/types/organization/dashboard"

const DEFAULT_LAYOUT: WidgetItem[] = [
    { id: "cover-profile", size: "large", order: 1, pinned: true },

    { id: "membership-tiers", size: "large", order: 4 },
    { id: "stats", size: "large", order: 5 },

    { id: "nft-gallery", size: "large", order: 9 },
    {
        id: "recent-posts",
        size: "large",
        order: 10,
    },
]

// Available components for adding to dashboard
const AVAILABLE_WIDGETS: WidgetDefinition[] = [
    {
        id: "cover-profile",
        title: "Cover & Profile",
        description: "Display cover photo and profile information",
        component: CoverProfileWidget,
        icon: "user",
        special: true,
    },
    {
        id: "profile",
        title: "Profile Card",
        description: "Display artist profile information",
        component: ProfileWidget,
        icon: "user",
    },
    {
        id: "stats",
        title: "Statistics",
        description: "Show key performance metrics",
        component: StatsWidget,
        icon: "stats",
    },

    {
        id: "recent-posts",
        title: "Recent Posts",
        description: "Show your latest posts",
        component: RecentPostsWidget,
        icon: "posts",
    },
    {
        id: "nft-gallery",
        title: "NFT Gallery",
        description: "Display your NFT collection",
        component: NFTGalleryWidget,
        icon: "gallery",
    },
    {
        id: "chart",
        title: "Analytics Chart",
        description: "Visualize your data with charts",
        component: ChartWidget,
        icon: "chart",
    },
    {
        id: "calendar",
        title: "Calendar",
        description: "Schedule and view upcoming events",
        component: CalendarWidget,
        icon: "calendar",
    },
    {
        id: "todo",
        title: "To-Do List",
        description: "Manage your tasks",
        component: TodoWidget,
        icon: "todo",
    },
    {
        id: "custom-html",
        title: "Custom HTML",
        description: "Add custom HTML content",
        component: CustomHTMLWidget,
        icon: "code",
    },
    {
        id: "music-player",
        title: "Music Player",
        description: "Play your music with controls and playlist",
        component: MusicPlayerWidget,
        icon: "music",
    },
    {
        id: "tour-dates",
        title: "Tour Dates",
        description: "Display upcoming shows and tour information",
        component: TourDatesWidget,
        icon: "calendar",
    },
    {
        id: "membership-tiers",
        title: "Membership Tiers",
        description: "Showcase membership options for fans",
        component: MembershipTiersWidget,
        icon: "users",
    },
    {
        id: "merchandise",
        title: "Merchandise",
        description: "Display and sell merchandise to fans",
        component: MerchandiseWidget,
        icon: "shopping",
    },
    {
        id: "band-members",
        title: "Band Members",
        description: "Introduce the band members to your fans",
        component: BandMembersWidget,
        icon: "users",
    },
    {
        id: "video-gallery",
        title: "Video Gallery",
        description: "Showcase your music videos and performances",
        component: VideoGalleryWidget,
        icon: "video",
    },
    {
        id: "newsletter",
        title: "Newsletter Signup",
        description: "Collect email subscriptions from fans",
        component: NewsletterWidget,
        icon: "mail",
    },
    {
        id: "lyrics",
        title: "Lyrics",
        description: "Share lyrics to your songs",
        component: LyricsWidget,
        icon: "file-text",
    },
    {
        id: "fan-community",
        title: "Fan Community",
        description: "Engage with your fan community",
        component: FanCommunityWidget,
        icon: "users",
    },
]

export default function DashboardBuilder() {
    // State variables
    const [widgets, setWidgets] = useState<WidgetItem[]>(DEFAULT_LAYOUT)
    const [editMode, setEditMode] = useState(false)
    const [layoutName, setLayoutName] = useState("My Dashboard")
    const [layoutId, setLayoutId] = useState("")
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
    const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false)
    const [newLayoutName, setNewLayoutName] = useState("")
    const [makePublic, setMakePublic] = useState(false)
    const [draggedWidget, setDraggedWidget] = useState<string | null>(null)
    const [dragOverWidget, setDragOverWidget] = useState<string | null>(null)
    const [selectedWidgets, setSelectedWidgets] = useState<string[]>([])
    const [isLayoutSaved, setIsLayoutSaved] = useState(false)
    const [widgetSearchQuery, setWidgetSearchQuery] = useState("")
    const [selectionMode, setSelectionMode] = useState(false)
    const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const [resizingWidget, setResizingWidget] = useState<string | null>(null)
    const [resizeStartX, setResizeStartX] = useState(0)
    const [resizeStartY, setResizeStartY] = useState(0)
    const [resizeStartWidth, setResizeStartWidth] = useState(0)
    const [resizeStartHeight, setResizeStartHeight] = useState(0)
    const widgetRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const groupRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const dashboardContainerRef = useRef<HTMLDivElement>(null)

    // Remove theme state
    // - const [theme, setTheme] = useState<Theme>(STYLE_PRESETS[0])

    // Group resizing state
    const [resizingGroup, setResizingGroup] = useState<GroupResizeState | null>(null)

    // Add a new state for profile editing mode
    const [isProfileEditMode, setIsProfileEditMode] = useState(false)

    // Add a state to track if user's layout is loaded
    const [userLayoutLoaded, setUserLayoutLoaded] = useState(false)

    // Add tRPC hooks
    const utils = api.useContext()
    const creator = api.fan.creator.meCreator.useQuery(undefined, {
        refetchOnWindowFocus: false,
    })
    const dashboardsQuery = api.fan.dashboard.getAll.useQuery(undefined, {
        onSuccess: (data) => {
            if (data && data.length > 0 && !userLayoutLoaded) {
                // Find user's last saved layout
                const userLayouts = data.filter((d) => !d.isDefault)
                const defaultLayout = data.find((d) => d.isDefault)

                // Transform the data to match the expected format
                const transformLayout = (layout: (typeof data)[0] | undefined) => {
                    if (!layout) return undefined;

                    return {
                        id: layout.id,
                        name: layout.name,
                        isDefault: layout.isDefault,
                        isPublic: layout.isPublic,
                        widgets: layout.widgets.map((widget) => ({
                            widgetId: widget.widgetId,
                            size: widget.size as "small" | "medium" | "large",
                            order: widget.order,
                            pinned: widget.pinned,
                            groupId: widget.groupId,
                            customWidth: widget.customWidth ?? undefined,
                            settings: widget.settings as Record<string, unknown> | null | undefined,
                        })),
                    }
                }

                // If user has layouts, load the most recent one
                if (userLayouts.length > 0) {
                    // Sort by updated date descending
                    const sortedLayouts = [...userLayouts].sort(
                        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
                    )

                    const transformedLayout = transformLayout(sortedLayouts[0])
                    if (transformedLayout) {
                        loadUserLayout(transformedLayout)
                        setUserLayoutLoaded(true)
                    }
                }
                // If no user layouts but there's a default layout, load that
                else if (defaultLayout && !userLayoutLoaded) {
                    const transformedDefaultLayout = transformLayout(defaultLayout)
                    if (transformedDefaultLayout) {
                        loadUserLayout(transformedDefaultLayout)
                        setUserLayoutLoaded(true)
                    }
                }

                // Transform all layouts for the list
                const transformedLayouts = data.map((dashboard) => ({
                    id: dashboard.id,
                    name: dashboard.name,
                    isDefault: dashboard.isDefault,
                    isPublic: dashboard.isPublic,
                    widgets: dashboard.widgets.map((widget) => ({
                        id: widget.widgetId,
                        size: widget.size as "small" | "medium" | "large",
                        order: widget.order,
                        pinned: widget.pinned,
                        groupId: widget.groupId ?? undefined,
                        customWidth: widget.customWidth ?? undefined,
                        settings: widget.settings as WidgetSettings | undefined,
                    })),
                }))

                setSavedLayouts(transformedLayouts)
            }
        },
    })

    // Use mutations for all operations that modify data
    const dashboardByIdMutation = api.fan.dashboard.getById.useMutation()
    const saveDashboardMutation = api.fan.dashboard.save.useMutation({
        onSuccess: () => {
            utils.fan.dashboard.getAll.invalidate()
        },
    })
    const deleteDashboardMutation = api.fan.dashboard.delete.useMutation({
        onSuccess: () => {
            utils.fan.dashboard.getAll.invalidate()
        },
    })

    // Helper function to load a user layout
    const loadUserLayout = (
        dashboard:
            | {
                id: string
                name: string
                widgets: {
                    widgetId: string
                    size: "small" | "medium" | "large"
                    order: number
                    pinned: boolean
                    groupId?: string | null
                    customWidth?: number | null
                    settings?: Record<string, unknown> | null
                }[]
                isDefault: boolean
                isPublic: boolean
            }
            | undefined,
    ) => {
        if (!dashboard) return // Early return if dashboard is undefined

        try {
            console.log("Loading user layout:", dashboard.name)
            console.log(
                "Widget settings from database:",
                dashboard.widgets.map((w) => ({
                    id: w.widgetId,
                    settings: w.settings,
                    settingsType: w.settings ? typeof w.settings : "undefined",
                })),
            )

            // Transform the data from Prisma format to our app format
            const widgetsData: WidgetItem[] = dashboard.widgets.map((widget) => {
                // Ensure settings is properly handled
                let processedSettings: WidgetSettings | undefined = undefined

                if (widget.settings) {
                    // If settings is a string (JSON string), parse it
                    if (typeof widget.settings === "string") {
                        try {
                            processedSettings = JSON.parse(widget.settings) as WidgetSettings
                        } catch (e) {
                            console.error(`Error parsing settings for widget ${widget.widgetId}:`, e)
                            processedSettings = {}
                        }
                    }
                    // If settings is already an object, use it directly
                    else if (typeof widget.settings === "object") {
                        processedSettings = widget.settings as WidgetSettings
                    }
                }

                console.log(`Processed settings for widget ${widget.widgetId}:`, processedSettings)

                return {
                    id: widget.widgetId,
                    size: widget.size,
                    order: widget.order,
                    pinned: widget.pinned,
                    groupId: widget.groupId ?? undefined,
                    customWidth: widget.customWidth ?? undefined,
                    settings: processedSettings,
                }
            })

            console.log("Transformed widgets data:", widgetsData)

            setWidgets(widgetsData)
            setLayoutName(dashboard.name)
            setLayoutId(dashboard.id)
            setIsLayoutSaved(true)
        } catch (error) {
            console.error("Error loading user layout:", error)
            // Silently fail and use default layout
        }
    }

    // Replace loadLayout with tRPC version
    const loadLayout = async (id: string) => {
        try {
            setIsLoading(true)

            // Use dashboard query
            const result = await dashboardByIdMutation.mutateAsync({ id })

            if (result) {
                // Debug the raw data from the database
                console.log("Raw dashboard data from database:", result)
                console.log(
                    "Raw widget settings from database:",
                    result.widgets.map((w) => ({ id: w.widgetId, settings: w.settings })),
                )

                const dashboard = result

                // Transform the data from Prisma format to our app format
                const widgetsData: WidgetItem[] = dashboard.widgets.map((widget) => {
                    console.log(`Loading widget ${widget.widgetId} with settings:`, widget.settings)
                    return {
                        id: widget.widgetId,
                        size: widget.size as "small" | "medium" | "large",
                        order: widget.order,
                        pinned: widget.pinned,
                        groupId: widget.groupId ?? undefined,
                        customWidth: widget.customWidth ?? undefined,
                        settings: widget.settings as WidgetSettings | undefined,
                    }
                })

                // Force a re-render of the entire dashboard to ensure settings are applied
                setTimeout(() => {
                    console.log("Forcing re-render of dashboard with widgets:", widgetsData)
                    console.log(
                        "Widget settings before re-render:",
                        widgetsData.map((w) => ({ id: w.id, settings: w.settings })),
                    )
                    setWidgets([...widgetsData])
                }, 50)

                // Update current layout instead of creating a new one
                setWidgets(widgetsData)
                setLayoutName(dashboard.name)
                setLayoutId(dashboard.id)
                setIsLayoutSaved(true)
                setIsLoadDialogOpen(false)

                // After data is loaded, apply custom widths to DOM elements in the next render cycle
                setTimeout(() => {
                    applyGroupWidgetSizes(widgetsData)
                }, 100)

                toast({
                    title: "Layout loaded",
                    description: `Dashboard layout "${dashboard.name}" has been loaded`,
                })
            }
        } catch (error) {
            console.error("Error loading layout:", error)
            toast({
                title: "Error",
                description: "Failed to load layout. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    // Replace deleteLayout with tRPC version
    const deleteLayout = async (id: string) => {
        try {
            await deleteDashboardMutation.mutateAsync({ id })

            // Remove from local state
            setSavedLayouts(savedLayouts.filter((layout) => layout.id !== id))

            // If we deleted the current layout, reset to default
            if (id === layoutId) {
                setWidgets(DEFAULT_LAYOUT)
                setLayoutName("My Dashboard")
                setLayoutId("")
                setIsLayoutSaved(false)
            }

            toast({
                title: "Layout deleted",
                description: "The dashboard layout has been deleted",
            })
        } catch (error) {
            console.error("Error deleting layout:", error)
            toast({
                title: "Error",
                description: "Failed to delete layout",
                variant: "destructive",
            })
        }
    }

    // Replace saveLayout with tRPC version
    const handleSaveLayout = async () => {
        if (!newLayoutName.trim()) {
            toast({
                title: "Error",
                description: "Please enter a name for your layout",
                variant: "destructive",
            })
            return
        }

        try {
            setIsSaving(true)

            // Transform the widgets to ensure they match the expected type
            const transformedWidgets = widgets.map((widget) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const settings = widget.settings ? JSON.parse(JSON.stringify(widget.settings)) : {}

                return ({
                    id: widget.id,
                    size: widget.size,
                    order: widget.order,
                    pinned: widget.pinned ?? false,
                    groupId: widget.groupId,
                    customWidth: widget.customWidth,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    settings: settings
                })
            }
            )

            const dashboardData = {
                id: layoutId ?? undefined,
                name: newLayoutName,
                widgets: transformedWidgets,
                isDefault: makePublic,
                isPublic: makePublic,
            }

            const result = await saveDashboardMutation.mutateAsync(dashboardData)

            // Update local state
            setLayoutName(newLayoutName)
            setLayoutId(result.id)
            setIsSaveDialogOpen(false)
            setNewLayoutName("")
            setMakePublic(false)
            setIsLayoutSaved(true)
            setEditMode(false)
            setSelectionMode(false)
            setSelectedWidgets([])

            // Refresh the list of saved layouts
            utils.fan.dashboard.getAll.invalidate()

            toast({
                title: "Layout saved",
                description: `Dashboard layout "${newLayoutName}" has been saved${makePublic ? " and set as default for all users" : ""}`,
            })
        } catch (error) {
            console.error("Error saving layout:", error)
            toast({
                title: "Error",
                description: "Failed to save layout",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    // Add a function to toggle profile edit mode
    const toggleProfileEditMode = () => {
        setIsProfileEditMode(!isProfileEditMode)
        // If turning on profile edit mode, turn off dashboard edit mode
        if (!isProfileEditMode && editMode) {
            setEditMode(false)
            setSelectionMode(false)
            setSelectedWidgets([])
        }
    }

    const handleResizeStart = (e: React.MouseEvent, widgetId: string) => {
        if (!editMode) return
        e.stopPropagation()
        e.preventDefault()

        const widgetEl = widgetRefs.current[widgetId]
        if (!widgetEl) return

        setResizingWidget(widgetId)
        setResizeStartX(e.clientX)
        setResizeStartY(e.clientY)
        setResizeStartWidth(widgetEl.offsetWidth)
        setResizeStartHeight(widgetEl.offsetHeight)

        document.addEventListener("mousemove", handleResizeMove)
        document.addEventListener("mouseup", handleResizeEnd)
    }

    const handleResizeMove = (e: MouseEvent) => {
        if (!resizingWidget) return

        const widgetEl = widgetRefs.current[resizingWidget]
        if (!widgetEl) return

        const deltaX = e.clientX - resizeStartX
        const deltaY = e.clientY - resizeStartY

        const newWidth = Math.max(200, resizeStartWidth + deltaX)
        const newHeight = Math.max(150, resizeStartHeight + deltaY)

        // Apply the new dimensions directly to the widget element
        widgetEl.style.width = `${newWidth}px`
        widgetEl.style.height = `${newHeight}px`

        // For widgets in a group, we need to adjust the proportions
        const widget = widgets.find((w) => w.id === resizingWidget)
        if (widget?.groupId) {
            // Find all widgets in this group
            const groupWidgets = widgets.filter((w) => w.groupId === widget.groupId)
            const groupContainer = widgetEl.closest("[data-group-id]")

            if (groupContainer) {
                const containerWidth = groupContainer.clientWidth
                // Account for gaps (8px per gap = 2 * 0.5rem)
                const totalGapWidth = (groupWidgets.length - 1) * 8
                const adjustedContainerWidth = containerWidth - totalGapWidth
                const widthPercent = (newWidth / adjustedContainerWidth) * 100

                // Calculate how much width to take from other widgets
                const totalOtherWidgets = groupWidgets.length - 1
                if (totalOtherWidgets > 0) {
                    const otherWidgetsCurrentWidth = 100 - widthPercent
                    const widthPerOtherWidget = otherWidgetsCurrentWidth / totalOtherWidgets

                    // Update the DOM for smooth resizing
                    groupWidgets.forEach((w) => {
                        const el = document.querySelector(`[data-widget-id="${w.id}"]`)
                        if (el) {
                            if (w.id === resizingWidget) {
                                (el as HTMLElement).style.width = `calc(${widthPercent}% - ${totalGapWidth / groupWidgets.length}px)`
                            } else {
                                (el as HTMLElement).style.width = `calc(${widthPerOtherWidget}% - ${totalGapWidth / groupWidgets.length}px)`
                            }
                        }
                    })
                }
            }
        } else {
            // For widgets not in a group, we need to adjust the column span
            const widgetWidth = newWidth
            const containerWidth = widgetEl.parentElement?.offsetWidth ?? 1000
            const widthRatio = widgetWidth / containerWidth

            if (widthRatio > 0.6) {
                widgetEl.parentElement?.classList.remove("col-span-4", "col-span-6")
                widgetEl.parentElement?.classList.add("col-span-12")
            } else if (widthRatio > 0.3) {
                widgetEl.parentElement?.classList.remove("col-span-4", "col-span-12")
                widgetEl.parentElement?.classList.add("col-span-6")
            } else {
                widgetEl.parentElement?.classList.remove("col-span-6", "col-span-12")
                widgetEl.parentElement?.classList.add("col-span-4")
            }
        }
    }

    const handleResizeEnd = () => {
        if (!resizingWidget) return

        const widgetEl = widgetRefs.current[resizingWidget]
        if (!widgetEl) return

        // Get the widget
        const widget = widgets.find((w) => w.id === resizingWidget)

        if (widget?.groupId) {
            // For widgets in a group, save the new proportions
            const groupWidgets = widgets.filter((w) => w.groupId === widget.groupId)
            const finalWidths: number[] = []

            // Calculate total gap width
            const totalGapWidth = (groupWidgets.length - 1) * 8

            groupWidgets.forEach((w) => {
                const el = document.querySelector(`[data-widget-id="${w.id}"]`)
                if (el) {
                    const style = window.getComputedStyle(el)
                    const widthStr = style.width
                    let width = 0

                    if (widthStr.endsWith("%")) {
                        width = Number.parseFloat(widthStr)
                    } else {
                        const groupContainer = widgetEl.closest("[data-group-id]")
                        const containerWidth = (groupContainer?.clientWidth ?? 1) - totalGapWidth
                        width = (Number.parseFloat(widthStr) / containerWidth) * 100
                    }

                    finalWidths.push(width)
                } else {
                    finalWidths.push(w.customWidth ?? 100 / groupWidgets.length)
                }
            })
        } else {
            // For individual widgets, determine the new size based on width
            const width = widgetEl.offsetWidth
            const containerWidth = widgetEl.parentElement?.offsetWidth ?? 1000
            const widthRatio = width / containerWidth

            let newSize: "small" | "medium" | "large"
            if (widthRatio < 0.3) {
                newSize = "small"
            } else if (widthRatio < 0.6) {
                newSize = "medium"
            } else {
                newSize = "large"
            }

            // Update the widget size in state
            setWidgets(
                widgets.map((w) => {
                    if (w.id === resizingWidget) {
                        return { ...w, size: newSize }
                    }
                    return w
                }),
            )
        }

        // Reset resize state
        setResizingWidget(null)

        // Remove event listeners
        document.removeEventListener("mousemove", handleResizeMove)
        document.removeEventListener("mouseup", handleResizeEnd)

        // Reset inline styles for individual widgets
        if (!widget?.groupId) {
            widgetEl.style.width = ""
            widgetEl.style.height = ""
        }
    }

    // Handle group resizing
    const handleGroupResizeStart = (e: React.MouseEvent, groupId: string, dividerIndex: number) => {
        e.preventDefault()
        e.stopPropagation()

        if (!editMode) return

        const groupContainer = groupRefs.current[groupId]
        if (!groupContainer) return

        // Get all widgets in this group
        const groupWidgets = widgets.filter((w) => w.groupId === groupId)

        // Get their current widths
        const initialWidths = groupWidgets.map((w) => w.customWidth ?? 100 / groupWidgets.length)

        setResizingGroup({
            groupId,
            dividerIndex,
            startX: e.clientX,
            initialWidths,
        })

        document.addEventListener("mousemove", handleGroupResizeMove)
        document.addEventListener("mouseup", handleGroupResizeEnd)
    }

    const handleGroupResizeMove = (e: MouseEvent) => {
        if (!resizingGroup) return

        const { groupId, dividerIndex, startX, initialWidths } = resizingGroup

        const groupContainer = groupRefs.current[groupId]
        if (!groupContainer) return

        const containerWidth = groupContainer.offsetWidth
        const deltaX = e.clientX - startX
        const deltaPercent = (deltaX / containerWidth) * 100

        // Get all widgets in this group
        const groupWidgets = widgets.filter((w) => w.groupId === groupId)

        // Create a copy of the initial widths
        const newWidths = [...initialWidths]

        // Ensure we have valid indices
        if (dividerIndex < 0 || dividerIndex >= newWidths.length - 1) return

        // Adjust the widths of the widgets on either side of the divider
        // Ensure minimum width of 10% and maximum of 90%
        newWidths[dividerIndex] = Math.min(Math.max((initialWidths[dividerIndex] ?? 0) + deltaPercent, 10), 90)
        newWidths[dividerIndex + 1] = Math.min(Math.max((initialWidths[dividerIndex + 1] ?? 0) - deltaPercent, 10), 90)

        // Update the DOM for smooth resizing
        const widgetElements = groupWidgets.map(
            (w) => document.querySelector(`[data-widget-id="${w.id}"]`),
        )

        widgetElements.forEach((el, i) => {
            if (el) {
                el.setAttribute("style", `width: ${newWidths[i]}%`)
            }
        })
    }

    const handleGroupResizeEnd = () => {
        if (!resizingGroup) return

        const { groupId } = resizingGroup

        // Get all widgets in this group
        const groupWidgets = widgets.filter((w) => w.groupId === groupId)

        // Get their final widths from the DOM
        const finalWidths: number[] = []

        groupWidgets.forEach((widget) => {
            const el = document.querySelector(`[data-widget-id="${widget.id}"]`)
            if (el) {
                const style = window.getComputedStyle(el)
                const widthStr = style.width
                const containerWidth = groupRefs.current[groupId]?.offsetWidth ?? 1

                // Convert width to percentage
                let width = 0
                if (widthStr.endsWith("%")) {
                    width = Number.parseFloat(widthStr)
                } else {
                    width = (Number.parseFloat(widthStr) / containerWidth) * 100
                }

                finalWidths.push(width)
            } else {
                finalWidths.push(widget.customWidth ?? 100 / groupWidgets.length)
            }
        })

        // Update the widgets with their new widths - ensure we're capturing precise values
        setWidgets(
            widgets.map((widget) => {
                const index = groupWidgets.findIndex((w) => w.id === widget.id)
                if (index !== -1) {
                    return finalWidths[index] !== undefined
                        ? { ...widget, customWidth: Number.parseFloat(finalWidths[index].toFixed(2)) }
                        : widget;
                }
                return widget
            }),
        )

        setResizingGroup(null)
        document.removeEventListener("mousemove", handleGroupResizeMove)
        document.removeEventListener("mouseup", handleGroupResizeEnd)
    }

    useEffect(() => {
        return () => {
            document.removeEventListener("mousemove", handleResizeMove)
            document.removeEventListener("mouseup", handleResizeEnd)
            document.removeEventListener("mousemove", handleGroupResizeMove)
            document.removeEventListener("mouseup", handleGroupResizeEnd)
        }
    }, [])

    useEffect(() => {
        // Load active layout from localStorage
        const loadActiveLayout = () => {
            try {
                const activeLayoutData = localStorage.getItem("active-dashboard-layout")
                if (activeLayoutData) {
                    const {
                        widgets,
                        name,
                        // theme: savedTheme,
                    } = JSON.parse(activeLayoutData) as {
                        widgets: WidgetItem[]
                        name: string
                        // theme?: Theme
                    }
                    setWidgets(widgets)
                    setLayoutName(name)
                    // if (savedTheme) {
                    //   setTheme(savedTheme)
                    // }
                    setIsLayoutSaved(true)
                }
            } catch (error) {
                console.error("Error loading active layout:", error)
            }
        }

        loadActiveLayout()
    }, [])

    // Add a useEffect to log the widgets state whenever it changes
    useEffect(() => {
        console.log("Widgets state updated:", widgets)
        console.log(
            "Widget settings in state:",
            widgets.map((w) => ({ id: w.id, settings: w.settings })),
        )
    }, [widgets])

    // Remove handleThemeChange function
    // - const handleThemeChange = (newTheme: Theme) => {
    // -   setTheme(newTheme)
    // - }

    const addWidget = (widgetId: string) => {
        if (widgets.some((w) => w.id === widgetId)) {
            toast({
                title: "Widget already added",
                description: "This widget is already on your dashboard",
            })
            return
        }

        const widgetToAdd = AVAILABLE_WIDGETS.find((w) => w.id === widgetId)
        if (!widgetToAdd) return

        // Add the widget to the end of the list
        const newWidget: WidgetItem = {
            id: widgetId,
            size: "medium",
            order: widgets.length + 1,
            pinned: widgetId === "cover-profile", // Pin the cover-profile widget
        }

        setWidgets([...widgets, newWidget])

        toast({
            title: "Widget added",
            description: `${widgetToAdd.title} has been added to your dashboard`,
        })
    }

    const removeWidget = (widgetId: string) => {
        // Don't allow removing pinned widgets
        if (widgets.find((w) => w.id === widgetId)?.pinned) {
            toast({
                title: "Cannot remove",
                description: "This widget is required and cannot be removed",
                variant: "destructive",
            })

            return
        }

        const updatedWidgets = widgets.filter((w) => w.id !== widgetId)

        // Reorder the remaining widgets
        const reorderedWidgets = updatedWidgets.map((w, index) => ({
            ...w,
            order: index + 1,
        }))

        setWidgets(reorderedWidgets)
        setSelectedWidgets(selectedWidgets.filter((id) => id !== widgetId))

        toast({
            title: "Widget removed",
            description: "The widget has been removed from your dashboard",
        })
    }

    // Replace the changeWidgetSize function with this implementation
    const changeWidgetSize = (widgetId: string) => {
        const sizes: ("small" | "medium" | "large")[] = ["small", "medium", "large"]

        setWidgets(
            widgets.map((widget) => {
                if (widget.id === widgetId) {
                    const currentSizeIndex = sizes.indexOf(widget.size)
                    // Ensure we have a valid index, default to 0 if not found
                    const validIndex = currentSizeIndex >= 0 ? currentSizeIndex : 0
                    const nextSizeIndex = (validIndex + 1) % sizes.length
                    // Explicitly type the size to ensure it's never undefined
                    const newSize: "small" | "medium" | "large" = sizes[nextSizeIndex] ?? "medium"
                    return { ...widget, size: newSize }
                }
                return widget
            }),
        )
    }

    // Toggle selection mode
    const toggleSelectionMode = () => {
        setSelectionMode(!selectionMode)
        if (!selectionMode) {
            toast({
                title: "Selection Mode Activated",
                description: "Click on widgets to select them for grouping",
            })
        } else {
            setSelectedWidgets([])
        }
    }

    // Widget selection handling
    const toggleWidgetSelection = (widgetId: string, e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation()
            e.preventDefault()
        }

        if (!selectionMode) return

        if (selectedWidgets.includes(widgetId)) {
            setSelectedWidgets(selectedWidgets.filter((id) => id !== widgetId))
        } else {
            // Don't allow selecting pinned widgets
            if (widgets.find((w) => w.id === widgetId)?.pinned) {
                toast({
                    title: "Cannot select",
                    description: "Pinned widgets cannot be grouped",
                    variant: "destructive",
                })
                return
            }

            // Don't allow selecting widgets that are already in a group
            if (widgets.find((w) => w.id === widgetId)?.groupId) {
                toast({
                    title: "Cannot select",
                    description: "Widgets that are already in a group cannot be selected",
                })
                return
            }

            setSelectedWidgets([...selectedWidgets, widgetId])
        }
    }

    // Group selected widgets
    const groupSelectedWidgets = () => {
        if (selectedWidgets.length < 2) {
            toast({
                title: "Cannot group",
                description: "Select at least two widgets to group them together",
                variant: "destructive",
            })
            return
        }

        // Check if any selected widget is pinned
        const hasPinnedWidget = widgets.some((w) => selectedWidgets.includes(w.id) && w.pinned)
        if (hasPinnedWidget) {
            toast({
                title: "Cannot group",
                description: "Pinned widgets cannot be grouped",
                variant: "destructive",
            })
            return
        }

        // Create a new group ID
        const groupId = `group-${Date.now()}`

        // Calculate equal widths for each widget in the group
        const widgetCount = selectedWidgets.length
        const equalWidth = 100 / widgetCount

        // Update widgets with the new group ID and custom widths
        const updatedWidgets = widgets.map((widget) => {
            if (selectedWidgets.includes(widget.id)) {
                return {
                    ...widget,
                    groupId,
                    customWidth: equalWidth, // Set initial equal widths
                }
            }
            return widget
        })

        setWidgets(updatedWidgets)
        setSelectedWidgets([])
        setSelectionMode(false)

        // Add this to the groupSelectedWidgets function, right before the toast
        const proportionText =
            selectedWidgets.length === 2
                ? "50,50"
                : selectedWidgets.length === 3
                    ? "33,33,34"
                    : `${Math.floor(100 / selectedWidgets.length)}% each`

        toast({
            title: "Widgets grouped",
            description: `The selected widgets have been grouped with proportions: ${proportionText}. You can resize them or set specific proportions.`,
        })
    }

    // Ungroup widgets
    const ungroupWidgets = (groupId: string) => {
        const updatedWidgets = widgets.map((widget) => {
            if (widget.groupId === groupId) {
                // Create a new object without the groupId and customWidth properties
                const { groupId, customWidth, ...rest } = widget
                return rest
            }
            return widget
        })

        setWidgets(updatedWidgets)
        setSelectedWidgets([])

        toast({
            title: "Widgets ungrouped",
            description: "The widgets have been ungrouped",
        })
    }

    // Add this after the existing ungroupWidgets function
    const setGroupWidgetProportions = (groupId: string, proportions: string) => {
        // Parse the proportions string (e.g., "70,30" or "60,40")
        const values = proportions.split(",").map((v) => Number.parseInt(v.trim(), 10))

        // Get all widgets in this group
        const groupWidgets = widgets.filter((w) => w.groupId === groupId)

        // Validate that we have the right number of values
        if (values.length !== groupWidgets.length || values.some(isNaN)) {
            toast({
                title: "Invalid proportions",
                description: `Please enter ${groupWidgets.length} valid numbers separated by commas`,
                variant: "destructive",
            })
            return
        }

        // Validate that values sum to 100
        const sum = values.reduce((a, b) => a + b, 0)
        if (sum !== 100) {
            toast({
                title: "Invalid proportions",
                description: "Values must sum to 100",
                variant: "destructive",
            })
            return
        }

        // Update the widgets with the new proportions
        setWidgets(
            widgets.map((widget) => {
                const index = groupWidgets.findIndex((w) => w.id === widget.id)
                if (index !== -1) {
                    return { ...widget, customWidth: values[index] }
                }
                return widget
            }),
        )

        toast({
            title: "Proportions updated",
            description: "Widget proportions have been updated",
        })
    }

    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent, widgetId: string) => {
        if (!editMode || selectionMode) return

        // Don't allow dragging pinned widgets
        if (widgets.find((w) => w.id === widgetId)?.pinned) {
            e.preventDefault()
            return
        }

        setDraggedWidget(widgetId)
        e.dataTransfer.setData("text/plain", widgetId)
        // For better drag preview
        if (e.target instanceof HTMLElement) {
            e.dataTransfer.setDragImage(e.target, 20, 20)
        }
    }

    const handleDragOver = (e: React.DragEvent, widgetId: string) => {
        if (!editMode || selectionMode || !draggedWidget || draggedWidget === widgetId) return

        // Don't allow dropping before pinned widgets
        if (widgets.find((w) => w.id === widgetId)?.pinned) {
            return
        }

        e.preventDefault()
        setDragOverWidget(widgetId)
    }

    // Update the handleDrop function to work with the CoverProfileWidget
    const handleDrop = (e: React.DragEvent, targetWidgetId: string) => {
        if (!editMode || selectionMode || !draggedWidget) return
        e.preventDefault()

        // Don't allow dropping before pinned widgets
        if (widgets.find((w) => w.id === targetWidgetId)?.pinned) {
            return
        }

        // Find the indices of the dragged and target widgets
        const draggedIndex = widgets.findIndex((w) => w.id === draggedWidget)
        const targetIndex = widgets.findIndex((w) => w.id === targetWidgetId)

        if (draggedIndex === -1 || targetIndex === -1) return

        // Create a new array with the reordered widgets
        const newWidgets = [...widgets]
        const [removed] = newWidgets.splice(draggedIndex, 1)
        if (removed) {
            newWidgets.splice(targetIndex, 0, removed)
        }

        // Update the order property
        const reorderedWidgets = newWidgets.map((w, index) => ({
            ...w,
            order: index + 1,
        }))

        setWidgets(reorderedWidgets)
        setDraggedWidget(null)
        setDragOverWidget(null)
    }

    const handleDragEnd = () => {
        setDraggedWidget(null)
        setDragOverWidget(null)
    }

    // Update the renderWidgetContent function to pass the drag handlers to CoverProfileWidget
    const renderWidgetContent = (widgetId: string) => {
        const widgetDefinition = AVAILABLE_WIDGETS.find((w) => w.id === widgetId)
        if (!widgetDefinition) return null

        const WidgetComponent = widgetDefinition.component
        const widget = widgets.find((w) => w.id === widgetId)

        // Debug the widget and its settings
        console.log(`Rendering widget ${widgetId}:`, widget)

        const widgetSettings = widget?.settings ?? {}
        console.log(`Widget settings for ${widgetId}:`, widgetSettings)

        // Pass drag handlers to CoverProfileWidget
        if (widgetId === "cover-profile") {
            const settingsKey = JSON.stringify(widgetSettings ?? {})
            console.log(`CoverProfileWidget settings key: ${settingsKey}`)

            return (
                <WidgetComponent
                    key={`cover-profile-${settingsKey}`}
                    editMode={editMode}
                    profileEditMode={isProfileEditMode}
                    onDragOver={(e: React.DragEvent) => handleDragOver(e, widgetId)}
                    onDragEnter={(e: React.DragEvent) => setDragOverWidget(widgetId)}
                    onDragLeave={(e: React.DragEvent) => setDragOverWidget(null)}
                    onDrop={(e: React.DragEvent) => handleDrop(e, widgetId)}
                    widgetId={widgetId}
                    creatorData={creator.data as CreatorWithPageAsset}
                    settings={widgetSettings}
                    setProfileEditMode={toggleProfileEditMode}
                    onSettingsChange={(newSettings) => {
                        // Prevent unnecessary updates by comparing with current settings
                        const currentSettings = widget?.settings ?? {}

                        console.log("Settings change requested:", newSettings)
                        console.log("Current settings:", currentSettings)

                        setWidgets(
                            widgets.map((w) => {
                                if (w.id === widgetId) {
                                    const updatedSettings = { ...currentSettings, ...newSettings }
                                    console.log("Updated settings:", updatedSettings)
                                    return { ...w, settings: updatedSettings }
                                }
                                return w
                            }),
                        )
                    }}
                />
            )
        }

        // Rest of the function remains the same...

        // Add a key prop to force re-render when settings change
        return (
            <WidgetComponent
                key={`${widgetId}-${JSON.stringify(widgetSettings)}`}
                editMode={editMode}
                profileEditMode={isProfileEditMode}
                onDragOver={(e: React.DragEvent) => handleDragOver(e, widgetId)}
                onDragEnter={(e: React.DragEvent) => setDragOverWidget(widgetId)}
                onDragLeave={(e: React.DragEvent) => setDragOverWidget(null)}
                onDrop={(e: React.DragEvent) => handleDrop(e, widgetId)}
                widgetId={widgetId}
                settings={widgetSettings}
                creatorData={creator.data as CreatorWithPageAsset}
                setProfileEditMode={toggleProfileEditMode}
                onSettingsChange={(newSettings) => {
                    // Prevent unnecessary updates by comparing with current settings
                    const currentSettings = widget?.settings ?? {}

                    console.log("Settings change requested:", newSettings)
                    console.log("Current settings:", currentSettings)

                    setWidgets(
                        widgets.map((w) => {
                            if (w.id === widgetId) {
                                return { ...w, settings: { ...currentSettings, ...newSettings } }
                            }
                            return w
                        }),
                    )
                }}
            />
        )
    }

    // Group widgets by row for full-width handling
    const getWidgetRows = () => {
        const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order)

        // First, handle the pinned widgets (they always go at the top)
        const pinnedWidgets = sortedWidgets.filter((w) => w.pinned)
        const unpinnedWidgets = sortedWidgets.filter((w) => !w.pinned)

        // Group widgets by their groupId
        const groupedWidgets: Record<string, WidgetItem[]> = {}

        unpinnedWidgets.forEach((widget) => {
            if (widget.groupId) {
                if (!groupedWidgets[widget.groupId]) {
                    groupedWidgets[widget.groupId] = []
                }
                (groupedWidgets[widget.groupId] ??= []).push(widget)
            }
        })

        // Process unpinned widgets to determine rows
        let currentRow: (WidgetItem | WidgetItem[])[] = []
        const rows: (WidgetItem | WidgetItem[])[][] = []

        // Add pinned widgets as their own rows
        pinnedWidgets.forEach((widget) => {
            rows.push([widget])
        })

        // Process remaining widgets
        let currentRowWidth = 0
        const maxRowWidth = 3 // Maximum columns in a row

        unpinnedWidgets.forEach((widget) => {
            // Skip widgets that are part of a group (we'll handle them separately)
            if (widget.groupId && groupedWidgets[widget.groupId]) {
                // Only process the first widget of each group to avoid duplicates
                if (groupedWidgets[widget.groupId]?.[0]?.id !== widget.id) {
                    return
                }

                // Calculate the total width of the group
                const groupWidgets = groupedWidgets[widget.groupId]
                const groupWidth = (groupWidgets ?? []).length // Each widget takes 1 column in the group

                // If this group would exceed row width, start a new row
                if (currentRowWidth + groupWidth > maxRowWidth && currentRow.length > 0) {
                    rows.push([...currentRow])
                    currentRow = []
                    currentRowWidth = 0
                }

                // Add the group to the current row
                currentRow.push(groupWidgets ?? [])
                currentRowWidth += groupWidth

                // Remove these widgets from groupedWidgets to mark them as processed
                delete groupedWidgets[widget.groupId]
            } else if (!widget.groupId) {
                // Handle individual widgets
                const widgetWidth = widget.size === "small" ? 1 : widget.size === "medium" ? 1 : 3

                // If this widget would exceed row width, start a new row
                if (currentRowWidth + widgetWidth > maxRowWidth && currentRow.length > 0) {
                    rows.push([...currentRow])
                    currentRow = []
                    currentRowWidth = 0
                }

                // Add widget to current row
                currentRow.push(widget)
                currentRowWidth += widgetWidth
            }
        })

        // Add the last row if it has widgets
        if (currentRow.length > 0) {
            rows.push(currentRow)
        }

        return rows
    }

    const widgetRows = getWidgetRows()

    const toggleEditMode = () => {
        setEditMode(!editMode)
        if (!editMode) {
            setSelectionMode(false)
            setSelectedWidgets([])
        }
    }

    const filteredWidgets = (widgets: typeof AVAILABLE_WIDGETS) => {
        if (!widgetSearchQuery) return widgets
        return widgets.filter(
            (widget) =>
                widget.title.toLowerCase().includes(widgetSearchQuery.toLowerCase()) ??
                widget.description.toLowerCase().includes(widgetSearchQuery.toLowerCase()),
        )
    }

    // Fix for the referee pattern to avoid creating functions in render
    const setWidgetRef = (el: HTMLDivElement | null, id: string): void => {
        widgetRefs.current[id] = el
    }

    const setGroupRef = (el: HTMLDivElement | null, id: string) => {
        groupRefs.current[id] = el
        return el
    }

    // Add a helper function to apply group widget sizes
    const applyGroupWidgetSizes = (widgetsToApply = widgets) => {
        // Get all unique group IDs
        const groupIds = [...new Set(widgetsToApply.filter((w) => w.groupId).map((w) => w.groupId))]

        // For each group, apply the custom widths
        groupIds.forEach((groupId) => {
            if (!groupId) return

            const groupWidgets = widgetsToApply.filter((w) => w.groupId === groupId)

            groupWidgets.forEach((widgets) => {
                if (widgets.customWidth) {
                    const el = document.querySelector(`[data-widget-id="${widgets.id}"]`)
                    if (el) {
                        (el as HTMLElement).style.width = `${widgets.customWidth}%`
                    }
                }
            })
        })
    }
    // Add this useEffect to apply group widget sizes whenever widgets change
    useEffect(() => {
        // Apply custom widths for group widgets after a short delay to ensure DOM is ready
        const timer = setTimeout(() => {
            applyGroupWidgetSizes()
        }, 100)

        return () => clearTimeout(timer)
    }, [widgets])

    // Add this useEffect to apply custom widths whenever widgets change
    useEffect(() => {
        // Apply custom widths for group widgets
        widgets.forEach((widget) => {
            if (widget.groupId && widget.customWidth) {
                const el = document.querySelector(`[data-widget-id="${widget.id}"]`)
                if (el) {
                    (el as HTMLElement).style.width = `${widget.customWidth}%`
                }
            }
        })
    }, [widgets])
    return (
        <div
            ref={dashboardContainerRef}
            className=" flex flex-col h-full"
        // Remove theme-related styling from the dashboard container
        // - style={{
        // -   fontFamily: theme.font.body,
        // -   backgroundColor: theme.colors.background,
        // -   color: theme.colors.text,
        // - }}
        >
            {/* Simplified Toolbar */}
            <div
                className=" border-b p-2 flex items-center justify-between"
            // Remove theme-related styling from the toolbar
            // - style={{
            // -   backgroundColor: theme.colors.card,
            // -   borderColor: theme.colors.border,
            // -   borderWidth: `0 0 ${theme.style.borderWidth}px 0`,
            // - }}
            >
                <div className="flex items-center">
                    <h2
                        className="text-xl font-bold mr-4"
                    // Remove theme-related styling from the layout name
                    // - style={{ fontFamily: theme.font.heading }}
                    >
                        {layoutName}
                    </h2>
                    {isLayoutSaved && (
                        <span className="text-xs text-muted-foreground">{makePublic ? "Public" : "Private"} Dashboard</span>
                    )}
                </div>

                <div className="flex items-center space-x-2">
                    {!editMode && !isProfileEditMode ? (
                        <div className="flex items-center gap-2">


                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button size="sm" variant="outline" onClick={toggleEditMode}>
                                            <Edit className="h-4 w-4 mr-2" />
                                            Customize Dashboard
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Rearrange widgets and customize your dashboard layout</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button size="sm" variant="outline" onClick={toggleProfileEditMode}>
                                            <User className="h-4 w-4 mr-2" />
                                            Edit Profile
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Update your profile information, cover image, and profile picture</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    ) : isProfileEditMode ? (
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="default" onClick={toggleProfileEditMode}>
                                <Save className="h-4 w-4 mr-2" />
                                Save Profile
                            </Button>
                            <Button size="sm" variant="outline" onClick={toggleProfileEditMode}>
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Remove ThemeCustomizer component from the toolbar */}
                            {/* - <ThemeCustomizer theme={theme} onThemeChange={handleThemeChange} /> */}

                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button size="sm" variant={selectionMode ? "default" : "outline"} onClick={toggleSelectionMode}>
                                            {selectionMode ? (
                                                <>
                                                    <Check className="h-4 w-4 mr-2" />
                                                    Selecting ({selectedWidgets.length})
                                                </>
                                            ) : (
                                                <>
                                                    <Check className="h-4 w-4 mr-2" />
                                                    Select Widgets
                                                </>
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Select widgets to group them together</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            {selectionMode && selectedWidgets.length >= 2 && (
                                <Button size="sm" variant="default" onClick={groupSelectedWidgets}>
                                    <Link2 className="h-4 w-4 mr-2" />
                                    Group Selected ({selectedWidgets.length})
                                </Button>
                            )}

                            <Sheet open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                                <SheetTrigger asChild>
                                    <Button size="sm" variant="outline">
                                        <Save className="h-4 w-4 mr-2" />
                                        Save
                                    </Button>
                                </SheetTrigger>
                                <SheetContent className="dashboard-sheet">
                                    <SheetHeader>
                                        <SheetTitle>Save Dashboard Layout</SheetTitle>
                                        <SheetDescription>Save your current dashboard configuration.</SheetDescription>
                                    </SheetHeader>
                                    <div className="py-6">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="layout-name">Layout Name</Label>
                                                <Input
                                                    id="layout-name"
                                                    placeholder="My Custom Dashboard"
                                                    value={newLayoutName}
                                                    onChange={(e) => setNewLayoutName(e.target.value)}
                                                />
                                            </div>

                                            <div className="flex items-center space-x-2">
                                                <Switch id="make-public" checked={makePublic} onCheckedChange={setMakePublic} />
                                                <Label htmlFor="make-public">Make this the default layout for all users</Label>
                                            </div>

                                            <div className="text-sm text-muted-foreground">
                                                {makePublic
                                                    ? "This layout will be visible to all users who visit your page."
                                                    : "This layout will only be saved for your own use."}
                                            </div>
                                        </div>
                                        <div className="flex justify-end mt-6">
                                            <Button onClick={handleSaveLayout} disabled={isSaving}>
                                                {isSaving ? "Saving..." : "Save Layout"}
                                            </Button>
                                        </div>
                                    </div>
                                </SheetContent>
                            </Sheet>

                            <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
                                <DialogContent className="dashboard-sheet sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Load Dashboard Layout</DialogTitle>
                                        <DialogDescription>Select a saved dashboard layout to load.</DialogDescription>
                                    </DialogHeader>

                                    {isLoading ? (
                                        <div className="py-6 text-center">Loading saved layouts...</div>
                                    ) : savedLayouts.length === 0 ? (
                                        <div className="py-6 text-center">No saved layouts found.</div>
                                    ) : (
                                        <div className="py-4">
                                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                                                {savedLayouts.map((layout) => (
                                                    <div
                                                        key={layout.id}
                                                        className={`p-4 border rounded-md cursor-pointer hover:bg-muted/50 flex justify-between items-center ${layout.id === layoutId ? "border-primary" : ""
                                                            }`}
                                                        onClick={() => loadLayout(layout.id)} // This will now correctly update the existing layout
                                                    >
                                                        <div>
                                                            <div className="font-medium">{layout.name}</div>
                                                            {layout.isDefault && (
                                                                <div className="text-xs text-muted-foreground mt-1">Default layout</div>
                                                            )}
                                                        </div>

                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                deleteLayout(layout.id)
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsLoadDialogOpen(false)}>
                                            Cancel
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            <Sheet>
                                <SheetTrigger asChild>
                                    <Button size="sm">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Widgets
                                    </Button>
                                </SheetTrigger>
                                <SheetContent
                                    side="right"
                                    className="dashboard-sheet border-l border-border w-[400px] sm:w-[540px] z-50"
                                >
                                    <SheetHeader>
                                        <SheetTitle>Add Widgets</SheetTitle>
                                        <SheetDescription>Add widgets to your dashboard.</SheetDescription>
                                    </SheetHeader>
                                    <div className="py-6">
                                        <div className="mb-4">
                                            <Input
                                                placeholder="Search widgets..."
                                                value={widgetSearchQuery}
                                                onChange={(e) => setWidgetSearchQuery(e.target.value)}
                                                className="w-full"
                                            />
                                        </div>
                                        <Tabs defaultValue="all">
                                            <TabsList className="grid w-full grid-cols-3">
                                                <TabsTrigger value="all">All</TabsTrigger>
                                                <TabsTrigger value="content">Content</TabsTrigger>
                                                <TabsTrigger value="analytics">Analytics</TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="all" className="mt-4 h-[calc(100vh-180px)] overflow-y-auto pr-2">
                                                <div className="grid grid-cols-1 gap-4">
                                                    {filteredWidgets(AVAILABLE_WIDGETS).map((widget) => (
                                                        <Card
                                                            key={widget.id}
                                                            className={`dashboard-card cursor-pointer transition-all hover:shadow-md ${widgets.some((w) => w.id === widget.id) ? "border-primary bg-primary/5" : ""
                                                                }`}
                                                            // Remove theme-related styling from cards and widgets
                                                            // - style={{
                                                            // -   borderRadius: `${theme.style.borderRadius}px`,
                                                            // -   borderWidth: `${theme.style.borderWidth}px`,
                                                            // - }}
                                                            onClick={() => {
                                                                if (!widgets.some((w) => w.id === widget.id)) {
                                                                    addWidget(widget.id)
                                                                }
                                                            }}
                                                        >
                                                            <div className="p-4">
                                                                <div className="text-base flex items-center justify-between">
                                                                    <span className="font-medium">{widget.title}</span>
                                                                    {widgets.some((w) => w.id === widget.id) ? (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="h-8 px-2 text-xs"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                removeWidget(widget.id)
                                                                            }}
                                                                            disabled={widget.id === "cover-profile"}
                                                                        >
                                                                            <X className="h-4 w-4 mr-1" />
                                                                            Remove
                                                                        </Button>
                                                                    ) : (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="default"
                                                                            className="h-8 px-2 text-xs"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                addWidget(widget.id)
                                                                            }}
                                                                        >
                                                                            <Plus className="h-4 w-4 mr-1" />
                                                                            Add
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                                <p className="text-sm text-muted-foreground mt-1">{widget.description}</p>
                                                            </div>
                                                        </Card>
                                                    ))}
                                                </div>
                                            </TabsContent>
                                            <TabsContent value="content" className="mt-4 h-[calc(100vh-180px)] overflow-y-auto pr-2">
                                                {/* Content tab widgets */}
                                                <div className="grid grid-cols-1 gap-4">
                                                    {filteredWidgets(
                                                        AVAILABLE_WIDGETS.filter((w) =>
                                                            ["cover-profile", "profile", "recent-posts", "nft-gallery", "subscriptions"].includes(
                                                                w.id,
                                                            ),
                                                        ),
                                                    ).map((widget) => (
                                                        <Card
                                                            key={widget.id}
                                                            className={`dashboard-card cursor-pointer transition-all hover:shadow-md ${widgets.some((w) => w.id === widget.id) ? "border-primary bg-primary/5" : ""
                                                                }`}
                                                            // Remove theme-related styling from cards and widgets
                                                            // - style={{
                                                            // -   borderRadius: `${theme.style.borderRadius}px`,
                                                            // -   borderWidth: `${theme.style.borderWidth}px`,
                                                            // - }}
                                                            onClick={() => {
                                                                if (!widgets.some((w) => w.id === widget.id)) {
                                                                    addWidget(widget.id)
                                                                }
                                                            }}
                                                        >
                                                            <div className="p-4">
                                                                <div className="text-base flex items-center justify-between">
                                                                    <span className="font-medium">{widget.title}</span>
                                                                    {widgets.some((w) => w.id === widget.id) ? (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="h-8 px-2 text-xs"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                removeWidget(widget.id)
                                                                            }}
                                                                            disabled={widget.id === "cover-profile"}
                                                                        >
                                                                            <X className="h-4 w-4 mr-1" />
                                                                            Remove
                                                                        </Button>
                                                                    ) : (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="default"
                                                                            className="h-8 px-2 text-xs"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                addWidget(widget.id)
                                                                            }}
                                                                        >
                                                                            <Plus className="h-4 w-4 mr-1" />
                                                                            Add
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                                <p className="text-sm text-muted-foreground mt-1">{widget.description}</p>
                                                            </div>
                                                        </Card>
                                                    ))}
                                                </div>
                                            </TabsContent>
                                            <TabsContent value="analytics" className="mt-4 h-[calc(100vh-180px)] overflow-y-auto pr-2">
                                                {/* Analytics tab widgets */}
                                                <div className="grid grid-cols-1 gap-4">
                                                    {filteredWidgets(
                                                        AVAILABLE_WIDGETS.filter((w) => ["stats", "chart", "calendar", "todo"].includes(w.id)),
                                                    ).map((widget) => (
                                                        <Card
                                                            key={widget.id}
                                                            className={`dashboard-card cursor-pointer transition-all hover:shadow-md ${widgets.some((w) => w.id === widget.id) ? "border-primary bg-primary/5" : ""
                                                                }`}
                                                            // Remove theme-related styling from cards and widgets
                                                            // - style={{
                                                            // -   borderRadius: `${theme.style.borderRadius}px`,
                                                            // -   borderWidth: `${theme.style.borderWidth}px`,
                                                            // - }}
                                                            onClick={() => {
                                                                if (!widgets.some((w) => w.id === widget.id)) {
                                                                    addWidget(widget.id)
                                                                }
                                                            }}
                                                        >
                                                            <div className="p-4">
                                                                <div className="text-base flex items-center justify-between">
                                                                    <span className="font-medium">{widget.title}</span>
                                                                    {widgets.some((w) => w.id === widget.id) ? (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="h-8 px-2 text-xs"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                removeWidget(widget.id)
                                                                            }}
                                                                        >
                                                                            <X className="h-4 w-4 mr-1" />
                                                                            Remove
                                                                        </Button>
                                                                    ) : (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="default"
                                                                            className="h-8 px-2 text-xs"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                addWidget(widget.id)
                                                                            }}
                                                                        >
                                                                            <Plus className="h-4 w-4 mr-1" />
                                                                            Add
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                                <p className="text-sm text-muted-foreground mt-1">{widget.description}</p>
                                                            </div>
                                                        </Card>
                                                    ))}
                                                </div>
                                            </TabsContent>
                                        </Tabs>
                                    </div>
                                </SheetContent>
                            </Sheet>

                            <Button size="sm" variant="outline" onClick={toggleEditMode}>
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Dashboard Grid */}
            <div
                className="dashboard-content flex-1 overflow-auto p-4"
            // Remove theme-related styling from the dashboard content
            // - style={{
            // -   padding:
            // -     theme.style.contentDensity === "compact"
            // -       ? "0.5rem"
            // -       : theme.style.contentDensity === "spacious"
            // -         ? "2rem"
            // -         : "1rem",
            // - }}
            >
                <div className="flex flex-col gap-4">
                    {widgetRows.map((row, rowIndex) => (
                        <div key={rowIndex} className="grid gap-4 grid-cols-1 md:grid-cols-3">
                            {row.map((item, itemIndex) => {
                                // Handle grouped widgets
                                if (Array.isArray(item)) {
                                    const groupId = item[0]?.groupId

                                    return (
                                        <div
                                            key={`group-${groupId}`}
                                            className="col-span-full bg-muted/20 rounded-lg p-2 relative"
                                            // Remove theme-related styling from cards and widgets
                                            // - style={{
                                            // -   borderRadius: `${theme.style.borderRadius}px`,
                                            // -   backgroundColor: `${theme.colors.background}`,
                                            // -   boxShadow:
                                            // -     theme.style.shadowSize === "sm"
                                            // -       ? "0 1px 2px rgba(0,0,0,0.05)"
                                            // -       : theme.style.shadowSize === "md"
                                            // -         ? "0 4px 6px -1px rgba(0,0,0,0.1)"
                                            // -         : theme.style.shadowSize === "lg"
                                            // -           ? "0 10px 15px -3px rgba(0,0,0,0.1)"
                                            // -           : "none",
                                            // - }}
                                            ref={(el) => {
                                                setGroupRef(el, groupId ?? "");
                                            }}
                                            data-group-id={groupId}
                                        >
                                            {editMode && (
                                                <div className="absolute right-2 top-2 z-10">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 px-2"
                                                        onClick={() => ungroupWidgets(groupId ?? "")}
                                                    >
                                                        <Unlink className="h-3 w-3 mr-1" />
                                                        Ungroup
                                                    </Button>
                                                </div>
                                            )}
                                            <div className="flex flex-row pt-6 gap-2 w-full ">
                                                {item.map((widget, widgetIndex) => {
                                                    const widgetInfo = AVAILABLE_WIDGETS.find((w) => w.id === widget.id)
                                                    if (!widgetInfo) return null

                                                    // Use custom width if available, otherwise calculate based on size
                                                    const widthPercentage = widget.customWidth ?? 100 / item.length

                                                    return (
                                                        <div
                                                            key={widget.id}
                                                            className={`
                                relative
                                ${dragOverWidget === widget.id ? "ring-2 ring-primary" : ""}
                                ${selectedWidgets.includes(widget.id) ? "ring-2 ring-destructive" : ""}
                                transition-all duration-200
                              `}
                                                            style={{
                                                                width: `${widthPercentage}%`, // Removed the calc to avoid calculation errors
                                                            }}
                                                            data-widget-id={widget.id}
                                                            data-custom-width={widget.customWidth ?? ""}
                                                            draggable={editMode && !selectionMode && !widget.pinned}
                                                            onDragStart={(e) => handleDragStart(e, widget.id)}
                                                            onDragOver={(e) => handleDragOver(e, widget.id)}
                                                            onDrop={(e) => handleDrop(e, widget.id)}
                                                            onDragEnd={handleDragEnd}
                                                            onClick={(e) => selectionMode && toggleWidgetSelection(widget.id, e)}
                                                        >
                                                            <Card
                                                                className="flex flex-col overflow-hidden relative h-[calc(100vh-20vh)] overflow-y-auto"
                                                                ref={(el) => setWidgetRef(el, widget.id)}
                                                            // Remove theme-related styling from cards and widgets
                                                            // - style={{
                                                            // -   borderRadius: `${theme.style.borderRadius}px`,
                                                            // -   borderWidth: `${theme.style.borderWidth}px`,
                                                            // -   borderColor: theme.colors.border,
                                                            // -   backgroundColor: theme.colors.card,
                                                            // -   boxShadow:
                                                            // -     theme.style.shadowSize === "sm"
                                                            // -       ? "0 1px 2px rgba(0,0,0,0.05)"
                                                            // -       : theme.style.shadowSize === "md"
                                                            // -         ? "0 4px 6px -1px rgba(0,0,0,0.1)"
                                                            // -         : theme.style.shadowSize === "lg"
                                                            // -           ? "0 10px 15px -3px rgba(0,0,0,0.1)"
                                                            // -           : "none",
                                                            // - }}
                                                            >
                                                                {editMode && !widget.pinned && (
                                                                    <>
                                                                        <div className="absolute left-0 top-0 right-0 bg-muted/80 p-1 flex items-center justify-between z-10">
                                                                            <div className="flex items-center">
                                                                                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                                                                                <span className="text-xs ml-1">{widgetInfo.title}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1">
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    className="h-6 w-6 p-0"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation()
                                                                                        changeWidgetSize(widget.id)
                                                                                    }}
                                                                                >
                                                                                    <span className="text-xs">{widget.size.charAt(0).toUpperCase()}</span>
                                                                                </Button>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    className="h-6 w-6 p-0 text-destructive"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation()
                                                                                        removeWidget(widget.id)
                                                                                    }}
                                                                                >
                                                                                    <X className="h-4 w-4" />
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                        <div
                                                                            className="absolute bottom-2 right-2 text-white hover:text-black cursor-se-resize bg-primary hover:bg-background border-2 rounded-full transition duration-200 p-1 z-10"
                                                                            onMouseDown={(e) => handleResizeStart(e, widget.id)}
                                                                        >
                                                                            <Maximize2 className="h-3 w-3" />
                                                                        </div>
                                                                    </>
                                                                )}
                                                                <CardContent className={`p-0   ${editMode && !widget.pinned ? "pt-8" : ""}`}>
                                                                    {renderWidgetContent(widget.id)}
                                                                </CardContent>
                                                            </Card>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            {editMode && (
                                                <div className="absolute left-0 right-0 bottom-0 flex justify-around items-center p-2 bg-muted/50">
                                                    {/* Divider controls */}
                                                    {Array.from({ length: item.length - 1 }).map((_, i) => (
                                                        <div key={`divider-${i}`} className="relative h-full flex items-center">
                                                            <div
                                                                className="absolute top-0 bottom-0 w-1 bg-border cursor-col-resize opacity-0 hover:opacity-100 transition-opacity"
                                                                onMouseDown={(e) => handleGroupResizeStart(e, groupId ?? "", i)}
                                                            />
                                                        </div>
                                                    ))}
                                                    {/* Proportions input */}
                                                    <div className="flex items-center gap-2">
                                                        <Label htmlFor={`proportions-${groupId}`} className="text-xs">
                                                            Proportions:
                                                        </Label>
                                                        <Input
                                                            type="text"
                                                            id={`proportions-${groupId}`}
                                                            placeholder="e.g., 60,40"
                                                            className="w-24 text-xs"
                                                            onBlur={(e) => setGroupWidgetProportions(groupId ?? "", e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                }

                                // Handle individual widgets
                                const widget = item
                                const widgetInfo = AVAILABLE_WIDGETS.find((w) => w.id === widget.id)
                                if (!widgetInfo) return null

                                // For single widgets in a row, make them full width
                                const isSingleInRow = row.length === 1
                                // For pinned widgets (like cover-profile), always make them full width
                                const isPinned = widget.pinned

                                return (
                                    <div
                                        key={widget.id}
                                        className={`
                      ${isSingleInRow ?? isPinned
                                                ? "col-span-full"
                                                : widget.size === "small"
                                                    ? "col-span-1"
                                                    : widget.size === "medium"
                                                        ? "col-span-1 md:col-span-1"
                                                        : "col-span-1 md:col-span-3"
                                            }
                      ${dragOverWidget === widget.id ? "ring-2 ring-primary" : ""}
                      ${selectedWidgets.includes(widget.id) ? "ring-2 ring-destructive" : ""}
                      transition-all duration-200
                      relative
                    `}
                                        draggable={editMode && !selectionMode && !widget.pinned}
                                        onDragStart={(e) => handleDragStart(e, widget.id)}
                                        onDragOver={(e) => handleDragOver(e, widget.id)}
                                        onDrop={(e) => handleDrop(e, widget.id)}
                                        onDragEnd={handleDragEnd}
                                        onClick={(e) => selectionMode && toggleWidgetSelection(widget.id, e)}
                                    >
                                        <Card
                                            className=" flex flex-col overflow-hidden relative  max-h-[calc(100vh-20vh)] overflow-y-auto"
                                            ref={(el) => setWidgetRef(el, widget.id)}
                                        // Remove theme-related styling from cards and widgets
                                        // - style={{
                                        // -   borderRadius: `${theme.style.borderRadius}px`,
                                        // -   borderWidth: `${theme.style.borderWidth}px`,
                                        // -   borderColor: theme.colors.border,
                                        // -   backgroundColor: theme.colors.card,
                                        // -   boxShadow:
                                        // -     theme.style.shadowSize === "sm"
                                        // -       ? "0 1px 2px rgba(0,0,0,0.05)"
                                        // -       : theme.style.shadowSize === "md"
                                        // -         ? "0 4px 6px -1px rgba(0,0,0,0.1)"
                                        // -         : theme.style.shadowSize === "lg"
                                        // -           ? "0 10px 15px -3px rgba(0,0,0,0.1)"
                                        // -           : "none",
                                        // - }}
                                        >
                                            {editMode && !isPinned && (
                                                <>
                                                    <div className="absolute left-0 top-0 right-0 bg-muted/80 p-1 flex items-center justify-between z-10">
                                                        <div className="flex items-center">
                                                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                                                            <span className="text-xs ml-1">{widgetInfo.title}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-6 w-6 p-0"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    changeWidgetSize(widget.id)
                                                                }}
                                                            >
                                                                <span className="text-xs">{widget.size.charAt(0).toUpperCase()}</span>
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-6 w-6 p-0 text-destructive"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    removeWidget(widget.id)
                                                                }}
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <div
                                                        className="absolute bottom-2 right-2 text-white hover:text-black cursor-se-resize bg-primary hover:bg-background border-2 rounded-full transition duration-200 p-1 z-10"
                                                        onMouseDown={(e) => handleResizeStart(e, widget.id)}
                                                    >
                                                        <Maximize2 className="h-3 w-3" />
                                                    </div>
                                                </>
                                            )}
                                            <CardContent className={`p-0    ${editMode && !isPinned ? "pt-8" : ""}`}>
                                                {renderWidgetContent(widget.id)}
                                            </CardContent>
                                        </Card>
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {editMode && (
                <div
                    className="bg-muted/80 p-4 text-center"
                // Remove theme-related styling from the edit mode footer
                // - style={{
                // -   backgroundColor: `${theme.colors.muted}20`,
                // -   color: theme.colors.text,
                // - }}
                >
                    {selectionMode ? (
                        <p className="text-sm">
                            <strong>Selection Mode:</strong> Click on widgets to select them, then click *Group Selected* to group
                            them together. Selected widgets: {selectedWidgets.length}
                        </p>
                    ) : (
                        <p className="text-sm">
                            Edit mode active. Drag to rearrange, click size button to resize, or remove widgets with the X button.
                            Click *Select Widgets* to select and group widgets.
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}
