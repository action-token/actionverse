"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/shadcn/ui/card";
import { Button } from "~/components/shadcn/ui/button";
import { PlusCircle, ShoppingBag, Palette, ArrowRight, Package } from "lucide-react";

const NFTHomePage = () => {
    return (
        <div className="flex h-[calc(100vh-10.8vh)] flex-col overflow-y-auto">
            {/* Hero Section */}
            <div className="relative flex min-h-[40vh] items-center justify-center bg-gradient-to-br from-primary/20 via-secondary to-primary/10 p-8">
                <div className="absolute inset-0 bg-[url('/images/logo.png')] bg-center bg-no-repeat opacity-5" />
                <div className="relative z-10 text-center">
                    <h1 className="text-4xl font-bold md:text-6xl">NFT Marketplace</h1>
                    <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                        Create, collect, and trade unique digital assets on the Stellar blockchain.
                        Powered by SEP-50 standard for maximum compatibility.
                    </p>
                    <div className="mt-8 flex flex-wrap justify-center gap-4">
                        <Link href="/nft/create">
                            <Button size="lg" className="shadow-sm shadow-black">
                                <PlusCircle className="mr-2 h-5 w-5" />
                                Create NFT
                            </Button>
                        </Link>
                        <Link href="/nft/browse">
                            <Button size="lg" variant="outline" className="shadow-sm shadow-black">
                                <ShoppingBag className="mr-2 h-5 w-5" />
                                Browse Marketplace
                            </Button>
                        </Link>
                        <Link href="/nft/my">
                            <Button size="lg" variant="outline" className="shadow-sm shadow-black">
                                <Package className="mr-2 h-5 w-5" />
                                My NFTs
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Features */}
            <div className="flex-1 bg-white/40 p-8">
                <h2 className="mb-8 text-center text-2xl font-bold">Get Started</h2>
                <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
                    <FeatureCard
                        href="/nft/create"
                        icon={<PlusCircle className="h-10 w-10" />}
                        title="Create NFTs"
                        description="Mint your digital art, music, videos, or 3D objects as NFTs on the Stellar blockchain."
                    />
                    <FeatureCard
                        href="/nft/browse"
                        icon={<ShoppingBag className="h-10 w-10" />}
                        title="Browse & Buy"
                        description="Discover and purchase unique digital collectibles from creators worldwide."
                    />
                    <FeatureCard
                        href="/nft/themes"
                        icon={<Palette className="h-10 w-10" />}
                        title="Themes"
                        description="Customize your NFT experience with different visual themes and layouts."
                    />
                </div>

                {/* Stats */}
                <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-4">
                    <StatCard label="Total NFTs" value="1,234" />
                    <StatCard label="Creators" value="456" />
                    <StatCard label="Total Volume" value="50K ACTION" />
                    <StatCard label="Collections" value="89" />
                </div>
            </div>
        </div>
    );
};

function FeatureCard({
    href,
    icon,
    title,
    description,
}: {
    href: string;
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <Link href={href}>
            <Card className="group h-full cursor-pointer shadow-sm shadow-black transition-all hover:shadow-lg">
                <CardHeader>
                    <div className="mb-2 text-primary transition-transform group-hover:scale-110">
                        {icon}
                    </div>
                    <CardTitle className="flex items-center gap-2">
                        {title}
                        <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <CardDescription>{description}</CardDescription>
                </CardContent>
            </Card>
        </Link>
    );
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <Card className="text-center shadow-sm shadow-black">
            <CardContent className="p-6">
                <p className="text-3xl font-bold">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
            </CardContent>
        </Card>
    );
}

export default NFTHomePage;
