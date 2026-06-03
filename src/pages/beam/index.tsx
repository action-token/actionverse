import Link from "next/link"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { Sparkles, ImageIcon, Video, FileText, Wand2, ArrowRight, Eye, Heart, Zap, Star, Plus } from "lucide-react"
import { api } from "~/utils/api"

const beamTypes = [
    {
        type: "IMAGE",
        icon: ImageIcon,
        title: "Image Beam",
        description: "Upload photos with personal messages",
        color: "from-rose-500 to-orange-500",
        bgColor: "bg-gradient-to-br from-rose-500/10 to-orange-500/10",
        iconBg: "bg-rose-500/10",
        iconColor: "text-rose-600 dark:text-rose-400",
    },
    {
        type: "VIDEO",
        icon: Video,
        title: "Video Beam",
        description: "Share video messages & celebrations",
        color: "from-blue-500 to-cyan-500",
        bgColor: "bg-gradient-to-br from-blue-500/10 to-cyan-500/10",
        iconBg: "bg-blue-500/10",
        iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
        type: "CARD",
        icon: FileText,
        title: "Card Beam",
        description: "Design cards with Vibe Studio",
        color: "from-emerald-500 to-teal-500",
        bgColor: "bg-gradient-to-br from-emerald-500/10 to-teal-500/10",
        iconBg: "bg-emerald-500/10",
        iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
        type: "AI",
        icon: Wand2,
        title: "AI Art Beam",
        description: "Generate unique AI artwork",
        color: "from-violet-500 to-purple-500",
        bgColor: "bg-gradient-to-br from-violet-500/10 to-purple-500/10",
        iconBg: "bg-violet-500/10",
        iconColor: "text-violet-600 dark:text-violet-400",
    },
]


