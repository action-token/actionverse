"use client"

import { useEffect, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Download, Globe, Rocket, Sparkles } from 'lucide-react'

import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent } from "~/components/shadcn/ui/card"

export default function AboutPage() {
    // Ref for scroll animations
    const scrollRef = useRef(null)

    // Animation variants
    const fadeInUp = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.6 }
        }
    }

    const staggerContainer = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2
            }
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-green-50 to-green-100">


            <main className="container mx-auto px-4 py-16">
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={fadeInUp}
                    className="text-center mb-16"
                >
                    <h1 className="text-5xl font-bold text-gray-800 mb-6">
                        Discover the <span className="text-green-600">Actionverse</span> Experience
                    </h1>
                    <motion.p
                        variants={fadeInUp}
                        className="mx-auto max-w-3xl text-xl text-gray-600 mb-8"
                    >
                        Actionverse is an innovative platform designed to transform the way people engage with organizations through gamified experiences. Our mission is to bridge the digital and physical worlds by enabling users to explore their surroundings, discover rewards, and connect with organizations in a fun, interactive way.
                    </motion.p>
                    <motion.div
                        variants={fadeInUp}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Link href="/fans/home">
                            <Button size="lg" className="bg-green-600 hover:bg-green-700 text-lg group">
                                JOIN AS ORGANIZATION
                                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </Link>
                    </motion.div>
                </motion.div>

                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    variants={staggerContainer}
                    className="mb-24 grid gap-8 md:grid-cols-2"
                >
                    <motion.div variants={fadeInUp}>
                        <Card className="h-full overflow-hidden border-none shadow-lg hover:shadow-xl transition-shadow duration-300">
                            <CardContent className="p-8">
                                <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600">
                                    <Globe className="h-8 w-8" />
                                </div>
                                <h2 className="mb-4 text-2xl font-semibold text-gray-800">
                                    For Organization:
                                </h2>
                                <p className="mb-6 text-gray-600">
                                    Actionverse offers a dynamic platform for organizations to create impactful, localized campaigns. With our intuitive dashboard, organizations can:
                                </p>
                                <ul className="space-y-3 text-gray-600">
                                    <li className="flex items-start">
                                        <span className="mr-2 text-green-500">✓</span>
                                        <span>Place virtual pins at any GPS location, each holding a unique reward.</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2 text-green-500">✓</span>
                                        <span>Customize campaigns with organization details, descriptions, and collection limits.</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2 text-green-500">✓</span>
                                        <span>Build memorable connections with customers through immersive experiences.</span>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div variants={fadeInUp}>
                        <Card className="h-full overflow-hidden border-none shadow-lg hover:shadow-xl transition-shadow duration-300">
                            <CardContent className="p-8">
                                <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600">
                                    <Sparkles className="h-8 w-8" />
                                </div>
                                <h2 className="mb-4 text-2xl font-semibold text-gray-800">
                                    For Users:
                                </h2>
                                <p className="mb-6 text-gray-600">
                                    Actionverse turns the world into your playground. Embark on exciting virtual scavenger hunts where you can:
                                </p>
                                <ul className="space-y-3 text-gray-600">
                                    <li className="flex items-start">
                                        <span className="mr-2 text-green-500">✓</span>
                                        <span>Discover GPS-based pins placed by organizations worldwide.</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2 text-green-500">✓</span>
                                        <span>Collect and claim rewards in real-time by exploring your surroundings.</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2 text-green-500">✓</span>
                                        <span>Enjoy a unique mix of augmented reality (AR) and gamification tailored to your lifestyle.</span>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </motion.div>
                </motion.div>

                <motion.section
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    variants={fadeInUp}
                    className="mb-24"
                >
                    <h2 className="mb-12 text-center text-3xl font-bold text-gray-800">
                        Why Choose <span className="text-green-600">Actionverse</span>?
                    </h2>
                    <motion.div
                        variants={staggerContainer}
                        className="grid gap-8 md:grid-cols-3"
                    >
                        {[
                            {
                                title: "Interactive Engagement",
                                description: "Elevate customer engagement with gamified experiences that create lasting impressions.",
                                icon: <Sparkles className="h-8 w-8" />,
                                color: "bg-purple-100 text-purple-600",
                            },
                            {
                                title: "Scalable Reach",
                                description: "Connect with users globally using real-time, location-based technology that grows with your organization.",
                                icon: <Globe className="h-8 w-8" />,
                                color: "bg-blue-100 text-blue-600",
                            },
                            {
                                title: "Seamless Experience",
                                description: "Enjoy an intuitive platform powered by cutting-edge AR and GPS integration for maximum engagement.",
                                icon: <Rocket className="h-8 w-8" />,
                                color: "bg-green-100 text-green-600",
                            },
                        ].map((item, index) => (
                            <motion.div
                                key={index}
                                variants={fadeInUp}
                                whileHover={{ y: -5 }}
                                className="h-full"
                            >
                                <Card className="h-full border-none shadow-lg hover:shadow-xl transition-all duration-300">
                                    <CardContent className="p-8 text-center flex flex-col items-center">
                                        <div className={`mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full ${item.color}`}>
                                            {item.icon}
                                        </div>
                                        <h3 className="mb-4 text-xl font-semibold text-gray-800">
                                            {item.title}
                                        </h3>
                                        <p className="text-gray-600">{item.description}</p>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </motion.div>
                </motion.section>

                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    variants={fadeInUp}
                    className="mb-24 text-center"
                >
                    <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-10">
                        <h2 className="text-3xl font-bold text-gray-800 mb-6">Ready to Transform Engagement?</h2>
                        <p className="mb-8 text-xl text-gray-600">
                            Whether you{"'re"} hunting for rewards or driving organization visibility, Actionverse redefines engagement by merging technology, fun, and creativity.
                        </p>
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Button size="lg" className="bg-green-600 hover:bg-green-700 text-lg">
                                Get Started Today
                            </Button>
                        </motion.div>
                    </div>
                </motion.div>

                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    variants={fadeInUp}
                    className="flex flex-col items-center justify-center py-10 bg-white rounded-2xl shadow-md"
                >
                    <h2 className="mb-6 text-2xl font-bold text-gray-800">
                        Download Our Application
                    </h2>

                    <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Link
                                href="https://apps.apple.com/us/app/Actionverse/id1639649037"
                            >
                                <Button variant="outline" size="lg" className="inline-flex items-center justify-center gap-3 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50">
                                    <svg
                                        className="h-7 w-7"
                                        aria-hidden="true"
                                        focusable="false"
                                        data-prefix="fab"
                                        data-icon="apple"
                                        role="img"
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 384 512"
                                    >
                                        <path
                                            fill="currentColor"
                                            d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
                                        ></path>
                                    </svg>
                                    <div className="text-left">
                                        <div className="text-xs">Download on the</div>
                                        <div className="font-semibold">App Store</div>
                                    </div>
                                </Button>
                            </Link>
                        </motion.div>

                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Link
                                href="https://play.google.com/store/apps/details?id=com.thebillboardapp.Actionverse">
                                <Button variant="outline" size="lg" className="inline-flex items-center justify-center gap-3 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50">
                                    <svg
                                        className="h-7 w-7"
                                        aria-hidden="true"
                                        focusable="false"
                                        data-prefix="fab"
                                        data-icon="google-play"
                                        role="img"
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 512 512"
                                    >
                                        <path
                                            fill="currentColor"
                                            d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"
                                        ></path>
                                    </svg>
                                    <div className="text-left">
                                        <div className="text-xs">Get it on</div>
                                        <div className="font-semibold">Google Play</div>
                                    </div>
                                </Button>
                            </Link>
                        </motion.div>
                    </div>
                </motion.div>
            </main>


        </div>
    )
}
