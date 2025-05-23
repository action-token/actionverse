"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Menu, Check, Download, ChevronDown, ArrowRight, Sparkles, Users, Coins, Award } from "lucide-react"

import { Button } from "~/components/shadcn/ui/button"
import { cn } from "~/lib/utils"
import { HomeVideoPlayer } from "~/components/common/home-video-player"
import { BountySection } from "~/components/bounty/bounty-card"
import { OrganizationSection } from "~/components/creator/organization-card"
import { api } from "~/utils/api"
import { useSession } from "next-auth/react"
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances"
import { PLATFORM_ASSET } from "~/lib/stellar/constant"
import { useSidebar } from "~/hooks/use-sidebar"
import { Sheet, SheetContent, SheetHeader, SheetTrigger } from "~/components/shadcn/ui/sheet"
import { DashboardNav } from "~/components/layout/Left-sidebar/dashboard-nav"
import { LeftBottom, LeftNavigation } from "~/components/layout/Left-sidebar/sidebar"
import { Skeleton } from "~/components/shadcn/ui/skeleton"

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const [activeFeature, setActiveFeature] = useState(0)

  const features = [
    {
      title: "Verified Actions",
      description:
        "Ensure authenticity through partnerships with reputable organizations and a robust verification process.",
      icon: <Check className="h-6 w-6" />,
    },
    {
      title: "Token Collection",
      description: "Build a personal portfolio of contributions, showcasing your commitment to positive change.",
      icon: <Sparkles className="h-6 w-6" />,
    },
    {
      title: "Reward System",
      description:
        "Access a diverse range of rewards, from digital badges to real-world experiences, as a testament to your impact.",
      icon: <ArrowRight className="h-6 w-6" />,
    },
    {
      title: "Community Engagement",
      description:
        "Connect with like-minded individuals and organizations, fostering a network dedicated to making a difference.",
      icon: <ChevronDown className="h-6 w-6" />,
    },
  ]

  useEffect(() => {
    setMounted(true)

    // Auto-rotate through features
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  if (!mounted) return <HomePageSkeleton />

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground overflow-hidden">
      <Header />

      {/* Hero Section with Video Background */}
      <section className="relative min-h-[90vh] w-full overflow-hidden bg-black text-primary-foreground">
        <div className="absolute inset-0 z-0">
          {/* Mobile: Static image instead of video */}
          <div className="md:hidden">
            <Image src="/images/action/plot-sign.jpeg" alt="ACTION Blocks" fill priority className="object-cover" />
            <div className="absolute inset-0 bg-black/60"></div>
          </div>

          {/* Desktop: Lazy-loaded video with poster image */}
          <div className="hidden h-full md:block">
            <HomeVideoPlayer src="/videos/Hand.mp4" poster="/images/action/plot-sign.jpeg" />
            <div className="absolute inset-0 bg-black/60"></div>
          </div>
        </div>

        <div className="container relative z-10 mx-auto flex h-full min-h-[90vh] flex-col items-center justify-center px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mb-6 inline-block rounded-full bg-primary/20 px-6 py-2 backdrop-blur-sm"
          >
            <span className="text-sm font-medium text-primary">Introducing Action Tokens</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mb-6 text-4xl font-bold leading-tight text-primary-foreground md:text-6xl lg:text-7xl"
          >
            Empowering <span className="text-primary">Real-World Impact</span> Through Digital Engagement
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mb-10 max-w-3xl text-lg text-muted md:text-xl"
          >
            Action Tokens is a platform designed to incentivize and reward positive actions in the physical world. By
            bridging the gap between digital engagement and real-world activities, we aim to foster meaningful
            connections.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Button
              size="lg"
              className="group relative overflow-hidden rounded-full bg-primary px-8 py-6 text-lg font-medium text-primary-foreground transition-all hover:bg-primary/90"
              onClick={() => {
                const section = document.getElementById("plots-section")
                section?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              <span className="relative z-10">Explore Plots</span>
              <span className="absolute inset-0 -translate-y-full bg-white/20 transition-transform duration-300 ease-in-out group-hover:translate-y-0"></span>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="group relative overflow-hidden rounded-full border-primary px-8 py-6 text-lg font-medium text-primary transition-all hover:text-primary-foreground"
              onClick={() => {
                const section = document.getElementById("bounties-section")
                section?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              <span className="relative z-10">Join Bounties</span>
              <span className="absolute inset-0 translate-y-full bg-primary transition-transform duration-300 ease-in-out group-hover:translate-y-0"></span>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.2 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2"
          >
            <button
              onClick={() => {
                const section = document.getElementById("what-are-tokens")
                section?.scrollIntoView({ behavior: "smooth" })
              }}
              className="flex flex-col items-center text-sm text-muted hover:text-primary transition-colors"
            >
              <span className="mb-2">Scroll to learn more</span>
              <motion.div animate={{ y: [0, 10, 0] }} transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.5 }}>
                <ChevronDown className="h-6 w-6" />
              </motion.div>
            </button>
          </motion.div>
        </div>
      </section>

      {/* What Are Action Tokens Section */}
      <section id="what-are-tokens" className="py-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-primary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-block rounded-lg bg-primary/10 px-4 py-2 mb-6">
                <span className="text-sm font-medium text-primary">What Are Action Tokens?</span>
              </div>

              <h2 className="text-3xl md:text-4xl font-bold mb-6">Digital Representations of Real-World Actions</h2>

              <p className="text-lg text-muted-foreground mb-8">
                Action Tokens serve as proof of participation in activities that contribute positively to society, such
                as community service, environmental conservation, or educational pursuits. These tokens can be
                collected, showcased, and redeemed for various rewards, creating a tangible value for intangible
                contributions.
              </p>

              <div className="space-y-6">
                {features.map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className={cn(
                      "p-6 rounded-xl transition-all duration-300 cursor-pointer",
                      activeFeature === index ? "bg-primary/10 shadow-lg" : "hover:bg-muted",
                    )}
                    onClick={() => setActiveFeature(index)}
                  >
                    <div className="flex items-start">
                      <div
                        className={cn(
                          "mr-4 rounded-full p-2 transition-colors",
                          activeFeature === index ? "bg-primary text-white" : "bg-muted text-primary",
                        )}
                      >
                        {feature.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg mb-1">{feature.title}</h3>
                        <p
                          className={cn(
                            "transition-all duration-300",
                            activeFeature === index ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative z-10 rounded-2xl overflow-hidden shadow-2xl border border-muted">
                <Image
                  src="/images/action/plot-sign.jpeg"
                  alt="Action Tokens Visualization"
                  width={600}
                  height={600}
                  className="w-full h-auto"
                />
              </div>

              <div className="absolute -top-6 -right-6 w-32 h-32 bg-primary/20 rounded-full blur-2xl"></div>
              <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-primary/20 rounded-full blur-2xl"></div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="inline-block rounded-lg bg-primary/10 px-4 py-2 mb-6"
            >
              <span className="text-sm font-medium text-primary">How It Works</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl md:text-4xl font-bold mb-6"
            >
              Three Simple Steps to Make an Impact
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-muted-foreground"
            >
              Our platform makes it easy to participate in meaningful actions and receive recognition for your
              contributions.
            </motion.p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Participate in Actions",
                description:
                  "Engage in verified activities promoted by partnered organizations or community initiatives.",
                icon: <Users className="h-10 w-10 text-primary" />,
              },
              {
                step: "02",
                title: "Earn Tokens",
                description:
                  "Upon completion and verification of an action, receive a unique Action Token as recognition.",
                icon: <Coins className="h-10 w-10 text-primary" />,
              },
              {
                step: "03",
                title: "Redeem Rewards",
                description:
                  "Accumulate tokens to unlock exclusive rewards, experiences, or further opportunities to contribute.",
                icon: <Award className="h-10 w-10 text-primary" />,
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="bg-background rounded-2xl p-8 shadow-lg border border-muted relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-4 text-4xl font-bold text-primary/10 group-hover:text-primary/20 transition-colors">
                  {item.step}
                </div>

                <div className="mb-6 rounded-full bg-primary/10 p-4 inline-block">{item.icon}</div>

                <h3 className="text-xl font-bold mb-4">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>

                <div className="absolute bottom-0 left-0 h-1 bg-primary transition-all duration-300 w-0 group-hover:w-full"></div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-16 text-center"
          >
            <Button
              size="lg"
              className="rounded-full bg-primary px-8 py-6 text-lg font-medium text-primary-foreground"
              onClick={() => {
                const section = document.getElementById("bounties-section")
                section?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              Start Your Journey
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Download App Section */}
      <section id="download-section" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-background"></div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-block rounded-lg bg-primary/10 px-4 py-2 mb-6">
                <span className="text-sm font-medium text-primary">Mobile Experience</span>
              </div>

              <h2 className="text-3xl md:text-4xl font-bold mb-6">Action Tokens Mobile App</h2>

              {/* <p className="text-lg text-muted-foreground mb-8">
                Take Action Tokens with you wherever you go. Our mobile app provides a seamless experience for
                participating in actions, managing your tokens, and redeeming rewards on the go.
              </p> */}

              <div className="space-y-6 mb-10">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                  className="flex items-start"
                >
                  <div className="mr-4 rounded-full bg-primary/10 p-1">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1">Positive Actions, Anytime, Anywhere</h3>
                    <p className="text-muted-foreground">Join verified community and organizational initiatives on the go. With our mobile app, earning Action Tokens through real-world tasks is seamless and rewarding.</p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="flex items-start"
                >
                  <div className="mr-4 rounded-full bg-primary/10 p-1">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1">Collect, Explore, Redeem</h3>
                    <p className="text-muted-foreground">Navigate the Actionverse map, complete geo-fenced and token-gated challenges in augmented reality, and redeem digital or physical rewards—all from your phone.</p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="flex items-start"
                >
                  <div className="mr-4 rounded-full bg-primary/10 p-1">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1">Empowered by Blockchain</h3>
                    <p className="text-muted-foreground">Securely manage your token portfolio, access exclusive offers, and connect with purpose-driven communities—empowering your journey toward real-world impact.</p>
                  </div>
                </motion.div>
              </div>

              <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
                <motion.a
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  href="#"
                  className="group flex items-center justify-center gap-3 rounded-xl bg-black px-6 py-4 text-white transition-transform hover:scale-105"
                >
                  <svg
                    className="h-8 w-8"
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
                    <div className="text-sm font-semibold">App Store</div>
                  </div>
                </motion.a>

                <motion.a
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                  href="#"
                  className="group flex items-center justify-center gap-3 rounded-xl bg-black px-6 py-4 text-white transition-transform hover:scale-105"
                >
                  <svg
                    className="h-8 w-8"
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
                    <div className="text-sm font-semibold">Google Play</div>
                  </div>
                </motion.a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative mx-auto"
            >
              <div className="relative z-10 mx-auto h-[600px] w-[300px]">
                <div className="absolute left-1/2 top-1/2 h-[600px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-[2.5rem] border-[8px] border-black bg-black shadow-2xl">
                  <div className="absolute left-1/2 top-0 h-[30px] w-[150px] -translate-x-1/2 rounded-b-[1rem] bg-black"></div>
                  <div className="absolute bottom-4 left-1/2 h-[4px] w-[100px] -translate-x-1/2 rounded-full bg-gray-800"></div>
                  <div className="h-full w-full overflow-hidden rounded-[2rem] bg-white">
                    <Image
                      src="/mobile-app.jpg"
                      alt="ACTION Mobile App"
                      width={600}
                      height={1200}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>

                {/* Decorative elements */}
                <div className="absolute -right-16 top-1/4 h-32 w-32 rounded-full bg-primary/20 blur-3xl"></div>
                <div className="absolute -left-16 bottom-1/4 h-32 w-32 rounded-full bg-primary/20 blur-3xl"></div>

                {/* Floating elements */}
                {/* <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="absolute -left-20 top-1/3 rounded-xl bg-background p-4 shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/20 p-2">
                      <Download className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-sm">
                      <div className="font-bold">10K+</div>
                      <div className="text-muted-foreground">Downloads</div>
                    </div>
                  </div>
                </motion.div> */}

                {/* <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                  className="absolute -right-24 bottom-1/3 rounded-xl bg-background p-4 shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/20 p-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-sm">
                      <div className="font-bold">4.8/5</div>
                      <div className="text-muted-foreground">User Rating</div>
                    </div>
                  </div>
                </motion.div> */}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Bounties Section */}
      <BountySection />

      {/* Organizations Section */}
      <OrganizationSection />

      {/* Join the Movement Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-background"></div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="inline-block rounded-lg bg-primary/10 px-4 py-2 mb-6"
            >
              <span className="text-sm font-medium text-primary">Join the Movement</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl md:text-4xl font-bold mb-6"
            >
              Be Part of Something Bigger
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-muted-foreground mb-10"
            >
              Be part of a growing community that values action over words. With Action Tokens, every positive deed is
              recognized, celebrated, and rewarded. Start your journey towards impactful engagement today.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Link href={"/organization/create"}>
                <Button
                  size="lg"
                  className="rounded-full bg-primary px-8 py-6 text-lg font-medium text-primary-foreground"
                >
                  Create Your Organization
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  )
}

interface HeaderProps {
  className?: string
  sidebarExpanded?: boolean
}

export function Header({ className, sidebarExpanded = false }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isPastHero, setIsPastHero] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const { setBalance, setActive } = useUserStellarAcc()
  const session = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const { isSheetOpen, setIsSheetOpen } = useSidebar()

  const bal = api.wallate.acc.getAccountBalance.useQuery(undefined, {
    onSuccess: (data) => {
      const { balances } = data
      setBalance(balances)
      setActive(true)
    },
    onError: (error) => {
      setActive(false)
    },
    enabled: session.data?.user?.id !== undefined,
  })

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      setScrollY(currentScrollY)
      setIsPastHero(currentScrollY > window.innerHeight * 0.5)
      setIsScrolled(currentScrollY > 20)
    }

    const handleResize = () => {
      setViewportHeight(window.innerHeight)
      setIsMobile(window.innerWidth < 768)
    }

    // Add event listeners
    window.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("resize", handleResize)

    // Initial check
    handleScroll()
    handleResize()

    // Cleanup
    return () => {
      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  return (
    <header
      ref={headerRef}
      className={cn(
        "fixed top-0 right-0 z-50 flex h-20 w-full items-center transition-all duration-500",
        // Show header only when scrolled past hero or when slightly scrolled
        isPastHero
          ? "translate-y-0 opacity-100"
          : isScrolled
            ? "bg-transparent translate-y-0 opacity-100"
            : "-translate-y-full opacity-0",
        // Glass effect when past hero
        isPastHero && "bg-background/70 backdrop-blur-md shadow-sm",
        isMobile ? "px-4" : sidebarExpanded ? "lg:pl-64" : "lg:pl-16",
        className,
      )}
    >
      <div className="flex w-full items-center justify-center gap-4">
        {/* Center section - Navigation (desktop only) */}
        <nav className="flex w-full items-center justify-between md:gap-8 lg:gap-16">
          <ul className="flex gap-6 items-center justify-center w-full md:gap-8">
            <Button
              variant="link"
              className="p-0 text-foreground hover:text-primary transition-colors"
              onClick={() => {
                const section = document.getElementById("bounties-section")
                section?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              Bounties
            </Button>
            <Button
              className="p-0 text-foreground hover:text-primary transition-colors"
              variant="link"
              onClick={() => {
                const section = document.getElementById("organizations-section")
                section?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              Organization
            </Button>
            <Button
              variant="link"
              className="p-0 text-foreground hover:text-primary transition-colors"
              onClick={() => {
                const section = document.getElementById("plots-section")
                section?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              Plots
            </Button>
            <Button
              variant="link"
              className="p-0 text-foreground hover:text-primary transition-colors hidden md:block"
              onClick={() => {
                const section = document.getElementById("download-section")
                section?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              Download App
            </Button>

          </ul>
          {session.status === "authenticated" && (
            <Link href="/wallet-balance" className="hidden md:block ">
              <Button className="bg-primary hover:bg-primary/90 transition-colors mr-2" variant="default">
                BALANCE :<span className="block md:hidden">{bal.data?.platformAssetBal.toFixed(0)}</span>
                <span className="hidden md:block ml-2">
                  {bal.data?.platformAssetBal.toFixed(0)} {PLATFORM_ASSET.code.toUpperCase()}
                </span>
              </Button>
            </Link>
          )}
        </nav>

        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="link" className="md:hidden p-2">
              <Menu />
            </Button>
          </SheetTrigger>

          <SheetContent side="left" className="w-72 p-0 h-full">
            <SheetHeader className="flex items-start justify-between bg-primary p-2 rounded-md shadow-md">
              <div className="flex items-center gap-0">
                <Image
                  alt="logo"
                  objectFit="cover"
                  src="/images/logo.png"
                  height={200}
                  width={200}
                  className="h-10 w-20"
                />
                <h1 className="relative text-xl font-bold capitalize text-black md:text-4xl">
                  <p className="">ACTIONVERSE</p>
                  <p className="absolute right-0 top-0 -mr-4 -mt-1 text-xs">TM</p>
                </h1>
              </div>
            </SheetHeader>
            <div className="flex h-full w-full flex-col items-center justify-between p-2 no-scrollbar overflow-y-auto">
              <div className="flex h-full w-full overflow-x-hidden flex-col py-2">
                <DashboardNav items={LeftNavigation} />
              </div>
              <div className="flex h-full w-full flex-col items-center">
                <LeftBottom />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

function HomePageSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header Skeleton */}
      <div className="h-20 w-full bg-background/70 backdrop-blur-md shadow-sm fixed top-0 z-50 flex items-center justify-between px-4">
        <Skeleton className="h-10 w-32" />
        <div className="hidden md:flex gap-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>

      {/* Hero Section Skeleton */}
      <div className="relative min-h-[90vh] w-full overflow-hidden bg-muted">
        <div className="container relative z-10 mx-auto flex h-full min-h-[90vh] flex-col items-center justify-center px-4 text-center">
          <Skeleton className="h-10 w-48 mb-6" />
          <Skeleton className="h-16 w-3/4 max-w-2xl mb-6" />
          <Skeleton className="h-8 w-full max-w-xl mb-8" />
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Skeleton className="h-14 w-40" />
            <Skeleton className="h-14 w-40" />
          </div>
        </div>
      </div>

      {/* What Are Action Tokens Section Skeleton */}
      <div className="py-24">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <Skeleton className="h-10 w-48 mb-6" />
              <Skeleton className="h-12 w-3/4 mb-6" />
              <Skeleton className="h-24 w-full mb-8" />

              <div className="space-y-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-6 rounded-xl">
                    <div className="flex items-start">
                      <Skeleton className="h-10 w-10 rounded-full mr-4" />
                      <div className="w-full">
                        <Skeleton className="h-6 w-1/3 mb-2" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <Skeleton className="rounded-2xl h-[600px] w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section Skeleton */}
      <div className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Skeleton className="h-10 w-48 mx-auto mb-6" />
            <Skeleton className="h-12 w-3/4 mx-auto mb-6" />
            <Skeleton className="h-8 w-full max-w-xl mx-auto" />
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
