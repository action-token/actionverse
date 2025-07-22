export interface QRItem {
    id: string
    title: string
    description: string
    modelUrl: string
    externalLink: string | null
    startDate: Date
    endDate: Date
    qrCode: string
    isActive: boolean
    creatorId: string
    createdAt: Date
    updatedAt: Date
}

export interface QRItemWithCreator extends QRItem {
    creator: {
        id: string
        name: string | null
        image: string | null
    }
}

export interface QRItemStats {
    total: number
    active: number
    expired: number
    upcoming: number
}

export interface CreateQRItemInput {
    title: string
    description: string
    modelUrl?: string
    externalLink?: string
    startDate: Date
    endDate: Date
}

export interface UpdateQRItemInput {
    id: string
    title?: string
    description?: string
    modelUrl?: string | null
    externalLink?: string | null
    startDate?: Date
    endDate?: Date
}

export interface QRCodeData {
    id: string
    title: string
    description: string
    modelUrl: string | null
    externalLink: string | null
    startDate: Date
    endDate: Date
    type: "qr-item"
}
