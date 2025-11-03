import type React from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import type { LocationBased } from "./locationbased-ar"
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

export async function loadMedia(
    qrItem: QRItemData,
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
    },
) {
    if (qrItem.mediaType === "THREE_D") {
        return await loadModel3D(qrItem.mediaUrl, locar, modelLat, modelLng, options)
    }
    // For image, video, audio - they will be displayed as overlays in the UI
    // No need to load them into the 3D scene
    return { type: qrItem.mediaType, url: qrItem.mediaUrl }
}

async function loadModel3D(
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
    },
) {
    try {
        console.log(`Loading 3D model from: ${modelUrl}`)

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
                    console.log(`[v0] Loading progress: ${percent.toFixed(1)}%`)
                },
                reject,
            )
        })

        const model = gltf.scene

        if (options?.modelRef) {
            options.modelRef.current = model
        }

        console.log("3D model loaded successfully:", model)

        // Setup animations
        if (gltf.animations && gltf.animations.length > 0 && options?.mixerRef) {
            console.log(`Found ${gltf.animations.length} animations`)
            options.mixerRef.current = new THREE.AnimationMixer(model)
            gltf.animations.forEach((clip: THREE.AnimationClip, index: number) => {
                console.log(`Animation ${index}: ${clip.name}, duration: ${clip.duration}s`)
                const action = options.mixerRef!.current!.clipAction(clip)
                action.play()
            })
        }

        // Setup materials
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

        // Calculate and apply scale
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
        console.log(`Applied scale: ${finalScale} (original: ${scale}, multiplier: ${modelScale})`)

        const modelElevation = 1.6
        locar.add(model, modelLng, modelLat, modelElevation)

        model.userData = {
            lat: modelLat,
            lng: modelLng,
            title: "3D Model",
        }

        console.log(`Model positioned at: ${modelLat}, ${modelLng}, elevation: ${modelElevation}`)

        options?.onSuccess?.()

        return { type: "model", model }
    } catch (error) {
        console.error("Error loading 3D model:", error)
        const err = error instanceof Error ? error : new Error("Unknown error loading model")
        options?.onError?.(err)
        throw err
    }
}
