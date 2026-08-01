"use client";

import React, { useState } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/shadcn/ui/card";
import { Button } from "~/components/shadcn/ui/button";
import { Badge } from "~/components/shadcn/ui/badge";
import { Check, Palette, Lock } from "lucide-react";
import { cn } from "~/lib/utils";

interface Theme {
    id: string;
    name: string;
    description: string;
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
    };
    isPremium: boolean;
    isLocked: boolean;
}

const THEMES: Theme[] = [
    {
        id: "default",
        name: "Default",
        description: "Clean and professional default theme",
        colors: {
            primary: "#2563eb",
            secondary: "#f3f4f6",
            accent: "#8b5cf6",
            background: "#ffffff",
        },
        isPremium: false,
        isLocked: false,
    },
    {
        id: "dark",
        name: "Midnight",
        description: "Sleek dark theme for night owls",
        colors: {
            primary: "#3b82f6",
            secondary: "#1f2937",
            accent: "#10b981",
            background: "#111827",
        },
        isPremium: false,
        isLocked: false,
    },
    {
        id: "sunset",
        name: "Sunset",
        description: "Warm orange and pink gradient vibes",
        colors: {
            primary: "#f97316",
            secondary: "#fef3c7",
            accent: "#ec4899",
            background: "#fffbeb",
        },
        isPremium: false,
        isLocked: false,
    },
    {
        id: "ocean",
        name: "Ocean",
        description: "Calming blue and teal ocean colors",
        colors: {
            primary: "#0891b2",
            secondary: "#ecfeff",
            accent: "#14b8a6",
            background: "#f0fdfa",
        },
        isPremium: false,
        isLocked: false,
    },
    {
        id: "neon",
        name: "Neon Cyber",
        description: "Vibrant cyberpunk neon aesthetics",
        colors: {
            primary: "#f0abfc",
            secondary: "#1e1b4b",
            accent: "#22d3ee",
            background: "#0f0a19",
        },
        isPremium: true,
        isLocked: true,
    },
    {
        id: "forest",
        name: "Forest",
        description: "Natural greens inspired by nature",
        colors: {
            primary: "#16a34a",
            secondary: "#dcfce7",
            accent: "#84cc16",
            background: "#f0fdf4",
        },
        isPremium: true,
        isLocked: true,
    },
    {
        id: "royal",
        name: "Royal Purple",
        description: "Luxurious purple and gold accents",
        colors: {
            primary: "#7c3aed",
            secondary: "#faf5ff",
            accent: "#eab308",
            background: "#fefce8",
        },
        isPremium: true,
        isLocked: true,
    },
    {
        id: "monochrome",
        name: "Monochrome",
        description: "Elegant black and white minimalism",
        colors: {
            primary: "#171717",
            secondary: "#f5f5f5",
            accent: "#525252",
            background: "#ffffff",
        },
        isPremium: true,
        isLocked: true,
    },
];

const ThemesPage = () => {
    const [selectedTheme, setSelectedTheme] = useState<string>("default");

    const handleSelectTheme = (theme: Theme) => {
        if (theme.isLocked) {
            alert("This theme is premium. Upgrade to unlock!");
            return;
        }
        setSelectedTheme(theme.id);
    };

    return (
        <div className="flex h-[calc(100vh-10.8vh)] flex-col overflow-hidden">
            {/* Header */}
            <div className="border-b bg-secondary p-4">
                <div className="flex items-center gap-3">
                    <Palette className="h-8 w-8 text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold">NFT Themes</h1>
                        <p className="text-sm text-muted-foreground">
                            Customize your marketplace experience
                        </p>
                    </div>
                </div>
            </div>

            {/* Theme Grid */}
            <div className="flex-1 overflow-y-auto bg-white/40 p-6">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-6 flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Available Themes</h2>
                        <Badge variant="outline">
                            {THEMES.filter((t) => !t.isLocked).length} Free /{" "}
                            {THEMES.filter((t) => t.isPremium).length} Premium
                        </Badge>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {THEMES.map((theme) => (
                            <ThemeCard
                                key={theme.id}
                                theme={theme}
                                isSelected={selectedTheme === theme.id}
                                onSelect={() => handleSelectTheme(theme)}
                            />
                        ))}
                    </div>

                    {/* Premium Banner */}
                    <Card className="mt-8 overflow-hidden shadow-sm shadow-black">
                        <div className="flex flex-col items-center justify-between gap-4 bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white md:flex-row">
                            <div>
                                <h3 className="text-xl font-bold">Unlock Premium Themes</h3>
                                <p className="text-white/80">
                                    Get access to exclusive themes and customization options
                                </p>
                            </div>
                            <Button variant="secondary" className="shadow-sm shadow-black">
                                Upgrade Now
                            </Button>
                        </div>
                    </Card>

                    {/* Coming Soon */}
                    <div className="mt-8">
                        <h2 className="mb-4 text-xl font-semibold">Coming Soon</h2>
                        <div className="grid gap-4 md:grid-cols-3">
                            {["Custom Backgrounds", "Animated Themes", "Seasonal Themes"].map(
                                (feature) => (
                                    <Card key={feature} className="shadow-sm shadow-black">
                                        <CardContent className="flex items-center gap-3 p-4">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                                <Palette className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{feature}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Coming Q3 2026
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ),
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

function ThemeCard({
    theme,
    isSelected,
    onSelect,
}: {
    theme: Theme;
    isSelected: boolean;
    onSelect: () => void;
}) {
    return (
        <Card
            className={cn(
                "cursor-pointer overflow-hidden shadow-sm shadow-black transition-all hover:shadow-lg",
                isSelected && "ring-2 ring-primary",
                theme.isLocked && "opacity-75",
            )}
            onClick={onSelect}
        >
            {/* Color Preview */}
            <div className="relative h-24">
                <div
                    className="absolute inset-0"
                    style={{ backgroundColor: theme.colors.background }}
                />
                <div className="absolute inset-0 flex items-center justify-center gap-2 p-4">
                    <div
                        className="h-8 w-8 rounded-full shadow-sm"
                        style={{ backgroundColor: theme.colors.primary }}
                    />
                    <div
                        className="h-8 w-8 rounded-full shadow-sm"
                        style={{ backgroundColor: theme.colors.secondary }}
                    />
                    <div
                        className="h-8 w-8 rounded-full shadow-sm"
                        style={{ backgroundColor: theme.colors.accent }}
                    />
                </div>
                {theme.isLocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Lock className="h-8 w-8 text-white" />
                    </div>
                )}
                {isSelected && (
                    <div className="absolute right-2 top-2 rounded-full bg-primary p-1">
                        <Check className="h-4 w-4 text-white" />
                    </div>
                )}
            </div>

            <CardContent className="p-4">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold">{theme.name}</h3>
                    {theme.isPremium && (
                        <Badge variant="secondary" className="text-xs">
                            Premium
                        </Badge>
                    )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                    {theme.description}
                </p>
                <Button
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="mt-3 w-full shadow-sm shadow-black"
                    disabled={theme.isLocked}
                >
                    {theme.isLocked
                        ? "Unlock"
                        : isSelected
                          ? "Selected"
                          : "Apply Theme"}
                </Button>
            </CardContent>
        </Card>
    );
}

export default ThemesPage;
