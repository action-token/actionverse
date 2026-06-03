import type React from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { createImagePlane, createVideoPlane, createAudioIndicator, positionMediaInScene } from "./media-objects"
import type { LocationBased } from "./locationbased-ar"
import { MarketAssetType } from "~/types/market/market-asset-type"


interface MediaLoadOptions {
    onProgress?: (progress: number) => void
    onError?: (error: Error) => void
    onSuccess?: () => void
    modelScale?: number
    mixerRef?: React.MutableRefObject<THREE.AnimationMixer | null>
    modelRef?: React.MutableRefObject<THREE.Group | null>
    originalScaleRef?: React.MutableRefObject<number>
    sceneRef?: React.MutableRefObject<THREE.Scene | null>
    mediaGroupRef?: React.MutableRefObject<THREE.Group | null>
}

export async function loadMedia(
    qrItem: {
        type: "VIDEO" | "IMAGE" | "MUSIC" | "THREE_D" | "CARD" | "AI"
        url: string
    },
    locar: LocationBased,
    modelLat: number,
    modelLng: number,
    options?: MediaLoadOptions,
) {
    if (qrItem.type === "THREE_D") {
        return await load3DModelIntoScene(qrItem.url, locar, modelLat, modelLng, options)
    }

    if (qrItem.type === "IMAGE" || qrItem.type === "CARD" || qrItem.type === "AI") {
        return await loadImageIntoScene(qrItem.url, options)
    } else if (qrItem.type === "VIDEO") {
        return await loadVideoIntoScene(qrItem.url, options)
    } else if (qrItem.type === "MUSIC") {
        return await loadAudioIntoScene(qrItem.url, options)
    }

    throw new Error(`Unsupported media type`)
}

async function loadImageIntoScene(url: string, options?: MediaLoadOptions) {
    try {
        console.log(`Loading image into scene: ${url}`)
        options?.onProgress?.(25)
        const imageMesh = await createImagePlane(url)
        positionMediaInScene(imageMesh, 5, 1.6, undefined, true)

        options?.onProgress?.(75)

        if (options?.mediaGroupRef?.current) {
            options.mediaGroupRef.current.add(imageMesh)
        }

        options?.onProgress?.(100)
        options?.onSuccess?.()

        return { type: "IMAGE", mesh: imageMesh }
    } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error loading image")
        options?.onError?.(err)
        throw err
    }
}

export async function loadVideoIntoScene(url: string, options?: MediaLoadOptions) {
    try {
        console.log(`Loading video into scene: ${url}`)
        options?.onProgress?.(25)
        const { mesh, video, texture } = await createVideoPlane(url)
        positionMediaInScene(mesh as THREE.Object3D<THREE.Object3DEventMap>, 3, 1.6, undefined, true)

        const unmuteButton = document.createElement("button")
        unmuteButton.innerHTML = "🔊 Tap to Unmute & Play"
        unmuteButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            background: rgba(0,0,0,0.85);
            color: white;
            border: 2px solid white;
            border-radius: 24px;
            z-index: 1000;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            display: ${video.muted ? "block" : "none"};
        `

        unmuteButton.onclick = async () => {
            try {
                video.muted = false
                await video.play()
                unmuteButton.style.display = "none"
                console.log("Video unmuted and playing")
            } catch (error) {
                console.error("Failed to unmute and play:", error)
                unmuteButton.innerHTML = "❌ Play Failed - Try Refresh"
            }
        }

        unmuteButton.onmouseover = () => {
            unmuteButton.style.background = "rgba(0,0,0,0.95)"
        }
        unmuteButton.onmouseout = () => {
            unmuteButton.style.background = "rgba(0,0,0,0.85)"
        }

        document.body.appendChild(unmuteButton)

        options?.onProgress?.(75)

        if (options?.mediaGroupRef?.current) {
            options.mediaGroupRef.current.add(mesh as THREE.Object3D<THREE.Object3DEventMap>)
        }

        options?.onProgress?.(100)
        options?.onSuccess?.()

        return { type: "VIDEO", mesh, video, texture }
    } catch (error) {
        console.error("Video loading error:", error)
        const err = error instanceof Error ? error : new Error("Unknown error loading video")
        options?.onError?.(err)
        throw err
    }
}

async function loadAudioIntoScene(url: string, options?: MediaLoadOptions) {
    try {
        console.log(`Loading audio into scene: ${url}`)
        options?.onProgress?.(25)

        const result = createAudioIndicator("AUDIO")
        const mesh = result.mesh
        const audio = result.audio

        positionMediaInScene(mesh as THREE.Object3D<THREE.Object3DEventMap>, 3, 1.6, undefined, true)

        audio.src = url
        audio.crossOrigin = "anonymous"

        const playButton = document.createElement("button")
        playButton.innerHTML = "🔊 Tap to Play Audio"
        playButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 8px 16px;
            background: rgba(0,0,0,0.7);
            color: white;
            border: none;
            border-radius: 20px;
            z-index: 1000;
        `
        playButton.onclick = async () => {
            try {
                await audio.play()
                playButton.style.display = "none"
            } catch (error) {
                console.warn("Failed to play audio:", error)
            }
        }
        document.body.appendChild(playButton)

        options?.onProgress?.(75)

        if (options?.mediaGroupRef?.current) {
            options.mediaGroupRef.current.add(mesh)
        }

        options?.onProgress?.(100)
        options?.onSuccess?.()

        return { type: "MUSIC" as const, mesh, audio }
    } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error loading audio")
        options?.onError?.(err)
        throw err
    }
}

