import Image from "next/image"
import { Badge } from "~/components/shadcn/ui/badge"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Pin, Gem } from "lucide-react"
import { addrShort } from "~/utils/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface AlbumViewProps {
    name?: string
    creatorId: string | null
    albumId: number
    coverImgUrl?: string
    isNFT?: boolean
    isPinned?: boolean
}

export default function AlbumView({ name, creatorId, coverImgUrl, albumId }: AlbumViewProps) {

    const router = useRouter()
    return (
        <Card
            onClick={() => router.push(`/music/album/${albumId}`)}
            className="group relative overflow-hidden rounded-xl  transition-all duration-300 hover:shadow-lg hover:shadow-primary/20">
            <CardContent className="p-0 h-[211px] md:h-[270px] lg:h-[300px] w-full">
                <div className="relative h-full w-full">
                    <Image
                        fill
                        alt={name ?? "asset"}
                        src={coverImgUrl ?? "/images/logo.png"}
                        className="object-cover transition-transform duration-300 group-hover:scale-105 "
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="absolute inset-x-0 bottom-1 left-1 right-1 p-0 border-2 rounded-xl">
                        <div className="rounded-lg bg-black/10 p-2 backdrop-blur-sm">
                            <p className="truncate text-lg font-bold text-white">{name}</p>
                            <p className=" truncate text-sm font-bold text-white">{creatorId ? addrShort(creatorId, 5) : "ADMIN"}</p>


                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

    )
}

