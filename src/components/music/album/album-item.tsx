"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Badge } from "~/components/shadcn/ui/badge"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Pin, Gem, Music, Star } from 'lucide-react'
import { addrShort } from "~/utils/utils"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"

interface AlbumViewProps {
    name?: string
    creatorId: string | null
    albumId: number
    coverImgUrl?: string
    isAlbum?: boolean
    creatorView?: boolean
}

export default function AlbumView({ name, creatorId, coverImgUrl, albumId, isAlbum = true, creatorView = false }: AlbumViewProps) {
    const router = useRouter()
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        setIsVisible(true)
    }, [])

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
        >
            <Card
                onClick={() =>
                    router.push(creatorView ? `/organization/music/album/${albumId}` : `/album/${albumId}`)
                }
                className="group relative overflow-hidden rounded-xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer"
            >
                <CardContent className="p-0 h-[211px] md:h-[270px] lg:h-[300px] w-full">
                    <div className="relative h-full w-full overflow-hidden">
                        {/* Subtle gradient overlay that enhances on hover */}
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" />

                        {/* Album cover image */}
                        <Image
                            fill
                            alt={name ?? "album"}
                            src={coverImgUrl ?? "/images/logo.png"}
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />

                        {/* NFT Badge with animation */}
                        {isAlbum && (
                            <div className="absolute top-2 right-2 z-20">
                                <motion.div
                                    animate={{
                                        boxShadow: ["0 0 0 rgba(255, 215, 0, 0)", "0 0 15px rgba(255, 215, 0, 0.7)", "0 0 0 rgba(255, 215, 0, 0)"]
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        repeatType: "loop"
                                    }}
                                >
                                    <Badge variant="secondary" className="bg-black/50 backdrop-blur-sm text-white border border-yellow-400">
                                        <Gem className="w-3 h-3 mr-1 text-yellow-400" /> ALBUM
                                    </Badge>
                                </motion.div>
                            </div>
                        )}



                        {/* Album info with gradient background */}
                        <div className="absolute inset-x-0 bottom-0 p-0">
                            <div className="rounded-b-xl bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 backdrop-blur-sm">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="truncate text-lg font-bold text-white">{name ?? "Untitled Album"}</p>
                                        <div className="flex items-center text-sm text-white/80">
                                            {creatorId ? addrShort(creatorId, 5) : "ADMIN"}
                                            <motion.div
                                                animate={{ rotate: [0, 15, 0, -15, 0] }}
                                                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
                                                className="ml-1"
                                            >
                                                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                            </motion.div>
                                        </div>
                                    </div>

                                    {/* Music icon with subtle animation */}
                                    <motion.div
                                        animate={{ scale: [1, 1.1, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="bg-primary p-1.5 rounded-full backdrop-blur-sm"
                                    >
                                        <Music className="w-4 h-4 " />
                                    </motion.div>
                                </div>

                                {/* Shimmer effect line */}
                                <div className="mt-2 h-0.5 w-full bg-white/20 rounded-full relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}
