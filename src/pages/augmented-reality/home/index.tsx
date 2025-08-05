"use client";
import { useEffect, useState, useRef, useLayoutEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Map, { Marker } from "react-map-gl";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
    MapPin,
    ScanLine,
    RefreshCcw,
    Crosshair,
    Zap,
    Trophy,
    Star,
} from "lucide-react";
import { useExtraInfo } from "~/lib/state/augmented-reality/useExtraInfo";
import { useNearByPin } from "~/lib/state/augmented-reality/useNearbyPin";
import { useAccountAction } from "~/lib/state/augmented-reality/useAccountAction";
import { useModal } from "~/lib/state/augmented-reality/useModal";
import type { ConsumedLocation } from "~/types/game/location";
import { Button } from "~/components/shadcn/ui/button";
import { Card, CardContent } from "~/components/shadcn/ui/card";
import { Badge } from "~/components/shadcn/ui/badge";
import { BASE_URL } from "~/lib/common";
import { useBrandFollowMode } from "~/lib/state/augmented-reality/useBrandFollowMode";
import { useWalkThrough } from "~/hooks/useWalkthrough";
import { getMapAllPins } from "~/lib/augmented-reality/get-Map-all-pins";
import { getUserPlatformAsset } from "~/lib/augmented-reality/get-user-platformAsset";
import Loading from "~/components/common/loading";
import { Walkthrough } from "~/components/common/walkthrough";
import { LocationPermissionHandler } from "~/components/common/location-permission-handler";

type UserLocationType = {
    lat: number;
    lng: number;
};

