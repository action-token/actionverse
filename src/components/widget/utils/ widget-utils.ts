import { WidgetItem, WidgetSettings } from "~/types/organization/dashboard";

// Widget size definitions
export type WidgetHeight = "SS" | "S" | "M" | "L" | "XL" | "2XL" | "3XL" | "4XL"
export type WidgetWidth = "SS" | "S" | "M" | "L" | "XL" | "2XL" | "3XL" | "4XL"

// Size to pixel/percentage mappings
export const HEIGHT_MAP: Record<WidgetHeight, number> = {
    SS: 120, // Extra small height
    S: 200, // Small height
    M: 300, // Medium height
    L: 400, // Large height
    XL: 600, // Extra large height
    "2XL": 800, // 2x Extra large height
    "3XL": 1000, // 3x Extra large height
    "4XL": 1200, // 4x Extra large height
}

export const WIDTH_MAP: Record<WidgetWidth, number> = {
    SS: 16.66, // Extra small width (1/6 of container)
    S: 25, // Small width (1/4 of container)
    M: 33.33, // Medium width (1/3 of container)
    L: 50, // Large width (1/2 of container)
    XL: 66.66, // Extra large width (2/3 of container)
    "2XL": 75, // 3/4 of container
    "3XL": 83.33, // 5/6 of container
    "4XL": 100, // full container
}

// Update the convertLegacySize function to handle the conversion from old to new size format
export function convertLegacySize(size: string): { width: WidgetWidth; height: WidgetHeight } {
    switch (size) {
        case "small":
            return { width: "S", height: "S" }
        case "medium":
            return { width: "M", height: "M" }
        case "large":
            return { width: "L", height: "L" }
        default:
            // Try to parse the size as a new format if it's not a legacy size
            if (["SS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"].includes(size)) {
                return { width: size as WidgetWidth, height: size as WidgetHeight }
            }
            // Default to medium if we can't determine the size
            return { width: "M", height: "M" }
    }
}

// Update the getNextSize function to use nullish coalescing for safer fallbacks
export function getNextSize<T extends string>(current: T, options: T[]): T {
    // If options array is empty, return the current value
    if (options.length === 0) {
        return current
    }

    // Find the current index
    const currentIndex = options.indexOf(current)

    // If current value is not found in options, return the first option or current as fallback
    if (currentIndex === -1) {
        // Use nullish coalescing to provide a fallback
        return options[0] ?? current
    }

    // Calculate the next index with wrap-around
    const nextIndex = (currentIndex + 1) % options.length
    // Use nullish coalescing here too for extra safety
    return options[nextIndex] ?? current
}

// Update the getWidgetDimensions function to ensure it handles all width types correctly
export function getWidgetDimensions(widget: WidgetItem): {
    height: number
    width: string | number
    gridSpan: number
} {

    // Special case for cover-profile widget
    if (widget.id === "cover-profile") {
        // For cover-profile, we'll use a larger default height
        const heightKey = (widget.settings?.height as WidgetHeight) || "2XL"
        const height = HEIGHT_MAP[heightKey] ?? HEIGHT_MAP["2XL"]

        // Always use full width for cover-profile
        const widthKey = "4XL" as WidgetWidth
        const gridSpan = getGridSpan(widthKey)

        return {
            height,
            width: "100%",
            gridSpan: gridSpan,
        }
    }

    // Get height from settings or default to large
    const heightKey = (widget.settings?.height as WidgetHeight) || "L"
    const height = HEIGHT_MAP[heightKey] || HEIGHT_MAP.L

    // Get width from settings or default to full width
    const widthKey = (widget.settings?.width as WidgetWidth) || "L"

    // For grouped widgets, use customWidth if available
    if (widget.groupId && widget.customWidth) {
        return {
            height,
            width: `${widget.customWidth}%`,
            gridSpan: 0, // Not used for grouped widgets
        }
    }

    // Calculate grid span based on width
    const gridSpan = getGridSpan(widthKey)

    // For regular widgets, use the width map
    return {
        height,
        width: "100%", // Full width of its grid cell
        gridSpan: gridSpan,
    }
}

// Update the getGridSpan function to handle all width types
export function getGridSpan(width: WidgetWidth): number {
    switch (width) {
        case "SS":
            return 2 // 1/6 of 12-column grid
        case "S":
            return 3 // 1/4 of 12-column grid
        case "M":
            return 4 // 1/3 of 12-column grid
        case "L":
            return 6 // 1/2 of 12-column grid
        case "XL":
            return 8 // 2/3 of 12-column grid
        case "2XL":
            return 9 // 3/4 of 12-column grid
        case "3XL":
            return 10 // 5/6 of 12-column grid
        case "4XL":
            return 12 // Full width in 12-column grid
        default:
            return 6 // Default to half width (L)
    }
}

// Update the createDefaultWidgetSettings function to use the new size types
export function createDefaultWidgetSettings(widgetId: string): WidgetSettings {
    // Default settings for all widgets - set to full width and large height
    const defaultSettings: WidgetSettings = {
        height: "L" as WidgetHeight, // Changed from "M" to "L" for larger default height
        width: "L" as WidgetWidth, // Changed from "M" to "L" for full width
    }

    // Add widget-specific default settings
    if (widgetId === "cover-profile") {
        return {
            ...defaultSettings,
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
        }
    }

    return defaultSettings
}

// Check if a widget can be resized (some widgets might have fixed sizes)
export function canResizeWidget(widgetId: string): boolean {
    const nonResizableWidgets: string[] = []
    return !nonResizableWidgets.includes(widgetId)
}

// Calculate optimal widget arrangement in a grid
export function optimizeWidgetLayout(widgets: WidgetItem[]): WidgetItem[] {
    // Sort widgets by order
    const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order)

    // Separate pinned widgets (they always go at the top)
    const pinnedWidgets = sortedWidgets.filter((w) => w.pinned)
    const unpinnedWidgets = sortedWidgets.filter((w) => !w.pinned)

    // Process unpinned widgets to optimize layout
    let currentRow: WidgetItem[] = []
    const rows: WidgetItem[][] = []

    // Add pinned widgets as their own rows
    pinnedWidgets.forEach((widget) => {
        rows.push([widget])
    })

    let currentRowWidth = 0
    const maxRowWidth = 12 // 12-column grid

    unpinnedWidgets.forEach((widget) => {
        // Skip widgets that are part of a group (we'll handle them separately)
        if (widget.groupId) {
            return
        }

        // Get the width of this widget in grid columns
        const widthKey = (widget.settings?.width as WidgetWidth) || "M"
        const widgetSpan = getGridSpan(widthKey)

        // If this widget would exceed row width, start a new row
        if (currentRowWidth + widgetSpan > maxRowWidth && currentRow.length > 0) {
            rows.push([...currentRow])
            currentRow = []
            currentRowWidth = 0
        }

        // Add widget to current row
        currentRow.push(widget)
        currentRowWidth += widgetSpan
    })

    // Add the last row if it has widgets
    if (currentRow.length > 0) {
        rows.push(currentRow)
    }

    // Flatten the rows back into a single array
    return rows.flat()
}

// Generate a unique group ID
export function generateGroupId(): string {
    return `group-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}
