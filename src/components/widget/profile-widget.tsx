"use client"

import Image from "next/image"
import Link from "next/link"
import { CheckCircle2, Globe, Twitter, Instagram, Calendar, Camera, Edit } from "lucide-react"
import { useState } from "react"
import { Button } from "~/components/shadcn/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/shadcn/ui/dropdown-menu"
import { Input } from "~/components/shadcn/ui/input"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { toast } from "~/components/shadcn/ui/use-toast"

interface ProfileWidgetProps {
    editMode?: boolean
    profileEditMode?: boolean
}

// Mock data
const CREATOR_DATA = {
    id: "creator-123",
    name: "Alex Rivera",
    bio: "Digital artist specializing in abstract art and NFT collections. Creating at the intersection of art and technology.",
    website: "https://alexrivera.art",
    twitter: "alexriveraart",
    instagram: "alexrivera.art",
    profileUrl: "/placeholder.svg?height=200&width=200",
    approved: true,
    joinedAt: "2023-01-15T00:00:00.000Z",
}

export default function ProfileWidget({ editMode, profileEditMode }: ProfileWidgetProps) {
    const [profilePosition, setProfilePosition] = useState<"left" | "center" | "right">("center")
    const [isEditingProfile, setIsEditingProfile] = useState(false)
    const [editedProfile, setEditedProfile] = useState({
        name: CREATOR_DATA.name,
        bio: CREATOR_DATA.bio,
    })

    // Add functions to handle profile editing
    const handleSaveProfile = () => {
        // In a real app, this would save to the backend
        setIsEditingProfile(false)

        // Show success message
        toast({
            title: "Profile updated",
            description: "Your profile information has been updated successfully.",
        })
    }

    const handleCancelEditProfile = () => {
        setEditedProfile({
            name: CREATOR_DATA.name,
            bio: CREATOR_DATA.bio,
        })
        setIsEditingProfile(false)
    }

    return (
        <div className="h-full p-4 flex flex-col" >
            {(editMode ?? profileEditMode) && (
                <div className="mb-4 flex justify-end" >
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild >
                            <Button variant="outline" size="sm" >
                                Profile Position
                            </Button>
                        </DropdownMenuTrigger>
                        < DropdownMenuContent >
                            <DropdownMenuItem onClick={() => setProfilePosition("left")}> Left </DropdownMenuItem>
                            < DropdownMenuItem onClick={() => setProfilePosition("center")
                            }> Center </DropdownMenuItem>
                            < DropdownMenuItem onClick={() => setProfilePosition("right")}> Right </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}

            <div className={`flex flex-col items-${profilePosition}`}>
                {/* Profile Image */}
                < div className="relative" >
                    <div className="h-20 w-20 rounded-full overflow-hidden border-4 border-background shadow-xl" >
                        <Image
                            src={CREATOR_DATA.profileUrl ?? "/placeholder.svg"}
                            alt={isEditingProfile ? editedProfile.name : CREATOR_DATA.name}
                            width={80}
                            height={80}
                            className="h-full w-full object-cover"
                        />
                    </div>

                    {
                        CREATOR_DATA.approved && (
                            <div className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1 shadow-lg" >
                                <CheckCircle2 className="h-4 w-4" />
                            </div>
                        )
                    }

                    {
                        (editMode ?? profileEditMode) && (
                            <Button variant="secondary" size="sm" className="absolute -bottom-2 -right-2 h-7 w-7 p-0 rounded-full" >
                                <Camera className="h-3 w-3" />
                            </Button>
                        )
                    }
                </div>

                {
                    isEditingProfile ?? profileEditMode ? (
                        <div className="w-full mt-3 space-y-2" >
                            <Input
                                value={editedProfile.name}
                                onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })
                                }
                                className="text-center"
                            />
                            <Textarea
                                value={editedProfile.bio}
                                onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                                className="resize-none text-center"
                                rows={3}
                            />
                            {profileEditMode && (
                                <div className="flex gap-2" >
                                    <Button variant="outline" size="sm" onClick={handleCancelEditProfile} className="flex-1" >
                                        Cancel
                                    </Button>
                                    < Button size="sm" onClick={handleSaveProfile} className="flex-1" >
                                        Save
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <h2
                                className={`text-xl font-bold mt-3 flex items-center ${profilePosition === "center" ? "justify-center" : profilePosition === "right" ? "justify-end" : "justify-start"} gap-1`}
                            >
                                {editedProfile.name}
                                {CREATOR_DATA.approved && <CheckCircle2 className="h-4 w-4 text-primary" />}
                            </h2>
                            < p className="mt-1 text-sm text-muted-foreground line-clamp-2" > {editedProfile.bio} </p>
                            {
                                (editMode ?? profileEditMode) && (
                                    <Button size="sm" variant="ghost" onClick={() => setIsEditingProfile(true)
                                    } className="mt-2" >
                                        <Edit className="h-4 w-4 mr-1" />
                                        Edit Profile
                                    </Button>
                                )}
                        </>
                    )}
            </div>

            < div className="mt-4 space-y-2 flex-1" >
                {
                    CREATOR_DATA.website && (
                        <div>
                            <Link
                                href={CREATOR_DATA.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
                            >
                                <Globe className="h-4 w-4 mr-2" />
                                <span className="truncate" > {CREATOR_DATA.website.replace(/(^\w+:|^)\/\//, "")} </span>
                            </Link>
                        </div>
                    )}
                {
                    CREATOR_DATA.twitter && (
                        <div>
                            <Link
                                href={`https://twitter.com/${CREATOR_DATA.twitter}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center text-sm text-muted-foreground hover:text-[#1DA1F2] transition-colors"
                            >
                                <Twitter className="h-4 w-4 mr-2" />
                                <span className="truncate" > @{CREATOR_DATA.twitter} </span>
                            </Link>
                        </div>
                    )
                }
                {
                    CREATOR_DATA.instagram && (
                        <div>
                            <Link
                                href={`https://instagram.com/${CREATOR_DATA.instagram}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center text-sm text-muted-foreground hover:text-[#E1306C] transition-colors"
                            >
                                <Instagram className="h-4 w-4 mr-2" />
                                <span className="truncate" > @{CREATOR_DATA.instagram} </span>
                            </Link>
                        </div>
                    )
                }

                <div className="flex items-center text-sm text-muted-foreground" >
                    <Calendar className="h-4 w-4 mr-2" />
                    <span>Joined {new Date(CREATOR_DATA.joinedAt).toLocaleDateString()} </span>
                </div>
            </div>
        </div>
    )
}
