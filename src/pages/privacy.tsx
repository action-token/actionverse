"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowLeft, ChevronRight, Shield } from "lucide-react"

export default function Privacy() {
    const [activeSection, setActiveSection] = useState("introduction")

    // Track scroll position to highlight active section in table of contents
    useEffect(() => {
        const handleScroll = () => {
            const sections = document.querySelectorAll("section[id]")
            let currentActiveSection = activeSection

            sections.forEach((section) => {
                const sectionTop = section.getBoundingClientRect().top
                const sectionId = section.getAttribute("id") ?? ""

                // Adjust this value based on testing - it determines how far from the top
                // a section needs to be to be considered "active"
                if (sectionTop < 150 && sectionTop > -100) {
                    currentActiveSection = sectionId
                }
            })

            if (currentActiveSection !== activeSection) {
                setActiveSection(currentActiveSection)
            }
        }

        window.addEventListener("scroll", handleScroll)
        // Initial check after component mounts
        setTimeout(handleScroll, 100)

        return () => {
            window.removeEventListener("scroll", handleScroll)
        }
    }, [activeSection])

    // Animation variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2,
            },
        },
    }

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { duration: 0.5 },
        },
    }

    const sections = [
        { id: "introduction", title: "Introduction" },
        { id: "information-we-collect", title: "Information We Collect" },
        { id: "third-party-services", title: "Third-Party Services" },
        { id: "security", title: "Security" },
        { id: "childrens-privacy", title: "Children's Privacy" },
        { id: "changes", title: "Changes to This Privacy Policy" },
        { id: "contact-us", title: "Contact Us" },
    ]

    const scrollToSection = (id: string) => {
        // Update active section immediately when clicking
        setActiveSection(id)

        const element = document.getElementById(id)
        if (element) {
            const yOffset = -120 // Adjust this value based on your header height
            const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset
            window.scrollTo({ top: y, behavior: "smooth" })
        }
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
                <div className="container mx-auto flex items-center justify-between px-4 py-4">
                    <Link href="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                        <span>Back to Home</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        <span className="font-semibold text-foreground">Privacy Policy</span>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 md:py-16">
                <motion.div initial="hidden" animate="visible" variants={containerVariants} className="mb-12 text-center">
                    <motion.h1 variants={itemVariants} className="mb-4 text-4xl font-bold text-foreground">
                        Privacy Policy
                    </motion.h1>
                    <motion.p variants={itemVariants} className="text-muted-foreground">
                        Last updated: March 12, 2024
                    </motion.p>
                </motion.div>

                <motion.div
                    variants={itemVariants}
                    className="mb-8 rounded-lg border border-border bg-card p-6 shadow-sm md:p-8"
                >
                    <p className="mb-4 text-sm text-muted-foreground">Effective Date: March 12, 2024</p>

                    <p className="text-card-foreground">
                        At Actionverse, your privacy is our priority. This policy explains what information we collect, how it is
                        used, and the rights you have as a user. By using Actionverse&apos;s services, you agree to the collection
                        and use of your data as outlined here.
                    </p>
                </motion.div>

                <div className="grid gap-8 md:grid-cols-4">
                    <motion.nav
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                        className="md:col-span-1"
                    >
                        <div className="sticky top-24 rounded-lg border border-border bg-card p-5 shadow-sm">
                            <h2 className="mb-4 text-xl font-semibold text-card-foreground">Table of Contents</h2>
                            <ul className="space-y-2">
                                {sections.map((section) => (
                                    <li key={section.id}>
                                        <button
                                            onClick={() => scrollToSection(section.id)}
                                            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${activeSection === section.id
                                                ? "bg-primary/10 text-primary font-medium"
                                                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                                }`}
                                        >
                                            <span>{section.title}</span>
                                            {activeSection === section.id && <ChevronRight className="h-4 w-4" />}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </motion.nav>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4, duration: 0.5 }}
                        className="space-y-12 md:col-span-3"
                    >
                        <section id="introduction" className="scroll-mt-24">
                            <h2 className="mb-4 border-b border-border pb-2 text-2xl font-semibold text-foreground">Introduction</h2>
                            <p className="text-muted-foreground">
                                Actionverse is an innovative platform designed to transform the way people engage with organizations
                                through gamified experiences. Our mission is to bridge the digital and physical worlds by enabling users
                                to explore their surroundings, discover rewards, and connect with organizations in a fun, interactive
                                way. This <strong className="text-foreground">Privacy Policy</strong> governs how we collect, use, and
                                protect the information you provide when using our services. Unless otherwise defined, the terms used in
                                this Privacy Policy have the same meanings as in our{" "}
                                <Link href="/terms" className="text-primary hover:underline">
                                    Terms and Conditions
                                </Link>
                                .
                            </p>
                        </section>

                        <section id="information-we-collect" className="scroll-mt-24">
                            <h2 className="mb-4 border-b border-border pb-2 text-2xl font-semibold text-foreground">
                                Information We Collect
                            </h2>

                            <div className="space-y-6">
                                <div>
                                    <h3 className="mb-2 text-xl font-semibold text-foreground">1. Information You Provide</h3>
                                    <p className="text-muted-foreground">
                                        To enhance your experience, we may collect personal information you provide, including:
                                    </p>
                                    <ul className="my-3 list-inside list-disc space-y-1 text-muted-foreground">
                                        <li>Name</li>
                                        <li>Email address</li>
                                        <li>Gender</li>
                                        <li>Location</li>
                                        <li>Profile pictures</li>
                                        <li>Stellar Address</li>
                                    </ul>
                                    <p className="text-muted-foreground">
                                        This information is used to deliver and improve our services. It is retained securely and shared
                                        only as described in this policy.
                                    </p>
                                </div>

                                <div>
                                    <h3 className="mb-2 text-xl font-semibold text-foreground">2. Cookies</h3>
                                    <p className="text-muted-foreground">
                                        Cookies are small files stored on your device, often used to identify users anonymously. While
                                        Actionverse does not use cookies directly, third-party tools integrated into our services may use
                                        cookies to collect and improve data. You can manage cookie preferences through your browser
                                        settings. Note that refusing cookies may limit certain functionalities of our platform.
                                    </p>
                                </div>

                                <div>
                                    <h3 className="mb-2 text-xl font-semibold text-foreground">3. Device Information</h3>
                                    <p className="text-muted-foreground">
                                        We may collect non-identifiable information about your device to improve services and prevent fraud.
                                        Examples include:
                                    </p>
                                    <ul className="my-3 list-inside list-disc space-y-1 text-muted-foreground">
                                        <li>Device type</li>
                                        <li>Operating system</li>
                                        <li>App usage data</li>
                                    </ul>
                                    <p className="text-muted-foreground">
                                        This information is used solely for operational improvements and security.
                                    </p>
                                </div>

                                <div>
                                    <h3 className="mb-2 text-xl font-semibold text-foreground">4. Location Information</h3>
                                    <p className="text-muted-foreground">
                                        Some services may require access to your device&apos;s location. Location data is used only within
                                        the scope necessary for the intended service and is not shared without your consent.
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section id="third-party-services" className="scroll-mt-24">
                            <h2 className="mb-4 border-b border-border pb-2 text-2xl font-semibold text-foreground">
                                Third-Party Services
                            </h2>
                            <p className="text-muted-foreground">Actionverse may engage trusted third-party providers to:</p>
                            <ul className="my-3 list-inside list-disc space-y-1 text-muted-foreground">
                                <li>Facilitate our services</li>
                                <li>Analyze usage data</li>
                                <li>Perform service-related tasks</li>
                            </ul>
                            <p className="text-muted-foreground">
                                These providers are contractually obligated to protect your personal information and use it solely for
                                authorized purposes.
                            </p>
                        </section>

                        <section id="security" className="scroll-mt-24">
                            <h2 className="mb-4 border-b border-border pb-2 text-2xl font-semibold text-foreground">Security</h2>
                            <p className="text-muted-foreground">
                                We employ commercially reasonable measures to protect your information. However, no online or electronic
                                storage method is entirely secure. While we strive for maximum protection, we cannot guarantee absolute
                                security.
                            </p>
                        </section>

                        <section id="childrens-privacy" className="scroll-mt-24">
                            <h2 className="mb-4 border-b border-border pb-2 text-2xl font-semibold text-foreground">
                                Children&apos;s Privacy
                            </h2>
                            <p className="text-muted-foreground">
                                Actionverse does not target or knowingly collect personal information from users under the age of 13. If
                                we learn that we have inadvertently collected such data, we will delete it promptly. Parents or
                                guardians aware of any such cases should contact us immediately.
                            </p>
                        </section>

                        <section id="changes" className="scroll-mt-24">
                            <h2 className="mb-4 border-b border-border pb-2 text-2xl font-semibold text-foreground">
                                Changes to This Privacy Policy
                            </h2>
                            <p className="text-muted-foreground">
                                Actionverse may update this policy periodically. Changes will be communicated via updates to this
                                document. Continued use of our services after such updates constitutes acceptance of the revised policy.
                            </p>
                        </section>

                        <section id="contact-us" className="scroll-mt-24">
                            <h2 className="mb-4 border-b border-border pb-2 text-2xl font-semibold text-foreground">Contact Us</h2>
                            <p className="text-muted-foreground">
                                If you have any questions or concerns about this Privacy Policy, please contact us at:
                            </p>
                            <div className="mt-4 rounded-lg border border-border bg-card p-5">
                                <p className="text-card-foreground">
                                    <strong>Email:</strong>{" "}
                                    <a href="mailto:support@Actionverse.com" className="text-primary hover:underline">
                                        support@action-tokens.com
                                    </a>
                                    <br />
                                    <strong>Website:</strong>{" "}
                                    <a
                                        href="https://www.action-tokens.com/"
                                        className="text-primary hover:underline"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        app.Actionverse.com
                                    </a>
                                </p>
                            </div>
                            <p className="mt-6 text-muted-foreground">
                                Thank you for trusting Actionverse. Together, we&apos;re empowering organizations and redefining
                                engagement experiences.
                            </p>
                        </section>
                    </motion.div>
                </div>
            </main>

            <footer className="border-t border-border bg-card py-6">
                <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
                    <p>© {new Date().getFullYear()} Actionverse. All rights reserved.</p>
                </div>
            </footer>
        </div>
    )
}
