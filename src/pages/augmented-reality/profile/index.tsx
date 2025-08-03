"use client"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useQuery } from "@tanstack/react-query"
import { Copy, Globe, LogOut, RotateCcw, Trash, User, Settings, Shield } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Switch } from "~/components/shadcn/ui/switch"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/shadcn/ui/dialog"
import { ScrollArea } from "~/components/shadcn/ui/scroll-area"
import { useAccountAction } from "~/lib/state/augmented-reality/useAccountAction"

import { BASE_URL } from "~/lib/common"
import { addrShort } from "~/utils/utils"

import { signOut } from "next-auth/react"
import { useWalkThrough } from "~/hooks/useWalkthrough"
import { getTokenUser } from "~/lib/augmented-reality/get-token-user"
import Loading from "~/components/common/loading"
import { Walkthrough } from "~/components/common/walkthrough"


type ButtonLayout = {
    x: number
    y: number
    width: number
    height: number
}

export default function SettingScreen() {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [showWalkthrough, setShowWalkthrough] = useState(false)
    const [buttonLayouts, setButtonLayouts] = useState<ButtonLayout[]>([])
    const router = useRouter()
    const { data: pinMode, setData } = useAccountAction()
    const { data: walkthroughData, setData: setWalkThroughData } = useWalkThrough()

    const visitButtonRef = useRef<HTMLButtonElement>(null)
    const autoCollectButtonRef = useRef<HTMLButtonElement>(null)
    const resetTutorialButtonRef = useRef<HTMLButtonElement>(null)
    const deleteDataButtonRef = useRef<HTMLButtonElement>(null)
    const signOutButtonRef = useRef<HTMLButtonElement>(null)

    const { data, isLoading, error } = useQuery({
        queryKey: ["currentUserInfo"],
        queryFn: getTokenUser,
    })

    const steps = [
        {
            target: buttonLayouts[0],
            title: "Visit app.action-tokens.com",
            content: "Click here to visit our website and explore our services.",
        },
        {
            target: buttonLayouts[1],
            title: "Auto Collection",
            content:
                "Enable Auto Collection to automatically collect eligible pins. All pins set for auto collection will be gathered when you're within collecting distance, but all manual pins must still be collected through AR mode.",
        },
        {
            target: buttonLayouts[2],
            title: "Reset Tutorial",
            content: "Click here to restart the tutorial and view it again.",
        },
        {
            target: buttonLayouts[3],
            title: "Delete Data",
            content:
                "Press this button to delete your account. A request will be sent to our support team and your account will be permanently deleted.",
        },
        {
            target: buttonLayouts[4],
            title: "Sign Out",
            content: "Click here to log out of your Action Tokens account.",
        },
    ]

    const resetTutorial = () => {
        localStorage.setItem("isFirstSignIn", "true")
        setShowWalkthrough(true)
        setWalkThroughData({
            showWalkThrough: true,
        })
    }

    const deleteData = async () => {
        try {
            const response = await fetch(new URL("api/game/user/delete-user", BASE_URL).toString(), {
                method: "GET",
                credentials: "include",
            })

            if (!response.ok) {
                toast.error("Error deleting")
            }

            await response.json()
            toast.success("Data deleted successfully")
            setShowDeleteDialog(false)
        } catch (error) {
            console.error("Error deleting user:", error)
            throw error
        }
    }

    const togglePinCollectionMode = () => {
        setData({
            ...pinMode,
            mode: !pinMode.mode,
        })
        console.log(`Pin Collection Mode set to: ${!pinMode.mode ? "Auto Collect" : "Manual Collect"}`)
    }

    useLayoutEffect(() => {
        const updateButtonLayouts = () => {
            const visitButton = visitButtonRef.current
            const autoCollectButton = autoCollectButtonRef.current
            const resetTutorialButton = resetTutorialButtonRef.current
            const deleteDataButton = deleteDataButtonRef.current
            const signOutButton = signOutButtonRef.current

            if (visitButton && autoCollectButton && resetTutorialButton && deleteDataButton && signOutButton) {
                const visitRect = visitButton.getBoundingClientRect()
                const autoCollectRect = autoCollectButton.getBoundingClientRect()
                const resetTutorialRect = resetTutorialButton.getBoundingClientRect()
                const deleteDataRect = deleteDataButton.getBoundingClientRect()
                const signOutRect = signOutButton.getBoundingClientRect()

                setButtonLayouts([
                    {
                        x: visitRect.x,
                        y: visitRect.y,
                        width: visitRect.width,
                        height: visitRect.height,
                    },
                    {
                        x: autoCollectRect.x,
                        y: autoCollectRect.y,
                        width: autoCollectRect.width,
                        height: autoCollectRect.height,
                    },
                    {
                        x: resetTutorialRect.x,
                        y: resetTutorialRect.y,
                        width: resetTutorialRect.width,
                        height: resetTutorialRect.height,
                    },
                    {
                        x: deleteDataRect.x,
                        y: deleteDataRect.y,
                        width: deleteDataRect.width,
                        height: deleteDataRect.height,
                    },
                    {
                        x: signOutRect.x,
                        y: signOutRect.y,
                        width: signOutRect.width,
                        height: signOutRect.height,
                    },
                ])
            }
        }

        const observer = new MutationObserver(() => {
            updateButtonLayouts()
        })

        observer.observe(document.body, { childList: true, subtree: true })
        updateButtonLayouts()

        return () => {
            observer.disconnect()
        }
    }, [])

    const checkFirstTimeSignIn = async () => {
        if (walkthroughData.showWalkThrough) {
            setShowWalkthrough(true)
        } else {
            setShowWalkthrough(false)
        }
    }

    useEffect(() => {
        checkFirstTimeSignIn()
    }, [walkthroughData])

    if (isLoading) return <Loading />
    if (error) return <div>Error: {(error as Error).message}</div>
    if (!data) return null

    return (
        <>
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
                {/* Compact Header */}
                <div className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-700/50">
                    <div className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                                <Settings className="h-4 w-4 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h1>
                            </div>
                        </div>
                    </div>
                </div>

                <ScrollArea className="h-full">
                    <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
                        {/* Compact Profile Card */}
                        <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-lg">
                            <CardContent className="p-4">
                                <div className="flex items-center space-x-3">
                                    <div className="relative">
                                        <Image
                                            src={data.image ?? "https://app.action-tokens.com/images/icons/avatar-icon.png"}
                                            alt="Profile"
                                            width={56}
                                            height={56}
                                            className="rounded-xl shadow-md"
                                        />
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-slate-800"></div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">{data.name}</h2>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{data.email}</p>
                                        <div className="flex items-center space-x-1 mt-1">
                                            <User className="h-3 w-3 text-slate-500" />
                                            <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                                                {addrShort(data.id, 4)}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-5 w-5 p-0"
                                                onClick={async () => {
                                                    await navigator.clipboard.writeText(data.id)
                                                    toast.success("Copied!")
                                                }}
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Compact Actions Card */}
                        <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-lg">
                            <CardContent className="p-4 space-y-3">
                                {/* Website Button */}
                                <Button
                                    ref={visitButtonRef}
                                    className="w-full h-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl text-sm"
                                    onClick={() => window.open("https://app.action-tokens.com", "_blank")}
                                >
                                    <Globe className="mr-2 h-4 w-4" />
                                    Visit app.action-tokens.com
                                </Button>

                                {/* Auto Collection Toggle */}
                                <div className="flex items-center justify-between p-3 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
                                    <div>
                                        <p className="font-medium text-slate-900 dark:text-white text-sm">Auto Collection</p>
                                        <p className="text-xs text-slate-600 dark:text-slate-400">Auto collect pins</p>
                                    </div>
                                    <Switch
                                        ref={autoCollectButtonRef}
                                        checked={pinMode.mode}
                                        onCheckedChange={togglePinCollectionMode}
                                        className="data-[state=checked]:bg-violet-500"
                                    />
                                </div>

                                {/* Action Buttons */}
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        ref={resetTutorialButtonRef}
                                        variant="outline"
                                        className="h-10 text-xs font-medium rounded-xl bg-transparent border-slate-200 dark:border-slate-700"
                                        onClick={() => resetTutorial()}
                                    >
                                        <RotateCcw className="mr-1 h-3 w-3" />
                                        Reset Tutorial
                                    </Button>

                                    <Button
                                        ref={deleteDataButtonRef}
                                        variant="outline"
                                        className="h-10 text-xs font-medium rounded-xl bg-transparent border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
                                        onClick={() => setShowDeleteDialog(true)}
                                    >
                                        <Trash className="mr-1 h-3 w-3" />
                                        Delete Data
                                    </Button>
                                </div>

                                {/* Sign Out Button */}
                                <Button
                                    ref={signOutButtonRef}
                                    className="w-full h-10 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-medium rounded-xl text-sm"
                                    onClick={async () =>
                                        await signOut({
                                            redirect: false,
                                        })
                                    }
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Sign Out
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </ScrollArea >

                {/* Compact Delete Dialog */}
                < Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} >
                    <DialogContent className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-0 shadow-xl max-w-sm">
                        <DialogHeader>
                            <DialogTitle className="flex items-center space-x-2 text-slate-900 dark:text-white text-lg">
                                <Shield className="h-4 w-4 text-red-500" />
                                <span>Delete Account</span>
                            </DialogTitle>
                            <DialogDescription className="text-sm text-slate-600 dark:text-slate-400">
                                This will permanently delete all your data. This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex-row space-x-2 justify-end">
                            <Button
                                variant="outline"
                                onClick={() => setShowDeleteDialog(false)}
                                className="rounded-lg text-sm"
                                size="sm"
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={deleteData}
                                className="rounded-lg bg-gradient-to-r from-red-600 to-rose-600 text-sm"
                                size="sm"
                            >
                                Delete
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog >

                {showWalkthrough && <Walkthrough steps={steps} onFinish={() => setShowWalkthrough(false)} />
                }
            </div >
        </>
    )
}
