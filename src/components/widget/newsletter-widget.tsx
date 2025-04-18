"use client"

import type React from "react"

import { useState } from "react"
import { Check } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Checkbox } from "~/components/shadcn/ui/checkbox"
import { Label } from "~/components/shadcn/ui/label"
import { JsonValue } from "@prisma/client/runtime/library"
import { Theme } from "~/types/organization/dashboard"

interface NewsletterWidgetProps {
    editMode?: boolean
    theme?: Theme
}

export default function NewsletterWidget({ editMode, theme }: NewsletterWidgetProps) {
    const [email, setEmail] = useState("")
    const [subscribed, setSubscribed] = useState(false)
    const [loading, setLoading] = useState(false)
    const [preferences, setPreferences] = useState({
        newReleases: true,
        tourDates: true,
        exclusiveContent: true,
        merchandise: false,
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        // Simulate API call
        setTimeout(() => {
            setLoading(false)
            setSubscribed(true)
        }, 1000)
    }

    const togglePreference = (key: keyof typeof preferences) => {
        setPreferences({
            ...preferences,
            [key]: !preferences[key],
        })
    }

    return (
        <div className="h-full flex flex-col p-4">
            <div className="flex items-center mb-4">
                <h3 className="text-lg font-bold"
                // style={{ fontFamily: theme?.font?.heading || "inherit" }}
                >
                    Join the Newsletter
                </h3>
            </div>

            <div className="flex-1 flex flex-col justify-center">
                {subscribed ? (
                    <div className="text-center">
                        <div className="mx-auto bg-primary/10 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
                            <Check className="h-8 w-8 text-primary" />
                        </div>
                        <h4 className="text-xl font-bold mb-2">Thanks for subscribing!</h4>
                        <p className="text-muted-foreground">You{"'re"} now on the list to receive the latest updates from us.</p>
                        <Button variant="outline" className="mt-4" onClick={() => setSubscribed(false)}>
                            Update Preferences
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <p className="mb-4">Subscribe to get exclusive updates on new music, tour dates, and special offers.</p>
                            <div className="flex gap-2">
                                <Input
                                    type="email"
                                    placeholder="Your email address"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="flex-1"
                                />
                                <Button type="submit" disabled={loading}>
                                    {loading ? "Subscribing..." : "Subscribe"}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm font-medium">I{"'m"} interested in:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="new-releases"
                                        checked={preferences.newReleases}
                                        onCheckedChange={() => togglePreference("newReleases")}
                                    />
                                    <Label htmlFor="new-releases">New Releases</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="tour-dates"
                                        checked={preferences.tourDates}
                                        onCheckedChange={() => togglePreference("tourDates")}
                                    />
                                    <Label htmlFor="tour-dates">Tour Dates</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="exclusive-content"
                                        checked={preferences.exclusiveContent}
                                        onCheckedChange={() => togglePreference("exclusiveContent")}
                                    />
                                    <Label htmlFor="exclusive-content">Exclusive Content</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="merchandise"
                                        checked={preferences.merchandise}
                                        onCheckedChange={() => togglePreference("merchandise")}
                                    />
                                    <Label htmlFor="merchandise">Merchandise</Label>
                                </div>
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            By subscribing, you agree to receive emails from us. You can unsubscribe at any time.
                        </p>
                    </form>
                )}
            </div>
        </div>
    )
}
