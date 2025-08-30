"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

interface PlayerContextType {
    isPlayerVisible: boolean
    currentSong: {
        title: string
        artist: string
        thumbnail?: string
        url?: string
    } | null
    showPlayer: (
        songTitle: string,
        artistName: string,
        url?: string,
        thumbnail?: string,
    ) => void
    hidePlayer: () => void
}

const BottomPlayerContext = createContext<PlayerContextType | undefined>(undefined)

export function BottomPlayerProvider({ children }: { children: ReactNode }) {
    const [isPlayerVisible, setIsPlayerVisible] = useState(false)
    console.log("isPlayerVisible", isPlayerVisible)
    const [currentSong, setCurrentSong] = useState<{
        title: string
        artist: string
        thumbnail?: string
        url?: string
    } | null>(null)

    const showPlayer = (
        songTitle: string,
        artistName: string,
        url?: string,
        thumbnail?: string,
    ) => {
        setCurrentSong({
            title: songTitle,
            artist: artistName,
            thumbnail: thumbnail,
            url: url,
        })
        setIsPlayerVisible(true)
    }

    const hidePlayer = () => {
        setIsPlayerVisible(false)
        setCurrentSong(null)
    }

    return (
        <BottomPlayerContext.Provider
            value={{
                isPlayerVisible,
                currentSong,
                showPlayer,
                hidePlayer,
            }}
        >
            {children}
        </BottomPlayerContext.Provider>
    )
}

export function useBottomPlayer() {
    const context = useContext(BottomPlayerContext)
    if (context === undefined) {
        throw new Error("useBottomPlayer must be used within a BottomPlayerProvider")
    }
    return context
}
