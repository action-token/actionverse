import * as THREE from "three"

export interface Location {
    id: string | number
    lat: number
    lng: number
    title: string
    description: string
    brand_name: string
    url: string
    image_url: string
    collected: boolean
    collection_limit_remaining: number
    auto_collect: boolean
    brand_image_url: string
    brand_id: string
}

export interface ConsumedLocation extends Location {
    modal_url: string
    viewed: boolean
}

export class ARCoin {
    private mesh: THREE.Mesh
    private billboardGroup: THREE.Group
    private cardMesh: THREE.Mesh | null = null
    private isHovered = false
    private location: ConsumedLocation
    private textSprite: THREE.Sprite | null = null

    constructor(location: ConsumedLocation) {
        this.location = location
        this.mesh = this.createCoinMesh()
        this.billboardGroup = new THREE.Group()
        this.setupBillboard()
    }

    private createCoinMesh(): THREE.Mesh {
        // Create coin geometry - cylinder for the coin shape
        const radius = 5
        const thickness = 0.8
        const segments = 32

        const geometry = new THREE.CylinderGeometry(radius, radius, thickness, segments)
        geometry.rotateX(Math.PI / 2) // Rotate to face forward

        // Create texture loader
        const textureLoader = new THREE.TextureLoader()

        // Load brand image texture for both sides
        const brandTexture = textureLoader.load(
            this.location.brand_image_url ?? this.location.image_url ?? "https://app.action-tokens.com/images/action/logo.png",
            (texture) => {
                // Ensure texture repeats properly
                texture.wrapS = THREE.ClampToEdgeWrapping
                texture.wrapT = THREE.ClampToEdgeWrapping
                texture.minFilter = THREE.LinearFilter
                texture.magFilter = THREE.LinearFilter
            },
        )

        // Clone the texture for the back side
        const brandTextureBack = brandTexture.clone()
        brandTextureBack.needsUpdate = true

        // Create materials for different parts of the coin
        const frontMaterial = new THREE.MeshStandardMaterial({
            map: brandTexture,
            roughness: 0.3,
            metalness: 0.7,
            emissive: 0x222222,
            emissiveIntensity: 0.3,
        })

        const backMaterial = new THREE.MeshStandardMaterial({
            map: brandTextureBack,
            roughness: 0.3,
            metalness: 0.7,
            emissive: 0x222222,
            emissiveIntensity: 0.3,
        })

        // Gold edge material
        const edgeMaterial = new THREE.MeshStandardMaterial({
            color: 0xd4af37,
            roughness: 0.3,
            metalness: 0.8,
            emissive: 0x332200,
            emissiveIntensity: 0.2,
        })

        // Create materials array for the cylinder
        // [edge, front face, back face]
        const materials = [edgeMaterial, frontMaterial, backMaterial]

        const mesh = new THREE.Mesh(geometry, materials)

        // Store location data in userData
        mesh.userData = this.location

        // Add floating animation
        this.addFloatingAnimation(mesh)

        return mesh
    }

    private addFloatingAnimation(mesh: THREE.Mesh) {
        const originalY = mesh.position.y
        const originalRotationY = mesh.rotation.y

        // Create floating animation
        const animate = () => {
            const time = Date.now() * 0.001
            mesh.position.y = originalY + Math.sin(time * 2) * 0.3
            mesh.rotation.y = originalRotationY + time * 0.5 // Slow rotation to show both sides
            requestAnimationFrame(animate)
        }

        animate()
    }

    private setupBillboard() {
        // Create text sprite for hover information
        this.createInfoSprite()
    }

    private createInfoSprite() {
        // Create canvas for text
        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d")
        if (!context) return

        // Set canvas size
        canvas.width = 512
        canvas.height = 256

        // Style the text
        context.fillStyle = "rgba(0, 0, 0, 0.8)"
        context.fillRect(0, 0, canvas.width, canvas.height)

        context.fillStyle = "#ffffff"
        context.font = "bold 24px Arial"
        context.textAlign = "center"

        // Draw brand name
        context.fillText(this.location.brand_name, canvas.width / 2, 50)

        // Draw title
        context.font = "18px Arial"
        context.fillText(this.location.title, canvas.width / 2, 80)

        // Draw description (word wrap)
        context.font = "14px Arial"
        const words = this.location.description.split(" ")
        let line = ""
        let y = 110
        const maxWidth = 480
        const lineHeight = 20

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + " "
            const metrics = context.measureText(testLine)
            const testWidth = metrics.width

            if (testWidth > maxWidth && n > 0) {
                context.fillText(line, canvas.width / 2, y)
                line = words[n] + " "
                y += lineHeight
            } else {
                line = testLine
            }

            // Limit to 3 lines
            if (y >= 150) break
        }
        context.fillText(line, canvas.width / 2, y)

        // Draw collection info
        context.fillStyle = "#ffff00"
        context.font = "12px Arial"
        context.fillText(`Remaining: ${this.location.collection_limit_remaining}`, canvas.width / 2, y + 30)

        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas)

        // Create sprite material
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0,
        })

        // Create sprite
        this.textSprite = new THREE.Sprite(spriteMaterial)
        this.textSprite.scale.set(10, 5, 1)
        this.textSprite.position.set(0, 8, 0) // Position above the coin
        this.textSprite.visible = false

        this.billboardGroup.add(this.textSprite)
    }

    public getMesh(): THREE.Mesh {
        return this.mesh
    }

    public getBillboardGroup(): THREE.Group {
        return this.billboardGroup
    }

    public showCard(camera: THREE.Camera) {
        if (!this.textSprite || this.isHovered) return

        this.isHovered = true
        this.textSprite.visible = true

        // Make billboard face the camera
        this.textSprite.lookAt(camera.position)

        // Animate card appearance
        const material = this.textSprite.material
        const startOpacity = 0
        const endOpacity = 0.95
        const duration = 300
        const startTime = Date.now()

        const animate = () => {
            const elapsed = Date.now() - startTime
            const progress = Math.min(elapsed / duration, 1)

            material.opacity = startOpacity + (endOpacity - startOpacity) * progress

            if (progress < 1) {
                requestAnimationFrame(animate)
            }
        }

        animate()
    }

    public hideCard() {
        if (!this.textSprite || !this.isHovered) return

        this.isHovered = false

        // Animate card disappearance
        const material = this.textSprite.material
        const startOpacity = material.opacity
        const endOpacity = 0
        const duration = 200
        const startTime = Date.now()

        const animate = () => {
            const elapsed = Date.now() - startTime
            const progress = Math.min(elapsed / duration, 1)

            material.opacity = startOpacity + (endOpacity - startOpacity) * progress

            if (progress < 1) {
                requestAnimationFrame(animate)
            } else {
                this.textSprite!.visible = false
            }
        }

        animate()
    }

    public updateBillboard(camera: THREE.Camera) {
        if (this.isHovered && this.textSprite) {
            // Keep billboard facing camera
            this.textSprite.lookAt(camera.position)
        }
    }

    public getLocation(): ConsumedLocation {
        return this.location
    }

    public isCardVisible(): boolean {
        return this.isHovered
    }

    public dispose() {
        // Clean up geometries and materials
        this.mesh.geometry.dispose()

        if (Array.isArray(this.mesh.material)) {
            this.mesh.material.forEach((material) => material.dispose())
        } else {
            this.mesh.material.dispose()
        }

        if (this.textSprite) {
            this.textSprite.geometry.dispose()
                ; (this.textSprite.material as THREE.Material).dispose()
        }
    }
}
