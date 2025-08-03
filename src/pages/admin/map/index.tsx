"use client";
import type { Location, LocationGroup } from "@prisma/client";
import {
  APIProvider,
  AdvancedMarker,
  ControlPosition,
  Map,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";

import {
  MapPin,
  Search,
  X,
  Plus,
  Minus,
  ArrowRightFromLine,
  ArrowLeftFromLine,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  type ModalData,
  type ModalType,
  useModal,
} from "~/lib/state/augmented-reality/use-modal-store";
import { useSelectedAutoSuggestion } from "~/lib/state/augmented-reality/use-selectedAutoSuggestion";
import { useCreatorStorageAcc } from "~/lib/state/wallete/stellar-balances";
import { api } from "~/utils/api";

import { create } from "zustand";
import { Button } from "~/components/shadcn/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/shadcn/ui/card";
import { ScrollArea } from "~/components/shadcn/ui/scroll-area";
import { Skeleton } from "~/components/shadcn/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/shadcn/ui/select";
import { useAdminMapModalStore } from "~/components/store/admin-map-modal-store";
import { useSelectCreatorStore } from "~/components/store/creator-selection-store";
import { CustomMapControl } from "~/components/map/custom-control";
import CreateAdminPinModal from "~/components/modal/admin-create-pin-modal";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "~/components/shadcn/ui/avatar";
import { Badge } from "~/components/shadcn/ui/badge";
import { useNearbyPinsStore } from "~/components/store/nearby-pin-store";
import AdminLayout from "~/components/layout/root/AdminLayout";

type UserLocationType = {
  lat: number;
  lng: number;
};

function AdminMap() {
  return (
    <AdminLayout>
      <AdminMapSection />
    </AdminLayout>
  );
}

function AdminMapSection() {
  const { setManual, setPosition, setIsOpen, setPrevData } =
    useAdminMapModalStore();
  const creator = api.fan.creator.getCreators.useQuery();
  const { setData: setSelectedCreator, data: selectedCreator } =
    useSelectCreatorStore();
  const [mapZoom, setMapZoom] = useState<number>(3);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>({
    lat: 22.54992,
    lng: 0,
  });

  const [centerChanged, setCenterChanged] =
    useState<google.maps.LatLngBoundsLiteral | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isCordsSearch, setIsCordsSearch] = useState<boolean>(false);
  const [searchCoordinates, setSearchCoordinates] =
    useState<google.maps.LatLngLiteral>();
  const [userLocation, setUserLocation] = useState<UserLocationType>({
    lat: 44.5,
    lng: -89.5,
  });
  const {
    selectedPlace: alreadySelectedPlace,
    setSelectedPlace: setAlreadySelectedPlace,
  } = useSelectedAutoSuggestion();
  const [cordSearchCords, setCordSearchLocation] =
    useState<google.maps.LatLngLiteral>();
  const [selectedPlace, setSelectedPlace] =
    useState<google.maps.places.PlaceResult | null>(null);
  const {
    onOpen,
    isPinCopied,
    data,
    isAutoCollect,
    isPinCut,
    setIsAutoCollect,
  } = useModal();
  const { filterNearbyPins, nearbyPins } = useNearbyPinsStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  function handleMapClick(event: MapMouseEvent): void {
    setManual(false);
    const position = event.detail.latLng;
    if (position) {
      setPosition(position);

      if (!isPinCopied && !isPinCut) {
        setIsOpen(true);
      } else if (isPinCopied || isPinCut) {
        onOpen("copied", {
          long: position.lng,
          lat: position.lat,
          pinId: data.pinId,
        });
      }
    }
  }
  useEffect(() => {
    if (alreadySelectedPlace) {
      const latLng = {
        lat: alreadySelectedPlace.lat,
        lng: alreadySelectedPlace.lng,
      };
      setMapCenter(latLng);
      setMapZoom(13);
      setPosition(latLng);
    }
  }, [alreadySelectedPlace]);

  function handleManualPinClick() {
    setManual(true);
    setPosition(undefined);
    setPrevData(undefined);
    setIsOpen(true);
  }

  const handleDragEnd = () => {
    if (centerChanged) {
      filterNearbyPins(centerChanged);
    }
  };
  useEffect(() => {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    // Request location permission and get location
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setMapCenter({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });

        setLoading(false);
      },
      (error) => {
        alert("Permission to access location was denied");
        console.error(error);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }, []);

  useEffect(() => {
    console.log(selectedCreator);
  }, [selectedCreator]);
  const handleZoomIn = () => {
    setMapZoom((prev) => Math.min(prev + 1, 20));
  };

  const handleZoomOut = () => {
    setMapZoom((prev) => Math.max(prev - 1, 3));
  };

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY!}>
      <CustomMapControl
        controlPosition={2}
        onPlaceSelect={setSelectedPlace}
        onCenterChange={setMapCenter}
        setIsCordsSearch={setIsCordsSearch}
        setSearchCoordinates={setSearchCoordinates}
        setCordSearchLocation={setCordSearchLocation}
        setZoom={setMapZoom}
      />
      <Map
        zoomControl={false}
        zoomControlOptions={{
          position: ControlPosition.RIGHT_TOP,
        }}
        onCenterChanged={(center) => {
          setMapCenter(center.detail.center);
          setCenterChanged(center.detail.bounds);
        }}
        onZoomChanged={(zoom) => {
          setMapZoom(zoom.detail.zoom);
        }}
        onClick={handleMapClick}
        mapId={"bf51eea910020fa25a"}
        className="h-screen w-full"
        defaultCenter={{ lat: 22.54992, lng: 0 }}
        defaultZoom={3}
        minZoom={3}
        zoom={mapZoom}
        center={mapCenter}
        gestureHandling={"greedy"}
        disableDefaultUI={true}
        onDragend={() => handleDragEnd()}
      >
        {centerChanged && searchCoordinates && (
          <AdvancedMarker
            position={{
              lat: searchCoordinates.lat,
              lng: searchCoordinates.lng,
            }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-lg">
              <MapPin className="h-5 w-5" />
            </div>
          </AdvancedMarker>
        )}

        {isCordsSearch && cordSearchCords && (
          <AdvancedMarker
            position={{
              lat: cordSearchCords.lat,
              lng: cordSearchCords.lng,
            }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-lg">
              <MapPin className="h-5 w-5" />
            </div>
          </AdvancedMarker>
        )}
        {selectedCreator && (
          <MyPins
            onOpen={onOpen}
            setIsAutoCollect={setIsAutoCollect}
            creatorId={selectedCreator?.id}
          />
        )}
      </Map>

      <ZoomControls onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />

      {/* Creator selector */}
      {creator.data && (
        <motion.div
          className="absolute left-6 top-16 z-10 w-64"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Select
            onValueChange={(value) => {
              const selectedCreator = creator.data.find((c) => c.id === value);
              if (selectedCreator) {
                setSelectedCreator(selectedCreator);
              }
            }}
            defaultValue={selectedCreator?.id}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a creator" />
            </SelectTrigger>
            <SelectContent>
              {creator.data.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>
      )}

      {/* Sidebar toggle button */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Button
          variant="outline"
          size="icon"
          className="absolute right-4 top-40 z-10 rounded-full bg-white shadow-md"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? (
            <ArrowRightFromLine className="h-4 w-4" />
          ) : (
            <ArrowLeftFromLine className="h-4 w-4" />
          )}
        </Button>
      </motion.div>

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute bottom-20 right-4 top-52 z-10  "
          >
            <SideMapItem setAlreadySelectedPlace={setAlreadySelectedPlace} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-40  right-2  z-10 ">
        <ManualPinButton handleClick={handleManualPinClick} />
      </div>

      {selectedCreator && <CreateAdminPinModal />}
    </APIProvider>
  );
}

function SideMapItem({
  setAlreadySelectedPlace,
}: {
  setAlreadySelectedPlace: (coords: { lat: number; lng: number }) => void;
}) {
  const { nearbyPins } = useNearbyPinsStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Card className="h-64 w-80 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Nearby Locations</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <ScrollArea className="h-40 pr-3">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <SkeletonPin key={index} />
              ))}
            </div>
          ) : nearbyPins.length <= 0 ? (
            <div className="flex h-20 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                No nearby locations found
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {nearbyPins?.map((pin) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => {
                    setAlreadySelectedPlace({
                      lat: pin.latitude,
                      lng: pin.longitude,
                    });
                  }}
                  key={pin.id}
                  className="group cursor-pointer rounded-lg border border-border bg-card p-3 transition-all hover:border-primary hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <div className="flex-1">
                      <h3 className="font-medium group-hover:text-primary">
                        {pin.locationGroup?.title ?? "Unnamed Location"}
                      </h3>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <div className="h-5 w-5 overflow-hidden rounded-full">
                            <Image
                              src={
                                pin.locationGroup?.creator.profileUrl ??
                                "/favicon.ico"
                              }
                              width={20}
                              height={20}
                              alt="Creator"
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                            {pin._count.consumers} visitors
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function SkeletonPin() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <Skeleton className="h-4 w-4 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-3/4" />
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}

function ManualPinButton({ handleClick }: { handleClick: () => void }) {
  return (
    <motion.div
      className="absolute bottom-4 right-4 z-10"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Button
        onClick={handleClick}
        className="flex items-center gap-2 shadow-md"
      >
        <MapPin className="h-4 w-4" />
        <span>Drop Pin</span>
      </Button>
    </motion.div>
  );
}

function ZoomControls({
  onZoomIn,
  onZoomOut,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <>
      <style jsx global>{`
        .touch-manipulation {
          touch-action: manipulation;
          -webkit-touch-callout: none;
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
      <motion.div
        className="absolute bottom-4 left-2 z-10 flex
                 items-center gap-2 md:bottom-auto md:left-auto md:right-2 md:top-4"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          whileHover={{
            scale: 1.1,
            transition: { duration: 0.2 },
          }}
          whileTap={{ scale: 0.9 }}
        >
          <Button
            variant="destructive"
            size="icon"
            className="h-10 w-10 touch-manipulation select-none rounded-full shadow-sm shadow-foreground"
            onClick={onZoomOut}
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </motion.div>
        <motion.div
          whileHover={{
            scale: 1.1,
            transition: { duration: 0.2 },
          }}
          whileTap={{ scale: 0.9 }}
        >
          <Button
            variant="destructive"
            size="icon"
            className="h-10 w-10 touch-manipulation  select-none rounded-full shadow-sm shadow-foreground"
            onClick={onZoomIn}
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </motion.div>
      </motion.div>
    </>
  );
}

function MyPins({
  onOpen,
  setIsAutoCollect,
  creatorId,
}: {
  onOpen: (type: ModalType, data?: ModalData) => void;
  setIsAutoCollect: (value: boolean) => void;
  creatorId: string;
}) {
  const { setAllPins } = useNearbyPinsStore();
  const pins = api.maps.pin.getCreatorPins.useQuery({
    creator_id: creatorId,
  });
  useEffect(() => {
    if (pins.data) {
      setAllPins(pins.data);
    }
  }, [pins.data]);

  if (pins.isLoading) {
    return (
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-4 shadow-lg">
        <p className="text-center">Loading pins...</p>
      </div>
    );
  }

  if (pins.data) {
    return (
      <>
        {pins.data.map((pin) => (
          <AdvancedMarker
            key={pin.id}
            position={{ lat: pin.latitude, lng: pin.longitude }}
            onClick={() => {
              onOpen("map", {
                pinId: pin.id,
                long: pin.longitude,
                lat: pin.latitude,
                mapTitle: pin.locationGroup?.title,
                image: pin.locationGroup?.image ?? undefined,
                mapDescription: pin.locationGroup?.description,
                endDate: pin.locationGroup?.endDate,
                startDate: pin.locationGroup?.startDate,
                pinCollectionLimit: pin.locationGroup?.limit,
                pinRemainingLimit: pin.locationGroup?.remaining,
                multiPin: pin.locationGroup?.multiPin,
                subscriptionId: pin.locationGroup?.subscriptionId ?? undefined,
                autoCollect: pin.autoCollect,
                pageAsset: pin.locationGroup?.pageAsset ?? false,
                privacy: pin.locationGroup?.privacy,
                pinNumber: pin.locationGroup?.remaining,
                link: pin.locationGroup?.link ?? undefined,
                assetId: pin.locationGroup?.assetId ?? undefined,
              });
              setIsAutoCollect(pin.autoCollect);
            }}
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className={`relative transition-all ${!pin.autoCollect ? "rounded-full" : ""} ${pin._count.consumers <= 0 ? "ring-2 ring-primary ring-offset-2" : "opacity-80"}`}
            >
              <Avatar className="h-8 w-8 border-2 border-white shadow-md">
                <AvatarImage
                  src={pin.locationGroup?.creator.profileUrl ?? "/favicon.ico"}
                  alt="Creator"
                />
                <AvatarFallback>C</AvatarFallback>
              </Avatar>
              {pin._count.consumers > 0 && (
                <Badge className="absolute -right-2 -top-2 h-5 w-5 rounded-full p-0 text-center text-[10px]">
                  {pin._count.consumers}
                </Badge>
              )}
            </motion.div>
          </AdvancedMarker>
        ))}
      </>
    );
  }

  return null;
}

export default AdminMap;