export default function HomePage() {
    const recentBeams = api.beam.recentBeams.useQuery().data ?? []
    return (

        <div className="min-h-screen">

            {/* Hero Section */}
            <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-background via-muted/20 to-background">
                <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
                <div className="relative mx-auto max-w-7xl px-4 py-16">
                    <div className="mx-auto max-w-3xl text-center">
                        <Badge variant="secondary" className="mb-4 gap-1.5 px-3 py-1.5">
                            <Sparkles className="h-3.5 w-3.5" />
                            Share moments that matter
                        </Badge>
                        <h1 className="mb-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                            Create memorable{" "}
                            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                                digital experiences
                            </span>
                        </h1>
                        <p className="mb-10 text-lg text-muted-foreground text-balance leading-relaxed max-w-2xl mx-auto">
                            Send personalized beams with images, videos, and AI-generated art. Make every message unforgettable.
                        </p>
                        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                            <Button size="lg" asChild className="gap-2 w-full sm:w-auto">
                                <Link href="/beam/create">
                                    <Sparkles className="h-4 w-4" />
                                    Start Creating
                                </Link>
                            </Button>
                            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto bg-transparent">
                                <Link href="/beam/gallery">
                                    Explore Beams
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-16">
                {/* Quick Create Section */}
                <section className="animate-fade-in-up">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold mb-2 text-balance">Choose Your Medium</h2>
                        <p className="text-muted-foreground text-balance">Select the perfect format to express yourself</p>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {beamTypes.map((beam, index) => (
                            <Link
                                key={beam.type}
                                href={`/beam/create?type=${beam.type.toLowerCase()}`} // Updated line
                                className="group animate-fade-in-up"
                                style={{ animationDelay: `${index * 100}ms` }}
                            >
                                <Card className="h-full overflow-hidden border-2 border-border/50 transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1">
                                    <CardContent className="relative p-6 h-full flex flex-col">
                                        <div
                                            className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${beam.bgColor}`}
                                        />
                                        <div className="relative flex-1 flex flex-col">
                                            <div
                                                className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${beam.iconBg} transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}
                                            >
                                                <beam.icon className={`h-7 w-7 ${beam.iconColor}`} />
                                            </div>
                                            <h3 className="mb-2 text-lg font-semibold text-balance">{beam.title}</h3>
                                            <p className="text-sm text-muted-foreground text-balance mb-4 flex-1">{beam.description}</p>
                                            <div className="flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-0 group-hover:translate-x-1">
                                                Create now
                                                <ArrowRight className="ml-1.5 h-4 w-4" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* Recent Activity */}
                <section className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
                    <div className="mb-8 flex items-end justify-between">
                        <div>
                            <h2 className="text-2xl font-bold mb-2 text-balance">Recent Activity</h2>
                            <p className="text-muted-foreground text-balance">Your latest beams and interactions</p>
                        </div>
                        <Button variant="ghost" size="sm" className="gap-1.5 hidden sm:flex" asChild>
                            <Link href="/beam/gallery">
                                View All
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </div>

                    <Card className="overflow-hidden">
                        <CardContent className="p-0">
                            <div className="divide-y divide-border">
                                {recentBeams.length > 0 ? (
                                    recentBeams.map((item, index) => (
                                        <Link
                                            key={item.id}
                                            href={`/beam/${item.id}`}
                                            className="flex items-center gap-4 p-5 transition-all hover:bg-muted/50 animate-fade-in-up"
                                            style={{ animationDelay: `${(index + 3) * 100}ms` }}
                                        >
                                            <div className="flex-shrink-0">
                                                <div
                                                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.type === "IMAGE"
                                                        ? "bg-rose-500/10"
                                                        : item.type === "VIDEO"
                                                            ? "bg-blue-500/10"
                                                            : item.type === "CARD"
                                                                ? "bg-emerald-500/10"
                                                                : "bg-violet-500/10"
                                                        }`}
                                                >
                                                    {item.type === "IMAGE" && <ImageIcon className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
                                                    {item.type === "VIDEO" && <Video className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
                                                    {item.type === "CARD" && (
                                                        <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                                    )}
                                                    {item.type === "AI" && <Wand2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
                                                </div>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-semibold truncate">{item.senderName}</span>
                                                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                                                    <span className="font-medium text-muted-foreground truncate">{item.recipientName}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className="text-xs">
                                                        {item.type}
                                                    </Badge>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-5 text-sm">
                                                <div className="flex items-center gap-1.5">
                                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-medium tabular-nums">{item.viewCount}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Heart className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-medium tabular-nums">{item.reactions.length}</span>
                                                </div>
                                            </div>

                                            <ArrowRight className="h-5 w-5 text-muted-foreground/30 flex-shrink-0 hidden sm:block" />
                                        </Link>
                                    ))
                                ) : (
                                    <div className="p-8 text-center">
                                        <p className="text-muted-foreground">No beams yet. Start creating!</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="mt-4 text-center sm:hidden">
                        <Button variant="outline" asChild className="w-full bg-transparent">
                            <Link href="/my-beams">View All My Beams</Link>
                        </Button>
                    </div>
                </section>

                {/* Feature Highlight */}
                <section className="animate-fade-in-up" style={{ animationDelay: "400ms" }}>
                    <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 shadow-xl shadow-primary/5">
                        <CardContent className="p-8 lg:p-12">
                            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                                <div className="space-y-4 flex-1">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                            <Zap className="h-5 w-5 text-primary" />
                                        </div>
                                        <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                                            New Feature
                                        </Badge>
                                    </div>
                                    <h3 className="text-3xl font-bold text-balance lg:text-4xl">AI-Powered Art Generation</h3>
                                    <p className="text-muted-foreground text-balance leading-relaxed text-lg max-w-2xl">
                                        Transform your ideas into stunning visual masterpieces with our advanced AI art generator. Simply
                                        describe your vision and watch it come to life in seconds.
                                    </p>
                                </div>
                                <Button size="lg" asChild className="gap-2 shrink-0 lg:self-start lg:mt-12">
                                    <Link href="/beam/create?type=ai">
                                        <Star className="h-5 w-5" />
                                        Try AI Art Now
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </section>
            </div>


        </div>

    )
}
