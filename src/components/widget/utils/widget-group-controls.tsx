"use client"

import { useState } from "react"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Slider } from "~/components/shadcn/ui/slider"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/shadcn/ui/popover"
import { Unlink, ChevronDown, Divide } from "lucide-react"

interface WidgetGroupControlsProps {
    groupId: string
    widgetCount: number
    onUngroup: (groupId: string) => void
    onSetProportions: (groupId: string, proportions: number[]) => void
    currentProportions: number[]
}

export default function WidgetGroupControls({
    groupId,
    widgetCount,
    onUngroup,
    onSetProportions,
    currentProportions,
}: WidgetGroupControlsProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [proportionInput, setProportionInput] = useState(currentProportions.map((p) => Math.round(p * 100)).join(","))
    const [sliderValues, setSliderValues] = useState<number[]>(currentProportions.map((p) => p * 100))

    // Handle applying proportions from text input
    const handleApplyProportions = () => {
        try {
            // Parse the input string into numbers
            const values = proportionInput
                .split(",")
                .map((v) => Number.parseFloat(v.trim()))
                .filter((v) => !isNaN(v))

            // Validate we have the right number of values
            if (values.length !== widgetCount) {
                throw new Error(`Please enter ${widgetCount} values separated by commas`)
            }

            // Validate that values sum to 100
            const sum = values.reduce((a, b) => a + b, 0)
            if (Math.abs(sum - 100) > 0.1) {
                throw new Error("Values must sum to 100")
            }

            // Convert percentages to proportions (0-1)
            const proportions = values.map((v) => v / 100)
            onSetProportions(groupId, proportions)
            setIsOpen(false)
        } catch (error) {
            console.error("Error applying proportions:", error)
            // You could show an error message here
        }
    }

    // Handle slider changes
    const handleSliderChange = (index: number, value: number) => {
        // Update the slider value for this widget
        const newValues = [...sliderValues]
        newValues[index] = value

        // Calculate the remaining percentage
        const usedPercentage = newValues[index]
        const remainingPercentage = 100 - usedPercentage

        // Distribute the remaining percentage among other widgets proportionally
        const otherWidgets = widgetCount - 1
        if (otherWidgets > 0) {
            const otherValues = newValues.filter((_, i) => i !== index)
            const otherSum = otherValues.reduce((a, b) => a + b, 0)

            for (let i = 0; i < newValues.length; i++) {
                if (i !== index) {
                    if (otherSum === 0) {
                        // If other sum is 0, distribute evenly
                        newValues[i] = remainingPercentage / otherWidgets
                    } else {
                        // Otherwise, distribute proportionally
                        newValues[i] = ((newValues[i] ?? 0) / otherSum) * remainingPercentage
                    }
                }
            }
        }

        // Update state
        setSliderValues(newValues)
        setProportionInput(newValues.map((v) => Math.round(v)).join(","))
    }

    // Apply slider values
    const applySliderValues = () => {
        const proportions = sliderValues.map((v) => v / 100)
        onSetProportions(groupId, proportions)
        setIsOpen(false)
    }

    // Reset to equal proportions
    const resetToEqual = () => {
        const equalValue = 100 / widgetCount
        const newValues = Array(widgetCount).fill(equalValue)
        setSliderValues(newValues)
        setProportionInput(newValues.map((v:
            number
        ) => Math.round(v)).join(","))
    }

    return (
        <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => onUngroup(groupId)}>
                <Unlink className="h-3.5 w-3.5 mr-1" />
                <span className="text-xs">Ungroup</span>
            </Button>

            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7 px-2">
                        <Divide className="h-3.5 w-3.5 mr-1" />
                        <span className="text-xs">Proportions</span>
                        <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                    <div className="space-y-4">
                        <h4 className="font-medium text-sm">Widget Proportions</h4>

                        <div className="space-y-4">
                            {sliderValues.map((value, index) => (
                                <div key={index} className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span>Widget {index + 1}</span>
                                        <span>{Math.round(value)}%</span>
                                    </div>
                                    <Slider
                                        value={[value]}
                                        min={10}
                                        max={90}
                                        step={1}
                                        onValueChange={(values) => handleSliderChange(index, values[0] ?? 0)}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="proportions-input" className="text-xs">
                                Manual Input (comma-separated percentages)
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="proportions-input"
                                    value={proportionInput}
                                    onChange={(e) => setProportionInput(e.target.value)}
                                    placeholder="e.g., 50,50 or 33,33,34"
                                    className="text-xs"
                                />
                                <Button size="sm" variant="outline" onClick={handleApplyProportions} className="whitespace-nowrap">
                                    Apply
                                </Button>
                            </div>
                        </div>

                        <div className="flex justify-between">
                            <Button size="sm" variant="outline" onClick={resetToEqual}>
                                Equal Split
                            </Button>
                            <Button size="sm" onClick={applySliderValues}>
                                Save Proportions
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
