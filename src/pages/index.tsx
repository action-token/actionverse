"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/shadcn/ui/card";
import Image from "next/image";
import { Button } from "~/components/shadcn/ui/button";
import { PLATFORM_ASSET } from "~/lib/stellar/constant";
import { api } from "~/utils/api";
import { MarketAssetType } from "~/types/market/market-asset-type";
import BuyModal from "~/components/modal/buy-asset-modal";
import { cn } from "~/lib/utils";

import Asset from "~/components/common/admin-asset";
import MarketAssetComponent from "~/components/common/market-asset";
import PageAssetComponent from "~/components/common/page-asset";
import { MoreAssetsSkeleton } from "~/components/common/grid-loading";
import { useBuyModalStore } from "~/components/store/buy-modal-store";
import { useSession } from "next-auth/react";
import { useLoginRequiredModalStore } from "~/components/store/login-required-modal-store";

// Global Variables
const TABS = ["ALL", "BANDCOIN", "ARTISTS", "ARTIST TOKENS"];

const HomePage = () => {
  // Variables Declaration
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showRecentlyAddedMarketAssets, setShowRecentlyAddedMarketAssets] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState(false);
  const [
    selectedRecentlyAddedMarketAssets,
    setSelectedRecentlyAddedMarketAssets,
  ] = useState<MarketAssetType>();
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const {
    setData,
    setIsOpen,

  } = useBuyModalStore()
  const { setIsOpen: setLoginModalOpen } = useLoginRequiredModalStore()
  const session = useSession()
  const fanAssets = api.marketplace.market.getLatestMarketNFT.useQuery(
    undefined,
    {
      refetchOnWindowFocus: false,
    },
  );

  const RecentlyAddedMarketAssets = fanAssets.data ?? [];

  // Function Declearation
  const handleNext = useCallback(() => {
    if (RecentlyAddedMarketAssets.length === 0) return;
    setCurrentIndex(
      (prevIndex) => (prevIndex + 1) % RecentlyAddedMarketAssets.length,
    );
  }, [RecentlyAddedMarketAssets.length]);

  const handlePrev = useCallback(() => {
    if (RecentlyAddedMarketAssets.length === 0) return;
    setCurrentIndex(
      (prevIndex) =>
        (prevIndex - 1 + RecentlyAddedMarketAssets.length) %
        RecentlyAddedMarketAssets.length,
    );
  }, [RecentlyAddedMarketAssets.length]);

  const handleProductClick = (asset: MarketAssetType | undefined) => {
    if (!asset) return;
    setSelectedRecentlyAddedMarketAssets(asset);
  };

  const getVisibleProducts = () => {
    if (RecentlyAddedMarketAssets.length === 0) return [];

    const visibleIndices = Array.from(
      { length: 5 },
      (_, i) => (currentIndex + i) % RecentlyAddedMarketAssets.length,
    );
    return visibleIndices.map((index) => RecentlyAddedMarketAssets[index]);
  };
  useEffect(() => {
    if (!isAutoPlay || RecentlyAddedMarketAssets.length === 0) return;

    const timer = setInterval(handleNext, 5000);
    return () => clearInterval(timer);
  }, [isAutoPlay, handleNext, RecentlyAddedMarketAssets.length]);



  useEffect(() => {
    // Check the window width on component mount

    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    // Run on mount and resize

    checkMobile();

    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Early return if no data
  if (fanAssets.isLoading ?? RecentlyAddedMarketAssets.length === 0) {
    return (
      <div className="relative  flex h-[calc(100vh-10.8vh)] flex-col gap-4 overflow-y-auto scrollbar-hide">
        <div className="relative h-[56vh] overflow-hidden rounded-b-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-4 md:h-[42vh]">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-black/60 via-black/40 to-black/90 backdrop-blur-md" />
          <div className="relative z-10 flex h-full flex-col rounded-md">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white xl:text-4xl">
                RECENLTY ADDED
              </h2>
              <div className="hidden gap-2 md:flex">
                <div className="h-10 w-10 rounded-lg bg-gray-700 " />
                <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-700" />
              </div>
            </div>

            <div className="grid flex-grow gap-4 md:grid-cols-4">
              <div className="relative col-span-3 flex h-full items-center justify-center overflow-hidden md:justify-start">
                <ProductSkeleton />
              </div>
              <div className="hidden w-full md:flex">
                <DetailsSkeleton />
              </div>
            </div>

            <div className="mt-4 flex justify-center">
              {[0, 1, 2, 3, 4].map((index) => (
                <div
                  key={index}
                  className="mx-1 h-2 w-2 animate-pulse rounded-full bg-gray-700"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentAsset = RecentlyAddedMarketAssets[currentIndex];

  return (
    <div className="relative  flex h-[calc(100vh-10.8vh)] flex-col gap-4 overflow-y-auto scrollbar-hide">
      <div className="relative min-h-[40vh] overflow-hidden rounded-b-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-4 shadow-lg md:min-h-[42vh]">
        {/* Background with gradient overlay */}
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 rounded-xl"
          style={{
            backgroundImage: `url(${currentAsset?.asset?.thumbnail ?? "/images/logo.png"})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 rounded-b-2xl bg-gradient-to-b from-white/20 via-white/20 to-white/10 backdrop-blur-md" />
        </motion.div>

        {/* Main content */}
        <div className="relative z-10 flex h-full flex-col">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white md:text-4xl">
              RECENLTY ADDED
            </h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="bg-transparent"
                size="icon"
                onClick={handlePrev}
              >
                <ChevronLeft className="h-6 w-6 text-white" />
              </Button>
              <Button
                variant="outline"
                className="bg-transparent"
                size="icon"
                onClick={handleNext}
              >
                <ChevronRight className="h-6 w-6 text-white" />
              </Button>
            </div>
          </div>

          {/* Product carousel */}
          <div className="grid flex-grow gap-4 xl:grid-cols-4 ">
            <div className="relative col-span-3 flex  items-center  overflow-hidden md:justify-start">
              <AnimatePresence initial={false}>
                {getVisibleProducts().map(
                  (marketasset, index) =>
                    marketasset && (
                      <motion.div
                        key={`${marketasset.asset.code}-${index}`}
                        className="absolute   flex-shrink-0 cursor-pointer "
                        initial={{
                          scale: 0.8,
                          x: index * 220,
                          opacity:
                            index === 0
                              ? isMobile
                                ? 0.6
                                : 0.95
                              : isMobile
                                ? 0.6
                                : 0.8,
                        }}
                        animate={{
                          scale:
                            index === 0
                              ? isMobile
                                ? 0.7
                                : 0.95
                              : isMobile
                                ? 0.6
                                : 0.8,
                          x:
                            index === 0
                              ? isMobile
                                ? -10
                                : -28
                              : index * (isMobile ? 180 : 220),
                          y: index === 0 ? -5 : isMobile ? 10 : 20,
                          opacity: index === 0 ? 1 : 0.8,
                          zIndex: index === 0 ? 2 : 1,
                        }}
                        onClick={() => {
                          setCurrentIndex(
                            (prevIndex) =>
                              (prevIndex + index) %
                              RecentlyAddedMarketAssets.length,
                          );
                          if (session.status === "unauthenticated") {
                            setLoginModalOpen(true);
                          }
                          else {
                            handleProductClick(marketasset as MarketAssetType);
                            setIsOpen(true);
                            setData(marketasset);
                          }
                        }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ duration: 0.5 }}
                      >
                        <div className="flex flex-col justify-between gap-4 md:pl-6">
                          <div
                            className={`${index === 0 ? "shadow-md  shadow-white " : "shadow-sm  shadow-white"} backdrop-blur-xs group relative overflow-hidden rounded-xl `}
                          >
                            <div
                              className={`${index === 0 ? "h-60 w-60 md:h-72 md:w-60  " : "h-60 w-60 md:h-72 md:w-60 "}  {${index === 1 ? "md:h-68 h-60 w-60 md:w-60  " : "md:h-68 h-60 w-60 md:w-60 "}relative transition-all duration-200 ease-in `}
                            >
                              <Image
                                src={
                                  marketasset.asset.thumbnail ??
                                  "/images/logo.png"
                                }
                                alt={marketasset.asset.code ?? "Placeholder"}
                                fill
                                className="rounded-xl object-cover"
                                priority={index === 0}
                              />
                            </div>

                            <div className="absolute bottom-2 left-2 right-2  rounded-xl  border-2 bg-black/50 p-4 backdrop-blur-sm ">
                              <h3 className="truncate text-xl font-bold text-white">
                                {marketasset.asset.name}
                              </h3>
                              <p className="text-sm font-bold text-gray-100">
                                {marketasset.asset.mediaType}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 md:hidden">
                            <div className="flex items-center gap-2 text-white">
                              <p className="w-full border-b-2 text-lg font-semibold">
                                PRICE: {marketasset.price}{" "}
                                {PLATFORM_ASSET.code.toLocaleUpperCase()}
                              </p>
                              <span className="rounded border-2 bg-black px-2 py-0.5 text-sm text-white">
                                ${marketasset.priceUSD}
                              </span>
                            </div>
                            <div className="flex items-center gap-2  text-white">
                              <p className="text-sm uppercase">Media Type:</p>
                              <span className="text-sm ">
                                {marketasset.asset.mediaType}
                              </span>
                            </div>
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setCurrentIndex(
                                  (prevIndex) =>
                                    (prevIndex + 0) %
                                    RecentlyAddedMarketAssets.length,
                                );
                                handleProductClick(
                                  currentAsset as MarketAssetType,
                                );
                                if (session.status === "unauthenticated") {
                                  setLoginModalOpen(true);
                                }
                                else {
                                  setIsOpen(true);
                                  setData(currentAsset as MarketAssetType);
                                }
                              }}
                              className="w-full shadow-sm shadow-black "
                            >
                              BUY NOW
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ),
                )}
              </AnimatePresence>
            </div>

            {/* Product details card */}
            <div className="hidden w-full xl:flex ">
              <Card className="min-w-[350px] space-y-6 border-none bg-white/40 p-6 shadow-sm shadow-black backdrop-blur-md">
                <div className="space-y-1 rounded-md border-2 p-2 ">
                  <h2 className="text-lg font-bold uppercase">
                    {currentAsset?.asset?.name}
                  </h2>
                  <p className="text-sm uppercase text-neutral-700">
                    {currentAsset?.asset?.code}
                  </p>
                </div>

                <div className="space-y-4 rounded-sm  p-2">
                  <div className="flex items-center gap-2 ">
                    <p className="w-full border-b-2 text-lg font-semibold">
                      PRICE: {currentAsset?.price}{" "}
                      {PLATFORM_ASSET.code.toLocaleUpperCase()}
                    </p>
                    <span className="rounded border-2 bg-black px-2 py-0.5 text-sm text-white">
                      ${currentAsset?.priceUSD}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm uppercase">Media Type:</p>
                    <span className="text-sm text-neutral-700">
                      {currentAsset?.asset?.mediaType}
                    </span>
                  </div>
                </div>

                <div className="flex">
                  <Button
                    onClick={() => {
                      setCurrentIndex(
                        (prevIndex) =>
                          (prevIndex + 0) % RecentlyAddedMarketAssets.length,
                      );
                      handleProductClick(currentAsset as MarketAssetType);
                      if (session.status === "unauthenticated") {
                        setLoginModalOpen(true);
                      }
                      else {
                        setIsOpen(true);
                        setData(currentAsset as MarketAssetType);
                      }
                    }}
                    className="w-full border-2 shadow-sm shadow-black "
                  >
                    BUY NOW
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          {/* Carousel dots */}
          <div className="flex justify-center ">
            {RecentlyAddedMarketAssets.map((_, index) => (
              <button
                key={index}
                className={`mx-1 h-2 w-2 rounded-full ${index === currentIndex ? "bg-white" : "bg-gray-500"}`}
                onClick={() => setCurrentIndex(index)}
              />
            ))}
          </div>
        </div>

      </div>

      {/* Tabs */}
      <div className="w-full ">
        <FilterTabs />
      </div>
    </div>
  );
};

export default HomePage;

const FilterTabs = () => {
  const [activeTab, setActiveTab] = useState("ALL");
  const musicAssets = api.music.song.getAllSongMarketAssets.useInfiniteQuery(
    { limit: 10 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );

  const adminAssets =
    api.marketplace.market.getMarketAdminNfts.useInfiniteQuery(
      { limit: 10 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor },
    );

  const fanAssets = api.marketplace.market.getFanMarketNfts.useInfiniteQuery(
    { limit: 10 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );

  const artistAssets = api.marketplace.market.getPageAssets.useInfiniteQuery(
    { limit: 10 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );

  const isLoading =
    musicAssets.isLoading ??
    adminAssets.isLoading ??
    fanAssets.isLoading ??
    artistAssets.isLoading;
  const hasNextPage =
    musicAssets.hasNextPage ??
    adminAssets.hasNextPage ??
    fanAssets.hasNextPage ??
    artistAssets.hasNextPage;
  const isFetchingNextPage =
    musicAssets.isFetchingNextPage ??
    adminAssets.isFetchingNextPage ??
    fanAssets.isFetchingNextPage ??
    artistAssets.isFetchingNextPage;

  const fetchNextPage = () => {
    if (musicAssets.hasNextPage) musicAssets.fetchNextPage();
    if (adminAssets.hasNextPage) adminAssets.fetchNextPage();
    if (fanAssets.hasNextPage) fanAssets.fetchNextPage();
    if (artistAssets.hasNextPage) artistAssets.fetchNextPage();
  };
  return (
    <Card className="rounded-none" >
      <CardHeader className="w-full rounded-none  bg-secondary p-2 md:p-4">
        <CardTitle className="flex w-full gap-2 p-0 md:w-[50vw] md:gap-4 ">
          {TABS.map((tab) => (
            <Button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex  w-1/2 px-2 text-sm shadow-sm shadow-black transition-all duration-300 ease-in-out lg:px-10",
                activeTab === tab
                  ? "w-full border-2  font-bold text-destructive border-destructive bg-background hover:bg-background"
                  : "",
              )}
            >
              {tab}
            </Button>
          ))}
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-y-auto p-0 scrollbar-hide h-[calc(100vh-20vh)] ">
        <div>
          {activeTab === "ALL" && (
            <div className="">
              <AllAssets
                musicAssets={musicAssets}
                adminAssets={adminAssets}
                fanAssets={fanAssets}
                artistAssets={artistAssets}
                isLoading={isLoading}
                hasNextPage={hasNextPage ?? false}
                isFetchingNextPage={isFetchingNextPage}
                fetchNextPage={fetchNextPage}
              />
            </div>
          )}
          {activeTab === "BANDCOIN" && (
            <div className="">
              <AdminAsset
                adminAssets={adminAssets}
                hasNextPage={adminAssets.hasNextPage ?? false}
                isFetchingNextPage={adminAssets.isFetchingNextPage}
                fetchNextPage={adminAssets.fetchNextPage}
                isLoading={isLoading}
              />
            </div>
          )}
          {activeTab === "ARTISTS" && (
            <div className="">
              <Artist
                artist={artistAssets}
                hasNextPage={artistAssets.hasNextPage ?? false}
                isFetchingNextPage={artistAssets.isFetchingNextPage}
                fetchNextPage={artistAssets.fetchNextPage}
                isLoading={artistAssets.isLoading}
              />
            </div>
          )}
          {activeTab === "ARTIST TOKENS" && (
            <div>
              <ArtistTokens
                artistTokens={fanAssets}
                hasNextPage={fanAssets.hasNextPage ?? false}
                isFetchingNextPage={fanAssets.isFetchingNextPage}
                fetchNextPage={fanAssets.fetchNextPage}
                isLoading={isLoading}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface AllAssetsTypes {
  musicAssets: ReturnType<
    typeof api.music.song.getAllSongMarketAssets.useInfiniteQuery
  >;
  adminAssets: ReturnType<
    typeof api.marketplace.market.getMarketAdminNfts.useInfiniteQuery
  >;
  fanAssets: ReturnType<
    typeof api.marketplace.market.getFanMarketNfts.useInfiniteQuery
  >;
  artistAssets: ReturnType<
    typeof api.marketplace.market.getPageAssets.useInfiniteQuery
  >;
  hasNextPage: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

const AllAssets = ({
  musicAssets,
  adminAssets,
  fanAssets,
  artistAssets,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: AllAssetsTypes) => {

  return (
    <div className="flex min-h-[calc(100vh-20vh)] flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md">
      {isLoading && (
        <MoreAssetsSkeleton className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5" />
      )}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5">
        {musicAssets.data?.pages.map((page, pageIndex) =>
          page.nfts.map((item, index) => (
            <MarketAssetComponent
              key={`music-${pageIndex}-${index}`}
              item={item}
            />
          )),
        )}
        {adminAssets.data?.pages.map((page, pageIndex) =>
          page.nfts.map((item, index) => (
            <MarketAssetComponent
              key={`admin-${pageIndex}-${index}`}
              item={item}
            />
          )),
        )}
        {fanAssets.data?.pages.map((page, pageIndex) =>
          page.nfts.map((item, index) => (
            <MarketAssetComponent
              key={`fan-${pageIndex}-${index}`}
              item={item}
            />
          )),
        )}
        {artistAssets.data?.pages.map((page, pageIndex) =>
          page.nfts.map((item, index) => (
            <PageAssetComponent
              key={`artist-${pageIndex}-${index}`}
              item={item}
            />
          )),
        )}
      </div>
      {hasNextPage && (
        <Button
          className="flex w-1/2 items-center justify-center  shadow-sm shadow-black md:w-1/4"
          onClick={fetchNextPage}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? "Loading more..." : "Load More"}
        </Button>
      )}
    </div>
  );
};

interface AdminAssetTypes {
  adminAssets: ReturnType<
    typeof api.marketplace.market.getMarketAdminNfts.useInfiniteQuery
  >;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  isLoading: boolean;
}

const AdminAsset = ({
  adminAssets,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  isLoading,
}: AdminAssetTypes) => {
  return (
    <div className="flex min-h-[calc(100vh-20vh)]  flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md">
      {isLoading && (
        <MoreAssetsSkeleton className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5" />
      )}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5">
        {adminAssets.data?.pages.map((page, pageIndex) =>
          page.nfts.map((item, index) => (
            <MarketAssetComponent
              key={`admin-${pageIndex}-${index}`}
              item={item}
            />
          )),
        )}
      </div>
      {hasNextPage && (
        <Button
          className="flex w-1/2 items-center justify-center  shadow-sm shadow-black md:w-1/4"
          onClick={fetchNextPage}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? "Loading more..." : "Load More"}
        </Button>
      )}
    </div>
  );
};

// ----------------- Fans -----------------

interface AristTokenTypes {
  artistTokens: ReturnType<
    typeof api.marketplace.market.getFanMarketNfts.useInfiniteQuery
  >;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  isLoading: boolean;
}

const ArtistTokens = ({
  artistTokens,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  isLoading,
}: AristTokenTypes) => {
  return (
    <div className="flex h-[calc(100vh-20vh)] flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md">
      {isLoading && (
        <MoreAssetsSkeleton className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5" />
      )}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5">
        {artistTokens.data?.pages.map((page, pageIndex) =>
          page.nfts.map((item, index) => (
            <MarketAssetComponent
              key={`artist-token-${pageIndex}-${index}`}
              item={item}
            />
          )),
        )}
      </div>
      {hasNextPage && (
        <Button
          className="flex w-1/2 items-center justify-center  shadow-sm shadow-black md:w-1/4"
          onClick={fetchNextPage}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? "Loading more..." : "Load More"}
        </Button>
      )}
    </div>
  );
};

// ----------------- Artist -----------------

interface ArtistTypes {
  artist: ReturnType<
    typeof api.marketplace.market.getPageAssets.useInfiniteQuery
  >;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  isLoading: boolean;
}

const Artist = ({
  artist,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  isLoading,
}: ArtistTypes) => {
  return (
    <div className="flex h-[calc(100vh-20vh)] flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md">
      {isLoading && (
        <MoreAssetsSkeleton className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5" />
      )}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5">
        {artist.data?.pages.map((page, pageIndex) =>
          page.nfts.map((item, index) => (
            <PageAssetComponent
              key={`artist-${pageIndex}-${index}`}
              item={item}
            />
          )),
        )}
      </div>
      {hasNextPage && (
        <Button
          className="shadow-sm shadow-black"
          onClick={fetchNextPage}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? "Loading more..." : "Load More"}
        </Button>
      )}
    </div>
  );
};

const ProductSkeleton = () => (
  <div className="relative flex h-full w-full gap-4">
    {[0, 1, 2, 3, 4].map((index) => (
      <div
        key={index}
        className="absolute flex-shrink-0 transition-all duration-300 "
        style={{
          transform: `translateX(${index * 220}px) scale(${index === 0 ? 0.95 : 0.8}) translateY(${index === 0 ? -10 : 20}px)`,
          zIndex: index === 0 ? 2 : 1,
          opacity: index === 0 ? 1 : 0.6,
        }}
      >
        <div className="flex flex-col justify-between gap-4 md:pl-8">
          <div
            className={`relative overflow-hidden rounded-xl ${index === 0 ? "shadow-lg shadow-gray-700" : "shadow-md shadow-gray-800"}`}
          >
            <div className="h-72 w-60 animate-pulse rounded-xl bg-gray-700" />
            <div className="absolute bottom-2 left-2 right-2 rounded-xl border-2 border-gray-600 bg-gray-800/50 p-4">
              <div className="mb-2 h-6 w-32 animate-pulse rounded bg-gray-700" />
              <div className="h-4 w-24 animate-pulse rounded bg-gray-700" />
            </div>
          </div>

          <div className="flex flex-col gap-2 md:hidden">
            <div className="flex items-center gap-2">
              <div className="h-6 w-full animate-pulse rounded bg-gray-700" />
              <div className="h-6 w-16 animate-pulse rounded bg-gray-700" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-20 animate-pulse rounded bg-gray-700" />
              <div className="h-4 w-24 animate-pulse rounded bg-gray-700" />
            </div>
            <div className="h-10 w-full animate-pulse rounded bg-gray-700" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const DetailsSkeleton = () => (
  <div className="min-w-[350px] space-y-6 rounded-xl border border-gray-700 bg-gray-800/50 p-6 backdrop-blur-md">
    <div className="space-y-2 rounded-md border-2 border-gray-700 p-4">
      <div className="h-6 w-32 animate-pulse rounded bg-gray-700" />
      <div className="h-4 w-24 animate-pulse rounded bg-gray-700" />
    </div>

    <div className="space-y-4 p-2">
      <div className="flex items-center gap-2">
        <div className="h-6 w-full animate-pulse rounded bg-gray-700" />
        <div className="h-6 w-16 animate-pulse rounded bg-gray-700" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-4 w-20 animate-pulse rounded bg-gray-700" />
        <div className="h-4 w-24 animate-pulse rounded bg-gray-700" />
      </div>
    </div>

    <div className="h-10 w-full animate-pulse rounded bg-gray-700" />
  </div>
);
