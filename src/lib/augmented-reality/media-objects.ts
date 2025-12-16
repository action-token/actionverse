import * as THREE from "three"

// Create an image plane in the 3D scene
export function createImagePlane(imageUrl: string): Promise<THREE.Mesh> {
    return new Promise((resolve, reject) => {
        const textureLoader = new THREE.TextureLoader()
        textureLoader.load(
            imageUrl,
            (texture) => {
                const width = 2
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                const height = (texture.image.height / texture.image.width) * width
                const geometry = new THREE.PlaneGeometry(width, height)
                const material = new THREE.MeshBasicMaterial({ map: texture })
                const mesh = new THREE.Mesh(geometry, material)
                resolve(mesh)
            },
            undefined,
            (error) => {
                reject(new Error(`Failed to load image texture`))
            },
        )
    })
}

export function createVideoPlane(videoUrl: string): Promise<{
    mesh: THREE.Mesh
    video: HTMLVideoElement
    texture: THREE.VideoTexture
}> {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video")
        video.playsInline = true
        video.setAttribute("webkit-playsinline", "true") // iOS 9
        video.crossOrigin = "anonymous"
        video.loop = true
        video.muted = true // Start muted (required for autoplay on mobile)
        video.preload = "metadata" // Use metadata instead of auto for faster loading
        video.controls = false

        // Some iOS versions need the video in DOM for proper initialization
        video.style.display = "none"
        document.body.appendChild(video)

        // Create texture before loading to avoid black frame
        const texture = new THREE.VideoTexture(video)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.format = THREE.RGBAFormat

        // Create plane geometry with initial dimensions
        const width = 2.5
        const height = 1.4 // 16:9 aspect ratio initially
        const geometry = new THREE.PlaneGeometry(width, height)
        const material = new THREE.MeshBasicMaterial({ map: texture })
        const mesh = new THREE.Mesh(geometry, material)

        video.onloadedmetadata = () => {
            try {
                // Update geometry with actual video dimensions
                const videoAspect = video.videoHeight / video.videoWidth
                const newHeight = width * videoAspect
                geometry.dispose()
                mesh.geometry = new THREE.PlaneGeometry(width, newHeight)

                const playPromise = video.play()
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            console.log("Video autoplay succeeded")
                            // Try to unmute after playing starts
                            setTimeout(() => {
                                video.muted = false
                            }, 500)
                        })
                        .catch((err) => {
                            console.warn("Video autoplay failed, keeping muted for user interaction:", err)
                            // Video will stay muted - unmute button will be shown
                        })
                } else {
                    // For older browsers that don't return a promise
                    video.muted = false
                }

                resolve({ mesh, video, texture })
            } catch (error) {
                reject(
                    new Error(`Failed to process video metadata: ${error instanceof Error ? error.message : "Unknown error"}`),
                )
            }
        }

        video.onerror = () => {
            // Remove video from DOM on error
            if (video.parentNode) {
                document.body.removeChild(video)
            }
            const errorMsg = video.error?.message ?? `Error code: ${video.error?.code}`
            reject(new Error(`Failed to load video: ${errorMsg}`))
        }

        video.onabort = () => {
            if (video.parentNode) {
                document.body.removeChild(video)
            }
            reject(new Error("Video loading aborted"))
        }

        // Start loading the video
        video.src = videoUrl
        video.load()

        const timeout = setTimeout(() => {
            if (!video.readyState) {
                if (video.parentNode) {
                    document.body.removeChild(video)
                }
                reject(new Error("Video loading timeout"))
            }
        }, 30000) // 30 second timeout

        // Clear timeout on successful load
        video.oncanplay = () => {
            clearTimeout(timeout)
        }
    })
}

// Create a visual indicator for audio playback in the 3D scene
export function createAudioIndicator(title: string): {
    mesh: THREE.Group
    audio: HTMLAudioElement
} {
    const group = new THREE.Group()

    // Create a simple sphere to represent audio
    const geometry = new THREE.IcosahedronGeometry(0.5, 4)
    const material = new THREE.MeshPhongMaterial({
        color: 0x00ff88,
        wireframe: false,
        emissive: 0x00ff88,
        emissiveIntensity: 0.5,
    })
    const sphere = new THREE.Mesh(geometry, material)
    group.add(sphere)

    // Create audio element (hidden, just for playback)
    const audio = document.createElement("audio")
    audio.crossOrigin = "anonymous"
    audio.controls = false
    audio.preload = "auto"

    return { mesh: group, audio }
}

// Position media in the AR scene at a specific location
export function positionMediaInScene(
    media: THREE.Object3D<THREE.Object3DEventMap> | THREE.Group,
    distance = 5,
    height = 1.6,
    worldPosition?: { x: number; y: number; z: number },
    cameraLocked = false,
): void {
    if (worldPosition && !cameraLocked) {
        // If world position is provided, use it directly (fixed in world space)
        media.position.set(worldPosition.x, worldPosition.y, worldPosition.z)
    } else {
        // Position directly in front of the camera
        media.position.set(0, height, -distance)

        // Mark this object as camera-locked (will be used in the animation loop)
        media.userData.cameraLocked = true
        media.userData.cameraDistance = distance
        media.userData.cameraHeight = height

        // Setup initial rotation to face camera
        media.rotation.set(0, 0, 0)

        // Center the media horizontally and vertically
        if (media instanceof THREE.Mesh) {
            const box = new THREE.Box3().setFromObject(media)
            const size = box.getSize(new THREE.Vector3())
            media.position.y = height - size.y / 2 // Adjust vertical position based on media height
        }
    }
}
