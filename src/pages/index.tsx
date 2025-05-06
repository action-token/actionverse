import Image from "next/image"
import Link from "next/link"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { MapPin, Phone, Mail, Check, Filter } from "lucide-react"



import { ImageWithFallback } from "~/components/common/image-with-fallback"
import { HomeVideoPlayer } from "~/components/common/home-video-player"
import { HorizontalScroll } from "~/components/common/horizontal-scroll"
import { bounties, organizations, plots } from "~/components/dummy-data/mock-data"
import { BountyCard } from "~/components/bounty/bounty-card"
import { OrganizationCard } from "~/components/creator/organization-card"
import { PlotCard } from "~/components/plot/plot-card"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-800">
      {/* Hero Section with Video Background */}
      <section className="relative h-screen w-full overflow-hidden bg-black text-white">
        <div className="absolute inset-0 z-0">
          {/* Mobile: Static image instead of video */}
          <div className="md:hidden">
            <Image src="/images/blocks-static.jpg" alt="ACTION Blocks" fill priority className="object-cover" />
            <div className="absolute inset-0 bg-black/50"></div>
          </div>

          {/* Desktop: Lazy-loaded video with poster image */}
          <div className="hidden md:block">
            <HomeVideoPlayer src="/videos/Hand.mp4" poster="/images/action/blocks-static.jpg" />
            <div className="absolute inset-0 bg-black/50"></div>
          </div>
        </div>

        <div className="container relative z-10 mx-auto flex h-full flex-col items-center justify-center px-4 text-center">
          <div className="mb-6 flex items-center justify-center">
            <div className="mr-4 text-6xl font-bold text-white">A</div>
            <div className="text-4xl font-light tracking-widest text-green-600">ACTION</div>
          </div>
          <h1 className="mb-6 text-4xl font-bold leading-tight text-white md:text-6xl">
            Premium Land Plots with <span className="text-green-600">Digital Innovation</span>
          </h1>
          <p className="mb-8 max-w-2xl text-lg text-gray-300">
            Secure your future with our exclusive tech-integrated land plots. Limited availability. Revolutionary
            ownership experience.
          </p>
          <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
            <Button className="bg-green-600 px-8 py-6 text-lg hover:bg-green-700">Explore Plots</Button>
            <Button variant="outline" className="border-green-600 px-8 py-6 text-lg text-green-600 hover:bg-green-50">
              Join Bounties
            </Button>
          </div>
        </div>
      </section>

      {/* Bounties Section */}
      <section className="bg-gray-100 py-20">
        <div className="container mx-auto px-4">
          <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">Available Bounties</h2>
              <p className="mt-2 text-gray-600">Complete tasks and earn rewards in our digital ecosystem.</p>
            </div>
            <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
              <Filter className="mr-2 h-4 w-4" />
              Filter Bounties
            </Button>
          </div>

          <HorizontalScroll>
            {bounties.map((bounty) => (
              <BountyCard key={bounty.id} {...bounty} />
            ))}
          </HorizontalScroll>
        </div>
      </section>

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
      <section className="bg-gray-100 py-20">
        <div className="container mx-auto px-4">
          <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">Join Organizations</h2>
              <p className="mt-2 text-gray-600">Connect with communities of like-minded property owners.</p>
            </div>
            <Button className="bg-green-600 hover:bg-green-700">View All Organizations</Button>
          </div>

          <HorizontalScroll>
            {organizations.map((org) => (
              <OrganizationCard key={org.id} {...org} />
            ))}
          </HorizontalScroll>
        </div>
      </section>

      {/* Featured Plots - Now with Horizontal Scroll */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">Featured Plots</h2>
              <p className="mt-2 text-gray-600">Limited availability. Secure your plot before they're gone.</p>
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
                today before they're all gone.
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
                    Premium plots are selling quickly. Don't miss your chance to own a piece of the future.
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

      {/* Contact Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">Get In Touch</h2>
            <p className="mx-auto max-w-2xl text-gray-600">
              Interested in learning more? Our team is ready to assist you with any questions about our premium plots.
            </p>
          </div>

          <div className="grid gap-12 md:grid-cols-2">
            <div className="rounded-lg bg-white p-8 shadow-lg">
              <h3 className="mb-6 text-2xl font-bold text-gray-900">Contact Information</h3>

              <div className="mb-6 space-y-4">
                <div className="flex items-center">
                  <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                    <Phone size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Call Us</p>
                    <p className="font-medium text-gray-800">+1 (555) 123-4567</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                    <Mail size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email Us</p>
                    <p className="font-medium text-gray-800">info@actionplots.com</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Visit Our Office</p>
                    <p className="font-medium text-gray-800">123 Tech Boulevard, Innovation District</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 rounded-lg bg-gray-100 p-6">
                <h4 className="mb-4 text-lg font-bold text-gray-900">Office Hours</h4>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex justify-between">
                    <span>Monday - Friday</span>
                    <span>9:00 AM - 6:00 PM</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Saturday</span>
                    <span>10:00 AM - 4:00 PM</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Sunday</span>
                    <span>Closed</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="rounded-lg bg-white p-8 shadow-lg">
              <h3 className="mb-6 text-2xl font-bold text-gray-900">Send Us a Message</h3>

              <form className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="mb-2 block text-sm text-gray-700">
                      Your Name
                    </label>
                    <Input id="name" placeholder="John Doe" className="border-gray-300 bg-white" />
                  </div>
                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm text-gray-700">
                      Your Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      className="border-gray-300 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="phone" className="mb-2 block text-sm text-gray-700">
                    Phone Number
                  </label>
                  <Input id="phone" placeholder="+1 (555) 123-4567" className="border-gray-300 bg-white" />
                </div>

                <div>
                  <label htmlFor="interest" className="mb-2 block text-sm text-gray-700">
                    I'm Interested In
                  </label>
                  <select id="interest" className="w-full rounded-md border border-gray-300 bg-white px-3 py-2">
                    <option>Premium Plots</option>
                    <option>Commercial Plots</option>
                    <option>Residential Plots</option>
                    <option>Investment Opportunities</option>
                    <option>Bounty Programs</option>
                    <option>Organizations</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="mb-2 block text-sm text-gray-700">
                    Your Message
                  </label>
                  <Textarea
                    id="message"
                    placeholder="I'm interested in learning more about..."
                    className="min-h-[120px] border-gray-300 bg-white"
                  />
                </div>

                <Button className="w-full bg-green-600 hover:bg-green-700">Send Message</Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-green-600 to-green-500 py-20 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-6 text-3xl font-bold md:text-4xl">Ready to Secure Your Future?</h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg">
            Don't miss this opportunity to own a premium plot in our exclusive development. Limited availability
            remaining.
          </p>
          <div className="flex flex-col justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
            <Button className="bg-white px-8 py-6 text-lg text-green-600 hover:bg-gray-100">Reserve Your Plot</Button>
            <Button variant="outline" className="border-white px-8 py-6 text-lg text-white hover:bg-green-500/10">
              Join Bounty Program
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-100 py-12">
        <div className="container mx-auto px-4">
          <div className="mb-8 grid gap-8 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center">
                <div className="mr-2 text-3xl font-bold text-gray-800">A</div>
                <div className="text-xl font-light tracking-widest text-green-600">ACTION</div>
              </div>
              <p className="text-gray-600">Revolutionizing land ownership with technology and innovation.</p>
            </div>

            <div>
              <h4 className="mb-4 text-lg font-bold text-gray-900">Quick Links</h4>
              <ul className="space-y-2 text-gray-600">
                <li>
                  <Link href="#" className="hover:text-green-600">
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-green-600">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-green-600">
                    Available Plots
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-green-600">
                    Bounties
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-green-600">
                    Organizations
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-green-600">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-lg font-bold text-gray-900">Legal</h4>
              <ul className="space-y-2 text-gray-600">
                <li>
                  <Link href="#" className="hover:text-green-600">
                    Terms & Conditions
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-green-600">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-green-600">
                    Refund Policy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-green-600">
                    Legal Disclaimer
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-lg font-bold text-gray-900">Newsletter</h4>
              <p className="mb-4 text-gray-600">Subscribe to our newsletter for the latest updates and offers.</p>
              <div className="flex">
                <Input placeholder="Your email" className="rounded-r-none border-gray-300 bg-white" />
                <Button className="rounded-l-none bg-green-600 hover:bg-green-700">Subscribe</Button>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-8 text-center text-gray-600">
            <p>© {new Date().getFullYear()} ACTION Land Plots. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
