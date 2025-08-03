"use client"

import { useState, useEffect, useCallback } from "react"
import { MapPin, Settings, RefreshCw, AlertCircle } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Alert, AlertDescription } from "~/components/shadcn/ui/alert"

type LocationPermissionState = "prompt" | "granted" | "denied" | "loading" | "error"

interface LocationPermissionHandlerProps {
    onLocationGranted: (location: { lat: number; lng: number }) => void
    onLocationDenied: () => void
}

export function LocationPermissionHandler({ onLocationGranted, onLocationDenied }: LocationPermissionHandlerProps) {
    const [permissionState, setPermissionState] = useState<LocationPermissionState>("prompt")
    const [errorMessage, setErrorMessage] = useState<string>("")
    const [isRetrying, setIsRetrying] = useState(false)

    const getLocationErrorMessage = (error: GeolocationPositionError): string => {
        switch (error.code) {
            case GeolocationPositionError.PERMISSION_DENIED:
                return "Location access was denied. Please enable location access in your browser settings to use this feature."
            case GeolocationPositionError.POSITION_UNAVAILABLE:
                return "Location information is unavailable. Please check your GPS settings and internet connection."
            case GeolocationPositionError.TIMEOUT:
                return "Location request timed out. Please check your internet connection and try again."
            default:
                return "An unknown error occurred while retrieving your location."
        }
    }

    const requestLocationWithFallback = useCallback(async (): Promise<GeolocationPosition> => {
        const tryGetLocation = (options: PositionOptions): Promise<GeolocationPosition> => {
            return new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, options)
            })
        }

        // Progressive fallback strategy
        const strategies = [
            {
                name: "High Accuracy",
                options: {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0,
                },
            },
            {
                name: "Balanced",
                options: {
                    enableHighAccuracy: false,
                    timeout: 10000,
                    maximumAge: 60000, // 1 minute
                },
            },
            {
                name: "Permissive",
                options: {
                    enableHighAccuracy: false,
                    timeout: 15000,
                    maximumAge: 300000, // 5 minutes
                },
            },
        ]

        for (const strategy of strategies) {
            try {
                console.log(`Trying ${strategy.name} location strategy...`)
                const position = await tryGetLocation(strategy.options)
                console.log(`${strategy.name} strategy succeeded`)
                return position
            } catch (error) {
                console.log(`${strategy.name} strategy failed:`, error)
                if (strategy === strategies[strategies.length - 1]) {
                    throw error // Re-throw the last error
                }
            }
        }

        throw new Error("All location strategies failed")
    }, [])

    const requestLocationPermission = useCallback(async () => {
        setIsRetrying(true)
        setPermissionState("loading")
        setErrorMessage("")

        try {
            // Check if geolocation is supported
            if (!navigator.geolocation) {
                throw new Error("Geolocation is not supported by your browser")
            }

            // Check current permission status if available
            if (navigator.permissions) {
                try {
                    const permission = await navigator.permissions.query({ name: "geolocation" })

                    if (permission.state === "denied") {
                        setPermissionState("denied")
                        setErrorMessage("Location access is denied. Please enable location access in your browser settings.")
                        onLocationDenied()
                        return
                    }
                } catch (permissionError) {
                    console.log("Permission API not fully supported, continuing with geolocation request")
                }
            }

            // Attempt to get location with fallback strategies
            const position = await requestLocationWithFallback()

            console.log("Location obtained:", {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
            })

            setPermissionState("granted")
            onLocationGranted({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            })

            // Start watching position for updates
            navigator.geolocation.watchPosition(
                (position) => {
                    onLocationGranted({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    })
                },
                (error) => console.error("Location watch error:", error),
                {
                    enableHighAccuracy: false,
                    timeout: 30000,
                    maximumAge: 120000, // 2 minutes
                },
            )
        } catch (error) {
            console.error("Location error:", error)
            setPermissionState("error")

            if (error instanceof GeolocationPositionError) {
                const message = getLocationErrorMessage(error)
                setErrorMessage(message)

                if (error.code === GeolocationPositionError.PERMISSION_DENIED) {
                    onLocationDenied()
                }
            } else {
                setErrorMessage("An unknown error occurred while retrieving location.")
            }
        } finally {
            setIsRetrying(false)
        }
    }, [requestLocationWithFallback, onLocationGranted, onLocationDenied])

    // Auto-request permission on mount
    useEffect(() => {
        requestLocationPermission()
    }, [requestLocationPermission])

    const openLocationSettings = () => {
        // Provide instructions for different browsers
        const userAgent = navigator.userAgent.toLowerCase()
        let instructions = ""

        if (userAgent.includes("chrome")) {
            instructions =
                "Click the location icon in your address bar, or go to Settings > Privacy and security > Site Settings > Location"
        } else if (userAgent.includes("firefox")) {
            instructions =
                "Click the shield icon in your address bar, or go to Settings > Privacy & Security > Permissions > Location"
        } else if (userAgent.includes("safari")) {
            instructions = "Go to Safari > Settings > Websites > Location, or check your system preferences"
        } else {
            instructions = "Check your browser's location settings in the address bar or settings menu"
        }

        alert(`To enable location access:\n\n${instructions}\n\nThen refresh this page.`)
    }

    if (permissionState === "loading") {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-6">
                <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-2xl max-w-md w-full">
                    <CardContent className="p-8 text-center space-y-6">
                        <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 inline-block">
                            <MapPin className="h-12 w-12 text-blue-600 dark:text-blue-400 animate-pulse" />
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Getting Your Location</h2>
                            <p className="text-slate-600 dark:text-slate-400 mb-6">
                                Please allow location access when prompted, or check your GPS settings if this takes too long.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                <div
                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full animate-pulse"
                                    style={{ width: "60%" }}
                                />
                            </div>

                            <Button
                                onClick={requestLocationPermission}
                                variant="outline"
                                className="w-full h-12 rounded-2xl bg-transparent"
                                disabled={isRetrying}
                            >
                                {isRetrying ? (
                                    <>
                                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                        Retrying...
                                    </>
                                ) : (
                                    "Retry Location Request"
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (permissionState === "denied" || permissionState === "error") {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-6">
                <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-2xl max-w-md w-full">
                    <CardContent className="p-8 text-center space-y-6">
                        <div className="p-6 rounded-3xl bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/20 dark:to-rose-900/20 inline-block">
                            <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Location Access Required</h2>
                            <p className="text-slate-600 dark:text-slate-400 mb-6">
                                Actionverse AR needs your location to show nearby pins and provide the full augmented reality
                                experience.
                            </p>
                        </div>

                        {errorMessage && (
                            <Alert className="text-left">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription className="text-sm">{errorMessage}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-3">
                            <Button
                                onClick={requestLocationPermission}
                                className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-2xl"
                                disabled={isRetrying}
                            >
                                {isRetrying ? (
                                    <>
                                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                        Trying Again...
                                    </>
                                ) : (
                                    "Try Again"
                                )}
                            </Button>

                            <Button
                                onClick={openLocationSettings}
                                variant="outline"
                                className="w-full h-12 rounded-2xl bg-transparent"
                            >
                                <Settings className="h-4 w-4 mr-2" />
                                Location Settings Help
                            </Button>
                        </div>

                        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-2">
                            <p className="font-medium">Quick fixes:</p>
                            <ul className="text-left space-y-1">
                                <li>• Check if location is enabled in your browser</li>
                                <li>• Ensure GPS is turned on (mobile devices)</li>
                                <li>• Try refreshing the page</li>
                                <li>• Check your internet connection</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return null // Component doesn't render when permission is granted
}
