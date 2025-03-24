"use client"

import { useState, useEffect } from "react"

/**
 * Hook to detect if the current device is a mobile device
 * @param breakpoint - The maximum width in pixels to consider as a mobile device (default: 768)
 * @returns boolean indicating if the current device is a mobile device
 */
export function useMobile(breakpoint = 768): boolean {
    const [isMobile, setIsMobile] = useState<boolean>(false)

    useEffect(() => {
        // Function to check if device is mobile
        const checkMobile = () => {
            // Check screen width
            const isMobileByWidth = window.innerWidth < breakpoint

            // Optionally check user agent for mobile devices
            const isMobileByAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

            // Consider a device mobile if either condition is true
            // You can adjust this logic based on your specific needs
            setIsMobile(isMobileByWidth || isMobileByAgent)
        }

        // Check immediately on mount
        checkMobile()

        // Add event listener for window resize
        window.addEventListener("resize", checkMobile)

        // Cleanup event listener on unmount
        return () => {
            window.removeEventListener("resize", checkMobile)
        }
    }, [breakpoint])

    return isMobile
}

