"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { cn } from "~/lib/utils";
import exp from "constants";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "~/components/shadcn/ui/card";
import { api } from "~/utils/api";
import { Button } from "~/components/shadcn/ui/button";
import { MoreAssetsSkeleton } from "~/components/common/grid-loading";
import { useMusicTabStore } from "~/components/store/tabs/music-tabs";
import { addrShort } from "~/utils/utils";
import { useMusicBuyModalStore } from "~/components/store/music-buy-store";
import { SongItemType } from "~/types/song/song-item-types";
import AlbumTab from "~/components/music/album/album-tab";
import RecentAddedSongsTab from "~/components/music/recently-added-tab";
import AllSongsTab from "~/components/music/all-song-tab";
import { AlignJustify, ArrowUpFromLine, Minus, MusicIcon, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "~/components/shadcn/ui/avatar";
import { Slider } from "@radix-ui/react-slider";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "~/components/shadcn/ui/drawer"
// Global Variables
const TABS = ["ALL SONGS", "ALBUMS", "FAVORITES", "RECENTLY ADDED"];

const Music = () => {
    const songs = api.music.song.getUserBuyedSongs.useQuery();

    return (
        <div className="flex h-[calc(100vh-11.8vh)] w-full grid-cols-1 gap-2 lg:grid lg:grid-cols-[1fr_300px] relative">
            {/* Left Section (Scrollable) */}
            <div className="col-span-1 w-full overflow-y-auto scrollbar-hide ">
                <div className="flex w-full flex-col gap-4 ">
                    <MusicCarousel />
                    <div className="w-full">
                        <MusicTabs />
                    </div>
                </div>
            </div>

            {/* Right Sidebar (Fixed, Visible only on lg screens) */}
            <div className="sticky top-[5.8rem] hidden h-[calc(100vh-11vh)] self-start overflow-y-auto lg:block">
                <RightSideItem />
            </div>

            <Drawer>
                <DrawerTrigger asChild>
                    <div className="fixed bottom-0 left-0 right-0 bg-primary p-2 flex items-center justify-center lg:hidden"

                    >
                        <ArrowUpFromLine size={20} />
                    </div>
                </DrawerTrigger>
                <DrawerContent>
                    <div className="w-full ">
                        <DrawerHeader>
                            <DrawerTitle className="text-center">PLAYABLE SONG</DrawerTitle>

                        </DrawerHeader>
                        <div className="overflow-y-auto h-[calc(100vh-50vh)] w-full">
                            {
                                songs.data?.length === 0 && (
                                    <div className="flex items-center justify-center h-full w-full">
                                        <h1 className="text-lg font-bold">No Playable Song</h1>
                                    </div>
                                )
                            }

                            {songs.data?.map((song) => (
                                <Card
                                    key={song.id}
                                    className="m-1 flex items-center justify-between  rounded-sm p-1  shadow-sm shadow-slate-300"
                                >
                                    <div className="flex items-center gap-2">
                                        <Image
                                            src={song.asset.thumbnail ?? "/placeholder.svg"}
                                            alt="Thumbnail"
                                            width={50}
                                            height={50}
                                            className="h-14
                                    w-14 rounded-sm object-cover 
                                    "
                                        />
                                        <div>
                                            <h1 className="truncate text-lg font-semibold">
                                                {song.asset.name}
                                            </h1>
                                            <p className="text-xs font-semibold text-gray-400">
                                                {song.asset.creatorId
                                                    ? addrShort(song.asset.creatorId, 5)
                                                    : "ADMIN"}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="shadow-sm shadow-black"
                                    >
                                        <Play />
                                    </Button>
                                </Card>
                            ))}
                        </div>

                    </div>
                </DrawerContent>
            </Drawer>

        </div>
    );
};

export default Music;

const MusicTabs = () => {
    const { seletedTab, setSelectedTab } = useMusicTabStore();
    return (
        <Card>
            <CardHeader className="w-full rounded-md bg-secondary p-2 md:p-4">
                <CardTitle className="flex w-full gap-2 p-0 md:gap-4">
                    {TABS.map((tab) => (
                        <Button
                            key={tab}
                            onClick={() => setSelectedTab(tab)}
                            className={cn(
                                "md:text-md flex w-1/2 px-2 text-xs shadow-sm shadow-black transition-all duration-300 ease-in-out lg:px-10",
                                seletedTab === tab
                                    ? "w-full border-2 font-bold text-destructive border-destructive bg-background hover:bg-background"
                                    : " ",
                            )}
                        >
                            {tab}
                        </Button>
                    ))}
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[calc(100vh-20vh)] overflow-y-auto p-0 scrollbar-hide">
                <div>
                    {seletedTab === "ALL SONGS" && (
                        <div className="">
                            <AllSongsTab />
                        </div>
                    )}
                    {seletedTab === "ALBUMS" && (
                        <div className="">
                            <AlbumTab />
                        </div>
                    )}
                    {seletedTab === "FAVORITES" && <div className=""></div>}
                    {seletedTab === "RECENTLY ADDED" && (
                        <div>
                            <RecentAddedSongsTab />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

const RightSideItem = () => {
    const songs = api.music.song.getUserBuyedSongs.useQuery();
    const selectedSong = songs.data?.[0];
    if (songs.isLoading) return <RightSideItemSkeleton />;

    return (
        <div className="flex h-[calc(100vh-12vh)] flex-col gap-2 overflow-y-auto">
            <Card className=" ">
                <CardHeader className="rounded-sm bg-primary p-4 shadow-sm shadow-slate-300">
                    <h1 className="text-center text-2xl font-bold  text-background">PLAYABLE SONG</h1>
                </CardHeader>
                <CardContent className="h-[calc(100vh-45vh)] overflow-y-auto p-0 scrollbar-hide ">
                    {
                        songs.data?.length === 0 && (
                            <div className="flex items-center justify-center h-full w-full">
                                <h1 className="text-lg font-bold">No Playable Song</h1>
                            </div>
                        )
                    }
                    {songs.data?.map((song) => (
                        <Card
                            key={song.id}
                            className="m-1 flex items-center justify-between  rounded-sm p-1  shadow-sm shadow-slate-300"
                        >
                            <div className="flex items-center gap-2">
                                <Image
                                    src={song.asset.thumbnail ?? "/placeholder.svg"}
                                    alt="Thumbnail"
                                    width={50}
                                    height={50}
                                    className="h-14
                                    w-14 rounded-sm object-cover 
                                    "
                                />
                                <div>
                                    <h1 className="truncate text-lg font-semibold">
                                        {song.asset.name}
                                    </h1>
                                    <p className="text-xs font-semibold text-gray-400">
                                        {song.asset.creatorId
                                            ? addrShort(song.asset.creatorId, 5)
                                            : "ADMIN"}
                                    </p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="destructive"
                                className="shadow-sm shadow-black"
                            >
                                <Play />
                            </Button>
                        </Card>
                    ))}
                </CardContent>
            </Card>
            <Card className=" ">
                <CardHeader className="rounded-sm bg-primary p-4 shadow-sm shadow-slate-300">
                    <h1 className="text-center text-2xl font-bold  text-background">NOW PLAYTING</h1>
                </CardHeader>
                <CardContent className=" mt-2 ">
                    {selectedSong ? (
                        <div className="flex flex-col border-1 rounded-md  items-center justify-center shadow-sm shadow-slate-300">
                            <Image
                                src={selectedSong.asset.thumbnail ?? "/placeholder.svg"}
                                alt="Now Playing"
                                width={60}
                                height={60}
                                className="h-20 w-20 rounded-md object-cover"
                            />
                            <div className="flex flex-col items-center justify-center">
                                <h2 className="truncate text-lg font-semibold">
                                    {selectedSong.asset.name}
                                </h2>
                                <p className="truncate text-sm text-muted-foreground">
                                    {selectedSong.asset.creatorId ?? "ADMIN"}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <p className="text-muted-foreground">No song selected</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

function MusicCarousel() {
    const RecentAddedSong = api.music.song.getRecentSong.useQuery({
        limit: 5,
    });
    const [currentSlide, setCurrentSlide] = useState(2);
    const { setData, setIsOpen } = useMusicBuyModalStore();
    const goToSlide = (index: number) => {
        setCurrentSlide(index);
    };

    const nextSlide = () => {
        if (RecentAddedSong.data) {
            setCurrentSlide((prev) =>
                prev === RecentAddedSong.data.length - 1 ? 0 : prev + 1,
            );
        }
    };

    const prevSlide = () => {
        if (RecentAddedSong.data) {
            setCurrentSlide((prev) =>
                prev === 0 ? RecentAddedSong.data.length - 1 : prev - 1,
            );
        }
    };

    useEffect(() => {
        const interval = setInterval(() => {
            nextSlide();
        }, 4000);

        return () => clearInterval(interval);
    }, []);

    if (RecentAddedSong.isLoading) {
        return (
            <div className="relative h-[calc(100vh-55vh)] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-4 shadow-lg sm:h-[calc(100vh-60vh)] md:h-[42vh]">
                {/* Background skeleton */}
                <div className="absolute inset-0 z-0 animate-pulse rounded-md bg-gray-800" />

                {/* Info box skeleton */}
                <div className="absolute left-8 top-8 z-50 hidden rounded-lg border-2 bg-black/40 px-4 py-3 backdrop-blur-sm md:block">
                    <div className="space-y-2">
                        <div className="h-4 w-48 animate-pulse rounded bg-gray-700" />
                        <div className="h-4 w-40 animate-pulse rounded bg-gray-700" />
                    </div>
                </div>

                {/* Carousel items skeleton */}
                <div className="relative mx-auto h-[390px] max-w-7xl overflow-hidden pt-8">
                    <div className="relative h-full">
                        {/* Center card */}
                        <div className="absolute left-1/2 z-30 h-[280px] w-[260px] -translate-x-1/2 -translate-y-5 md:h-[320px] md:w-[280px]">
                            <div className="h-full w-full animate-pulse rounded-2xl bg-gray-700 shadow-[0_0_15px_rgba(255,255,255,0.15)]">
                                <div className="absolute bottom-2 left-2 right-2 rounded-xl border-2 bg-black/50 p-4">
                                    <div className="mb-2 h-6 w-3/4 animate-pulse rounded bg-gray-600" />
                                    <div className="h-4 w-1/2 animate-pulse rounded bg-gray-600" />
                                </div>
                            </div>
                        </div>

                        {/* Left card */}
                        <div className="absolute left-1/2 z-20 h-[230px] w-[240px] -translate-x-[105%] translate-y-7 md:h-[250px] md:w-[250px] md:translate-y-12">
                            <div className="h-full w-full animate-pulse rounded-2xl bg-gray-700 shadow-[0_0_15px_rgba(255,255,255,0.15)]" />
                        </div>

                        {/* Right card */}
                        <div className="absolute left-1/2 z-20 h-[230px] w-[240px] translate-x-[5%] translate-y-7 md:h-[250px] md:w-[250px] md:translate-y-12">
                            <div className="h-full w-full animate-pulse rounded-2xl bg-gray-700 shadow-[0_0_15px_rgba(255,255,255,0.15)]" />
                        </div>

                        {/* Far left card */}
                        <div className="absolute left-1/2 z-10 h-[180px] w-[180px] -translate-x-[180%] translate-y-20 md:h-[200px] md:w-[200px] md:translate-y-24">
                            <div className="h-full w-full animate-pulse rounded-2xl bg-gray-700 shadow-[0_0_15px_rgba(255,255,255,0.15)]" />
                        </div>

                        {/* Far right card */}
                        <div className="absolute left-1/2 z-10 h-[180px] w-[180px] translate-x-[80%] translate-y-20 md:h-[200px] md:w-[200px] md:translate-y-24">
                            <div className="h-full w-full animate-pulse rounded-2xl bg-gray-700 shadow-[0_0_15px_rgba(255,255,255,0.15)]" />
                        </div>
                    </div>

                    {/* Dots skeleton */}
                    <div className="absolute bottom-14 left-1/2 z-40 flex -translate-x-1/2 gap-3 md:bottom-6">
                        {Array.from({ length: 5 }, (_, index: number) => (
                            <div
                                key={index}
                                className="mx-1 h-2 w-2 animate-pulse rounded-full bg-gray-500"
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    }
    if (!RecentAddedSong.data) return null;
    return (
        <>
            <div className="relative h-[calc(100vh-55vh)] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-4 shadow-lg sm:h-[calc(100vh-60vh)] md:h-[42vh]">
                <div className="absolute inset-0 z-0 rounded-md">
                    <Image
                        src={
                            RecentAddedSong.data[currentSlide]?.asset.thumbnail ??
                            "/placeholder.svg"
                        }
                        alt="Background"
                        fill
                        className="rounded-md object-cover transition-opacity duration-1000 ease-in-out"
                        style={{ filter: "blur(15px)" }}
                    />
                    <div className="absolute inset-0 bg-black/50" />
                </div>
                <div className="absolute left-8 top-8 z-50 hidden rounded-lg border-2 bg-black/40 px-4 py-3 text-white backdrop-blur-sm md:block">
                    <div className="space-y-0.5 ">
                        <p className="text-sm font-medium">
                            NAME :{" "}
                            <span className="text-white">
                                {RecentAddedSong.data[currentSlide]?.asset.name}
                            </span>
                        </p>
                        <p className="text-sm font-medium">
                            ARTISTS :{" "}
                            <span className="text-gray-400">
                                {RecentAddedSong.data[currentSlide]?.asset.creatorId
                                    ? addrShort(
                                        RecentAddedSong.data[currentSlide]?.asset.creatorId,
                                        5,
                                    )
                                    : "ADMIN"}
                            </span>
                        </p>
                        <Button
                            size="sm"
                            variant="destructive"
                            className="w-full shadow-sm shadow-black "
                            onClick={() => {
                                setData(RecentAddedSong.data[currentSlide] as SongItemType);
                                setIsOpen(true);
                            }}
                        >
                            BUY NOW
                        </Button>
                    </div>
                </div>

                <div className="relative mx-auto h-[390px] max-w-7xl overflow-hidden pt-8">
                    <div className="relative h-full">
                        {RecentAddedSong.data.map((slide, index) => {
                            const position =
                                (index - currentSlide + RecentAddedSong.data.length) %
                                RecentAddedSong.data.length;

                            return (
                                <div
                                    key={slide.id}
                                    onClick={() => {
                                        setData(slide as SongItemType);
                                        setIsOpen(true);
                                    }}
                                    className={cn(
                                        "absolute left-1/2 transform transition-all duration-700 ease-out",
                                        {
                                            "z-30 h-[280px] w-[260px] -translate-x-1/2 -translate-y-5 md:h-[320px] md:w-[280px]":
                                                position === 0,
                                            "z-20 h-[230px] w-[240px] -translate-x-[105%] translate-y-7 opacity-100 md:h-[250px]  md:w-[250px] md:translate-y-12":
                                                position === RecentAddedSong.data.length - 1,
                                            "z-20 h-[230px] w-[240px]  translate-x-[5%] translate-y-7 opacity-100 md:h-[250px]  md:w-[250px] md:translate-y-12":
                                                position === 1,
                                            "z-10 h-[180px] w-[180px] -translate-x-[180%]  translate-y-20 opacity-100 md:h-[200px]  md:w-[200px] md:translate-y-24":
                                                position === RecentAddedSong.data.length - 2,
                                            "w-[180px z-10 h-[180px] translate-x-[80%] translate-y-20 opacity-100 md:h-[200px] md:w-[200px] md:translate-y-24":
                                                position === 2,
                                            invisible:
                                                position > 2 &&
                                                position < RecentAddedSong.data.length - 2,
                                        },
                                    )}
                                >
                                    <div className="relative h-full w-full overflow-hidden rounded-2xl shadow-[0_0_15px_rgba(255,255,255,0.15)] transition-transform">
                                        <Image
                                            src={slide.asset.thumbnail ?? "/placeholder.svg"}
                                            alt={slide.asset.name}
                                            fill
                                            className="object-cover"
                                            priority
                                        />
                                        <div className="absolute bottom-2 left-2 right-2 rounded-xl border-2 bg-black/50 p-4 backdrop-blur-sm">
                                            <h3 className="truncate text-xl font-bold text-white">
                                                {slide.asset.name}
                                            </h3>
                                            <p className="text-sm font-bold text-gray-100">
                                                {slide.asset.creatorId
                                                    ? addrShort(slide.asset.creatorId, 5)
                                                    : "ADMIN"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="absolute bottom-14 left-1/2 z-40 flex -translate-x-1/2 gap-3 md:bottom-8">
                        {RecentAddedSong.data.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => goToSlide(index)}
                                className={`mx-1 h-2 w-2 rounded-full ${index === currentSlide ? "bg-white" : "bg-gray-500"}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}


const RightSideItemSkeleton = () => {
    // Generate array of 5 items for skeleton loading
    const skeletonItems = Array.from({ length: 8 }, (_, i) => i);

    return (
        <div className="flex h-full flex-col gap-2 overflow-y-auto">
            <Card className="flex-grow">
                <CardHeader className="rounded-sm bg-primary p-4 shadow-sm shadow-slate-300">
                    <h1 className="text-center text-2xl font-bold">PLAYABLE SONG</h1>
                </CardHeader>
                <CardContent className="h-[calc(100vh-41vh)] overflow-y-auto p-0 scrollbar-hide">
                    {skeletonItems.map((item) => (
                        <Card
                            key={item}
                            className="m-1 flex items-center justify-between rounded-sm p-1 shadow-sm shadow-slate-300"
                        >
                            <div className="flex items-center gap-2">
                                <div className="h-14 w-14 animate-pulse rounded-sm bg-gray-200" />
                                <div>
                                    <div className="h-5 w-32 animate-pulse rounded-md bg-gray-200" />
                                    <div className="mt-1 h-3 w-20 animate-pulse rounded-md bg-gray-200" />
                                </div>
                            </div>
                            <div className="h-8 w-8 animate-pulse rounded-md bg-gray-200" />
                        </Card>
                    ))}
                </CardContent>
            </Card>

            <Card className="h-1/4">
                <CardHeader className="rounded-sm bg-primary p-4 shadow-sm shadow-slate-300">
                    <h1 className="text-center text-2xl font-bold">NOW PLAYING</h1>
                </CardHeader>
                <CardContent className="mt-2">
                    <div className="flex flex-col items-center justify-center rounded-md border-1 shadow-sm shadow-slate-300">
                        <div className="h-20 w-20 animate-pulse rounded-md bg-gray-200" />
                        <div className="flex flex-col items-center justify-center">
                            <div className="mt-2 h-5 w-40 animate-pulse rounded-md bg-gray-200" />
                            <div className="mt-1 h-3 w-24 animate-pulse rounded-md bg-gray-200" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
