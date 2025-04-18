"use client"

import { useEffect, useRef } from "react"
import { Button } from "~/components/shadcn/ui/button"

interface ChartWidgetProps {
    editMode?: boolean
}

export default function ChartWidget({ editMode }: ChartWidgetProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        // Set canvas size
        const setCanvasSize = () => {
            const parent = canvas.parentElement
            if (parent) {
                canvas.width = parent.clientWidth
                canvas.height = parent.clientHeight
            }
        }

        setCanvasSize()
        window.addEventListener("resize", setCanvasSize)

        // Draw chart
        const drawLineChart = (ctx: CanvasRenderingContext2D) => {
            const width = ctx.canvas.width
            const height = ctx.canvas.height
            const padding = 40

            // Data for the chart
            const data = [10, 25, 15, 30, 20, 35, 45, 40, 50, 60, 55, 70]

            // Clear canvas
            ctx.clearRect(0, 0, width, height)

            // Draw axes
            ctx.beginPath()
            ctx.strokeStyle = "#e2e8f0"
            ctx.lineWidth = 1

            // X axis
            ctx.moveTo(padding, height - padding)
            ctx.lineTo(width - padding, height - padding)

            // Y axis
            ctx.moveTo(padding, padding)
            ctx.lineTo(padding, height - padding)
            ctx.stroke()

            // Draw grid lines
            const gridCount = 5
            ctx.beginPath()
            ctx.strokeStyle = "#e2e8f0"
            ctx.lineWidth = 0.5

            for (let i = 1; i <= gridCount; i++) {
                const y = padding + ((height - padding * 2) / gridCount) * i
                ctx.moveTo(padding, height - y)
                ctx.lineTo(width - padding, height - y)
            }
            ctx.stroke()

            // Plot data points
            const plotWidth = width - padding * 2
            const plotHeight = height - padding * 2
            const pointWidth = plotWidth / (data.length - 1)

            // Draw line
            ctx.beginPath()
            ctx.strokeStyle = "#3b82f6"
            ctx.lineWidth = 2

            // Start at first data point
            const maxValue = Math.max(...data)
            const scaleFactor = plotHeight / maxValue

            if (data[0] !== undefined) {
                ctx.moveTo(padding, height - padding - data[0] * scaleFactor)
            }

            // Draw line to each subsequent point
            for (let i = 1; i < data.length; i++) {
                if (data[i] !== undefined) {
                    ctx.lineTo(padding + i * pointWidth, height - padding - (data[i] ?? 0) * scaleFactor)
                }
            }
            ctx.stroke()

            // Draw points
            for (let i = 0; i < data.length; i++) {
                const x = padding + i * pointWidth
                const y = height - padding - (data[i] ?? 0) * scaleFactor

                ctx.beginPath()
                ctx.arc(x, y, 4, 0, Math.PI * 2)
                ctx.fillStyle = "#3b82f6"
                ctx.fill()
                ctx.strokeStyle = "#fff"
                ctx.lineWidth = 2
                ctx.stroke()
            }

            // Draw month labels on x-axis
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            ctx.fillStyle = "#94a3b8"
            ctx.font = "10px sans-serif"
            ctx.textAlign = "center"

            for (let i = 0; i < months.length; i++) {
                const x = padding + i * pointWidth
                ctx.fillText(months[i] ?? "", x, height - padding + 15)
            }

            // Draw Y-axis labels
            ctx.textAlign = "right"
            ctx.textBaseline = "middle"

            for (let i = 0; i <= gridCount; i++) {
                const y = height - padding - (plotHeight / gridCount) * i
                const value = Math.round((maxValue / gridCount) * i)
                ctx.fillText(value.toString(), padding - 10, y)
            }
        }

        drawLineChart(ctx)

        return () => {
            window.removeEventListener("resize", setCanvasSize)
        }
    }, [])

    return (
        <div className="h-full p-2 flex flex-col">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <h3 className="text-sm font-medium">Monthly Performance</h3>
                    <p className="text-xs text-muted-foreground">Revenue and engagement over time</p>
                </div>
                <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                        Revenue
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                        Followers
                    </Button>
                </div>
            </div>
            <div className="flex-1 relative">
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
            </div>
        </div>
    )
}
