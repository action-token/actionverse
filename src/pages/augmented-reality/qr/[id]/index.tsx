"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/router"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"

import { DeviceOrientationControls, LocationBased, WebcamRenderer } from "~/lib/augmented-reality/locationbased-ar"

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

interface QRItemData {
    id: string
    title: string
    descriptions: Array<{
        id: string
        title: string
        content: string
        order: number
    }>
    modelUrl: string
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
    const { id } = router.query

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

    // Three.js refs
    const rendererRef = useRef<THREE.WebGLRenderer>()
    const sceneRef = useRef<THREE.Scene | null>(null)
    const cameraRef = useRef<THREE.Camera | null>(null)
    const modelRef = useRef<THREE.Group | null>(null)
    const clockRef = useRef<THREE.Clock>(new THREE.Clock())
    const mixerRef = useRef<THREE.AnimationMixer | null>(null)
    const locarRef = useRef<LocationBased | null>(null)
    const debugSphereRef = useRef<THREE.Mesh | null>(null)
    const originalScaleRef = useRef<number>(1)
    const deviceOrientationControlsRef = useRef<DeviceOrientationControls | null>(null)
    const webcamRendererRef = useRef<WebcamRenderer | null>(null)
    const initializationRef = useRef<boolean>(false)

    // Model will be positioned closer for better visibility
    const modelOffsetDistance = 5 // Reduced from 10 to 5 meters

