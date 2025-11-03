"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import * as THREE from "three"

import { DeviceOrientationControls, LocationBased, WebcamRenderer } from "~/lib/augmented-reality/locationbased-ar"
import { loadMedia } from "~/lib/augmented-reality/media-loader"

import {
    ArrowLeft,
    Box,
    Calendar,
    FileText,
    AlertCircle,
    Navigation,
    MapPin,
    Plus,
    Minus,
    Camera,
    Smartphone,
    RefreshCw,
} from "lucide-react"
import { BASE_URL } from "~/lib/common"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { Progress } from "~/components/shadcn/ui/progress"
import { format } from "date-fns"
import { ImageViewer } from "~/components/player/ar/image-viewer"
import { VideoPlayer } from "~/components/player/ar/video-player"
import { AudioPlayer } from "~/components/player/ar/audio-player"
import { MediaSelector } from "~/components/player/ar/media-selector"
import { MediaType } from "@prisma/client"

interface QRItemData {
    id: string
    title: string
    descriptions: Array<{
        id: string
        title: string
        content: string
        order: number
    }>
    mediaType: MediaType
    mediaUrl: string
    externalLink: string | null
    startDate: string
    endDate: string
    isActive: boolean
    creator: {
        id: string
        name: string | null
        image: string | null
    }
}

