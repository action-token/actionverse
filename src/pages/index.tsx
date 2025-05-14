"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Bell, User, Menu, Check, Filter, ChevronRight, Download, Smartphone, Apple, Globe } from 'lucide-react'

import { Button } from "~/components/shadcn/ui/button"
import { cn } from "~/lib/utils"
import { ImageWithFallback } from "~/components/common/image-with-fallback"
import { HomeVideoPlayer } from "~/components/common/home-video-player"
import { HorizontalScroll } from "~/components/common/horizontal-scroll"
import { plots } from "~/components/dummy-data/mock-data"
import { BountySection } from "~/components/bounty/bounty-card"
import { OrganizationSection } from "~/components/creator/organization-card"
import { PlotCard } from "~/components/plot/plot-card"
import { ConnectWalletButton } from "package/connect_wallet"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      {/* Hero Section with Video Background */}
      <section className="relative h-[60vh] w-full overflow-hidden rounded-b-xl bg-black text-primary-foreground md:h-[70vh]">
        <div className="absolute inset-0 z-0">
          {/* Mobile: Static image instead of video */}
          <div className="md:hidden">
            <Image src="/images/action/plot-sign.jpeg" alt="ACTION Blocks" fill priority className="object-cover" />
            <div className="absolute inset-0 bg-black/50"></div>
          </div>

          {/* Desktop: Lazy-loaded video with poster image */}
          <div className="hidden h-full md:block">
            <HomeVideoPlayer src="/videos/Hand.mp4" poster="/images/action/plot-sign.jpeg" />
            <div className="absolute inset-0 bg-black/50"></div>
          </div>
        </div>

        <div className="container relative z-10 mx-auto flex h-full flex-col items-center justify-center px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 flex items-center justify-center"
          >
            <div className="mr-4 text-6xl font-bold tracking-widest text-primary">ACTION</div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-6 text-4xl font-bold leading-tight text-primary-foreground md:text-6xl"
          >
            Premium Land Plots with <span className="text-primary">Digital Innovation</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mb-8 max-w-2xl text-lg text-muted"
          >
            Secure your future with our exclusive tech-integrated land plots. Limited availability. Revolutionary
            ownership experience.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Button
              className="bg-primary text-primary-foreground px-8 py-6 text-lg hover:bg-primary/90"
              onClick={() => {
                const section = document.getElementById("plots-section")
                section?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              Explore Plots
            </Button>
            <Button
              variant="outline"
              className="border-primary px-8 py-6 text-lg text-primary hover:bg-primary/10"
              onClick={() => {
                const section = document.getElementById("bounties-section")
                section?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              Join Bounties
            </Button>
          </motion.div>
        </div>
      </section>

      {/* App Download Section */}
      <section id="download-section" className="bg-gradient-to-r from-primary/10 to-primary/5 py-20">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="mb-6 text-3xl font-bold text-foreground md:text-4xl">
                Take ACTION <span className="text-primary">Anywhere</span>
              </h2>
              <p className="mb-8 text-muted-foreground">
                Download our mobile app to explore plots, participate in bounties, and manage your digital assets on the go.
                Get real-time notifications and exclusive mobile-only features.
              </p>

              <div className="mb-8 space-y-4">
                <div className="flex items-start">
                  <div className="mr-4 rounded-full bg-primary/10 p-1">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <p>Explore available plots with augmented reality visualization</p>
                </div>
                <div className="flex items-start">
                  <div className="mr-4 rounded-full bg-primary/10 p-1">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <p>Receive instant notifications about new opportunities</p>
                </div>
                <div className="flex items-start">
                  <div className="mr-4 rounded-full bg-primary/10 p-1">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <p>Manage your digital assets securely on the go</p>
                </div>
              </div>

              <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
                <a href="#" className="inline-flex items-center justify-center rounded-lg bg-black px-5 py-3 text-center text-white hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 dark:focus:ring-gray-900">
                  <Apple className="mr-2 h-5 w-5" />
                  <div className="text-left">
                    <div className="mb-1 text-xs">Download on the</div>
                    <div className="-mt-1 font-sans text-sm font-semibold">App Store</div>
                  </div>
                </a>
                <a href="#" className="inline-flex items-center justify-center rounded-lg bg-black px-5 py-3 text-center text-white hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 dark:focus:ring-gray-900">
                  <svg className="mr-2 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google-play" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                    <path fill="currentColor" d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"></path>
                  </svg>
                  <div className="text-left">
                    <div className="mb-1 text-xs">Get it on</div>
                    <div className="-mt-1 font-sans text-sm font-semibold">Google Play</div>
                  </div>
                </a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative mx-auto max-w-xs"
            >
              <div className="relative mx-auto h-[500px] w-[250px] overflow-hidden rounded-[2.5rem] border-[8px] border-gray-800 bg-gray-800 shadow-xl">
                <div className="absolute left-[50%] top-0 h-[30px] w-[150px] -translate-x-[50%] rounded-b-[1rem] bg-gray-800"></div>
                <div className="h-full w-full overflow-hidden rounded-[2rem] bg-white">
                  <Image
                    src="/mobile-app.jpg"
                    alt="ACTION Mobile App"
                    width={400}
                    height={800}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>

            </motion.div>
          </div>
        </div>
      </section>

      {/* Bounties Section */}
      <BountySection />

      {/* Organizations Section */}
      <OrganizationSection />

      {/* Featured Plots - Now with Horizontal Scroll */}
      <section id="plots-section" className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground md:text-4xl">Featured Plots</h2>
              <p className="mt-2 text-muted-foreground">
                Limited availability. Secure your plot before they{"'re"} gone.
              </p>
            </div>
            <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
              <Filter className="mr-2 h-4 w-4" />
              Filter Plots
            </Button>
          </div>

          <HorizontalScroll>
            {plots.map((plot) => (
              <PlotCard key={plot.id} {...plot} />
            ))}
          </HorizontalScroll>
        </div>
      </section>

      {/* Availability Chart */}
      <section className="bg-muted py-20">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <h2 className="mb-6 text-3xl font-bold text-foreground md:text-4xl">Limited Plots Available</h2>
              <p className="mb-6 text-muted-foreground">
                Our exclusive development is selling fast. With only 30% of plots remaining, secure your investment
                today before they{"'re"} all gone.
              </p>

              <div className="mb-8">
                <div className="mb-2 flex justify-between">
                  <span>Availability</span>
                  <span className="text-primary">30% Remaining</span>
                </div>
                <div className="h-4 w-full overflow-hidden rounded-full bg-muted-foreground/20">
                  <div className="h-full w-[30%] rounded-full bg-gradient-to-r from-primary to-primary/60"></div>
                </div>
              </div>

              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Reserve Your Plot Now</Button>
            </div>

            <div className="relative h-[400px] w-full overflow-hidden rounded-lg shadow-lg">
              <ImageWithFallback src="/images/plot-sale.jpeg" alt="Plot Availability" fill className="object-cover" />
              <div className="absolute inset-0 bg-background/30"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-lg bg-card/90 p-8 text-center shadow-lg">
                  <h3 className="mb-4 text-2xl font-bold text-primary">Act Fast</h3>
                  <p className="mb-4 text-foreground">
                    Premium plots are selling quickly. Don{"'t"} miss your chance to own a piece of the future.
                  </p>
                  <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                    Schedule Viewing
                  </Button>
                </div>
              </div>
            </div>
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

  const [scrollY, setScrollY] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)

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
        "fixed top-0 z-50 flex h-16 w-full items-center right-0 transition-all duration-300",
        // Show header only when scrolled past hero or when slightly scrolled
        isPastHero ? "translate-y-0 opacity-100" : isScrolled ? "bg-transparent translate-y-0 opacity-100" : "-translate-y-full opacity-0",
        // Glass effect when past hero
        isPastHero && "bg-background/70 backdrop-blur-md shadow-sm",
        isMobile ? "px-4" : sidebarExpanded ? "lg:pl-64" : "lg:pl-16",
        className,
      )}
    >
      <div className="flex w-full items-center justify-between">
        {/* Left section - Logo and Search */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center">
            <div className="relative hidden h-10 w-10 md:block transition-all duration-500 ease-in-out">
              <Image
                alt="logo"
                src="/images/action/logo.png"
                height={200}
                width={200}
                className="h-full w-full transition-transform duration-500 ease-in-out"
              />
            </div>
            <span className="ml-2 font-semibold text-foreground">ACTION</span>
          </Link>
        </div>

        {/* Center section - Navigation (desktop only) */}
        <nav className="hidden md:block">
          <ul className="flex gap-6">
            <Button
              variant="link"
              className="p-0 text-foreground hover:text-primary"
              onClick={() => {
                const section = document.getElementById("bounties-section")
                section?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              Bounties
            </Button>
            <Button
              className="p-0 text-foreground hover:text-primary"
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
              className="p-0 text-foreground hover:text-primary"
              onClick={() => {
                const section = document.getElementById("plots-section")
                section?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              Plots
            </Button>
            <Button
              variant="link"
              className="p-0 text-foreground hover:text-primary"
              onClick={() => {
                const section = document.getElementById("download-section")
                section?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              Download App
            </Button>
          </ul>
        </nav>

        {/* Right section - Actions */}
        <div className="flex items-center space-x-2">
          <ConnectWalletButton />

          {/* Mobile menu button */}
          <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}
