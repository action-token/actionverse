"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import {
  ClickHandler,
  DeviceOrientationControls,
  LocationBased,
  WebcamRenderer,
} from "~/lib/augmented-reality/locationbased-ar"
import { ArrowLeft, Coins, Navigation, X, Camera, Smartphone, MapPin, AlertTriangle, RefreshCw } from "lucide-react"
import ArCard from "~/components/common/ar-card"
import { ARCoin } from "~/components/common/AR-Coin"
import { BASE_URL } from "~/lib/common"
import { useNearByPin } from "~/lib/state/augmented-reality/useNearbyPin"
import useWindowDimensions from "~/lib/state/augmented-reality/useWindowWidth"
import type { ConsumedLocation } from "~/types/game/location"
import { Button } from "~/components/shadcn/ui/button"
import { useRouter } from "next/router"

const ARPage = () => {
  const router = useRouter()
  const [selectedPin, setPin] = useState<ConsumedLocation>()
  const collectPinRes = useRef()
  const { data } = useNearByPin()
  const winDim = useWindowDimensions()
  const [infoBoxVisible, setInfoBoxVisible] = useState(false)
  const [infoBoxPosition, setInfoBoxPosition] = useState({ left: 0, top: 0 })
  const [infoText, setInfoText] = useState<ConsumedLocation>()
  const rendererRef = useRef<THREE.WebGLRenderer>()
  const previousIntersectedObject = useRef<THREE.Object3D | undefined>(undefined)
  const [showLoading, setShowLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showCollectionAnimation, setShowCollectionAnimation] = useState(false)
  const [collectedPin, setCollectedPin] = useState<ConsumedLocation | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [initializationError, setInitializationError] = useState<string | null>(null)
  const [coinsLoaded, setCoinsLoaded] = useState(0)
  const [showPathToNearest, setShowPathToNearest] = useState(false)
  const [permissionStep, setPermissionStep] = useState<
    "requesting" | "camera" | "orientation" | "location" | "complete" | "error"
  >("requesting")
  const [retryCount, setRetryCount] = useState(0)

  // Core AR refs
  const pathToNearestRef = useRef<THREE.Line | null>(null)
  const pathLabelsRef = useRef<THREE.Sprite[]>([])
  const arCoinsRef = useRef<ARCoin[]>([])
  const hoveredCoinRef = useRef<ARCoin | null>(null)
  const clockRef = useRef<THREE.Clock>(new THREE.Clock())
  const locarRef = useRef<LocationBased | null>(null)
  const coinsRef = useRef<THREE.Mesh[]>([])
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.Camera | null>(null)
  const deviceOrientationControlsRef = useRef<DeviceOrientationControls | null>(null)
  const webcamRendererRef = useRef<WebcamRenderer | null>(null)
  const initializationRef = useRef<boolean>(false)

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
      setIsInitializing(true)
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
      setIsInitializing(false)
      return false
    }
  }

  // Distance calculation helper function
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

  // Initialize camera with better settings for AR
  const initializeCamera = () => {
    const camera = new THREE.PerspectiveCamera(
      75, // Wider field of view for better AR experience
      window.innerWidth / window.innerHeight,
      0.1, // Near clipping plane
      1000, // Far clipping plane
    )
    // Set camera at eye level
    camera.position.set(0, 1.6, 0)
    camera.rotation.set(0, 0, 0)
    // Ensure proper matrix updates
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
    renderer.setClearColor(0x000000, 0) // Transparent background for AR
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // Optimize for performance
    // Enable proper depth testing
    renderer.sortObjects = true
    renderer.autoClear = true
    return renderer
  }

  // Add comprehensive lighting for better coin visibility
  const setupLighting = (scene: THREE.Scene) => {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambientLight)

    // Main directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
    directionalLight.position.set(5, 10, 5)
    directionalLight.castShadow = false // Disable shadows for performance
    scene.add(directionalLight)

    // Secondary directional light for fill
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.6)
    directionalLight2.position.set(-5, 5, -5)
    scene.add(directionalLight2)

    // Point light for additional illumination
    const pointLight = new THREE.PointLight(0xffffff, 0.8, 100)
    pointLight.position.set(0, 5, 0)
    scene.add(pointLight)
  }

  // Show path to nearest coin
  const showPathToNearestCoin = () => {
    if (!locarRef.current || !sceneRef.current || coinsRef.current.length === 0) return

    // Find the nearest coin
    let nearestCoin: THREE.Mesh | null = null
    let shortestDistance = Number.POSITIVE_INFINITY

    coinsRef.current.forEach((coin) => {
      if (coin.userData.lat && coin.userData.lng) {
        // Calculate distance from camera to coin
        const distance = coin.position.distanceTo(cameraRef.current?.position ?? new THREE.Vector3())
        if (distance < shortestDistance) {
          shortestDistance = distance
          nearestCoin = coin
        }
      }
    })

    if (!nearestCoin) return

    // Create a curved path line
    const start = new THREE.Vector3(0, 1.6, 0) // Camera position
    const end = (nearestCoin as THREE.Mesh).position.clone()
    const mid = new THREE.Vector3(
      (start.x + end.x) / 2,
      Math.max(start.y, end.y) + 2, // Arc upward
      (start.z + end.z) / 2,
    )

    // Create curved path using quadratic bezier
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
    const points = curve.getPoints(20)
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
      color: 0x00ff88,
      linewidth: 3,
      transparent: true,
      opacity: 0.8,
    })

    // Remove existing path
    clearPath()

    const line = new THREE.Line(geometry, material)
    sceneRef.current.add(line)
    pathToNearestRef.current = line

    // Add distance marker
    const canvas = document.createElement("canvas")
    canvas.width = 256
    canvas.height = 64
    const context = canvas.getContext("2d")
    if (context) {
      context.fillStyle = "rgba(0, 0, 0, 0.8)"
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = "#00ff88"
      context.font = "bold 20px Arial"
      context.textAlign = "center"
      context.fillText(`${shortestDistance.toFixed(0)}m`, canvas.width / 2, canvas.height / 2 + 7)
    }

    const texture = new THREE.CanvasTexture(canvas)
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    })
    const sprite = new THREE.Sprite(spriteMaterial)
    sprite.position.copy(mid)
    sprite.scale.set(4, 2, 1)
    sceneRef.current.add(sprite)
    pathLabelsRef.current.push(sprite)

    setShowPathToNearest(true)
  }

  // Clear path visualization
  const clearPath = () => {
    if (!sceneRef.current) return

    if (pathToNearestRef.current) {
      sceneRef.current.remove(pathToNearestRef.current)
      pathToNearestRef.current = null
    }

    pathLabelsRef.current.forEach((label) => {
      sceneRef.current?.remove(label)
    })
    pathLabelsRef.current = []
    setShowPathToNearest(false)
  }

  const simulateApiCall = async () => {
    if (!selectedPin) return

    try {
      setShowLoading(true)
      const response = await fetch(new URL("api/game/locations/consume", BASE_URL).toString(), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ location_id: selectedPin.id.toString() }),
      })

      if (!response.ok) {
        throw new Error("Failed to consume location")
      }

      // Set the collected pin and show collection animation
      setCollectedPin(selectedPin)
      setShowCollectionAnimation(true)

      // Hide the collection animation after 4 seconds
      setTimeout(() => {
        setShowCollectionAnimation(false)
        setShowSuccess(true)

        // Navigate back after success
        setTimeout(() => {
          setShowSuccess(false)
          setCollectedPin(null)
          router.push("/augmented-reality/home")
        }, 2000)
      }, 4000)
    } catch (error) {
      console.error("Error consuming location", error)
      alert("Error consuming location")
    } finally {
      setShowLoading(false)
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
    arCoinsRef.current = []
    coinsRef.current = []

    // Restart the initialization process
    setTimeout(() => {
      initializeAR()
    }, 100)
  }

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

      // Initialize camera with optimized settings
      const camera = initializeCamera()
      cameraRef.current = camera

      // Initialize renderer with AR optimizations
      const renderer = initializeRenderer()
      document.body.appendChild(renderer.domElement)
      rendererRef.current = renderer

      // Create scene
      const scene = new THREE.Scene()
      sceneRef.current = scene

      // Setup optimized lighting
      setupLighting(scene)

      // Initialize location-based AR
      const locar = new LocationBased(scene, camera)
      locarRef.current = locar

      // Initialize webcam and device controls
      const cam = new WebcamRenderer(renderer)
      webcamRendererRef.current = cam
      const clickHandler = new ClickHandler(renderer)

      // Initialize device orientation controls
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

      // Handle GPS updates and coin loading
      locar.on("gpsupdate", (pos: GeolocationPosition) => {
        if (firstLocation) {
          const { latitude, longitude } = pos.coords
          const coinsPositions = data.nearbyPins

          console.log("Loading coins:", coinsPositions?.length ?? 0)

          if (!coinsPositions) {
            setIsInitializing(false)
            return
          }

          let loadedCoins = 0

          // Create AR coins for each location
          for (const coinData of coinsPositions) {
            // Calculate distance from current position to coin
            const distance = calculateDistance(latitude, longitude, coinData.lat, coinData.lng)

            // Only add coins within reasonable distance (500 meters)
            if (distance > 500) {
              continue
            }

            // Create ARCoin instance
            const consumedLocation: ConsumedLocation = {
              ...coinData,
              modal_url: coinData.url || "",
              viewed: false,
            }

            try {
              const arCoin = new ARCoin(consumedLocation)
              const coinMesh = arCoin.getMesh()
              const billboardGroup = arCoin.getBillboardGroup()

              // **FIX: Set userData on the coin mesh with the coin data**
              coinMesh.userData = consumedLocation

              // Also set userData on billboard group for consistency
              billboardGroup.userData = consumedLocation

              // Add to scene using location-based positioning
              locar.add(coinMesh, coinData.lng, coinData.lat)
              scene.add(billboardGroup)

              // Store references
              arCoinsRef.current.push(arCoin)
              coinsRef.current.push(coinMesh)

              loadedCoins++
              console.log(`Added AR coin: ${coinData.brand_name}`)
            } catch (error) {
              console.error(`Failed to create AR coin for ${coinData.brand_name}:`, error)
            }
          }

          setCoinsLoaded(loadedCoins)
          setIsInitializing(false)
          firstLocation = false
        }
      })

      // Start GPS tracking
      locar.startGps()

      // Mouse/touch interaction for hover effects
      const raycaster = new THREE.Raycaster()
      const mouse = new THREE.Vector2()

      // Handle click/tap events
      // Handle mouse/touch move for hover effects
      const onMouseMove = (event: MouseEvent | TouchEvent) => {
        let clientX, clientY

        if (event instanceof TouchEvent) {
          if (event.touches.length > 0 && event.touches[0]) {
            clientX = event.touches[0].clientX
            clientY = event.touches[0].clientY
          } else {
            return
          }
        } else {
          clientX = event.clientX
          clientY = event.clientY
        }

        mouse.x = (clientX / window.innerWidth) * 2 - 1
        mouse.y = -(clientY / window.innerHeight) * 2 + 1

        raycaster.setFromCamera(mouse, camera)
        const intersects = raycaster.intersectObjects(coinsRef.current)

        if (intersects.length > 0 && intersects[0]) {
          const intersectedCoin = intersects[0].object
          const arCoin = arCoinsRef.current.find((coin) => coin.getMesh() === intersectedCoin)

          if (arCoin && hoveredCoinRef.current !== arCoin) {
            // Hide previous hover
            if (hoveredCoinRef.current) {
              hoveredCoinRef.current.hideCard()
            }
            // Show new hover
            arCoin.showCard(camera)
            hoveredCoinRef.current = arCoin
          }
        } else {
          // No intersection, hide any visible card
          if (hoveredCoinRef.current) {
            hoveredCoinRef.current.hideCard()
            hoveredCoinRef.current = null
          }
        }
      }

      const onMouseClick = (event: MouseEvent | TouchEvent) => {
        event.preventDefault()

        let clientX, clientY

        if (event instanceof TouchEvent) {
          if (event.changedTouches && event.changedTouches.length > 0 && event.changedTouches[0]) {
            clientX = event.changedTouches[0].clientX
            clientY = event.changedTouches[0].clientY
          } else {
            return
          }
        } else {
          clientX = event.clientX
          clientY = event.clientY
        }

        console.log("🎯 Click/tap detected at:", clientX, clientY)

        mouse.x = (clientX / window.innerWidth) * 2 - 1
        mouse.y = -(clientY / window.innerHeight) * 2 + 1

        console.log("🎯 Mouse coordinates:", mouse.x, mouse.y)

        raycaster.setFromCamera(mouse, camera)
        const intersects = raycaster.intersectObjects(coinsRef.current, true) // Include children

        console.log("🎯 Raycast intersects:", intersects.length)
        console.log("🎯 Available coins for intersection:", coinsRef.current.length)

        if (intersects.length > 0 && intersects[0]) {
          const intersect = intersects[0]
          console.log("🎯 Intersected object:", intersect.object)
          console.log("🎯 Object userData:", intersect.object.userData)

          // Try to find the userData in the intersected object or its parent
          let objectData = intersect.object.userData as ConsumedLocation

          // If no userData on the intersected object, check parent
          if (!objectData) {
            let parent = intersect.object.parent
            while (parent && (!parent.userData)) {
              parent = parent.parent
            }
            if (parent) {
              objectData = parent.userData as ConsumedLocation
            }
          }

          if (objectData) {
            console.log("🎯 Coin clicked:", objectData.brand_name)
            console.log("🎯 Full object data:", objectData)

            // Set the info box content and position
            setInfoText(objectData)
            setInfoBoxVisible(true)

            // Calculate screen position of the intersected object
            const vector = new THREE.Vector3()
            intersect.object.getWorldPosition(vector)
            vector.project(camera)
            const left = ((vector.x + 1) / 2) * window.innerWidth
            const top = (-(vector.y - 1) / 2) * window.innerHeight
            setInfoBoxPosition({ left, top })

            previousIntersectedObject.current = intersect.object

            // Hide info box after 5 seconds (increased from 3)
            setTimeout(() => setInfoBoxVisible(false), 5000)

            // Set selected pin - this should show the capture button
            console.log("🎯 Setting selected pin to:", objectData.brand_name)
            setPin(objectData)

            // Add visual feedback
            document.body.style.cursor = "pointer"
            setTimeout(() => {
              document.body.style.cursor = "default"
            }, 200)
          } else {
            console.log("🎯 No valid userData found on intersected object")
          }
        } else {
          console.log("🎯 No intersections found")
          console.log("🎯 Camera position:", camera.position)
          console.log("🎯 Camera rotation:", camera.rotation)
        }
      }

      // Add event listeners for both mouse and touch
      window.addEventListener("mousemove", onMouseMove)
      window.addEventListener("click", onMouseClick)

      // Main animation loop
      renderer.setAnimationLoop(() => {
        const deltaTime = clockRef.current.getDelta()

        // Update webcam and device orientation
        cam.update()
        deviceOrientationControls.update()

        // Update AR coin animations and billboards
        arCoinsRef.current.forEach((arCoin) => {
          try {
            // arCoin.update(deltaTime);
            arCoin.updateBillboard(camera)
          } catch (error) {
            console.error("Error updating AR coin:", error)
          }
        })

        // Render the scene
        renderer.render(scene, camera)

        // Handle click interactions
        const [intersect] = clickHandler.raycast(camera, scene)
        if (intersect) {
          const objectData = intersect.object.userData as ConsumedLocation

          console.log("Clicked object userData:", objectData) // Debug log

          // **FIX: Add validation to ensure userData exists**
          if (objectData) {
            // Set the info box content and position
            setInfoText(objectData)
            setInfoBoxVisible(true)

            // Calculate screen position of the intersected object
            const vector = new THREE.Vector3()
            intersect.object.getWorldPosition(vector)
            vector.project(camera)

            const left = ((vector.x + 1) / 2) * window.innerWidth
            const top = (-(vector.y - 1) / 2) * window.innerHeight

            setInfoBoxPosition({ left, top })
            previousIntersectedObject.current = intersect.object

            // Hide info box after 3 seconds
            setTimeout(() => setInfoBoxVisible(false), 3000)

            // Set selected pin
            setPin(objectData)
            console.log("Selected pin set:", objectData) // Debug log
          } else {
            console.warn("Clicked object has no userData or invalid data:", intersect.object)
          }
        }
      })

      // Cleanup function
      cleanup = () => {
        window.removeEventListener("resize", handleResize)
        window.removeEventListener("mousemove", onMouseMove)

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

        // Dispose AR coins
        arCoinsRef.current.forEach((arCoin) => {
          try {
            arCoin.dispose()
          } catch (error) {
            console.error("Error disposing AR coin:", error)
          }
        })
        arCoinsRef.current = []
        coinsRef.current = []

        // Clean up renderer
        renderer.dispose()
        if (document.body.contains(renderer.domElement)) {
          document.body.removeChild(renderer.domElement)
        }
      }

      console.log("AR initialization completed successfully")
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
    let cleanup: (() => void) | undefined

    const init = async () => {
      cleanup = await initializeAR()
    }

    init()

    return () => {
      if (cleanup) cleanup()
    }
  }, [data.nearbyPins, retryCount])

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
  if (isInitializing) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 m-4 max-w-sm text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-bold mb-2">Initializing AR</h2>
          <p className="text-gray-600 mb-4">Setting up your augmented reality experience...</p>
          <div className="text-sm text-gray-500">{coinsLoaded > 0 && `Loaded ${coinsLoaded} coins`}</div>
          <Button variant="outline" onClick={() => router.back()} className="w-full mt-4">
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // Error screen
  if (initializationError) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 m-4 max-w-sm text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
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

  return (
    <>
      {/* Back Button */}
      <Button
        className="absolute left-4 top-4 z-50 bg-black/50 text-white border-none hover:bg-black/70"
        onClick={() => {
          router.back()
        }}
      >
        <ArrowLeft className="h-6 w-6" /> Back
      </Button>

      {/* Coins Counter */}
      <div className="absolute top-4 right-4 z-50 bg-black/70 text-white px-3 py-2 rounded-lg">
        <div className="flex items-center space-x-2">
          <Coins className="w-5 h-5 text-yellow-400" />
          <span className="font-semibold">{coinsLoaded} coins nearby</span>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="absolute top-20 right-4 z-50 space-y-2">
        {!showPathToNearest ? (
          <Button
            onClick={showPathToNearestCoin}
            className="bg-green-500/80 hover:bg-green-600/80 text-white border-none"
            size="sm"
          >
            <Navigation className="w-4 h-4 mr-2" />
            Show Path
          </Button>
        ) : (
          <Button onClick={clearPath} className="bg-red-500/80 hover:bg-red-600/80 text-white border-none" size="sm">
            <X className="w-4 h-4 mr-2" />
            Clear Path
          </Button>
        )}
      </div>



      {/* Info Card */}
      {infoBoxVisible && infoText && (
        <ArCard
          brandName={infoText.brand_name}
          description={infoText.description}
          position={{
            left: Math.max(10, Math.min(winDim.width - 220, infoBoxPosition.left - 110)),
            top: Math.max(100, infoBoxPosition.top - 50),
          }}
        />
      )}

      {/* Bottom UI */}
      {selectedPin && (
        <div className="absolute bottom-48 left-0 right-0 w-full bg-black/90 backdrop-blur-sm z-40">
          <div className="flex items-stretch" style={{ width: winDim.width }}>
            <div className="flex flex-1 items-center space-x-4 p-4">
              <div className="text-white">
                <p className="text-sm font-semibold text-yellow-400">{selectedPin.title}</p>
                <p className="text-lg font-bold">{selectedPin.brand_name}</p>
              </div>
            </div>
            <div className="my-2 w-px self-stretch bg-gray-700" aria-hidden="true"></div>
            <div className="flex flex-1 items-center space-x-4 p-4">
              <div className="text-white">
                <p className="text-sm font-semibold text-yellow-400">Remaining:</p>
                <p className="text-lg font-bold">{selectedPin.collection_limit_remaining}</p>
              </div>
            </div>
            <div className="my-2 w-px self-stretch bg-gray-700" aria-hidden="true"></div>
            {!data.singleAR && (
              <div className="flex items-center p-4">
                <button
                  onClick={simulateApiCall}
                  className="rounded-lg bg-blue-500 px-6 py-2 font-semibold text-white transition-colors duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50"
                >
                  Capture
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collection Animation */}
      {showCollectionAnimation && collectedPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="relative flex flex-col items-center">
            <div className="relative mb-8">
              <div className="animate-bounce">
                <div className="relative mx-auto h-32 w-32">
                  <div className="animate-spin-slow absolute inset-0 rotate-12 transform rounded-full bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 shadow-2xl">
                    <div className="absolute inset-2 overflow-hidden rounded-full border-4 border-yellow-200">
                      <img
                        src={collectedPin.brand_image_url ?? "/placeholder.svg?height=200&width=200"}
                        alt={collectedPin.brand_name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src =
                            "/placeholder.svg?height=200&width=200&text=" + encodeURIComponent(collectedPin.brand_name)
                        }}
                      />
                    </div>
                  </div>
                  <div className="absolute -left-2 -top-2 h-4 w-4 animate-ping rounded-full bg-yellow-300"></div>
                  <div className="animation-delay-200 absolute -right-3 -top-1 h-3 w-3 animate-ping rounded-full bg-white"></div>
                  <div className="animation-delay-400 absolute -bottom-2 -left-3 h-2 w-2 animate-ping rounded-full bg-yellow-400"></div>
                  <div className="animation-delay-600 absolute -bottom-1 -right-2 h-3 w-3 animate-ping rounded-full bg-yellow-200"></div>
                  <div className="absolute inset-0 scale-110 animate-pulse rounded-full bg-yellow-400 opacity-30"></div>
                </div>
              </div>
            </div>
            <div className="space-y-4 text-center text-white">
              <div className="animate-bounce text-6xl">🎉</div>
              <h2 className="animate-pulse text-4xl font-bold text-yellow-400">Coin Collected!</h2>
              <div className="max-w-md rounded-lg bg-black bg-opacity-50 p-6">
                <h3 className="mb-2 text-2xl font-semibold text-white">{collectedPin.brand_name}</h3>
                <p className="mb-2 text-lg text-yellow-300">{collectedPin.title}</p>
                <p className="text-sm text-gray-300">{collectedPin.description}</p>
                <div className="mt-4 flex items-center justify-center space-x-2">
                  <Coins className="h-5 w-5 text-yellow-400" />
                  <span className="font-semibold text-yellow-400">+1 Coin Added to Collection</span>
                </div>
              </div>
            </div>
            <div className="mt-8 h-2 w-64 rounded-full bg-gray-700">
              <div className="animate-progress-fill h-2 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600"></div>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {showLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="rounded-lg bg-white p-6 text-center">
            <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-t-4 border-blue-500"></div>
            <p className="text-xl font-bold">Capturing the coin...</p>
          </div>
        </div>
      )}

      {/* Success animation */}
      {showSuccess && (
        <div className="absolute inset-0 flex items-center justify-center bg-green-500 bg-opacity-50 z-50">
          <div className="rounded-lg bg-white p-6 text-center">
            <div className="mb-4 text-6xl">✅</div>
            <p className="mb-2 text-2xl font-bold text-green-600">Collection Complete!</p>
            <p className="text-lg">{collectedPin?.brand_name} added to your collection</p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes progress-fill {
          from { width: 0%; }
          to { width: 100%; }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        .animate-progress-fill {
          animation: progress-fill 4s ease-out forwards;
        }
        .animation-delay-200 { animation-delay: 0.2s; }
        .animation-delay-400 { animation-delay: 0.4s; }
        .animation-delay-600 { animation-delay: 0.6s; }
      `}</style>
    </>
  )
}

export default ARPage
