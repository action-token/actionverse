"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { ArrowRight, Palette, Globe, Award, Zap } from "lucide-react"

import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent } from "~/components/shadcn/ui/card"

export default function JoinArtistPage() {
    return (
        <div className="">
            {/* Background Elements */}

            <div className="container mx-auto px-4 py-12 md:py-24">
                <div className="max-w-5xl mx-auto">
                    {/* Hero Section */}

                    {/* Benefits Section */}
                    <div className="mb-16">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                            className="text-center mb-12"
                        >
                            <h2 className="text-3xl font-bold">Why Join as an Organization?</h2>
                            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                                Our platform offers everything you need to showcase your talent and grow your audience.
                            </p>
                        </motion.div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                {
                                    icon: <Globe className="h-10 w-10" />,
                                    title: "Global Reach",
                                    description: "Share your work with audiences worldwide",
                                },
                                {
                                    icon: <Award className="h-10 w-10" />,
                                    title: "Organization Recognition",
                                    description: "Get verified status and build credibility",
                                },
                                {
                                    icon: <Zap className="h-10 w-10" />,
                                    title: "Powerful Tools",
                                    description: "Access exclusive organization features and analytics",
                                },
                                {
                                    icon: <Palette className="h-10 w-10" />,
                                    title: "Creative Freedom",
                                    description: "Express yourself with full creative control",
                                },
                            ].map((benefit, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 + index * 0.1 }}
                                >
                                    <Card className="h-full border transition-all duration-300 hover:border-primary hover:shadow-md">
                                        <CardContent className="p-6 flex flex-col items-center text-center">
                                            <div className="rounded-full bg-primary/10 p-4 text-primary mb-4">{benefit.icon}</div>
                                            <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                                            <p className="text-muted-foreground">{benefit.description}</p>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* CTA Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.6 }}
                        className="bg-primary/5 border border-primary/10 rounded-2xl p-8 md:p-12 text-center"
                    >
                        <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to showcase your talent?</h2>
                        <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
                            Join our growing community of artists and start sharing your creative work today.
                        </p>
                        <Button size="lg" asChild className="rounded-full px-8">
                            <Link href="/organization/create" className="gap-2">
                                Join as Organization <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}

