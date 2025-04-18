"use client"

import Image from "next/image"
import { Instagram, Twitter, Globe } from "lucide-react"
import { Card } from "~/components/shadcn/ui/card"
import { Button } from "~/components/shadcn/ui/button"
import { JsonValue } from "@prisma/client/runtime/library"
import { Theme } from "~/types/organization/dashboard"

interface BandMembersWidgetProps {
    editMode?: boolean
    theme?: Theme
}

// Sample band members
const BAND_MEMBERS = [
    {
        id: "member-1",
        name: "Alex Rivera",
        role: "Lead Vocals / Guitar",
        bio: "Founder and creative force behind the band's unique sound.",
        image: "/placeholder.svg?height=300&width=300",
        social: {
            instagram: "alexrivera",
            twitter: "alexrivera",
            website: "https://example.com",
        },
    },
    {
        id: "member-2",
        name: "Jamie Chen",
        role: "Bass / Backing Vocals",
        bio: "Brings the groove and depth to every track.",
        image: "/placeholder.svg?height=300&width=300",
        social: {
            instagram: "jamiechen",
            twitter: "jamiechen",
        },
    },
    {
        id: "member-3",
        name: "Taylor Morgan",
        role: "Drums / Percussion",
        bio: "The rhythmic heartbeat of the band since day one.",
        image: "/placeholder.svg?height=300&width=300",
        social: {
            instagram: "taylormorgan",
        },
    },
    {
        id: "member-4",
        name: "Jordan Lee",
        role: "Keyboards / Synth",
        bio: "Creates the atmospheric layers that define our sound.",
        image: "/placeholder.svg?height=300&width=300",
        social: {
            twitter: "jordanlee",
            website: "https://example.com",
        },
    },
]

export default function BandMembersWidget({ editMode, theme }: BandMembersWidgetProps) {
    return (
        <div className="h-full flex flex-col p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold"
                //  style={{ fontFamily: theme?.font?.heading || "inherit" }}
                >
                    Meet the Band
                </h3>
            </div>

            <div className="flex-1 overflow-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {BAND_MEMBERS.map((member) => (
                        <Card
                            key={member.id}
                            className="overflow-hidden flex flex-col"
                        // style={{
                        //     borderRadius: theme?.style?.borderRadius ? `${theme.style.borderRadius}px` : undefined,
                        //     borderWidth: theme?.style?.borderWidth ? `${theme.style.borderWidth}px` : undefined,
                        // }}
                        >
                            <div className="relative aspect-square">
                                <Image src={member.image || "/placeholder.svg"} alt={member.name} fill className="object-cover" />
                            </div>
                            <div className="p-3">
                                <h4 className="font-bold">{member.name}</h4>
                                <p className="text-sm text-muted-foreground">{member.role}</p>
                                <p className="text-sm mt-2 line-clamp-2">{member.bio}</p>

                                <div className="flex gap-2 mt-3">
                                    {member.social.instagram && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                            <a
                                                href={`https://instagram.com/${member.social.instagram}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <Instagram className="h-4 w-4" />
                                            </a>
                                        </Button>
                                    )}
                                    {member.social.twitter && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                            <a
                                                href={`https://twitter.com/${member.social.twitter}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <Twitter className="h-4 w-4" />
                                            </a>
                                        </Button>
                                    )}
                                    {member.social.website && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                            <a href={member.social.website} target="_blank" rel="noopener noreferrer">
                                                <Globe className="h-4 w-4" />
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    )
}