const QRARPage = () => {
    const router = useRouter()
    const searchParams = useSearchParams()
    const id = searchParams.get("id")

    // State management
    const [qrItem, setQrItem] = useState<QRItemData | null>(null)
    const [fetchError, setFetchError] = useState<string | null>(null)
    const [isInitializing, setIsInitializing] = useState(true)
    const [initializationError, setInitializationError] = useState<string | null>(null)
    const [modelLoaded, setModelLoaded] = useState(false)
    const [showInfo, setShowInfo] = useState(false)
    const [modelError, setModelError] = useState<string | null>(null)
    const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null)
    const [distanceToModel, setDistanceToModel] = useState<number>(0)
    const [modelPosition, setModelPosition] = useState<{ lat: number; lng: number } | null>(null)
    const [debugMode, setDebugMode] = useState(false)
    const [loadingProgress, setLoadingProgress] = useState<number>(0)
    const [isLoadingModel, setIsLoadingModel] = useState(false)
    const [modelScale, setModelScale] = useState<number>(1)
    const [permissionStep, setPermissionStep] = useState<
        "requesting" | "camera" | "orientation" | "location" | "complete" | "error"
    >("requesting")
    const [retryCount, setRetryCount] = useState(0)
    const [currentMediaType, setCurrentMediaType] = useState<MediaType>("THREE_D")
    const [currentMedia, setCurrentMedia] = useState<{
        type: MediaType
        url: string
        title?: string
    } | null>(null)

    // Three.js refs
    const rendererRef = useRef<THREE.WebGLRenderer>()
    const sceneRef = useRef<THREE.Scene | null>(null)
    const cameraRef = useRef<THREE.Camera | null>(null)
    const modelRef = useRef<THREE.Group | null>(null)
    const clockRef = useRef<THREE.Clock>(new THREE.Clock())
    const mixerRef = useRef<THREE.AnimationMixer | null>(null)
    const locarRef = useRef<LocationBased | null>(null)
    const originalScaleRef = useRef<number>(1)
    const deviceOrientationControlsRef = useRef<DeviceOrientationControls | null>(null)
    const webcamRendererRef = useRef<WebcamRenderer | null>(null)
    const initializationRef = useRef<boolean>(false)

    const modelOffsetDistance = 5

    const handleMediaSelect = (type: MediaType) => {
        setCurrentMediaType(type)
        if (type === "THREE_D") {
            setCurrentMedia(null)
        } else if (qrItem?.mediaType === type) {
            setCurrentMedia({
                type: qrItem.mediaType as "image" | "video" | "audio",
                url: qrItem.mediaUrl,
                title: qrItem.title,
            })
        }
    }

    // Request device orientation permission
    const requestDeviceOrientationPermission = async () => {
        return new Promise<boolean>((resolve) => {
            const permissionButton = document.createElement("button")
            permissionButton.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 10000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="background: white; padding: 24px; border-radius: 12px; text-align: center; max-width: 320px; margin: 16px;">
            <div style="font-size: 48px; margin-bottom: 16px;">📱</div>
            <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 8px; color: #333;">Enable Device Motion</h2>
            <p style="color: #666; margin-bottom: 20px; font-size: 14px;">AR requires access to your device's motion sensors to track orientation.</p>
            <div style="background: #007AFF; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; width: 100%;">Allow Motion Access</div>
          </div>
        </div>
      `
            permissionButton.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; border: none; background: transparent; z-index: 10000; cursor: pointer;`
            document.body.appendChild(permissionButton)

            permissionButton.onclick = async () => {
                try {
                    const tempCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
                    const tempControls = new DeviceOrientationControls(tempCamera)

                    if (tempControls.requiresPermission()) {
                        const granted = await tempControls.requestPermissions()
                        tempControls.dispose()
                        document.body.removeChild(permissionButton)
                        resolve(granted)
                    } else {
                        tempControls.dispose()
                        document.body.removeChild(permissionButton)
                        resolve(true)
                    }
                } catch (error) {
                    document.body.removeChild(permissionButton)
                    resolve(false)
                }
            }
        })
    }

    // Request all permissions
    const requestPermissions = async () => {
        try {
            setInitializationError(null)
            setPermissionStep("requesting")

            setPermissionStep("camera")
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
            })
            stream.getTracks().forEach((track) => track.stop())

            setPermissionStep("orientation")
            const orientationGranted = await requestDeviceOrientationPermission()
            if (!orientationGranted) throw new Error("Device orientation permission denied")

            setPermissionStep("location")
            try {
                await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 60000,
                    })
                })
            } catch (locationError) {
                console.warn("Location permission denied, but continuing...")
            }

            setPermissionStep("complete")
            await new Promise((resolve) => setTimeout(resolve, 500))
            return true
        } catch (error) {
            setInitializationError(`Permission denied: ${error instanceof Error ? error.message : "Unknown error"}`)
            setPermissionStep("error")
            return false
        }
    }

    // Fetch QR item data
    useEffect(() => {
        const fetchQRItem = async () => {
            if (!id) return
            try {
                const response = await fetch(new URL("api/game/qr/get-qr-by-id", BASE_URL).toString(), {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ qrId: id }),
                })
                if (!response.ok) throw new Error("Failed to fetch QR item")
                const data = (await response.json()) as QRItemData
                setQrItem(data)
            } catch (err) {
                setFetchError("An unexpected error occurred while fetching QR item.")
            }
        }
        fetchQRItem()
    }, [id])

    const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371e3
        const φ1 = (lat1 * Math.PI) / 180
        const φ2 = (lat2 * Math.PI) / 180
        const Δφ = ((lat2 - lat1) * Math.PI) / 180
        const Δλ = ((lng2 - lng1) * Math.PI) / 180
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return R * c
    }

    const calculateOffsetPosition = (lat: number, lng: number, bearing: number, distance: number) => {
        const R = 6371e3
        const δ = distance / R
        const θ = (bearing * Math.PI) / 180
        const φ1 = (lat * Math.PI) / 180
        const λ1 = (lng * Math.PI) / 180
        const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ))
        const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2))
        return { lat: (φ2 * 180) / Math.PI, lng: (λ2 * 180) / Math.PI }
    }

    const initializeCamera = () => {
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
        camera.position.set(0, 1.6, 0)
        return camera
    }

    const initializeRenderer = () => {
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" })
        renderer.setSize(window.innerWidth, window.innerHeight)
        renderer.setClearColor(0x000000, 0)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        return renderer
    }

    const setupLighting = (scene: THREE.Scene) => {
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2)
        scene.add(ambientLight)
        const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.5)
        directionalLight1.position.set(10, 10, 10)
        directionalLight1.castShadow = true
        directionalLight1.shadow.mapSize.width = 2048
        directionalLight1.shadow.mapSize.height = 2048
        scene.add(directionalLight1)
    }

    const increaseModelSize = () => {
        if (modelRef.current) {
            const newScale = Math.min(modelScale * 1.2, 5)
            setModelScale(newScale)
            const finalScale = originalScaleRef.current * newScale
            modelRef.current.scale.setScalar(finalScale)
        }
    }

    const decreaseModelSize = () => {
        if (modelRef.current) {
            const newScale = Math.max(modelScale * 0.8, 0.1)
            setModelScale(newScale)
            const finalScale = originalScaleRef.current * newScale
            modelRef.current.scale.setScalar(finalScale)
        }
    }

    const handleRetry = () => {
        setRetryCount((prev) => prev + 1)
        setInitializationError(null)
        setPermissionStep("requesting")
        setIsInitializing(true)
        initializationRef.current = false

        if (deviceOrientationControlsRef.current) {
            deviceOrientationControlsRef.current.dispose()
            deviceOrientationControlsRef.current = null
        }
        if (webcamRendererRef.current) {
            webcamRendererRef.current.dispose()
            webcamRendererRef.current = null
        }
        if (rendererRef.current) {
            rendererRef.current.dispose()
            if (document.body.contains(rendererRef.current.domElement)) {
                document.body.removeChild(rendererRef.current.domElement)
            }
            rendererRef.current = undefined
        }

        sceneRef.current = null
        cameraRef.current = null
        locarRef.current = null

        setTimeout(() => void initializeAR(), 100)
    }

    // Initialize AR
    const initializeAR = async () => {
        if (initializationRef.current) return
        initializationRef.current = true

        let cleanup: (() => void) | undefined

        try {
            const permissionsGranted = await requestPermissions()
            if (!permissionsGranted) {
                initializationRef.current = false
                return
            }

            const camera = initializeCamera()
            cameraRef.current = camera

            const renderer = initializeRenderer()
            document.body.appendChild(renderer.domElement)
            rendererRef.current = renderer

            const scene = new THREE.Scene()
            sceneRef.current = scene

            setupLighting(scene)

            const locar = new LocationBased(scene, camera, { gpsMinDistance: 1, gpsMinAccuracy: 100 })
            locarRef.current = locar

            const cam = new WebcamRenderer(renderer)
            webcamRendererRef.current = cam

            const deviceOrientationControls = new DeviceOrientationControls(camera)
            deviceOrientationControlsRef.current = deviceOrientationControls

            if (deviceOrientationControls.requiresPermission()) {
                const success = await deviceOrientationControls.init()
                if (!success) throw new Error("Failed to initialize device orientation controls")
            }

            const handleResize = () => {
                renderer.setSize(window.innerWidth, window.innerHeight)
                camera.aspect = window.innerWidth / window.innerHeight
                camera.updateProjectionMatrix()
            }

            window.addEventListener("resize", handleResize)
            window.addEventListener("orientationchange", () => setTimeout(handleResize, 100))

            let firstLocation = true

            locar.on("gpsupdate", (pos: GeolocationPosition) => {
                const { latitude, longitude } = pos.coords
                setCurrentPosition({ lat: latitude, lng: longitude })

                if (firstLocation) {
                    const modelPos = calculateOffsetPosition(latitude, longitude, 0, modelOffsetDistance)
                    setModelPosition(modelPos)

                    void loadMedia(qrItem!, locar, modelPos.lat, modelPos.lng, {
                        onProgress: setLoadingProgress,
                        onError: (error) => {
                            setModelError(`Failed to load media: ${error.message}`)
                            setIsLoadingModel(false)
                        },
                        onSuccess: () => {
                            setModelLoaded(true)
                            setIsLoadingModel(false)
                            setLoadingProgress(100)
                        },
                        modelScale,
                        mixerRef,
                        modelRef,
                        originalScaleRef,
                    }).catch((error) => {
                        setModelError(`Failed to load media: ${error instanceof Error ? error.message : "Unknown error"}`)
                    })

                    firstLocation = false
                    setIsInitializing(false)
                }

                if (modelRef.current?.userData?.lat && modelRef.current?.userData?.lng) {
                    const distance = calculateDistance(
                        latitude,
                        longitude,
                        modelRef.current.userData.lat as number,
                        modelRef.current.userData.lng as number,
                    )
                    setDistanceToModel(distance)
                }
            })

            locar.on("gpserror", (error: number) => {
                let errorMessage = "GPS error occurred."
                if (error === 1) errorMessage = "GPS permission denied. Please enable location services."
                if (error === 2) errorMessage = "GPS position unavailable. Please check your connection."
                if (error === 3) errorMessage = "GPS timeout. Please try again."
                setInitializationError(errorMessage)
            })

            const gpsStarted = locar.startGps()
            if (!gpsStarted) {
                setInitializationError("Failed to start GPS. Please check location permissions.")
                return
            }

            renderer.setAnimationLoop(() => {
                const deltaTime = clockRef.current.getDelta()
                cam.update()
                deviceOrientationControls.update()
                if (mixerRef.current) mixerRef.current.update(deltaTime)
                if (modelRef.current) modelRef.current.rotation.y += 0.01
                renderer.render(scene, camera)
            })

            cleanup = () => {
                window.removeEventListener("resize", handleResize)
                if (mixerRef.current) {
                    mixerRef.current.stopAllAction()
                    mixerRef.current = null
                }
                if (locarRef.current) {
                    locarRef.current.stopGps()
                    locarRef.current = null
                }
                if (deviceOrientationControlsRef.current) {
                    deviceOrientationControlsRef.current.dispose()
                    deviceOrientationControlsRef.current = null
                }
                if (webcamRendererRef.current) {
                    webcamRendererRef.current.dispose()
                    webcamRendererRef.current = null
                }
                renderer.dispose()
                if (document.body.contains(renderer.domElement)) {
                    document.body.removeChild(renderer.domElement)
                }
            }
        } catch (error) {
            setInitializationError(`Failed to initialize AR: ${error instanceof Error ? error.message : "Unknown error"}`)
            setIsInitializing(false)
        } finally {
            initializationRef.current = false
        }

        return cleanup
    }

    useEffect(() => {
        if (!qrItem) return
        let cleanup: (() => void) | undefined
        const init = async () => {
            cleanup = await initializeAR()
        }
        init()
        return () => {
            if (cleanup) cleanup()
        }
    }, [qrItem, debugMode, retryCount])

    // Permission screen
    if (isInitializing && permissionStep !== "complete") {
        const getStepMessage = () => {
            const messages: Record<string, string> = {
                requesting: "Preparing to request permissions...",
                camera: "Requesting camera access...",
                orientation: "Requesting device orientation access...",
                location: "Requesting location access...",
            }
            return messages[permissionStep] ?? "Requesting permissions..."
        }

        const getStepIcon = () => {
            switch (permissionStep) {
                case "camera":
                    return <Camera className="w-12 h-12 text-blue-500" />
                case "orientation":
                    return <Smartphone className="w-12 h-12 text-blue-500" />
                case "location":
                    return <MapPin className="w-12 h-12 text-blue-500" />
                default:
                    return <RefreshCw className="w-12 h-12 text-blue-500 animate-spin" />
            }
        }

        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 m-4 max-w-sm text-center">
                    <div className="mb-4">{getStepIcon()}</div>
                    <h2 className="text-xl font-bold mb-2">Requesting Permissions</h2>
                    <p className="text-gray-600 mb-4">{getStepMessage()}</p>
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-sm text-gray-500">Please allow all permissions when prompted</p>
                    <Button variant="outline" onClick={() => router.back()} className="w-full mt-4">
                        Cancel
                    </Button>
                </div>
            </div>
        )
    }

    if (!qrItem && !fetchError) {
        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 m-4 max-w-sm text-center">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <h2 className="text-xl font-bold mb-2">Loading QR Item</h2>
                    <p className="text-gray-600">Fetching QR item data...</p>
                </div>
            </div>
        )
    }

    if (fetchError) {
        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 m-4 max-w-sm text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold mb-2">Error Loading QR Item</h2>
                    <p className="text-gray-600 mb-4">{fetchError}</p>
                    <div className="space-y-2">
                        <Button onClick={() => window.location.reload()} className="w-full">
                            Try Again
                        </Button>
                        <Button variant="outline" onClick={() => router.back()} className="w-full">
                            Go Back
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    if (isInitializing) {
        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 m-4 max-w-sm text-center">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <h2 className="text-xl font-bold mb-2">Initializing AR</h2>
                    <p className="text-gray-600 mb-4">Setting up your augmented reality experience...</p>
                    <div className="text-sm text-gray-500">
                        {modelLoaded ? "Model loaded successfully" : "Waiting for GPS location..."}
                    </div>
                    <Button variant="outline" onClick={() => router.back()} className="w-full mt-4">
                        Cancel
                    </Button>
                </div>
            </div>
        )
    }

    if (initializationError) {
        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 m-4 max-w-sm text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold mb-2">AR Setup Failed</h2>
                    <p className="text-gray-600 mb-4">{initializationError}</p>
                    <div className="space-y-2">
                        <Button onClick={handleRetry} className="w-full">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Try Again {retryCount > 0 && `(${retryCount})`}
                        </Button>
                        <Button variant="outline" onClick={() => router.back()} className="w-full">
                            Go Back
                        </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-4">
                        Make sure you{"'"}re using HTTPS and allow all permissions when prompted.
                    </p>
                </div>
            </div>
        )
    }

    if (modelError) {
        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 m-4 max-w-sm text-center">
                    <Box className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold mb-2">Model Loading Failed</h2>
                    <p className="text-gray-600 mb-4">{modelError}</p>
                    <div className="space-y-2">
                        <Button onClick={() => window.location.reload()} className="w-full">
                            Try Again
                        </Button>
                        <Button variant="outline" onClick={() => router.back()} className="w-full">
                            Go Back
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    const availableMedias = [
        { type: "THREE_D" as MediaType, url: qrItem?.mediaUrl || "", title: "3D" },
        ...(qrItem?.mediaType === "IMAGE" || qrItem?.mediaType === "VIDEO" || qrItem?.mediaType === "MUSIC"
            ? [{ type: qrItem.mediaType as MediaType, url: qrItem.mediaUrl, title: qrItem.title }]
            : []),
    ]

    return (
        <>
            {isLoadingModel && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-60">
                    <div className="bg-white rounded-lg p-6 m-4 max-w-sm w-full text-center">
                        <Box className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">Loading Media</h2>
                        <div className="space-y-3">
                            <Progress value={loadingProgress} className="w-full" />
                            <p className="text-sm text-gray-600">{loadingProgress.toFixed(1)}% complete</p>
                            <p className="text-xs text-gray-500">Please wait while we load your media...</p>
                        </div>
                    </div>
                </div>
            )}

            {currentMedia && currentMedia.type === "IMAGE" && (
                <ImageViewer
                    src={currentMedia.url || "/placeholder.svg"}
                    alt={currentMedia.title || "Image"}
                    onClose={() => {
                        setCurrentMediaType("THREE_D")
                        setCurrentMedia(null)
                    }}
                />
            )}

            {currentMedia && currentMedia.type === "VIDEO" && (
                <VideoPlayer
                    src={currentMedia.url}
                    title={currentMedia.title || "Video"}
                    onClose={() => {
                        setCurrentMediaType("THREE_D")
                        setCurrentMedia(null)
                    }}
                />
            )}

            {currentMedia && currentMedia.type === "MUSIC" && (
                <AudioPlayer
                    src={currentMedia.url}
                    title={currentMedia.title || "Audio"}
                    onClose={() => {
                        setCurrentMediaType("THREE_D")
                        setCurrentMedia(null)
                    }}
                />
            )}

            <Button
                className="absolute left-4 top-4 z-50 bg-black/50 text-white border-none hover:bg-black/70"
                onClick={() => router.back()}
            >
                <ArrowLeft className="h-6 w-6" /> Back
            </Button>

            <Button
                className="absolute top-4 right-4 z-50 bg-black/50 text-white border-none hover:bg-black/70"
                onClick={() => setShowInfo(!showInfo)}
            >
                <FileText className="h-6 w-6" />
            </Button>

            {modelLoaded && (
                <div className="absolute bottom-48 right-4 z-50 space-y-2">
                    <div className="bg-black/70 text-white px-2 py-1 rounded text-xs text-center">
                        Scale: {modelScale.toFixed(1)}x
                    </div>
                    <Button
                        onClick={increaseModelSize}
                        className="bg-green-500/80 hover:bg-green-600/80 text-white border-none w-full"
                        size="sm"
                    >
                        <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                        onClick={decreaseModelSize}
                        className="bg-red-500/80 hover:bg-red-600/80 text-white border-none w-full"
                        size="sm"
                    >
                        <Minus className="w-4 h-4" />
                    </Button>
                </div>
            )}

            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40">
                <div className="w-8 h-8 border-2 border-white rounded-full opacity-70">
                    <div className="w-2 h-2 bg-white rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
                </div>
            </div>

            <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 text-white px-4 py-2 rounded-lg text-center max-w-xs">
                <p className="text-sm font-bold">Look around to find the media!</p>
                <p className="text-xs text-gray-300">Move closer to see it better</p>
                {modelLoaded && <p className="text-xs text-green-300">Media loaded successfully</p>}
            </div>

            {modelLoaded && availableMedias.length > 1 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 px-4 py-3 rounded-lg">
                    <MediaSelector medias={availableMedias} currentType={currentMediaType} onSelect={handleMediaSelect} />
                </div>
            )}

            {showInfo && qrItem && (
                <div className="absolute top-16 left-4 right-4 z-40 max-w-md mx-auto">
                    <Card className="bg-black/90 text-white border-gray-700">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Box className="h-5 w-5" />
                                {qrItem.title}
                                <Badge variant={qrItem.isActive ? "default" : "secondary"}>
                                    {qrItem.isActive ? "Active" : "Inactive"}
                                </Badge>
                            </CardTitle>
                            <CardDescription className="text-gray-300">Created by {qrItem.creator.name ?? "Unknown"}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-2 text-sm">
                                <Navigation className="h-4 w-4 text-blue-400" />
                                <span className="text-blue-400 font-medium">{distanceToModel.toFixed(1)} meters away</span>
                            </div>

                            {modelLoaded && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Box className="h-4 w-4 text-purple-400" />
                                    <span className="text-purple-400 font-medium">Scale: {modelScale.toFixed(1)}x</span>
                                </div>
                            )}

                            {qrItem.descriptions && qrItem.descriptions.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-gray-400" />
                                        <span className="font-medium text-sm">Descriptions</span>
                                    </div>
                                    <div className="space-y-2 max-h-32 overflow-y-auto">
                                        {qrItem.descriptions
                                            .sort((a, b) => a.order - b.order)
                                            .map((desc) => (
                                                <div key={desc.id} className="border border-gray-700 rounded p-2 bg-gray-800/50">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge variant="outline" className="text-xs">
                                                            {desc.order}
                                                        </Badge>
                                                        <span className="font-medium text-xs">{desc.title}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-300">
                                                        {desc.content.length > 100 ? `${desc.content.slice(0, 100)}...` : desc.content}
                                                    </p>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <Calendar className="h-3 w-3" />
                                <span>
                                    {format(new Date(qrItem.startDate), "MMM dd, yyyy")} -{" "}
                                    {format(new Date(qrItem.endDate), "MMM dd, yyyy")}
                                </span>
                            </div>

                            {qrItem.externalLink && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => window.open(qrItem.externalLink!, "_blank")}
                                    className="w-full"
                                >
                                    View External Link
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </>
    )
}

export default QRARPage
