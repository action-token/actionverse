"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { ArrowRight, Palette, Globe, Award, Zap, Loader2 } from "lucide-react"

import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { ActivationModal } from "../modal/activation-modal"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { checkStellarAccountActivity } from "~/lib/helper/helper_client"

export default function JoinArtistPage() {
    const session = useSession()
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isActive, setIsActive] = useState<boolean>(false);
    const [isActiveStatusLoading, setIsActiveStatusLoading] = useState<boolean>(false);
    useEffect(() => {
        const checkAccountActivity = async () => {
            if (session.data?.user.id) {
                setIsActiveStatusLoading(true);
                const active = await checkStellarAccountActivity(session.data.user.id);
                setIsActive(active);
                setIsActiveStatusLoading(false);
            }
        }
        checkAccountActivity();
    }, [session.data?.user.id]);

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
                                Our platform empowers you to engage your fans in new and exciting ways.
                            </p>
                        </motion.div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                {
                                    icon: <Globe className="h-10 w-10" />,
                                    title: "Global Reach",
                                    description: "Share your brand with audiences worldwide",
                                },
                                {
                                    icon: <Award className="h-10 w-10" />,
                                    title: "Recognize your Fans",
                                    description: "Reward your fans with exclusive rewards and unique digital badges",
                                },
                                {
                                    icon: <Zap className="h-10 w-10" />,
                                    title: "Creative Freedom",
                                    description: "Express your organization with digital art and unique competitions that get your fans moving IRL",
                                },
                                {
                                    icon: <Palette className="h-10 w-10" />,
                                    title: "Ready to Showcase your org?",
                                    description: "Join our growing platform connecting organizations with fans",
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
                        {
                            isActive ? (
                                <Button size="lg" asChild className="rounded-full px-8">
                                    <Link href="/organization/create" className="gap-2">
                                        Join as Organization <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>)
                                : (isActiveStatusLoading ? (
                                    <Button size="lg" disabled className="rounded-full px-8">
                                        Checking Account...
                                        <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                    </Button>
                                ) : (
                                    <Button
                                        size="lg" variant="destructive" onClick={() => setDialogOpen(true)} className="rounded-full px-8 gap-2">
                                        Join as Organization <ArrowRight className="h-4 w-4" />
                                    </Button>
                                ))
                        }
                    </motion.div>
                </div>
            </div>
            <ActivationModal
                dialogOpen={dialogOpen}
                setDialogOpen={setDialogOpen}
            />
        </div>
    )
}

