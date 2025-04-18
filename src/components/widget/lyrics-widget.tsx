"use client"

import { useState } from "react"
import { Music } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/shadcn/ui/select"
import { ScrollArea } from "~/components/shadcn/ui/scroll-area"
import { JsonValue } from "@prisma/client/runtime/library"
import { Theme } from "~/types/organization/dashboard"

interface LyricsWidgetProps {
    editMode?: boolean
    theme?: Theme
}

// Sample songs with lyrics
const SONGS = [
    {
        id: "song-1",
        title: "Cosmic Dreams",
        album: "Digital Horizons",
        year: "2025",
        lyrics: `Verse 1:
Floating through the endless night
Stars around me burning bright
Memories fade into the void
As new worlds are being destroyed

Chorus:
Cosmic dreams, take me away
Beyond the stars, beyond the day
Cosmic dreams, show me the light
Guide me through this endless night

Verse 2:
Planets spinning in the dark
Galaxies leave their mark
Time is bending, space is too
Nothing's old and nothing's new

(Chorus)

Bridge:
The universe expands within my mind
Leaving reality far behind
Dimensions shift and realities blend
On this journey that never ends

(Chorus x2)

Outro:
Cosmic dreams...`,
    },
    {
        id: "song-2",
        title: "Digital Horizon",
        album: "Digital Horizons",
        year: "2025",
        lyrics: `Verse 1:
Pixels form the edge of sight
Binary code turns dark to light
The future's here but not quite clear
As virtual worlds begin to appear

Chorus:
Standing at the digital horizon
Where code and consciousness are rising
Digital horizon, blurring every line
Between the human and the divine

Verse 2:
Networks span across the globe
Connecting minds, a digital robe
Information flows like streams
Powering our electric dreams

(Chorus)

Bridge:
We built this world with ones and zeros
Created villains, created heroes
But who controls this vast creation?
When algorithms rule the nation

(Chorus x2)

Outro:
The horizon calls...`,
    },
    {
        id: "song-3",
        title: "Neon Memories",
        album: "Digital Horizons",
        year: "2025",
        lyrics: `Verse 1:
City lights reflect in rain
Glowing signs ease the pain
Memories stored in electric form
Shelter me from the storm

Chorus:
Neon memories light the way
Guiding me through night and day
Neon memories never fade
Bright colors that refuse to gray

Verse 2:
Holographic billboards shine
Promising worlds so divine
But underneath the gleaming glow
Lies a truth we all should know

(Chorus)

Bridge:
The past is stored in circuits now
Replayed and changed, we don't know how
Are memories real if they can change?
As our minds are rearranged

(Chorus x2)

Outro:
Memories in neon light...`,
    },
]

export default function LyricsWidget({ editMode, theme }: LyricsWidgetProps) {
    const [selectedSong, setSelectedSong] = useState(SONGS[0]?.id ?? "")
    const [showChords, setShowChords] = useState(false)

    const song = SONGS.find((s) => s.id === selectedSong) ?? SONGS[0]

    return (
        <div className="h-full flex flex-col p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold"
                // style={{ fontFamily: theme?.font?.heading || "inherit" }}
                >
                    Lyrics
                </h3>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant={showChords ? "default" : "outline"} onClick={() => setShowChords(!showChords)}>
                        {showChords ? "Hide Chords" : "Show Chords"}
                    </Button>
                    <Select value={selectedSong} onValueChange={setSelectedSong}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select a song" />
                        </SelectTrigger>
                        <SelectContent>
                            {SONGS.map((song) => (
                                <SelectItem key={song.id} value={song.id}>
                                    {song.title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="bg-muted/20 p-4 rounded-lg mb-4">
                <div className="flex items-center gap-2">
                    <Music className="h-5 w-5 text-primary" />
                    <div>
                        <h4 className="font-bold">{song?.title ?? "Unknown Title"}</h4>
                        <p className="text-sm text-muted-foreground">
                            {song?.album} ({song?.year})
                        </p>
                    </div>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="whitespace-pre-line font-mono text-sm">{song?.lyrics}</div>
            </ScrollArea>
        </div>
    )
}
