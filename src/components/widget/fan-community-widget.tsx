"use client"

import type React from "react"

import { useState } from "react"
import Image from "next/image"
import { Heart, MessageSquare, Share2, Send } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { ScrollArea } from "~/components/shadcn/ui/scroll-area"
import { JsonValue } from "@prisma/client/runtime/library"
import { Theme } from "~/types/organization/dashboard"

interface FanCommunityWidgetProps {
    editMode?: boolean
    theme?: Theme
}

// Sample fan posts
const FAN_POSTS = [
    {
        id: "post-1",
        user: {
            name: "MusicLover42",
            avatar: "/placeholder.svg?height=100&width=100",
        },
        content: "Just got my tickets for the LA show! Can't wait to see you guys live! 🎸🔥",
        image: "/placeholder.svg?height=400&width=600",
        likes: 24,
        comments: 5,
        time: "2 hours ago",
    },
    {
        id: "post-2",
        user: {
            name: "ConcertQueen",
            avatar: "/placeholder.svg?height=100&width=100",
        },
        content:
            "The new album is on repeat! 'Cosmic Dreams' is definitely my favorite track. What's everyone else loving?",
        image: null,
        likes: 18,
        comments: 12,
        time: "5 hours ago",
    },
    {
        id: "post-3",
        user: {
            name: "GuitarHero99",
            avatar: "/placeholder.svg?height=100&width=100",
        },
        content: "Tried to cover 'Digital Horizon' - still working on those solos! Any tips?",
        image: "/placeholder.svg?height=400&width=600",
        likes: 32,
        comments: 8,
        time: "1 day ago",
    },
]

// Sample fan questions
const FAN_QUESTIONS = [
    {
        id: "question-1",
        user: {
            name: "MusicTheory101",
            avatar: "/placeholder.svg?height=100&width=100",
        },
        question: "What tuning do you use for 'Neon Memories'?",
        answer: "We use drop D tuning for that one. It gives the riff that extra punch!",
        likes: 15,
        time: "3 days ago",
    },
    {
        id: "question-2",
        user: {
            name: "DrummerBoy",
            avatar: "/placeholder.svg?height=100&width=100",
        },
        question: "Will you be adding more tour dates in Europe?",
        answer: null,
        likes: 28,
        time: "1 day ago",
    },
    {
        id: "question-3",
        user: {
            name: "BassistFan",
            avatar: "/placeholder.svg?height=100&width=100",
        },
        question: "What bass guitar do you use in the studio?",
        answer: "For most tracks we use a Fender Precision Bass, but occasionally mix in a Rickenbacker for some songs.",
        likes: 12,
        time: "4 days ago",
    },
]

export default function FanCommunityWidget({ editMode, theme }: FanCommunityWidgetProps) {
    const [activeTab, setActiveTab] = useState("feed")
    const [newComment, setNewComment] = useState("")

    const handleSubmitComment = (e: React.FormEvent) => {
        e.preventDefault()
        // In a real app, this would submit the comment
        setNewComment("")
    }

    return (
        <div className="h-full flex flex-col p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold"
                // style={{ fontFamily: theme?.font?.heading || "inherit" }}
                >
                    Fan Community
                </h3>
                <Button size="sm" variant="outline" asChild>
                    <a href="#" target="_blank" rel="noopener noreferrer">
                        Join Community
                    </a>
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="feed">Fan Feed</TabsTrigger>
                    <TabsTrigger value="questions">Q&A</TabsTrigger>
                </TabsList>

                <TabsContent value="feed" className="flex-1 flex flex-col mt-4">
                    <ScrollArea className="flex-1">
                        <div className="space-y-4">
                            {FAN_POSTS.map((post) => (
                                <div key={post.id} className="border rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Avatar>
                                            <AvatarImage src={post.user.avatar || "/placeholder.svg"} alt={post.user.name} />
                                            <AvatarFallback>{post.user.name.substring(0, 2)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-medium">{post.user.name}</p>
                                            <p className="text-xs text-muted-foreground">{post.time}</p>
                                        </div>
                                    </div>

                                    <p className="mb-3">{post.content}</p>

                                    {post.image && (
                                        <div className="relative aspect-video mb-3 rounded-md overflow-hidden">
                                            <Image src={post.image || "/placeholder.svg"} alt="Fan post" fill className="object-cover" />
                                        </div>
                                    )}

                                    <div className="flex items-center gap-4">
                                        <Button variant="ghost" size="sm" className="gap-1">
                                            <Heart className="h-4 w-4" />
                                            <span>{post.likes}</span>
                                        </Button>
                                        <Button variant="ghost" size="sm" className="gap-1">
                                            <MessageSquare className="h-4 w-4" />
                                            <span>{post.comments}</span>
                                        </Button>
                                        <Button variant="ghost" size="sm" className="gap-1">
                                            <Share2 className="h-4 w-4" />
                                            <span>Share</span>
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>

                    <form onSubmit={handleSubmitComment} className="mt-4 flex gap-2">
                        <Input
                            placeholder="Add a comment..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="flex-1"
                        />
                        <Button type="submit" size="sm" disabled={!newComment.trim()}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </TabsContent>

                <TabsContent value="questions" className="flex-1 flex flex-col mt-4">
                    <ScrollArea className="flex-1">
                        <div className="space-y-4">
                            {FAN_QUESTIONS.map((item) => (
                                <div key={item.id} className="border rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Avatar>
                                            <AvatarImage src={item.user.avatar || "/placeholder.svg"} alt={item.user.name} />
                                            <AvatarFallback>{item.user.name.substring(0, 2)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-medium">{item.user.name}</p>
                                            <p className="text-xs text-muted-foreground">{item.time}</p>
                                        </div>
                                    </div>

                                    <p className="font-medium mb-2">{item.question}</p>

                                    {item.answer ? (
                                        <div className="bg-muted/30 p-3 rounded-md mb-3">
                                            <p className="text-sm font-medium mb-1">Answer from the band:</p>
                                            <p>{item.answer}</p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground mb-3">Waiting for an answer...</p>
                                    )}

                                    <div className="flex items-center">
                                        <Button variant="ghost" size="sm" className="gap-1">
                                            <Heart className="h-4 w-4" />
                                            <span>{item.likes}</span>
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>

                    <form onSubmit={handleSubmitComment} className="mt-4 flex gap-2">
                        <Input
                            placeholder="Ask a question..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="flex-1"
                        />
                        <Button type="submit" size="sm" disabled={!newComment.trim()}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </TabsContent>
            </Tabs>
        </div>
    )
}