    // Request device orientation permission with user interaction
    const requestDeviceOrientationPermission = async () => {
        return new Promise<boolean>((resolve) => {
            // Create a user interaction button for iOS permission request
            const permissionButton = document.createElement("button")
            permissionButton.innerHTML = `
                <div style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                ">
                    <div style="
                        background: white;
                        padding: 24px;
                        border-radius: 12px;
                        text-align: center;
                        max-width: 320px;
                        margin: 16px;
                    ">
                        <div style="font-size: 48px; margin-bottom: 16px;">📱</div>
                        <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 8px; color: #333;">
                            Enable Device Motion
                        </h2>
                        <p style="color: #666; margin-bottom: 20px; font-size: 14px;">
                            AR requires access to your device's motion sensors to track orientation.
                        </p>
                        <div style="
                            background: #007AFF;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                            width: 100%;
                        ">
                            Allow Motion Access
                        </div>
                    </div>
                </div>
            `

            permissionButton.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                border: none;
                background: transparent;
                z-index: 10000;
                cursor: pointer;
            `

            document.body.appendChild(permissionButton)

            permissionButton.onclick = async () => {
                try {
                    console.log("User clicked permission button, requesting device orientation...")

                    // Create temporary camera and controls for permission request
                    const tempCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
                    const tempControls = new DeviceOrientationControls(tempCamera)

                    if (tempControls.requiresPermission()) {
                        const granted = await tempControls.requestPermissions()
                        tempControls.dispose()

                        document.body.removeChild(permissionButton)

                        if (granted) {
                            console.log("Device orientation permission granted!")
                            resolve(true)
                        } else {
                            console.error("Device orientation permission denied!")
                            resolve(false)
                        }
                    } else {
                        // No permission required
                        tempControls.dispose()
                        document.body.removeChild(permissionButton)
                        console.log("Device orientation permission not required")
                        resolve(true)
                    }
                } catch (error) {
                    console.error("Error requesting device orientation permission:", error)
                    document.body.removeChild(permissionButton)
                    resolve(false)
                }
            }
        })
    }

    // Request all permissions step by step
    const requestPermissions = async () => {
        try {
            setInitializationError(null)
            setPermissionStep("requesting")

            console.log("Starting permission request process...")

            // Step 1: Request camera permission
            setPermissionStep("camera")
            console.log("Requesting camera permission...")

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
            })

            // Stop the stream immediately as we just needed permission
            stream.getTracks().forEach((track) => track.stop())
            console.log("Camera permission granted")

            // Step 2: Request device orientation permission with user interaction
            setPermissionStep("orientation")
            console.log("Requesting device orientation permission...")

            const orientationGranted = await requestDeviceOrientationPermission()

            if (!orientationGranted) {
                throw new Error("Device orientation permission denied")
            }

            console.log("Device orientation permission granted")

            // Step 3: Request location permission (optional)
            setPermissionStep("location")
            console.log("Requesting location permission...")

            try {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 60000,
                    })
                })
                console.log("Location permission granted")
            } catch (locationError) {
                console.warn("Location permission denied, but continuing...", locationError)
            }

            setPermissionStep("complete")
            console.log("All permissions granted successfully")

            // Small delay to show completion
            await new Promise((resolve) => setTimeout(resolve, 500))

            return true
        } catch (error) {
            console.error("Permission request failed:", error)
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
                setFetchError(null)
                const response = await fetch(new URL("api/game/qr/get-qr-by-id", BASE_URL).toString(), {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ qrId: id }),
                })
                if (!response.ok) {
                    throw new Error("Failed to fetch QR item")
                }
                const data = (await response.json()) as QRItemData
                console.log("QR Item Data:", data)
                setQrItem(data)
            } catch (err) {
                console.error("Error fetching QR item:", err)
                setFetchError("An unexpected error occurred while fetching QR item.")
            }
        }
        fetchQRItem()
    }, [id])

    // Calculate distance between two coordinates
    const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371e3 // Earth's radius in meters
        const φ1 = (lat1 * Math.PI) / 180
        const φ2 = (lat2 * Math.PI) / 180
        const Δφ = ((lat2 - lat1) * Math.PI) / 180
        const Δλ = ((lng2 - lng1) * Math.PI) / 180

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

        return R * c // Distance in meters
    }

    // Calculate position offset in lat/lng
    const calculateOffsetPosition = (lat: number, lng: number, bearing: number, distance: number) => {
        const R = 6371e3 // Earth's radius in meters
        const δ = distance / R // angular distance
        const θ = (bearing * Math.PI) / 180 // bearing in radians

        const φ1 = (lat * Math.PI) / 180
        const λ1 = (lng * Math.PI) / 180

        const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ))
        const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2))

        return {
            lat: (φ2 * 180) / Math.PI,
            lng: (λ2 * 180) / Math.PI,
        }
    }

    // Initialize camera with AR settings
    const initializeCamera = () => {
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
        camera.position.set(0, 1.6, 0)
        camera.rotation.set(0, 0, 0)
        camera.updateMatrixWorld()
        return camera
    }

    // Create optimized renderer for AR
    const initializeRenderer = () => {
        const renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
        })
        renderer.setSize(window.innerWidth, window.innerHeight)
        renderer.setClearColor(0x000000, 0)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.sortObjects = true
        renderer.autoClear = true
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        return renderer
    }

    // Setup enhanced lighting for better visibility
    const setupLighting = (scene: THREE.Scene) => {
        // Bright ambient light for overall illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2)
        scene.add(ambientLight)

        // Multiple directional lights from different angles
        const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.5)
        directionalLight1.position.set(10, 10, 10)
        directionalLight1.castShadow = true
        directionalLight1.shadow.mapSize.width = 2048
        directionalLight1.shadow.mapSize.height = 2048
        scene.add(directionalLight1)

        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1.0)
        directionalLight2.position.set(-10, 10, -10)
        scene.add(directionalLight2)

        const directionalLight3 = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight3.position.set(0, 10, -10)
        scene.add(directionalLight3)

        // Point lights for additional illumination
        const pointLight1 = new THREE.PointLight(0xffffff, 1.5, 50)
        pointLight1.position.set(0, 5, 0)
        scene.add(pointLight1)

        const pointLight2 = new THREE.PointLight(0xffffff, 1.0, 30)
        pointLight2.position.set(5, 3, 5)
        scene.add(pointLight2)
    }

    // Create debug sphere to mark model position
    const createDebugSphere = (scene: THREE.Scene, locar: LocationBased, lat: number, lng: number) => {
        const geometry = new THREE.SphereGeometry(0.5, 16, 16)
        const material = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.8,
            wireframe: true,
        })
        const sphere = new THREE.Mesh(geometry, material)

        // Position the debug sphere at the same location as the model
        locar.add(sphere, lng, lat, 2) // Slightly higher than model
        debugSphereRef.current = sphere

        console.log(`Debug sphere positioned at: ${lat}, ${lng}`)
    }

    // Scale model functions
    const increaseModelSize = () => {
        if (modelRef.current) {
            const newScale = Math.min(modelScale * 1.2, 5) // Max scale of 5x
            setModelScale(newScale)
            const finalScale = originalScaleRef.current * newScale
            modelRef.current.scale.setScalar(finalScale)
            console.log(`Model scale increased to: ${newScale.toFixed(2)}x (final: ${finalScale.toFixed(2)})`)
        }
    }

    const decreaseModelSize = () => {
        if (modelRef.current) {
            const newScale = Math.max(modelScale * 0.8, 0.1) // Min scale of 0.1x
            setModelScale(newScale)
            const finalScale = originalScaleRef.current * newScale
            modelRef.current.scale.setScalar(finalScale)
            console.log(`Model scale decreased to: ${newScale.toFixed(2)}x (final: ${finalScale.toFixed(2)})`)
        }
    }

    // Load 3D model and position it in world coordinates
    const loadModel = async (modelUrl: string, locar: LocationBased, modelLat: number, modelLng: number) => {
        try {
            setModelError(null)
            setIsLoadingModel(true)
            setLoadingProgress(0)
            console.log(`Loading model from: ${modelUrl}`)

            const loader = new GLTFLoader()

            const gltf = await new Promise<{
                scene: THREE.Group
                animations: THREE.AnimationClip[]
            }>((resolve, reject) => {
                loader.load(
                    modelUrl,
                    resolve,
                    (progress) => {
                        const percent = (progress.loaded / progress.total) * 100
                        setLoadingProgress(percent)
                        console.log(`Loading progress: ${percent.toFixed(1)}%`)
                    },
                    reject,
                )
            })

            const model = gltf.scene
            modelRef.current = model

            console.log("Model loaded successfully:", model)
            console.log("Model children count:", model.children.length)

            // Setup animations if they exist
            if (gltf.animations && gltf.animations.length > 0) {
                console.log(`Found ${gltf.animations.length} animations`)
                mixerRef.current = new THREE.AnimationMixer(model)
                gltf.animations.forEach((clip: THREE.AnimationClip, index: number) => {
                    console.log(`Animation ${index}: ${clip.name}, duration: ${clip.duration}s`)
                    const action = mixerRef.current!.clipAction(clip)
                    action.play()
                })
            }

            // Configure materials for better visibility
            model.traverse((child: THREE.Object3D) => {
                if (child instanceof THREE.Mesh) {
                    child.castShadow = true
                    child.receiveShadow = true

                    // Ensure materials are visible
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach((mat) => {
                                if (mat instanceof THREE.MeshStandardMaterial) {
                                    mat.needsUpdate = true
                                    // Increase emissive for better visibility
                                    mat.emissive = new THREE.Color(0x222222)
                                    mat.emissiveIntensity = 0.1
                                }
                            })
                        } else if (child.material instanceof THREE.MeshStandardMaterial) {
                            child.material.needsUpdate = true
                            child.material.emissive = new THREE.Color(0x222222)
                            child.material.emissiveIntensity = 0.1
                        }
                    }
                }
            })

            // Calculate bounding box and get model dimensions
            const box = new THREE.Box3().setFromObject(model)
            const size = box.getSize(new THREE.Vector3())
            const center = box.getCenter(new THREE.Vector3())

            console.log("Model bounding box:", {
                size: { x: size.x, y: size.y, z: size.z },
                center: { x: center.x, y: center.y, z: center.z },
            })

            // Center the model
            model.position.sub(center)

            // Scale the model for better visibility
            const maxDimension = Math.max(size.x, size.y, size.z)
            let scale = 1

            if (maxDimension > 5) {
                scale = 3 / maxDimension // Make large models smaller
            } else if (maxDimension < 0.5) {
                scale = 2 / maxDimension // Make tiny models bigger
            } else if (maxDimension < 2) {
                scale = 1.5 // Make small models a bit bigger
            }

            // Store original scale for scaling controls
            originalScaleRef.current = scale
            const finalScale = scale * modelScale
            model.scale.setScalar(finalScale)
            console.log(`Applied scale: ${finalScale} (original: ${scale}, multiplier: ${modelScale})`)

            // Set model elevation (height above ground)
            const modelElevation = 1.6 // Same as camera height

            // Add model to scene using location-based positioning
            locar.add(model, modelLng, modelLat, modelElevation)

            // Store model data for distance calculations
            model.userData = {
                lat: modelLat,
                lng: modelLng,
                title: qrItem?.title ?? "3D Model",
            }

            // Create debug sphere if in debug mode
            if (debugMode) {
                createDebugSphere(sceneRef.current!, locar, modelLat, modelLng)
            }

            console.log(`Model positioned at: ${modelLat}, ${modelLng}, elevation: ${modelElevation}`)
            console.log("Model world position:", model.position)

            setModelLoaded(true)
            setIsLoadingModel(false)
            setLoadingProgress(100)
        } catch (error) {
            console.error("Error loading model:", error)
            setModelError(`Failed to load 3D model: ${error instanceof Error ? error.message : "Unknown error"}`)
            setIsLoadingModel(false)
            setLoadingProgress(0)
        }
    }

    // Reset camera position
    const resetCamera = () => {
        if (cameraRef.current) {
            cameraRef.current.position.set(0, 1.6, 0)
            cameraRef.current.rotation.set(0, 0, 0)
            console.log("Camera reset to:", cameraRef.current.position)
        }
    }

    // Toggle debug mode
    const toggleDebugMode = () => {
        setDebugMode(!debugMode)
        if (!debugMode && sceneRef.current && locarRef.current && modelPosition) {
            // Add debug sphere
            createDebugSphere(sceneRef.current, locarRef.current, modelPosition.lat, modelPosition.lng)
        } else if (debugMode && debugSphereRef.current && sceneRef.current) {
            // Remove debug sphere
            sceneRef.current.remove(debugSphereRef.current)
            debugSphereRef.current = null
        }
    }

    // Handle retry with proper cleanup
    const handleRetry = () => {
        console.log("Retrying AR initialization...")
        setRetryCount((prev) => prev + 1)
        setInitializationError(null)
        setPermissionStep("requesting")
        setIsInitializing(true)
        initializationRef.current = false

        // Clean up any existing AR components
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

        // Clear refs
        sceneRef.current = null
        cameraRef.current = null
        locarRef.current = null

        // Restart the initialization process
        setTimeout(() => {
            initializeAR()
        }, 100)
    }

    // Initialize AR with location-based positioning
    const initializeAR = async () => {
        if (initializationRef.current) {
            console.log("AR initialization already in progress, skipping...")
            return
        }

        initializationRef.current = true

        let cleanup: (() => void) | undefined

        try {
            console.log("Starting AR initialization process...")

            // First request all permissions
            const permissionsGranted = await requestPermissions()
            if (!permissionsGranted) {
                initializationRef.current = false
                return
            }

            console.log("Permissions granted, initializing AR components...")

            // Initialize camera
            const camera = initializeCamera()
            cameraRef.current = camera

            // Initialize renderer
            const renderer = initializeRenderer()
            document.body.appendChild(renderer.domElement)
            rendererRef.current = renderer

            // Create scene
            const scene = new THREE.Scene()
            sceneRef.current = scene

            // Setup enhanced lighting
            setupLighting(scene)

            // Initialize location-based AR
            const locar = new LocationBased(scene, camera, {
                gpsMinDistance: 1, // Update every 1 meter
                gpsMinAccuracy: 100, // Accept GPS accuracy up to 100 meters
            })
            locarRef.current = locar

            // Initialize webcam and device controls
            const cam = new WebcamRenderer(renderer)
            webcamRendererRef.current = cam

            const deviceOrientationControls = new DeviceOrientationControls(camera)
            deviceOrientationControlsRef.current = deviceOrientationControls

            // Initialize device orientation controls properly
            if (deviceOrientationControls.requiresPermission()) {
                console.log("Initializing device orientation controls with permission...")
                const success = await deviceOrientationControls.init()
                if (!success) {
                    throw new Error("Failed to initialize device orientation controls")
                }
            } else {
                console.log("Device orientation controls already connected")
            }

            // Handle window resize
            const handleResize = () => {
                renderer.setSize(window.innerWidth, window.innerHeight)
                camera.aspect = window.innerWidth / window.innerHeight
                camera.updateProjectionMatrix()
            }

            window.addEventListener("resize", handleResize)
            window.addEventListener("orientationchange", () => {
                setTimeout(handleResize, 100)
            })

            let firstLocation = true

            // Handle GPS updates
            locar.on("gpsupdate", (pos: GeolocationPosition) => {
                const { latitude, longitude, accuracy } = pos.coords
                console.log(`GPS Update: ${latitude}, ${longitude}, accuracy: ${accuracy}m`)

                setCurrentPosition({ lat: latitude, lng: longitude })

                if (firstLocation) {
                    // Calculate model position (5 meters north of initial position)
                    const modelPos = calculateOffsetPosition(latitude, longitude, 0, modelOffsetDistance) // 0 degrees = North
                    setModelPosition(modelPos)

                    console.log(`Initial position: ${latitude}, ${longitude}`)
                    console.log(`Model will be positioned at: ${modelPos.lat}, ${modelPos.lng}`)

                    // Load and position the 3D model
                    void loadModel(qrItem!.modelUrl, locar, modelPos.lat, modelPos.lng)

                    firstLocation = false
                    setIsInitializing(false)
                }

                // Update distance to model if model is loaded
                if (modelRef.current?.userData?.lat && modelRef.current?.userData?.lng) {
                    const distance = calculateDistance(
                        latitude,
                        longitude,
                        modelRef.current.userData.lat as number,
                        modelRef.current.userData.lng as number,
                    )
                    setDistanceToModel(distance)
                    console.log(`Distance to model: ${distance.toFixed(2)}m`)
                }
            })

            // Handle GPS errors
            locar.on("gpserror", (error: number) => {
                console.error("GPS error:", error)
                let errorMessage = "GPS error occurred."
                switch (error) {
                    case 1:
                        errorMessage = "GPS permission denied. Please enable location services."
                        break
                    case 2:
                        errorMessage = "GPS position unavailable. Please check your connection."
                        break
                    case 3:
                        errorMessage = "GPS timeout. Please try again."
                        break
                }
                setInitializationError(errorMessage)
            })

            // Start GPS tracking
            const gpsStarted = locar.startGps()
            console.log("GPS started:", gpsStarted)

            if (!gpsStarted) {
                setInitializationError("Failed to start GPS. Please check location permissions.")
                return
            }

            // Animation loop
            renderer.setAnimationLoop(() => {
                const deltaTime = clockRef.current.getDelta()

                // Update webcam and device orientation
                cam.update()
                deviceOrientationControls.update()

                // Update model animations
                if (mixerRef.current) {
                    mixerRef.current.update(deltaTime)
                }

                // Gentle rotation animation for the model
                if (modelRef.current) {
                    modelRef.current.rotation.y += 0.01 // Slightly faster rotation for visibility
                }

                // Render the scene
                renderer.render(scene, camera)
            })

            console.log("AR initialization complete")

            // Cleanup function
            cleanup = () => {
                console.log("Cleaning up AR...")
                window.removeEventListener("resize", handleResize)

                if (mixerRef.current) {
                    mixerRef.current.stopAllAction()
                    mixerRef.current = null
                }

                if (locarRef.current) {
                    locarRef.current.stopGps()
                    locarRef.current = null
                }

                // Dispose device orientation controls
                if (deviceOrientationControlsRef.current) {
                    deviceOrientationControlsRef.current.dispose()
                    deviceOrientationControlsRef.current = null
                }

                // Dispose webcam renderer
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
            console.error("AR initialization failed:", error)
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

    // Permission request screen
    if (isInitializing && permissionStep !== "complete") {
        const getStepMessage = () => {
            switch (permissionStep) {
                case "requesting":
                    return "Preparing to request permissions..."
                case "camera":
                    return "Requesting camera access..."
                case "orientation":
                    return "Requesting device orientation access..."
                case "location":
                    return "Requesting location access..."
                default:
                    return "Requesting permissions..."
            }
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

    // Loading screen
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

    // Error screen for fetch error
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

    // AR initialization loading
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

    // AR initialization error
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

    // Model loading error
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

    return (
        <>
            {/* Model Loading Progress Overlay */}
            {isLoadingModel && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-60">
                    <div className="bg-white rounded-lg p-6 m-4 max-w-sm w-full text-center">
                        <Box className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">Loading 3D Model</h2>
                        <div className="space-y-3">
                            <Progress value={loadingProgress} className="w-full" />
                            <p className="text-sm text-gray-600">{loadingProgress.toFixed(1)}% complete</p>
                            <p className="text-xs text-gray-500">Please wait while we load your 3D model...</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Back Button */}
            <Button
                className="absolute left-4 top-4 z-50 bg-black/50 text-white border-none hover:bg-black/70"
                onClick={() => router.back()}
            >
                <ArrowLeft className="h-6 w-6" /> Back
            </Button>

            {/* Info Toggle Button */}
            <Button
                className="absolute top-4 right-4 z-50 bg-black/50 text-white border-none hover:bg-black/70"
                onClick={() => setShowInfo(!showInfo)}
            >
                <FileText className="h-6 w-6" />
            </Button>

            {/* Model Size Controls */}
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

            {/* Crosshair for aiming */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40">
                <div className="w-8 h-8 border-2 border-white rounded-full opacity-70">
                    <div className="w-2 h-2 bg-white rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
                </div>
            </div>

            {/* Instructions */}
            <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 text-white px-4 py-2 rounded-lg text-center max-w-xs">
                <p className="text-sm font-bold">Look around to find the 3D model!</p>
                <p className="text-xs text-gray-300">Move closer to see it better</p>
                {modelLoaded && <p className="text-xs text-green-300">Model loaded successfully</p>}
            </div>

            {/* QR Item Information Panel */}
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
                            {/* Distance Info */}
                            <div className="flex items-center gap-2 text-sm">
                                <Navigation className="h-4 w-4 text-blue-400" />
                                <span className="text-blue-400 font-medium">{distanceToModel.toFixed(1)} meters away</span>
                            </div>

                            {/* Model Scale Info */}
                            {modelLoaded && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Box className="h-4 w-4 text-purple-400" />
                                    <span className="text-purple-400 font-medium">Model Scale: {modelScale.toFixed(1)}x</span>
                                </div>
                            )}

                            {/* Debug Info */}
                            {debugMode && modelPosition && (
                                <div className="bg-red-900/30 border border-red-700 rounded p-2 text-xs">
                                    <div className="font-semibold text-red-400 mb-1">Debug Info:</div>
                                    <div>
                                        Model Position: {modelPosition.lat.toFixed(6)}, {modelPosition.lng.toFixed(6)}
                                    </div>
                                    {currentPosition && (
                                        <div>
                                            Your Position: {currentPosition.lat.toFixed(6)}, {currentPosition.lng.toFixed(6)}
                                        </div>
                                    )}
                                    <div>Distance: {distanceToModel.toFixed(2)}m</div>
                                    <div>Scale: {modelScale.toFixed(2)}x</div>
                                </div>
                            )}

                            {/* Descriptions */}
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

                            {/* Date Range */}
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <Calendar className="h-3 w-3" />
                                <span>
                                    {format(new Date(qrItem.startDate), "MMM dd, yyyy")} -{" "}
                                    {format(new Date(qrItem.endDate), "MMM dd, yyyy")}
                                </span>
                            </div>

                            {/* External Link */}
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
