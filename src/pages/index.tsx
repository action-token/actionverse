import Image from "next/image"
import Link from "next/link"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { MapPin, Phone, Mail, Check, Filter } from "lucide-react"


import { useState, useEffect, useRef } from "react"
import { Bell, Search, User, Menu } from "lucide-react"

import { cn } from "~/lib/utils"

import { ImageWithFallback } from "~/components/common/image-with-fallback"
import { HomeVideoPlayer } from "~/components/common/home-video-player"
import { HorizontalScroll } from "~/components/common/horizontal-scroll"
import { bounties, organizations, plots } from "~/components/dummy-data/mock-data"
import { BountyCard, BountySection } from "~/components/bounty/bounty-card"
import { OrganizationCard, OrganizationSection } from "~/components/creator/organization-card"
import { PlotCard } from "~/components/plot/plot-card"

export default function Home() {


  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-800">
      <Header />
      {/* Hero Section with Video Background */}
      <section className="relative h-[50vh] w-full rounded-b-xl overflow-hidden bg-black text-white">
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
          <div className="mb-6 flex items-center justify-center">

            <div className="mr-4 text-6xl font-bold  tracking-widest text-green-600">ACTION</div>
          </div>
          <h1 className="mb-6 text-4xl font-bold leading-tight text-white md:text-6xl">
            Premium Land Plots with <span className="text-green-600">Digital Innovation</span>
          </h1>
          <p className="mb-8 max-w-2xl text-lg text-gray-300">
            Secure your future with our exclusive tech-integrated land plots. Limited availability. Revolutionary
            ownership experience.
          </p>
          <div className="flex  items-center justify-center gap-4">
            <Button
              className="bg-green-600 px-8 py-6 text-lg hover:bg-green-700"
              onClick={() => {
                const section = document.getElementById("plots-section")
                section?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              Explore Plots
            </Button>
            <Button
              variant="outline"
              className="border-green-600 px-8 py-6 text-lg text-green-600 hover:bg-green-50"
              onClick={() => {
                const section = document.getElementById("bounties-section")
                section?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              Join Bounties
            </Button>
          </div>
        </div>
      </section>

      {/* Bounties Section */}


      <BountySection />



      {/* About Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">The Future of Land Ownership</h2>
            <p className="mx-auto max-w-2xl text-gray-600">
              ACTION is revolutionizing how you invest in and experience land ownership with cutting-edge technology and
              sustainable practices.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-lg bg-white p-6 shadow-md transition-all hover:shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                <Check size={24} />
              </div>
              <h3 className="mb-3 text-xl font-bold">Digital Integration</h3>
              <p className="text-gray-600">
                Each plot comes with digital mapping and blockchain verification for secure, transparent ownership.
              </p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-md transition-all hover:shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                <Check size={24} />
              </div>
              <h3 className="mb-3 text-xl font-bold">Premium Locations</h3>
              <p className="text-gray-600">
                Strategically selected plots in high-growth areas with excellent connectivity and future development
                potential.
              </p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-md transition-all hover:shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                <Check size={24} />
              </div>
              <h3 className="mb-3 text-xl font-bold">Sustainable Development</h3>
              <p className="text-gray-600">
                Eco-friendly infrastructure planning with renewable energy options and green space preservation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Organizations Section */}



      <OrganizationSection />




      {/* Featured Plots - Now with Horizontal Scroll */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">Featured Plots</h2>
              <p className="mt-2 text-gray-600">Limited availability. Secure your plot before they{"'re"} gone.</p>
            </div>
            <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
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
      <section className="bg-gray-100 py-20">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <h2 className="mb-6 text-3xl font-bold text-gray-900 md:text-4xl">Limited Plots Available</h2>
              <p className="mb-6 text-gray-600">
                Our exclusive development is selling fast. With only 30% of plots remaining, secure your investment
                today before they{"'re"} all gone.
              </p>

              <div className="mb-8">
                <div className="mb-2 flex justify-between">
                  <span>Availability</span>
                  <span className="text-green-600">30% Remaining</span>
                </div>
                <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full w-[30%] rounded-full bg-gradient-to-r from-green-600 to-yellow-500"></div>
                </div>
              </div>

              <Button className="bg-green-600 hover:bg-green-700">Reserve Your Plot Now</Button>
            </div>

            <div className="relative h-[400px] w-full overflow-hidden rounded-lg shadow-lg">
              <ImageWithFallback src="/images/plot-sale.jpeg" alt="Plot Availability" fill className="object-cover" />
              <div className="absolute inset-0 bg-white/30"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-lg bg-white/90 p-8 text-center shadow-lg">
                  <h3 className="mb-4 text-2xl font-bold text-green-600">Act Fast</h3>
                  <p className="mb-4 text-gray-700">
                    Premium plots are selling quickly. Don{"'t"} miss your chance to own a piece of the future.
                  </p>
                  <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
                    Schedule Viewing
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


    </div >
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
    }

    const handleResize = () => {
      setViewportHeight(window.innerHeight)
    }

    // Add event listeners
    window.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("resize", handleResize)

    // Initial check
    handleScroll()

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
        isPastHero ? "translate-y-0 opacity-100" : isScrolled ? "bg-transparent" : "-translate-y-full opacity-0",
        // Glass effect when past hero
        isPastHero && "bg-white/70 backdrop-blur-md shadow-sm",
        isMobile ? "px-4" : sidebarExpanded ? "lg:pl-64" : "lg:pl-16",
        className,
      )}
    >
      <div className="flex w-full items-center justify-between">
        {/* Left section - Logo and Search */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center">
            <div className="relative hidden h-16 w-16 md:block transition-all duration-500 ease-in-out">
              <Image
                alt="logo"
                src="/images/action/logo.png"
                height={200}
                width={200}
                className="h-full w-full transition-transform duration-500 ease-in-out"
              />
            </div>
          </Link>


        </div>

        {/* Center section - Navigation (desktop only) */}
        <nav className="hidden lg:block">
          <ul className="flex space-x-6">

            <Button
              variant="link"
              onClick={() => {
                const section = document.getElementById("bounties-section")
                section?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              Bounties
            </Button>
            <Button
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
              onClick={() => {
                const section = document.getElementById("plots-section")
                section?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              Plots
            </Button>
          </ul>
        </nav>

        {/* Right section - Actions */}
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" className="text-gray-600">
            <Bell className="h-5 w-5" />
          </Button>

          <Button variant="ghost" size="icon" className="text-gray-600">
            <User className="h-5 w-5" />
          </Button>

          <Button className="hidden lg:inline-flex bg-green-600 hover:bg-green-700">Reserve Plot</Button>

          {/* Mobile menu button */}
          <Button variant="ghost" size="icon" className="lg:hidden text-gray-600">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}