export async function load3DModelIntoScene(
    modelUrl: string,
    locar: LocationBased,
    modelLat: number,
    modelLng: number,
    options?: {
        onProgress?: (progress: number) => void
        onError?: (error: Error) => void
        onSuccess?: () => void
        modelScale?: number
        mixerRef?: React.MutableRefObject<THREE.AnimationMixer | null>
        modelRef?: React.MutableRefObject<THREE.Group | null>
        originalScaleRef?: React.MutableRefObject<number>
        sceneRef?: React.MutableRefObject<THREE.Scene | null>
        mediaGroupRef?: React.MutableRefObject<THREE.Group | null>
    },
) {
    try {
        console.log(`Loading 3D model into scene: ${modelUrl}`)

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
                    options?.onProgress?.(percent)
                    console.log(`Loading progress: ${percent.toFixed(1)}%`)
                },
                reject,
            )
        })

        const model = gltf.scene

        if (options?.modelRef) {
            options.modelRef.current = model
        }

        console.log("3D model loaded successfully:", model)

        if (gltf.animations && gltf.animations.length > 0 && options?.mixerRef) {
            console.log(`Found ${gltf.animations.length} animations`)
            options.mixerRef.current = new THREE.AnimationMixer(model)
            gltf.animations.forEach((clip: THREE.AnimationClip) => {
                const action = options.mixerRef!.current!.clipAction(clip)
                action.play()
            })
        }

        model.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true
                child.receiveShadow = true

                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach((mat) => {
                            if (mat instanceof THREE.MeshStandardMaterial) {
                                mat.needsUpdate = true
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

        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())

        console.log("Model bounding box:", {
            size: { x: size.x, y: size.y, z: size.z },
            center: { x: center.x, y: center.y, z: center.z },
        })

        model.position.sub(center)

        const maxDimension = Math.max(size.x, size.y, size.z)
        let scale = 1

        if (maxDimension > 5) {
            scale = 3 / maxDimension
        } else if (maxDimension < 0.5) {
            scale = 2 / maxDimension
        } else if (maxDimension < 2) {
            scale = 1.5
        }

        if (options?.originalScaleRef) {
            options.originalScaleRef.current = scale
        }

        const modelScale = options?.modelScale ?? 1
        const finalScale = scale * modelScale
        model.scale.setScalar(finalScale)

        options?.onProgress?.(90)

        if (options?.mediaGroupRef?.current) {
            options.mediaGroupRef.current.add(model)
            console.log("3D model added to media group")
        } else {
            console.warn("Media group reference not available, adding to scene directly")
            if (options?.sceneRef?.current) {
                options.sceneRef.current.add(model)
            }
        }

        options?.onProgress?.(100)
        options?.onSuccess?.()
        const modelElevation = 1.6 // Same as camera height

        locar.add(model, modelLng, modelLat, modelElevation)

        return { type: "model", model }
    } catch (error) {
        console.error("Error loading 3D model:", error)
        const err = error instanceof Error ? error : new Error("Unknown error loading model")
        options?.onError?.(err)
        throw err
    }
}