type ButtonLayout = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export default function HomeScreen() {
    const [userLocation, setUserLocation] = useState<UserLocationType | null>(
        null,
    );
    const [locationPermissionGranted, setLocationPermissionGranted] =
        useState(false);
    const [pinCollected, setPinCollected] = useState(false);
    const [collectedPinData, setCollectedPinData] =
        useState<ConsumedLocation | null>(null);
    const router = useRouter();
    const { setData: setExtraInfo } = useExtraInfo();

    const [center, setCenter] = useState<UserLocationType | null>(null);
    const { setData } = useNearByPin();
    const { data } = useAccountAction();
    const autoCollectModeRef = useRef(data.mode);
    const { onOpen } = useModal();
    const [buttonLayouts, setButtonLayouts] = useState<ButtonLayout[]>([]);
    const [showWalkthrough, setShowWalkthrough] = useState(false);
    const { data: walkthroughData } = useWalkThrough();
    const { data: brandFollowMode } = useBrandFollowMode();

    const welcomeRef = useRef<HTMLDivElement>(null);
    const balanceRef = useRef<HTMLDivElement>(null);
    const refreshButtonRef = useRef<HTMLButtonElement>(null);
    const recenterButtonRef = useRef<HTMLButtonElement>(null);
    const arButtonRef = useRef<HTMLButtonElement>(null);

    const steps = [
        {
            target: buttonLayouts[0],
            title: "Welcome to the Actionverse AR!",
            content:
                "This tutorial will show you how to use Actionverse to find pins around you, follow your favorite brands, and collect rewards.",
        },
        {
            target: buttonLayouts[1],
            title: "Actionverse Balance",
            content:
                "The Actionverse Balance displays your Actionverse count. Check the Bounty Board for the latest ways to earn more Actionverse!",
        },
        {
            target: buttonLayouts[2],
            title: "Refresh Button",
            content:
                "If you need to refresh your map, press the refresh button. This will reload your entire map with all up to date app data.",
        },
        {
            target: buttonLayouts[3],
            title: "Re-center button",
            content:
                "Press the Re-center button to center your map view to your current location",
        },
        {
            target: buttonLayouts[4],
            title: "AR button",
            content:
                "To collect manual pins, press the AR button on your map to view your surroundings. Locate the icon on your screen, then press the Collect button that appears below it to add the item to your collection.",
        },
        {
            target: buttonLayouts[5],
            title: "Pin Auto Collection",
            content:
                "This celebration occurs when a pin has been automatically collected in Actionverse.",
        },
    ];

    const handleLocationGranted = (location: UserLocationType) => {
        console.log("Location granted:", location);
        setUserLocation(location);
        setCenter(location);
        setLocationPermissionGranted(true);
    };

    const handleLocationDenied = () => {
        console.log("Location access denied");
        setLocationPermissionGranted(false);
    };
    const getNearbyPins = (
        userLocation: UserLocationType,
        locations: ConsumedLocation[],
        radius: number,
    ) => {
        return locations.filter((location) => {
            if (
                location.auto_collect ||
                location.collection_limit_remaining <= 0 ||
                location.collected
            )
                return false;
            const distance = getDistanceFromLatLonInMeters(
                userLocation.lat,
                userLocation.lng,
                location.lat,
                location.lng,
            );
            return distance <= radius;
        });
    };

    const getDistanceFromLatLonInMeters = (
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number,
    ) => {
        const R = 6371000; // Radius of the Earth in meters
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            0.5 -
            Math.cos(dLat) / 2 +
            (Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                (1 - Math.cos(dLon))) /
            2;
        return R * 2 * Math.asin(Math.sqrt(a));
    };

    const handleARPress = (
        userLocation: UserLocationType,
        locations: ConsumedLocation[],
    ) => {
        const nearbyPins = getNearbyPins(userLocation, locations, 50);

        setData({
            nearbyPins: nearbyPins,
            singleAR: false,
        });
        router.push("/augmented-reality/enter");
    };

    const handleRecenter = () => {
        if (userLocation) {
            setCenter({
                lat: userLocation.lat,
                lng: userLocation.lng,
            });
        }
    };

    const getAutoCollectPins = (
        userLocation: UserLocationType | null,
        locations: ConsumedLocation[],
        radius: number,
    ) => {
        if (!userLocation) return [];
        return locations.filter((location) => {
            if (location.collection_limit_remaining <= 0 || location.collected)
                return false;
            if (location.auto_collect) {
                const distance = getDistanceFromLatLonInMeters(
                    userLocation.lat,
                    userLocation.lng,
                    location.lat,
                    location.lng,
                );
                return distance <= radius;
            }
        });
    };

    const collectPinsSequentially = async (pins: ConsumedLocation[]) => {
        for (const pin of pins) {
            if (!autoCollectModeRef.current) {
                console.log("Auto collect mode paused");
                return;
            }
            if (pin.collection_limit_remaining <= 0 || pin.collected) {
                console.log("Pin limit reached:", pin.id);
                continue;
            }
            const response = await fetch(
                new URL("api/game/locations/consume", BASE_URL).toString(),
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ location_id: pin.id.toString() }),
                },
            );
            if (response.ok) {
                console.log("Collected pin:", pin.id);
                setCollectedPinData(pin);
                showPinCollectionAnimation();
            }
            await new Promise((resolve) => setTimeout(resolve, 20000));
        }
    };

    const showPinCollectionAnimation = () => {
        setPinCollected(true);
        setTimeout(() => {
            setPinCollected(false);
            setCollectedPinData(null);
        }, 3000);
    };

    const response = useQuery({
        queryKey: ["MapsAllPins", brandFollowMode],
        queryFn: () =>
            getMapAllPins({
                filterID: brandFollowMode ? "1" : "0",
            }),
    });

    const balanceRes = useQuery({
        queryKey: ["balance"],
        queryFn: getUserPlatformAsset,
    });

    const locations = response.data?.locations ?? [];

    useLayoutEffect(() => {
        const updateButtonLayouts = () => {
            // Only update if walkthrough is active
            if (!showWalkthrough) return;

            const welcome = welcomeRef.current;
            const balance = balanceRef.current;
            const refreshButton = refreshButtonRef.current;
            const recenterButton = recenterButtonRef.current;
            const arButton = arButtonRef.current;

            // Check if all required elements exist
            const allElementsExist =
                welcome && balance && refreshButton && recenterButton && arButton;

            if (allElementsExist) {
                try {
                    const welcomeRect = welcome.getBoundingClientRect();
                    const balanceRect = balance.getBoundingClientRect();
                    const refreshRect = refreshButton.getBoundingClientRect();
                    const recenterRect = recenterButton.getBoundingClientRect();
                    const arRect = arButton.getBoundingClientRect();

                    // Only update if all rectangles are valid
                    if (
                        welcomeRect.width > 0 &&
                        balanceRect.width > 0 &&
                        refreshRect.width > 0 &&
                        recenterRect.width > 0 &&
                        arRect.width > 0
                    ) {
                        setButtonLayouts([
                            {
                                x: welcomeRect.left,
                                y: welcomeRect.top,
                                width: welcomeRect.width,
                                height: welcomeRect.height,
                            },
                            {
                                x: balanceRect.left,
                                y: balanceRect.top,
                                width: balanceRect.width,
                                height: balanceRect.height,
                            },
                            {
                                x: refreshRect.left,
                                y: refreshRect.top,
                                width: refreshRect.width,
                                height: refreshRect.height,
                            },
                            {
                                x: recenterRect.left,
                                y: recenterRect.top,
                                width: recenterRect.width,
                                height: recenterRect.height,
                            },
                            {
                                x: arRect.left,
                                y: arRect.top,
                                width: arRect.width,
                                height: arRect.height,
                            },
                        ]);
                    }
                } catch (error) {
                    console.error("Error updating button layouts:", error);
                }
            }
        };

        // Debounce the update function
        let timeoutId: NodeJS.Timeout;
        const debouncedUpdate = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(updateButtonLayouts, 100);
        };

        const observer = new MutationObserver(debouncedUpdate);

        // Only observe if walkthrough is active
        if (showWalkthrough) {
            observer.observe(document.body, { childList: true, subtree: true });
            // Initial layout calculation with delay
            setTimeout(updateButtonLayouts, 500);
        }

        return () => {
            observer.disconnect();
            clearTimeout(timeoutId);
        };
    }, [showWalkthrough]);

    const checkFirstTimeSignIn = async () => {
        try {
            if (walkthroughData?.showWalkThrough) {
                // Delay showing walkthrough to ensure elements are rendered
                setTimeout(() => {
                    setShowWalkthrough(true);
                }, 1000);
            } else {
                setShowWalkthrough(false);
            }
        } catch (error) {
            console.error("Error checking walkthrough data:", error);
            setShowWalkthrough(false);
        }
    };

    useEffect(() => {
        checkFirstTimeSignIn();
    }, [walkthroughData]);

    useEffect(() => {
        if (data.mode && locations) {
            const autoCollectPins = getAutoCollectPins(userLocation, locations, 50);
            if (autoCollectPins.length > 0) {
                collectPinsSequentially(autoCollectPins);
            }
        }
    }, [data.mode, locations]);

    useEffect(() => {
        autoCollectModeRef.current = data.mode;
    }, [data.mode]);

    if (response.isLoading) {
        return <Loading />;
    }

    // Show location permission handler if permission not granted
    if (!locationPermissionGranted) {
        return (
            <LocationPermissionHandler
                onLocationGranted={handleLocationGranted}
                onLocationDenied={handleLocationDenied}
            />
        );
    }

    // Show loading if we have permission but no location yet
    if (!userLocation) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
                    <p className="text-slate-600 dark:text-slate-400">Loading map...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-screen w-full">
            {userLocation && (
                <>
                    <Map
                        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API}
                        initialViewState={{
                            latitude: userLocation.lat,
                            longitude: userLocation.lng,
                            zoom: 14,
                        }}

                        latitude={center?.lat}
                        longitude={center?.lng}
                        onDrag={(e) => {
                            setCenter({
                                lat: e.viewState.latitude ?? 0,
                                lng: e.viewState.longitude ?? 0,
                            });
                        }}
                        style={{ width: "100%", height: "100%" }}
                        mapStyle="mapbox://styles/suppport-10/cmcntcaoj010m01sb66oiddp8"
                    >
                        {userLocation && (
                            <Marker
                                longitude={userLocation.lng}
                                latitude={userLocation.lat}
                                anchor="center"
                            >
                                <div className="relative">
                                    <div className="border-3 flex h-6 w-6 items-center justify-center rounded-full border-white bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                                        <div className="h-2 w-2 rounded-full bg-white"></div>
                                    </div>
                                    <div className="absolute -inset-2 animate-ping rounded-full bg-blue-500/20"></div>
                                    <div className="absolute -inset-1 animate-pulse rounded-full bg-blue-500/30"></div>
                                </div>
                            </Marker>
                        )}
                        <MyPins locations={locations} />
                        {showWalkthrough && <div ref={welcomeRef}></div>}
                    </Map>

                    {/* Modern Balance Display */}
                    <div
                        ref={balanceRef}
                        className="absolute right-4 top-4 z-10 rounded-2xl border border-white/20 bg-white/80 p-3 shadow-xl backdrop-blur-xl dark:bg-slate-900/80"
                    >
                        <div className="flex items-center space-x-3">
                            {/* <div className="w-10 h-10 bg-gradient-to-br from-[#38C02B] to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                                    <Zap className="h-5 w-5 text-white" />
                                </div> */}
                            <div>
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                    Balance
                                </p>
                                <p className="text-lg font-bold text-slate-900 dark:text-white">
                                    {Number(balanceRes.data).toFixed(2) ?? 0}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Modern Control Buttons */}
                    <div className="absolute bottom-48 right-4 z-10 flex flex-col space-y-3">
                        {/* AR Button */}
                        <Button
                            ref={arButtonRef}
                            size="lg"
                            className="h-14 w-14 rounded-2xl border-0 bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-xl shadow-violet-500/25 hover:from-violet-700 hover:to-purple-800"
                            onClick={() => handleARPress(userLocation, locations)}
                        >
                            <ScanLine className="h-6 w-6" />
                        </Button>

                        {/* Recenter Button */}
                        <Button
                            ref={recenterButtonRef}
                            variant="outline"
                            size="lg"
                            className="h-14 w-14 rounded-2xl border border-white/20 bg-white/80 shadow-xl backdrop-blur-xl hover:bg-white/90 dark:bg-slate-900/80 dark:hover:bg-slate-800/90"
                            onClick={handleRecenter}
                        >
                            <Crosshair className="h-5 w-5" />
                        </Button>

                        {/* Refresh Button */}
                        <Button
                            ref={refreshButtonRef}
                            variant="outline"
                            size="lg"
                            className="h-14 w-14 rounded-2xl border border-white/20 bg-white/80 shadow-xl backdrop-blur-xl hover:bg-white/90 dark:bg-slate-900/80 dark:hover:bg-slate-800/90"
                            onClick={() => response.refetch()}
                        >
                            <RefreshCcw className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Enhanced Pin Collection Animation */}
                    {pinCollected && collectedPinData && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                            <Card className="mx-4 max-w-sm rounded-3xl border-0 bg-white/95 p-8 shadow-2xl backdrop-blur-xl duration-500 animate-in zoom-in-50 dark:bg-slate-900/95">
                                <CardContent className="space-y-6 text-center">
                                    <div className="relative">
                                        <div className="mx-auto flex h-24 w-24 animate-pulse items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-2xl">
                                            <Trophy className="h-12 w-12 text-white" />
                                        </div>
                                        <div className="absolute -inset-4 animate-ping rounded-full bg-emerald-500/20"></div>
                                    </div>

                                    <div>
                                        <h3 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">
                                            Pin Collected!
                                        </h3>
                                        <p className="mb-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                                            {collectedPinData.title}
                                        </p>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            From {collectedPinData.brand_name}
                                        </p>
                                    </div>

                                    <Badge className="border-0 bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white">
                                        <Star className="mr-1 h-4 w-4" />
                                        Auto Collected
                                    </Badge>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </>
            )}

            {showWalkthrough && (
                <Walkthrough steps={steps} onFinish={() => setShowWalkthrough(false)} />
            )}
        </div>
    );
}

function MyPins({ locations }: { locations: ConsumedLocation[] }) {
    const { onOpen } = useModal();

    return (
        <>
            {locations.map((location: ConsumedLocation, index: number) => (
                <Marker
                    key={index}
                    latitude={location.lat}
                    longitude={location.lng}
                    anchor="center"
                    onClick={() =>
                        onOpen("LocationInformation", {
                            Collection: location,
                        })
                    }
                >
                    <div className="group relative cursor-pointer">
                        <div className="border-3 h-12 w-12 overflow-hidden rounded-full border-white bg-white shadow-xl transition-transform duration-200 hover:scale-110">
                            <Image
                                height={48}
                                width={48}
                                alt="Pin"
                                src={location.brand_image_url || "/placeholder.svg"}
                                className="h-full w-full object-cover"
                            />
                        </div>
                        {location.collection_limit_remaining > 0 && !location.collected && (
                            <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                                <span className="text-xs font-bold text-white">
                                    {location.collection_limit_remaining}
                                </span>
                            </div>
                        )}
                        <div className="absolute -inset-1 rounded-full bg-white/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100"></div>
                    </div>
                </Marker>
            ))}
        </>
    );
}
