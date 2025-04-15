"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "~/components/shadcn/ui/button";
import { Card, CardContent, CardTitle } from "~/components/shadcn/ui/card";
import { useMusicBuyModalStore } from "~/components/store/music-buy-store";

import { api } from "~/utils/api";
import { addrShort } from "~/utils/utils";



export default function Album() {
    const params = useParams();
    const userAssets = api.wallate.acc.getAccountInfo.useQuery();
    const { setData, setIsOpen } = useMusicBuyModalStore()
    const {
        data: album,
        isLoading,
        error,
    } = api.fan.music.getAlbum.useQuery(
        {
            id: Number(params?.id),
        },
        {
            enabled: !!Number(params?.id),
        },
    );

    if (isLoading) {
        return (
            <AlbumSkeleton />
        );
    }
    if (error) {
        return (<ErrorMessage message={error.message} />);
    }


    return (
        <div className="min-h-screen w-full overflow-hidden">
            {/* Album Header Section */}
            <div className="relative h-auto min-h-[400px] w-full overflow-hidden rounded-t-md">
                <Image
                    src={album?.coverImgUrl ?? "/placeholder.svg"}
                    alt="Background"
                    fill
                    className="rounded-md object-cover transition-opacity duration-1000 ease-in-out"
                    style={{ filter: "blur(15px)" }}
                />
                <div className="absolute inset-0 bg-black/50" />

                {/* Content Container */}
                <div className="relative z-10 flex h-full flex-col items-center p-4 md:flex-row md:items-center md:p-8">
                    {/* Album Art */}
                    <div className="relative mb-6 md:mb-0">
                        <div className="h-[250px] w-[250px] overflow-hidden rounded-lg shadow-2xl md:h-[300px] md:w-[300px]">
                            <Image
                                src={album?.coverImgUrl ?? "/placeholder.svg"}
                                alt="Album Cover"
                                height={300}
                                width={300}
                                className="h-full w-full object-cover"
                            />
                        </div>
                    </div>

                    {/* Album Info */}
                    <div className="text-center md:ml-8 md:text-left">
                        <h1 className="mb-4 text-4xl font-bold truncate text-white md:text-8xl">
                            {album?.name}
                        </h1>
                        <div className="space-y-2">
                            <p className="text-sm text-gray-200">{album.description}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Album Details Section */}
            {album?.songs.length === 0 && <EmptyAlbum coverImgUrl={album.coverImgUrl} />}

            {album?.songs.map((song, index) => (
                <Card key={index} className="my-2 flex w-full flex-col items-start gap-4 p-2 md:flex-row md:items-center shadow-sm shadow-slate-300">
                    <div className="h-16 w-16 flex items-center justify-center bg-gray-700 rounded-lg">
                        <Image
                            src={song.asset.thumbnail ?? "/placeholder.svg"}
                            alt="Artist"
                            width={300}
                            height={300}
                            className="ml-2  h-16 w-16 rounded-sm object-cover flex items-center justify-center "
                        />
                    </div>
                    <div className="flex w-full flex-col items-start gap-4 rounded-lg  bg-primary p-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                            <div>
                                <h3 className="text-lg font-semibold">{song.asset.name}</h3>
                                <p className="text-gray-400">
                                    ARTIST:{" "}
                                    {song.asset.creatorId
                                        ? addrShort(song.asset.creatorId, 5)
                                        : "ADMIN"}
                                </p>
                            </div>
                        </div>

                        <div className="flex w-full items-center justify-between gap-4 md:w-auto md:gap-8">
                            {userAssets.data?.dbAssets?.some(
                                (el) => el.code === song.asset.code && el.issuer === song.asset.issuer,
                            ) && (
                                    <Button
                                        variant="destructive"
                                        className="shadow-sm shadow-black px-6 py-2 gap-1 flex items-center justify-center"
                                    >
                                        <Play className="h-6 w-6" />
                                        <span>PLAY</span>
                                    </Button>
                                )}
                            <Button
                                onClick={() => {
                                    setData(song)
                                    setIsOpen(true)
                                }}

                                className="rounded-md bg-white px-6 py-2 font-medium shadow-sm shadow-black transition-colors hover:bg-gray-100">
                                BUY NOW
                            </Button>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}

export const AlbumSkeleton = () => {
    return (
        <div className="min-h-screen w-full">
            {/* Album Header Section */}
            <div className="relative h-[400px] w-full overflow-hidden">
                {/* Background Skeleton */}
                <div className="absolute inset-0 bg-gray-800 animate-pulse" />

                {/* Content Container */}
                <div className="relative z-10 flex h-full items-center p-8">
                    {/* Album Art Skeleton */}
                    <div className="relative">
                        <div className="h-[300px] w-[300px] rounded-lg bg-gray-700 animate-pulse shadow-2xl" />
                    </div>

                    {/* Album Info Skeleton */}
                    <div className="ml-8 space-y-4">
                        <div className="h-20 w-96 bg-gray-700 animate-pulse rounded" />
                        <div className="space-y-2">
                            <div className="h-8 w-64 bg-gray-700 animate-pulse rounded" />

                        </div>
                    </div>
                </div>
            </div>

            {/* Song List Skeleton */}
            {Array.from({ length: 5 }, (_, index: number) => (
                <Card key={index} className="my-2 flex w-full items-center gap-4 p-2">
                    <div className="h-16 w-16 bg-gray-700 animate-pulse rounded" />
                    <div className="flex w-full items-center justify-between rounded-lg bg-primary p-4">
                        <div className="flex items-center gap-4">
                            <div className="space-y-2">
                                <div className="h-6 w-48 bg-gray-700 animate-pulse rounded" />
                                <div className="h-4 w-32 bg-gray-700 animate-pulse rounded" />
                            </div>
                        </div>
                        <div className="h-10 w-24 bg-gray-700 animate-pulse rounded" />
                    </div>
                </Card>
            ))}
        </div>
    );
};

// Empty Album Component
export const EmptyAlbum = ({ coverImgUrl }: {
    coverImgUrl: string;
}) => {
    return (
        <div className="container mx-auto px-4 py-8">
            <Card className="w-full">
                <CardContent className="p-6">
                    <div className="flex flex-col items-center justify-center space-y-4 text-center">
                        <div className="rounded-full bg-gray-100 ">
                            <div className=" text-gray-400">
                                <Image
                                    src={coverImgUrl ?? "/placeholder.svg"}
                                    alt="Background"
                                    height={48}
                                    width={48}
                                    className="rounded-full h-12 w-12"

                                />
                            </div>
                        </div>
                        <CardTitle>No Songs Available</CardTitle>
                        <p className="text-gray-500">This album doesn{"'"}t have any songs yet.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

// Error Component (already defined in your code, but adding here for completeness)
export const ErrorMessage = ({ message }: { message: string }) => {
    return (
        <div className="container mx-auto flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-100 to-indigo-100 px-4 py-8">
            <Card className="w-full max-w-md">
                <CardContent className="p-6 text-center">
                    <h2 className="mb-4 text-2xl font-semibold text-red-600">Error</h2>
                    <p>{message}</p>
                </CardContent>
            </Card>
        </div>
    );
};

