"use client"

import { useState } from "react"
import { Button } from "~/components/shadcn/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/shadcn/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { ChevronDown, Maximize } from "lucide-react"
import { HEIGHT_MAP, WIDTH_MAP, type WidgetHeight, type WidgetWidth } from "~/components/widget/utils/ widget-utils"

interface WidgetSizeSelectorProps {
    currentHeight: WidgetHeight
    currentWidth: WidgetWidth
    onHeightChange: (height: WidgetHeight) => void
    onWidthChange: (width: WidgetWidth) => void
    disabled?: boolean
}

export default function WidgetSizeSelector({
    currentHeight,
    currentWidth,
    onHeightChange,
    onWidthChange,
    disabled = false,
}: WidgetSizeSelectorProps) {
    const [open, setOpen] = useState(false)

    // Available height and width options
    const heightOptions: WidgetHeight[] = ["SS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"]
    const widthOptions: WidgetWidth[] = ["SS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"]

    // Get display names for current sizes
    const getHeightDisplayName = (height: WidgetHeight): string => {
        switch (height) {
            case "SS":
                return "Extra Small"
            case "S":
                return "Small"
            case "M":
                return "Medium"
            case "L":
                return "Large"
            case "XL":
                return "Extra Large"
            case "2XL":
                return "2X Large"
            case "3XL":
                return "3X Large"
            case "4XL":
                return "4X Large"
        }
    }

    const getWidthDisplayName = (width: WidgetWidth): string => {
        switch (width) {
            case "SS":
                return "Extra Small (1/6)"
            case "S":
                return "Small (1/4)"
            case "M":
                return "Medium (1/3)"
            case "L":
                return "Large (1/2)"
            case "XL":
                return "Extra Large (2/3)"
            case "2XL":
                return "2X Large (3/4)"
            case "3XL":
                return "3X Large (5/6)"
            case "4XL":
                return "Full Width"
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" disabled={disabled}>
                    <Maximize className="h-3.5 w-3.5" />
                    <span>Size</span>
                    <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
                <Tabs defaultValue="height" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="height">Height</TabsTrigger>
                        <TabsTrigger value="width">Width</TabsTrigger>
                    </TabsList>

                    <TabsContent value="height" className="p-4 space-y-4">
                        <div className="text-sm font-medium">
                            Current: {getHeightDisplayName(currentHeight)} ({HEIGHT_MAP[currentHeight]}px)
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {heightOptions.map((height) => (
                                <Button
                                    key={height}
                                    variant={currentHeight === height ? "default" : "outline"}
                                    className="flex flex-col items-center justify-center p-2 h-auto"
                                    onClick={() => {
                                        onHeightChange(height)
                                        setOpen(false)
                                    }}
                                >
                                    <div className="flex items-end justify-center w-full">
                                        <div
                                            className="bg-primary/20 border border-primary/30 rounded-sm w-4"
                                            style={{
                                                height: `${Math.max(12, HEIGHT_MAP[height] / 20)}px`,
                                            }}
                                        />
                                    </div>
                                    <span className="text-xs mt-1">{height}</span>
                                </Button>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="width" className="p-4 space-y-4">
                        <div className="text-sm font-medium">Current: {getWidthDisplayName(currentWidth)}</div>
                        <div className="grid grid-cols-4 gap-2">
                            {widthOptions.map((width) => (
                                <Button
                                    key={width}
                                    variant={currentWidth === width ? "default" : "outline"}
                                    className="flex flex-col items-center justify-center p-2 h-auto"
                                    onClick={() => {
                                        onWidthChange(width)
                                        setOpen(false)
                                    }}
                                >
                                    <div className="flex items-center justify-center w-full">
                                        <div
                                            className="bg-primary/20 border border-primary/30 rounded-sm h-4"
                                            style={{
                                                width: `${Math.max(20, WIDTH_MAP[width] / 4)}px`,
                                            }}
                                        />
                                    </div>
                                    <span className="text-xs mt-1">{width}</span>
                                </Button>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            </PopoverContent>
        </Popover>
    )
}
