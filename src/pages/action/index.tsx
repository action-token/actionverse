"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function AugmentedRealityPage() {
    const router = useRouter()

    useEffect(() => {
        // Redirect to the home page immediately when component mounts
        router.push("/action/home")
    }, [router])

    // Return a loading state while redirecting
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Redirecting to AR experience...</p>
            </div>
        </div>
    )
}
