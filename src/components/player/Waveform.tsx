"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback } from "react"

interface WaveformProps {
  audioUrl?: string
  duration: number
  currentTime: number
  height?: number
  color?: string
  backgroundColor?: string
  progressColor?: string
  onSeek?: (time: number) => void
  isPlaying?: boolean
  startTime?: number
  endTime?: number
  className?: string
}

export function Waveform({
  audioUrl,
  duration,
  currentTime,
  height = 60,
  color = "#8B5CF6",
  backgroundColor = "#E5E7EB",
  progressColor = "#6366F1",
  onSeek,
  isPlaying = false,
  startTime = 0,
  endTime,
  className = "",
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [waveformData, setWaveformData] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Generate realistic waveform data
  const generateWaveformData = useCallback((audioDuration: number) => {
    const samples = Math.min(150, Math.max(50, Math.floor(audioDuration * 8))) // Responsive sample count
    const data: number[] = []

    for (let i = 0; i < samples; i++) {
      const time = (i / samples) * audioDuration

      let amplitude = 0.2 + Math.random() * 0.8

      // Create realistic patterns
      if (time < audioDuration * 0.1) {
        amplitude *= time / (audioDuration * 0.1)
      } else if (time > audioDuration * 0.9) {
        amplitude *= (audioDuration - time) / (audioDuration * 0.1)
      }

      // Add musical patterns
      if (Math.sin(time * 3) > 0.6) amplitude *= 1.4
      if (Math.sin(time * 0.7) < -0.4) amplitude *= 0.6

      data.push(Math.min(amplitude, 1))
    }

    return data
  }, [])

  useEffect(() => {
    setIsLoading(true)
    const data = generateWaveformData(duration)
    setWaveformData(data)
    setIsLoading(false)
  }, [duration, generateWaveformData])

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || waveformData.length === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { width, height: canvasHeight } = canvas
    const barWidth = width / waveformData.length
    const centerY = canvasHeight / 2

    ctx.clearRect(0, 0, width, canvasHeight)

    waveformData.forEach((amplitude, index) => {
      const x = index * barWidth
      const barHeight = amplitude * (canvasHeight * 0.9)

      const currentTimeRatio = currentTime / duration
      const barTimeRatio = index / waveformData.length

      const barTime = barTimeRatio * duration
      const effectiveStartTime = startTime ?? 0
      const effectiveEndTime = endTime ?? duration

      let barColor = backgroundColor

      if (barTime >= effectiveStartTime && barTime <= effectiveEndTime) {
        barColor = barTimeRatio <= currentTimeRatio ? progressColor : color
      }

      ctx.fillStyle = barColor
      ctx.fillRect(x, centerY - barHeight / 2, Math.max(barWidth - 0.5, 1), barHeight)
    })

    // Playhead
    if (currentTime > 0) {
      const playheadX = (currentTime / duration) * width
      ctx.strokeStyle = "#EF4444"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX, canvasHeight)
      ctx.stroke()
    }
  }, [waveformData, currentTime, duration, color, backgroundColor, progressColor, startTime, endTime])

  useEffect(() => {
    drawWaveform()
  }, [drawWaveform])

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || !canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const clickRatio = x / canvas.width
    const seekTime = clickRatio * duration

    onSeek(seekTime)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      }
      drawWaveform()
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)
    return () => window.removeEventListener("resize", resizeCanvas)
  }, [drawWaveform])

  if (isLoading) {
    return (
      <div className={`bg-muted animate-pulse rounded ${className}`} style={{ height }}>
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className={`w-full cursor-pointer ${className}`}
      style={{ height }}
      onClick={handleCanvasClick}
      title="Click to seek"
    />
  )
}
