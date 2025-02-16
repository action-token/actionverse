import Image from "next/image"
import { Badge } from "~/components/shadcn/ui/badge"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Pin, Gem } from "lucide-react"

interface AssetViewProps {
    code?: string
    thumbnail: string | null
    isNFT?: boolean
    isPinned?: boolean
}

export default function AssetView({ code, thumbnail, isNFT = true, isPinned = false }: AssetViewProps) {
    return (
        <Card className="group relative overflow-hidden rounded-xl  transition-all duration-300 hover:shadow-lg hover:shadow-primary/20">
            <CardContent className="p-0 h-[211px] md:h-[270px] lg:h-[300px] w-full">
                <div className="relative h-full w-full">
                    <Image
                        fill
                        alt={code ?? "asset"}
                        src={thumbnail ?? "/images/logo.png"}
                        className="object-cover transition-transform duration-300 group-hover:scale-105 "
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="absolute inset-x-0 bottom-1 left-1 right-1 p-0 border-2 rounded-xl">
                        <div className="rounded-lg bg-black/10 p-2 backdrop-blur-sm">
                            <p className="mb-2 truncate text-lg font-bold text-white">{code}</p>
                            <div className="flex gap-2">
                                {isPinned && (
                                    <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
                                        <Pin className="mr-1 h-3 w-3" />
                                        PIN
                                    </Badge>
                                )}
                                {isNFT && (
                                    <Badge variant="secondary" className="bg-primary text-primary-foreground">
                                        <Gem className="mr-1 h-3 w-3" />
                                        NFT
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

