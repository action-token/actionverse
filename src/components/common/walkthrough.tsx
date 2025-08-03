"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { X, ChevronLeft, ChevronRight, Check, Sparkles } from "lucide-react"
import { useWalkThrough } from "~/hooks/useWalkthrough"

type StepProps = {
    target?: {
        x: number
        y: number
        width: number
        height: number
    }
    title: string
    content: string
    isVisible?: boolean
    currentStep?: number
    totalSteps?: number
    onNext?: () => void
    onPrevious?: () => void
    onSkip?: () => void
    onFinish?: () => void
}

type WalkthroughProps = {
    steps: StepProps[]
    onFinish: () => void
}

const Step: React.FC<StepProps> = ({
    target,
    title,
    content,
    isVisible,
    currentStep,
    totalSteps,
    onNext,
    onPrevious,
    onSkip,
    onFinish,
}) => {
    const [position, setPosition] = useState<{
        top: number
        left: number
        placement: "top" | "bottom" | "left" | "right"
    }>()

    useEffect(() => {
        if (target && isVisible) {
            const { x, y, width, height } = target
            const centerX = x + width / 2
            const centerY = y + height / 2
            const cardWidth = 400
            const cardHeight = 320

            let top = 0
            let left = 0
            let placement: "top" | "bottom" | "left" | "right" = "bottom"

            // Determine best placement
            const spaceAbove = y
            const spaceBelow = window.innerHeight - (y + height)
            const spaceLeft = x
            const spaceRight = window.innerWidth - (x + width)

            if (spaceBelow >= cardHeight + 20) {
                // Place below
                placement = "bottom"
                top = y + height + 20
                left = centerX - cardWidth / 2
            } else if (spaceAbove >= cardHeight + 20) {
                // Place above
                placement = "top"
                top = y - cardHeight - 20
                left = centerX - cardWidth / 2
            } else if (spaceRight >= cardWidth + 20) {
                // Place right
                placement = "right"
                top = centerY - cardHeight / 2
                left = x + width + 20
            } else if (spaceLeft >= cardWidth + 20) {
                // Place left
                placement = "left"
                top = centerY - cardHeight / 2
                left = x - cardWidth - 20
            } else {
                // Default to bottom with viewport constraints
                placement = "bottom"
                top = y + height + 20
                left = centerX - cardWidth / 2
            }

            // Ensure the card stays within the viewport
            top = Math.max(20, Math.min(top, window.innerHeight - cardHeight - 20))
            left = Math.max(20, Math.min(left, window.innerWidth - cardWidth - 20))

            setPosition({ top, left, placement })
        }
    }, [target, isVisible])

    if (!isVisible || !position) return null

    const cardVariants = {
        hidden: {
            opacity: 0,
            scale: 0.8,
            y: position.placement === "top" ? 20 : position.placement === "bottom" ? -20 : 0,
            x: position.placement === "left" ? 20 : position.placement === "right" ? -20 : 0,
        },
        visible: {
            opacity: 1,
            scale: 1,
            y: 0,
            x: 0,
            transition: {
                type: "spring",
                stiffness: 300,
                damping: 30,
                duration: 0.4,
            },
        },
        exit: {
            opacity: 0,
            scale: 0.9,
            transition: {
                duration: 0.2,
            },
        },
    }

    const overlayVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { duration: 0.3 },
        },
        exit: {
            opacity: 0,
            transition: { duration: 0.2 },
        },
    }

    const highlightVariants = {
        hidden: {
            opacity: 0,
            scale: 0.95,
        },
        visible: {
            opacity: 1,
            scale: 1,
            transition: {
                duration: 0.4,
                ease: "easeOut",
            },
        },
        exit: {
            opacity: 0,
            scale: 0.95,
            transition: { duration: 0.2 },
        },
    }

    return (
        <motion.div
            className="fixed inset-0 z-50"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Spotlight effect */}
            {target && (
                <motion.div
                    className="absolute"
                    style={{
                        left: target.x - 10,
                        top: target.y - 10,
                        width: target.width + 20,
                        height: target.height + 20,
                    }}
                    variants={highlightVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                >
                    {/* Glowing border */}
                    <div className="absolute inset-0 rounded-lg border-2 border-white shadow-lg shadow-white/50" />

                    {/* Pulsing glow effect */}
                    <motion.div
                        className="absolute inset-0 rounded-lg border-2 border-blue-400"
                        animate={{
                            opacity: [0.5, 1, 0.5],
                            scale: [1, 1.02, 1],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "easeInOut",
                        }}
                    />

                    {/* Corner sparkles */}
                    <motion.div
                        className="absolute -top-1 -left-1"
                        animate={{
                            rotate: [0, 360],
                            scale: [1, 1.2, 1],
                        }}
                        transition={{
                            duration: 3,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "linear",
                        }}
                    >
                        <Sparkles className="w-4 h-4 text-yellow-400" />
                    </motion.div>

                    <motion.div
                        className="absolute -top-1 -right-1"
                        animate={{
                            rotate: [360, 0],
                            scale: [1, 1.2, 1],
                        }}
                        transition={{
                            duration: 3,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "linear",
                            delay: 1,
                        }}
                    >
                        <Sparkles className="w-4 h-4 text-blue-400" />
                    </motion.div>
                </motion.div>
            )}

            {/* Tutorial Card */}
            <motion.div
                className="absolute"
                style={{
                    top: position.top,
                    left: position.left,
                }}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
            >
                <Card className="w-[400px] shadow-2xl border-0 bg-gradient-to-br from-white via-white to-blue-50/50 backdrop-blur-sm">
                    {/* Progress bar */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 rounded-t-lg overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                            initial={{ width: 0 }}
                            animate={{
                                width: `${((currentStep! + 1) / totalSteps!) * 100}%`,
                            }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                    </div>

                    {/* Close button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-3 right-3 h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 transition-colors"
                        onClick={onFinish}
                    >
                        <X className="h-4 w-4" />
                    </Button>

                    <CardHeader className="pb-4 pt-6">
                        <div className="flex items-center gap-2">
                            <motion.div
                                className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
                            >
                                {currentStep! + 1}
                            </motion.div>
                            <CardTitle className="text-xl font-semibold text-gray-800">{title}</CardTitle>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                            Step {currentStep! + 1} of {totalSteps}
                        </div>
                    </CardHeader>

                    <CardContent className="pb-6">
                        <motion.p
                            className="text-gray-700 leading-relaxed"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.3 }}
                        >
                            {content}
                        </motion.p>
                    </CardContent>

                    <CardFooter className="flex justify-between items-center pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                            {Array.from({ length: totalSteps! }).map((_, index) => (
                                <motion.div
                                    key={index}
                                    className={`w-2 h-2 rounded-full transition-colors ${index <= currentStep! ? "bg-gradient-to-r from-blue-500 to-purple-500" : "bg-gray-300"
                                        }`}
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: index * 0.1 }}
                                />
                            ))}
                        </div>

                        <div className="flex gap-2">
                            {currentStep! > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onPrevious}
                                    className="hover:bg-gray-50 transition-colors bg-transparent"
                                >
                                    <ChevronLeft className="w-4 h-4 mr-1" />
                                    Previous
                                </Button>
                            )}

                            {currentStep! < totalSteps! - 1 ? (
                                <Button
                                    onClick={onNext}
                                    size="sm"
                                    className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-md hover:shadow-lg"
                                >
                                    Next
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            ) : (
                                <Button
                                    onClick={onSkip}
                                    size="sm"
                                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 transition-all duration-200 shadow-md hover:shadow-lg"
                                >
                                    <Check className="w-4 h-4 mr-1" />
                                    Finish
                                </Button>
                            )}
                        </div>
                    </CardFooter>
                </Card>
            </motion.div>
        </motion.div>
    )
}

export const Walkthrough: React.FC<WalkthroughProps> = ({ steps, onFinish }) => {
    const [currentStep, setCurrentStep] = useState(0)
    const [showWalkthrough, setShowWalkthrough] = useState(true)
    const { data, setData } = useWalkThrough()

    const onStop = () => {
        if (typeof window !== "undefined") {
            localStorage.setItem("isFirstSignIn", "false")
            setData({ showWalkThrough: false })
        }
        onFinish()
    }

    const nextStep = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1)
        }
    }

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1)
        }
    }

    const skip = () => {
        onFinish()
    }

    if (!showWalkthrough) return null

    const currentStepData = steps[currentStep];

    return (
        <AnimatePresence mode="wait">
            {showWalkthrough && (
                <motion.div
                    key="walkthrough"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <AnimatePresence mode="wait">
                        <Step
                            key={currentStep}
                            target={currentStepData?.target}
                            title={currentStepData?.title ?? ""}
                            content={currentStepData?.content ?? ""}
                            isVisible={true}
                            currentStep={currentStep}
                            totalSteps={steps.length}
                            onNext={nextStep}
                            onPrevious={prevStep}
                            onFinish={onStop}
                            onSkip={skip}
                        />
                    </AnimatePresence>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
