import { Creator, CreatorPageAsset } from "@prisma/client"
import type React from "react"
// Define types for the widget settings
export interface CoverProfileSettings {
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


}
// Update the WidgetSettings interface to match what the mutation expects
type WidgetSettingValue = string | number | boolean | Record<string, unknown>;

export type WidgetSettings = Record<string, WidgetSettingValue>;


// Ensure WidgetItem.size is required and can't be undefined
export interface WidgetItem {
    id: string
    size: "small" | "medium" | "large" // This is required, not optional
    order: number
    pinned?: boolean
    groupId?: string
    customWidth?: number
    settings?: WidgetSettings
}

export interface WidgetDefinition {
    id: string
    title: string
    description: string
    component: React.ComponentType<CoverProfileWidgetProps>
    icon: string
    special?: boolean
}

export interface SavedLayout {
    id: string
    name: string
    isDefault: boolean
    isPublic: boolean
    widgets: WidgetItem[]
}

export interface GroupResizeState {
    groupId: string
    dividerIndex: number
    startX: number
    initialWidths: number[]
}

export interface ThemeColors {
    primary: string
    secondary: string
    accent: string
    background: string
    card: string
    text: string
    muted: string
    border: string
}

export interface ThemeFont {
    family: string
    heading: string
    body: string
}

export interface ThemeStyle {
    borderRadius: number
    borderWidth: number
    shadowSize: "none" | "sm" | "md" | "lg"
    contentDensity: "compact" | "normal" | "spacious"
}

export interface Theme {
    name: string
    colors: ThemeColors
    font: ThemeFont
    style: ThemeStyle
}

export interface AppearanceData {
    id?: string
    name: string
    isDefault?: boolean
    creatorId?: string
    creator?: Creator
    widgets: WidgetItem[]
    theme?: Theme
    isPublic?: boolean
}

export interface WidgetData {
    id: string
    widgetId: string
    size: "small" | "medium" | "large"
    order: number
    pinned: boolean
    groupId?: string
    customWidth?: number
    appearanceId: string
    settings?: WidgetSettings
    appearance: AppearanceData
    createdAt: Date
    updatedAt: Date
}


export type CreatorWithPageAsset = Creator & {
    pageAsset: CreatorPageAsset | null
    _count: {
        posts: number
        assets: number
        followers: number
        revenue: number
    }
}
