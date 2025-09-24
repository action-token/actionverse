"use client";

import React, { useEffect } from "react";
import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
    ImageIcon,
    Grid3X3,
    Calendar,
    Twitter,
    Instagram,
    Globe,
    CheckCircle2,
    Edit,
    Plus,
    Eye,
    Camera,
    X,
    DollarSign,
    Menu,
    Users,
    ChevronUp,
    ChevronDown,
    ArrowDownFromLine,
    Info,
    Copy,
    Check,
    Loader2,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/shadcn/ui/dialog";
import { Button } from "~/components/shadcn/ui/button";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "~/components/shadcn/ui/tabs";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/shadcn/ui/card";
import { Input } from "~/components/shadcn/ui/input";
import { Textarea } from "~/components/shadcn/ui/textarea";
import { Label } from "~/components/shadcn/ui/label";
import { Separator } from "~/components/shadcn/ui/separator";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import ArtistDashboardSkeleton from "~/components/creator/artist-profile-loading";
import NotFound from "~/pages/404";
import CustomAvatar from "~/components/common/custom-avatar";
import { useCreatePostModalStore } from "~/components/store/create-post-modal-store";
import { useSession } from "next-auth/react";
import PostCard from "~/components/post/post-card";
import { UploadS3Button } from "~/components/common/upload-button";
import toast from "react-hot-toast";
import { useAddSubsciptionModalStore } from "~/components/store/add-subscription-modal-store";
import { Skeleton } from "~/components/shadcn/ui/skeleton";
import { MoreAssetsSkeleton } from "~/components/common/grid-loading";
import MarketAssetComponent from "~/components/common/market-asset";
import { useNFTCreateModalStore } from "~/components/store/nft-create-modal-store";
import { Badge } from "~/components/shadcn/ui/badge";
import { SubscriptionContextMenu } from "~/components/common/subscripton-context";
import { useCreatorStorageAcc } from "~/lib/state/wallete/stellar-balances";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/shadcn/ui/tooltip";
const isValidUrl = (string: string) => {
    try {
        const url = new URL(string);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
        return false;
    }
};

export default function ArtistDashboard() {
    const session = useSession();

    const [activeTab, setActiveTab] = useState("posts");
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [expandedPackage, setExpandedPackage] = useState<number | null>(null);
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [scrollProgress, setScrollProgress] = useState(0);
    const { setIsOpen: setIsPostModalOpen } = useCreatePostModalStore();
    const { openForCreate, openForEdit } = useAddSubsciptionModalStore();
    const { setIsOpen: setIsNFTModalOpen } = useNFTCreateModalStore();
    const { getAssetBalance } = useCreatorStorageAcc();
    const [copied, setCopied] = useState(false);

    const contentRef = useRef<HTMLDivElement>(null);

    // API calls
    const creator = api.fan.creator.meCreator.useQuery();
    const code =
        creator.data?.pageAsset?.code ??
        creator.data?.customPageAssetCodeIssuer?.split("-")[0];
    const issuer =
        creator.data?.pageAsset?.issuer ??
        creator.data?.customPageAssetCodeIssuer?.split("-")[1];
    const assetObj = { code, issuer };
    const walletAddress = creator.data?.storagePub;

    const subscriptionPackages = api.fan.creator.getCreatorPackages.useQuery();
    const updateProfileMutation =
        api.fan.creator.changeCreatorProfilePicture.useMutation({
            onSuccess: () => {
                toast.success("Profile Picture changed successfully");
                creator.refetch();
            },
        });
    const coverChangeMutation =
        api.fan.creator.changeCreatorCoverPicture.useMutation({
            onSuccess: () => {
                toast.success("Cover Changed Successfully");
                creator.refetch();
            },
        });
    const allCreatedPost = api.fan.post.getPosts.useInfiniteQuery(
        {
            pubkey: session.data?.user.id ?? "",
            limit: 10,
        },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor,
        },
    );
    const creatorNFT =
        api.marketplace.market.getCreatorNftsByCreatorID.useInfiniteQuery(
            { limit: 10, creatorId: session.data?.user.id ?? "" },
            {
                getNextPageParam: (lastPage) => lastPage.nextCursor,
            },
        );

    // Profile editing state
    const [editedProfile, setEditedProfile] = useState({
        name: creator.data?.name ?? "",
        bio: creator.data?.bio ?? "",
        website: creator.data?.website ?? "",
        twitter: creator.data?.twitter ?? "",
        instagram: creator.data?.instagram ?? "",
    });

    const [formErrors, setFormErrors] = useState({
        name: "",
        bio: "",
        website: "",
        twitter: "",
        instagram: "",
    });

    // Update profile info mutation
    const UpdateCreatorProfileInfo =
        api.fan.creator.updateCreatorProfileInfo.useMutation({
            onSuccess: () => {
                toast.success("Profile Updated Successfully");
                creator.refetch();
                setShowSuccessMessage(true);
                setTimeout(() => setShowSuccessMessage(false), 3000);
            },
            onError: (error) => {
                toast.error(`Error updating profile: ${error.message}`);
            },
        });

    // Cancel profile editing
    const cancelProfileEditing = () => {
        setEditedProfile({
            name: creator.data?.name ?? "",
            bio: creator.data?.bio ?? "",
            website: creator.data?.website ?? "",
            twitter: creator.data?.twitter ?? "",
            instagram: creator.data?.instagram ?? "",
        });
        setFormErrors({
            name: "",
            bio: "",
            website: "",
            twitter: "",
            instagram: "",
        });
        setIsEditingProfile(false);
    };

    const handleCopy = async (url: string | undefined) => {
        try {
            if (url) {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch (err) {
            console.error("Failed to copy text: ", err);
        }
    };
    // Save profile changes
    const saveProfileChanges = () => {
        setIsEditingProfile(false);
        UpdateCreatorProfileInfo.mutate({
            name: editedProfile.name,
            bio: editedProfile.bio,
            website: editedProfile.website,
            twitter: editedProfile.twitter,
            instagram: editedProfile.instagram,
        });
    };

    // Toggle package expansion
    const togglePackageExpansion = (id: number) => {
        if (expandedPackage === id) {
            setExpandedPackage(null);
        } else {
            setExpandedPackage(id);
        }
    };

    useEffect(() => {
        const handleScroll = () => {
            if (contentRef.current) {
                const scrollPosition = contentRef.current.scrollTop;
                const scrollThreshold = 100;

                if (scrollPosition > scrollThreshold) {
                    setIsScrolled(true);
                    setScrollProgress(
                        Math.min(1, (scrollPosition - scrollThreshold) / 50),
                    );
                } else {
                    setIsScrolled(false);
                    setScrollProgress(0);
                }
            }
        };

        // Add event listener to the content div instead of window
        const currentContentRef = contentRef.current;
        if (currentContentRef) {
            currentContentRef.addEventListener("scroll", handleScroll);
        }

        // Clean up
        return () => {
            if (currentContentRef) {
                currentContentRef.removeEventListener("scroll", handleScroll);
            }
        };
    }, []);

    // Toggle sidebar on mobile
    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    if (creator.isLoading) {
        return <ArtistDashboardSkeleton />;
    }

    if (!creator.data) {
        return <NotFound />;
    }

    return (
        <div className="flex h-screen flex-col  bg-background">
            {/* Success Message */}
            {showSuccessMessage && (
                <div className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-md bg-green-500 px-4 py-2 text-white shadow-lg">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Profile updated successfully!</span>
                </div>
            )}

            {/* Header with Cover Image */}
            <div
                className="relative  w-full transition-all duration-500"
                style={{
                    height: isScrolled ? "0px" : "200px",
                }}
            >
                <div className="relative h-full w-full">
                    {
                        coverChangeMutation.isLoading ? (
                            //loading overley
                            <>
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black bg-opacity-50">
                                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                                </div>
                            </>

                        ) : (
                            <Image
                                src={
                                    creator.data.coverUrl?.length === 0 ||
                                        creator.data.coverUrl === null
                                        ? "/placeholder.svg?height=400&width=1200"
                                        : creator.data.coverUrl
                                }
                                alt={`${creator.data.name}'s cover`}
                                fill
                                className="object-cover"
                                priority
                            />
                        )
                    }

                    {/* Mobile Menu Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-2 top-2 z-20 text-white hover:bg-background/20 md:hidden"
                        onClick={toggleSidebar}
                    >
                        <ArrowDownFromLine className="h-5 w-5" />
                    </Button>

                    {/* Edit Profile Button - Only visible when not editing */}
                    {!isEditingProfile ? (
                        <Button
                            variant="secondary"
                            size="sm"
                            className="absolute right-4 top-4 gap-1"
                            onClick={() => setIsEditingProfile(true)}
                        >
                            <Edit className="h-4 w-4" />
                            <span className="hidden sm:inline">Edit Profile</span>
                        </Button>
                    ) : (
                        <Button
                            variant="secondary"
                            size="sm"
                            className="absolute bottom-4 right-4 gap-1"
                            disabled={coverChangeMutation.isLoading}
                            onClick={() => document.getElementById("cover-upload")?.click()}
                        >
                            {coverChangeMutation.isLoading ? (
                                <>

                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="hidden sm:inline">Uploading...</span>
                                </>
                            ) : (
                                <>

                                    <Camera className="h-4 w-4" />
                                    <span className="hidden sm:inline">Change Cover</span>
                                </>
                            )}
                        </Button>
                    )}

                    {isEditingProfile && (
                        <UploadS3Button
                            endpoint="coverUploader"
                            variant="hidden"
                            id="cover-upload"
                            onClientUploadComplete={(res) => {
                                const fileUrl = res.url;
                                coverChangeMutation.mutate(fileUrl);
                            }}
                            onUploadError={(error: Error) => {
                                toast.error(`ERROR! ${error.message}`);
                            }}
                        />
                    )}
                </div>
                <header
                    className={cn(
                        "absolute left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b border-primary/20 bg-background/95 px-4 shadow-md backdrop-blur-sm transition-all duration-500",
                        isScrolled
                            ? "translate-y-0 opacity-100"
                            : "-translate-y-full opacity-0",
                    )}
                    style={{
                        transform: isScrolled ? `translateY(0)` : `translateY(-100%)`,
                        opacity: scrollProgress,
                    }}
                >
                    <div className="flex items-center gap-3">
                        <CustomAvatar
                            url={creator.data.profileUrl}
                            className="h-9 w-9 border-2 border-background"
                        />
                        <div className="flex flex-col">
                            <span className="flex items-center gap-1 text-sm font-semibold">
                                {creator.data.name}
                                {creator.data.approved && (
                                    <CheckCircle2 className="h-3 w-3 text-primary" />
                                )}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {isEditingProfile ? "Editing Profile" : "Artist Dashboard"}
                            </span>
                        </div>
                    </div>
                    {isEditingProfile ? (
                        <div className="mb-8 flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={cancelProfileEditing}
                            >
                                <X className="h-3 w-3" />
                                <span>Cancel</span>
                            </Button>
                            <Button
                                size="sm"
                                className="gap-1"
                                onClick={saveProfileChanges}
                                disabled={
                                    UpdateCreatorProfileInfo.isLoading ||
                                    !!formErrors.name ||
                                    !!formErrors.bio ||
                                    !!formErrors.website ||
                                    !!formErrors.twitter ||
                                    !!formErrors.instagram
                                }
                            >
                                <CheckCircle2 className="h-3 w-3" />
                                <span>
                                    {UpdateCreatorProfileInfo.isLoading ? "Saving..." : "Save"}
                                </span>
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => setIsEditingProfile(true)}
                        >
                            <Edit className="h-3 w-3" />
                            <span>Edit Profile</span>
                        </Button>
                    )}
                </header>
            </div>

            {/* Main Content Area with Responsive Sidebar */}
            <div className="flex flex-1 overflow-hidden ">
                {/* Left Sidebar - Fixed on desktop, slide-in on mobile */}
                <div
                    className={cn(
                        "absolute z-40 h-full w-[300px] shrink-0 border-r bg-card transition-transform duration-500 md:relative",
                        isSidebarOpen
                            ? "translate-x-0"
                            : "-translate-x-full md:translate-x-0",
                    )}
                >
                    {/* Close button for mobile sidebar */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 md:hidden"
                        onClick={toggleSidebar}
                    >
                        <X className="h-5 w-5" />
                    </Button>

                    <div className="flex h-full flex-col overflow-auto p-6 pb-32">
                        <div className="flex flex-col items-center pt-4">
                            {/* Profile Image */}
                            <div className="relative">
                                <CustomAvatar
                                    url={creator.data?.profileUrl}
                                    className="h-24 w-24 border-4 border-background shadow-xl"
                                />

                                {creator.data.approved && (
                                    <div className="absolute bottom-1 right-1 rounded-full bg-primary p-1 text-primary-foreground shadow-lg">
                                        <CheckCircle2 className="h-4 w-4" />
                                    </div>
                                )}

                                {/* Edit Profile Image Button */}
                                {isEditingProfile && (
                                    <>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                                            disabled={updateProfileMutation.isLoading}
                                            onClick={() =>
                                                document.getElementById("profile-upload")?.click()
                                            }
                                        >
                                            {
                                                updateProfileMutation.isLoading ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        <span className="sr-only">Loading...</span>
                                                    </>
                                                ) : (
                                                    <Camera className="h-4 w-4" />
                                                )
                                            }
                                        </Button>
                                        <UploadS3Button
                                            endpoint="profileUploader"
                                            variant="hidden"
                                            id="profile-upload"
                                            onClientUploadComplete={(res) => {
                                                const fileUrl = res.url;
                                                updateProfileMutation.mutate(fileUrl);
                                            }}
                                            onUploadError={(error: Error) => {
                                                toast.error(`ERROR! ${error.message}`);
                                            }}
                                        />
                                    </>
                                )}
                            </div>

                            {/* Profile Info */}
                            <div className="mt-4 w-full text-center">
                                {isEditingProfile ? (
                                    <Input
                                        value={editedProfile.name}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setEditedProfile({ ...editedProfile, name: value });
                                            setFormErrors({
                                                ...formErrors,
                                                name:
                                                    value.length > 99
                                                        ? "Name must be less than 99 characters"
                                                        : "",
                                            });
                                        }}
                                        className={cn(
                                            "mb-1 text-center text-xl font-bold",
                                            formErrors.name && "border-destructive",
                                        )}
                                        maxLength={99}
                                    />
                                ) : (
                                    <h1 className="flex items-center justify-center gap-1 text-xl font-bold md:text-2xl">
                                        {creator.data.name}
                                        {creator.data.approved && (
                                            <CheckCircle2 className="h-4 w-4 text-primary" />
                                        )}
                                    </h1>
                                )}

                                {isEditingProfile ? (
                                    <div className="mt-3">
                                        <Label htmlFor="bio" className="text-sm">
                                            Bio
                                        </Label>
                                        <Textarea
                                            id="bio"
                                            value={editedProfile.bio}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setEditedProfile({ ...editedProfile, bio: value });
                                                const wordCount = value.trim().split(/\s+/).length;
                                                setFormErrors({
                                                    ...formErrors,
                                                    bio:
                                                        wordCount > 200
                                                            ? "Bio must be less than 200 words"
                                                            : "",
                                                });
                                            }}
                                            className={cn(
                                                "mt-1 resize-none",
                                                formErrors.bio && "border-destructive",
                                            )}
                                            rows={3}
                                        />
                                        {formErrors.bio && (
                                            <p className="mt-1 text-xs text-destructive">
                                                {formErrors.bio}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="mt-3 text-sm text-muted-foreground">
                                        {creator.data?.bio && creator.data.bio.length > 0
                                            ? creator.data.bio
                                            : "No bio provided"}
                                    </p>
                                )}
                            </div>
                        </div>

                        <Separator className="my-6" />

                        {/* Profile Stats */}
                        <div className="grid w-full grid-cols-3 gap-2">
                            <div className="cursor-pointer rounded-lg bg-muted/50 p-3 text-center transition-colors hover:bg-muted/70">
                                <p className="text-xl font-bold">
                                    {creator.data._count.followers ?? 0}
                                </p>
                                <p className="text-xs text-muted-foreground">Followers</p>
                            </div>
                            <div className="cursor-pointer rounded-lg bg-muted/50 p-3 text-center transition-colors hover:bg-muted/70">
                                <p className="text-xl font-bold">
                                    {creator.data._count.posts ?? 0}
                                </p>
                                <p className="text-xs text-muted-foreground">Posts</p>
                            </div>
                            <div className="cursor-pointer rounded-lg bg-muted/50 p-3 text-center transition-colors hover:bg-muted/70">
                                <p className="text-xl font-bold">
                                    {creator.data._count.assets ?? 0}
                                </p>
                                <p className="text-xs text-muted-foreground">NFTs</p>
                            </div>
                        </div>

                        <Separator className="my-6" />

                        {/* Social Links */}
                        {isEditingProfile ? (
                            <div className="w-full space-y-4">
                                <div>
                                    <Label htmlFor="website" className="text-sm">
                                        Website
                                    </Label>
                                    <div className="mt-1 flex items-center">
                                        <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="website"
                                            value={editedProfile.website}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setEditedProfile({ ...editedProfile, website: value });

                                                // URL validation
                                                if (value && !isValidUrl(value)) {
                                                    setFormErrors({
                                                        ...formErrors,
                                                        website: "Please enter a valid URL",
                                                    });
                                                } else {
                                                    setFormErrors({
                                                        ...formErrors,
                                                        website: "",
                                                    });
                                                }
                                            }}
                                            placeholder="https://yourwebsite.com"
                                            className={formErrors.website ? "border-destructive" : ""}
                                        />
                                    </div>
                                    {formErrors.website && (
                                        <p className="mt-1 text-xs text-destructive">
                                            {formErrors.website}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="twitter" className="text-sm">
                                        Twitter
                                    </Label>
                                    <div className="mt-1 flex items-center">
                                        <Twitter className="mr-2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="twitter"
                                            value={editedProfile.twitter}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/^@/, ""); // Remove @ if user types it
                                                setEditedProfile({ ...editedProfile, twitter: value });

                                                // Twitter handle validation
                                                if (value && /\s/.test(value)) {
                                                    setFormErrors({
                                                        ...formErrors,
                                                        twitter: "Enter a valid Twitter handle without spaces",
                                                    });
                                                } else {
                                                    setFormErrors({
                                                        ...formErrors,
                                                        twitter: "",
                                                    });
                                                }
                                            }}
                                            placeholder="username"
                                            className={formErrors.twitter ? "border-destructive" : ""}
                                        />
                                    </div>
                                    {formErrors.twitter && (
                                        <p className="mt-1 text-xs text-destructive">
                                            {formErrors.twitter}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="instagram" className="text-sm">
                                        Instagram
                                    </Label>
                                    <div className="mt-1 flex items-center">
                                        <Instagram className="mr-2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="instagram"
                                            value={editedProfile.instagram}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/^@/, ""); // Remove @ if user types it
                                                setEditedProfile({
                                                    ...editedProfile,
                                                    instagram: value,
                                                });

                                                // Instagram handle validation
                                                if (value && /\s/.test(value)) {
                                                    setFormErrors({
                                                        ...formErrors,
                                                        instagram: "Enter a valid Instagram handle without spaces",
                                                    });
                                                } else {
                                                    setFormErrors({
                                                        ...formErrors,
                                                        instagram: "",
                                                    });
                                                }
                                            }}
                                            placeholder="username"
                                            className={
                                                formErrors.instagram ? "border-destructive" : ""
                                            }
                                        />
                                    </div>
                                    {formErrors.instagram && (
                                        <p className="mt-1 text-xs text-destructive">
                                            {formErrors.instagram}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="w-full space-y-3">
                                {creator.data.website && (
                                    <div>
                                        <Link
                                            href={creator.data.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center text-sm text-muted-foreground transition-colors hover:text-primary"
                                        >
                                            <Globe className="mr-2 h-4 w-4" />
                                            <span>
                                                {creator.data.website.replace(/(^\w+:|^)\/\//, "")}
                                            </span>
                                        </Link>
                                    </div>
                                )}
                                {creator.data.twitter && (
                                    <div>
                                        <Link
                                            href={`https://twitter.com/${creator.data.twitter}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center text-sm text-muted-foreground transition-colors hover:text-[#1DA1F2]"
                                        >
                                            <Twitter className="mr-2 h-4 w-4" />
                                            <span>@{creator.data.twitter}</span>
                                        </Link>
                                    </div>
                                )}
                                {creator.data.instagram && (
                                    <div>
                                        <Link
                                            href={`https://instagram.com/${creator.data.instagram}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center text-sm text-muted-foreground transition-colors hover:text-[#E1306C]"
                                        >
                                            <Instagram className="mr-2 h-4 w-4" />
                                            <span>@{creator.data.instagram}</span>
                                        </Link>
                                    </div>
                                )}

                                <div className="flex items-center text-sm text-muted-foreground">
                                    <Calendar className="mr-2 h-4 w-4" />
                                    <span>
                                        Joined{" "}
                                        {new Date(creator.data.joinedAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Edit Profile Buttons */}
                        {isEditingProfile && (
                            <div className="mb-8 mt-6 flex w-full gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={cancelProfileEditing}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={saveProfileChanges}
                                    disabled={
                                        UpdateCreatorProfileInfo.isLoading ||
                                        !!formErrors.name ||
                                        !!formErrors.bio ||
                                        !!formErrors.website ||
                                        !!formErrors.twitter ||
                                        !!formErrors.instagram
                                    }
                                >
                                    {UpdateCreatorProfileInfo.isLoading ? "Saving..." : "Save"}
                                </Button>
                            </div>
                        )}

                        {/* Sidebar Footer */}
                        <div className="mt-auto pt-6">
                            <Button variant="outline" className="w-full" asChild>
                                <Link href={`/organization/${creator.data.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Public Profile
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Overlay for mobile sidebar */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 z-10 bg-background/80 backdrop-blur-sm md:hidden"
                        onClick={toggleSidebar}
                    />
                )}

                {/* Right Content Area - Scrollable */}
                <div className="relative flex-1">
                    <div ref={contentRef} className="absolute inset-0 overflow-auto">
                        <div className="p-1 pb-20 md:p-6">
                            {/* Dashboard Header */}
                            <div className="mb-8 flex items-center justify-between">
                                <h1 className="text-2xl font-bold md:text-3xl">
                                    Artist Dashboard
                                </h1>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        className="h-9 md:h-10"
                                        onClick={() => setIsPostModalOpen(true)}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        <span className="hidden sm:inline">Create Post</span>
                                        <span className="sm:hidden">Post</span>
                                    </Button>
                                </div>
                            </div>

                            {/* Stats Cards */}
                            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Total Followers
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center">
                                            <Users className="mr-2 h-5 w-5 text-muted-foreground" />
                                            <div className="text-2xl font-bold">
                                                {creator.data._count.followers ?? 0}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Total Posts
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center">
                                            <Grid3X3 className="mr-2 h-5 w-5 text-muted-foreground" />
                                            <div className="text-2xl font-bold">
                                                {creator.data._count.posts ?? 0}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Total NFTs
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center">
                                            <ImageIcon className="mr-2 h-5 w-5 text-muted-foreground" />
                                            <div className="text-2xl font-bold">
                                                {creator.data._count.assets ?? 0}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            PageAsset
                                        </CardTitle>
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="border-2"
                                                >
                                                    <Info className="" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-md">
                                                <DialogHeader>
                                                    <DialogTitle className="flex items-center gap-2">
                                                        <Info className="h-5 w-5" />
                                                        Wallet Information
                                                    </DialogTitle>
                                                </DialogHeader>

                                                <div className="mt-4 space-y-4">
                                                    Please deposit {code} to the following wallet for your
                                                    custom asset
                                                    <CopyableField
                                                        label="Wallet Address"
                                                        value={walletAddress ?? ""}
                                                        description="Public Key"
                                                    />
                                                    <CopyableField label="Issuer" value={issuer ?? ""} />
                                                    <CopyableField label="Code" value={code ?? ""} />
                                                </div>

                                                <div className="mt-6 rounded-lg bg-muted/50 p-3">
                                                    <p className="text-center text-xs text-muted-foreground">
                                                        Hover over any field and click the copy icon to copy
                                                        to clipboard
                                                    </p>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center gap-2">
                                            <div className="text-2xl font-bold">
                                                {getAssetBalance(assetObj) ?? 0}{" "}
                                                <span className="text-sm">{code}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                            {/* Subscription Packages Section */}
                            <div className="mb-8">
                                {subscriptionPackages.data &&
                                    subscriptionPackages.data?.length > 0 && (
                                        <div className="mb-4 flex items-center justify-between">
                                            <h2 className="text-xl font-bold">
                                                Subscription Packages
                                            </h2>
                                            <Button
                                                size="sm"
                                                onClick={() =>
                                                    openForCreate({
                                                        customPageAsset:
                                                            creator.data?.customPageAssetCodeIssuer,
                                                        pageAsset: creator.data?.pageAsset,
                                                    })
                                                }
                                            >
                                                <Plus className="mr-2 h-4 w-4" />
                                                Create New Package
                                            </Button>
                                        </div>
                                    )}

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {subscriptionPackages.isLoading && (
                                        <SubscriptionPackagesSkeleton />
                                    )}
                                    {subscriptionPackages.data?.length === 0 && (
                                        <div className="rounded-lg bg-muted/30 py-12 text-center">
                                            <ImageIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                                            <h3 className="mb-2 text-lg font-medium">
                                                No Subscription Packages Found
                                            </h3>
                                            <p className="mb-4 text-muted-foreground">
                                                Start creating subscription packages for your followers
                                            </p>
                                            <Button
                                                onClick={() =>
                                                    openForCreate({
                                                        customPageAsset:
                                                            creator.data?.customPageAssetCodeIssuer,
                                                        pageAsset: creator.data?.pageAsset,
                                                    })
                                                }
                                            >
                                                <Plus className="mr-2 h-4 w-4" />
                                                Create New Package
                                            </Button>
                                        </div>
                                    )}
                                    {subscriptionPackages.data?.map((pkg) => (
                                        <Card
                                            key={pkg.id}
                                            className={cn(
                                                "relative h-full overflow-hidden border-2 transition-all duration-200 hover:shadow-md",
                                                pkg.popular ? "border-primary" : "border-border",
                                                !pkg.isActive && "opacity-60",
                                                expandedPackage === pkg.id && "ring-2 ring-primary",
                                            )}
                                        >
                                            <div className={cn("h-2", pkg.color)} />
                                            <CardHeader className="w-full pb-2">
                                                <div className="flex w-full justify-between">
                                                    <div className="flex w-full flex-col">
                                                        <CardTitle className="w-full">
                                                            <div className="flex w-full items-center justify-between  gap-2">
                                                                <span> {pkg.name}</span>
                                                                <SubscriptionContextMenu
                                                                    creatorId={pkg.creatorId}
                                                                    subscription={pkg}
                                                                    pageAsset={creator.data?.pageAsset}
                                                                    customPageAsset={
                                                                        creator.data?.customPageAssetCodeIssuer
                                                                    }
                                                                />
                                                            </div>
                                                        </CardTitle>
                                                        <div className="mt-2 flex items-baseline">
                                                            <span className="text-3xl font-bold">
                                                                {pkg.price}
                                                            </span>
                                                            <span className="ml-1 text-muted-foreground">
                                                                {creator.data?.pageAsset
                                                                    ? creator.data?.pageAsset.code
                                                                    : creator.data?.customPageAssetCodeIssuer?.split(
                                                                        "-",
                                                                    )[0]}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {pkg.popular && (
                                                    <div className="absolute right-0 top-0">
                                                        <div className="rounded-bl-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                                                            POPULAR
                                                        </div>
                                                    </div>
                                                )}
                                                <CardDescription className="mt-2">
                                                    {pkg.description}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4 pb-2">
                                                <ul className="space-y-2">
                                                    {pkg.features
                                                        .slice(
                                                            0,
                                                            expandedPackage === pkg.id
                                                                ? pkg.features.length
                                                                : 3,
                                                        )
                                                        .map((feature, i) => (
                                                            <li key={i} className="flex items-start gap-2">
                                                                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                                                                <span>{feature}</span>
                                                            </li>
                                                        ))}
                                                </ul>

                                                {pkg.features.length > 3 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="w-full text-xs"
                                                        onClick={() => togglePackageExpansion(pkg.id)}
                                                    >
                                                        {expandedPackage === pkg.id ? (
                                                            <>
                                                                <ChevronUp className="mr-1 h-4 w-4" />
                                                                Show Less
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ChevronDown className="mr-1 h-4 w-4" />
                                                                Show All Features
                                                            </>
                                                        )}
                                                    </Button>
                                                )}
                                            </CardContent>
                                            <CardFooter>
                                                <div className="flex w-full items-center justify-between">
                                                    <Badge variant={pkg.isActive ? "default" : "outline"}>
                                                        {pkg.isActive ? "Active" : "Inactive"}
                                                    </Badge>
                                                </div>
                                            </CardFooter>
                                        </Card>
                                    ))}
                                </div>
                            </div>

                            {/* Content Tabs */}
                            <div>
                                <Tabs
                                    defaultValue="posts"
                                    value={activeTab}
                                    onValueChange={setActiveTab}
                                    className="w-full"
                                >
                                    <TabsList className="mb-6 grid w-full grid-cols-2 sm:w-[300px]">
                                        <TabsTrigger
                                            value="posts"
                                            className="flex items-center gap-2"
                                        >
                                            <Grid3X3 className="h-4 w-4" />
                                            <span>Posts</span>
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="nfts"
                                            className="flex items-center gap-2"
                                        >
                                            <ImageIcon className="h-4 w-4" />
                                            <span>NFTs</span>
                                        </TabsTrigger>
                                    </TabsList>

                                    {/* Posts Tab */}
                                    <TabsContent value="posts" className="mb-16  space-y-6 ">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-xl font-bold">Your Posts</h2>
                                            <Button
                                                size="sm"
                                                onClick={() => setIsPostModalOpen(true)}
                                            >
                                                <Plus className="mr-2 h-4 w-4" />
                                                Create New Post
                                            </Button>
                                        </div>

                                        <div className="space-y-6 ">
                                            {allCreatedPost.isLoading && (
                                                <div className="space-y-4 ">
                                                    {[1, 2, 3].map((i) => (
                                                        <Card key={i} className="overflow-hidden">
                                                            <CardHeader>
                                                                <Skeleton className="mb-2 h-6 w-1/3" />
                                                                <Skeleton className="h-4 w-1/4" />
                                                            </CardHeader>
                                                            <CardContent>
                                                                <Skeleton className="mb-2 h-4 w-full" />
                                                                <Skeleton className="mb-2 h-4 w-full" />
                                                                <Skeleton className="mb-4 h-4 w-2/3" />
                                                                <Skeleton className="mb-4 h-48 w-full rounded-md" />
                                                            </CardContent>
                                                        </Card>
                                                    ))}
                                                </div>
                                            )}

                                            {allCreatedPost.data?.pages.map((page, i) => (
                                                <React.Fragment key={i}>
                                                    {page.posts.map((post) => (
                                                        <PostCard
                                                            key={post.id}
                                                            post={post}
                                                            creator={post.creator}
                                                            likeCount={post._count.likes}
                                                            commentCount={post._count.comments}
                                                            locked={post.subscription ? true : false}
                                                            show={true}
                                                            media={post.medias}
                                                        />
                                                    ))}
                                                </React.Fragment>
                                            ))}

                                            {allCreatedPost.hasNextPage && (
                                                <Button
                                                    variant="outline"
                                                    className="w-full"
                                                    onClick={() => allCreatedPost.fetchNextPage()}
                                                    disabled={allCreatedPost.isFetchingNextPage}
                                                >
                                                    {allCreatedPost.isFetchingNextPage
                                                        ? "Loading more..."
                                                        : "Load More Posts"}
                                                </Button>
                                            )}

                                            {allCreatedPost.data?.pages[0]?.posts.length === 0 && (
                                                <div className="rounded-lg bg-muted/30 py-12 text-center">
                                                    <ImageIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                                                    <h3 className="mb-2 text-lg font-medium">
                                                        No Posts Yet
                                                    </h3>
                                                    <p className="mb-4 text-muted-foreground">
                                                        Start creating content for your followers
                                                    </p>
                                                    <Button onClick={() => setIsPostModalOpen(true)}>
                                                        <Plus className="mr-2 h-4 w-4" />
                                                        Create Your First Post
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </TabsContent>

                                    {/* NFTs Tab */}
                                    <TabsContent value="nfts">
                                        <div className="mb-6 flex items-center justify-between">
                                            <h2 className="text-xl font-bold">Your NFT Collection</h2>
                                            <Button onClick={() => setIsNFTModalOpen(true)}>
                                                <Plus className="mr-2 h-4 w-4" />
                                                Create New NFT
                                            </Button>
                                        </div>

                                        <div className="flex min-h-[calc(100vh-20vh)] flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md">
                                            {creatorNFT.isLoading && (
                                                <MoreAssetsSkeleton className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4 xl:grid-cols-5" />
                                            )}

                                            {creatorNFT.data?.pages[0]?.nfts.length === 0 && (
                                                <div className="flex h-full flex-col items-center justify-center text-lg font-bold">
                                                    <ImageIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                                                    <h3 className="mb-2 text-lg font-medium">
                                                        No NFTs Found
                                                    </h3>
                                                    <p className="mb-4 text-muted-foreground">
                                                        Start creating your NFT collection
                                                    </p>
                                                    <Button onClick={() => setIsNFTModalOpen(true)}>
                                                        <Plus className="mr-2 h-4 w-4" />
                                                        Create Your First NFT
                                                    </Button>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4 xl:grid-cols-5">
                                                {creatorNFT.data?.pages.map((items, itemIndex) =>
                                                    items.nfts.map((item, index) => (
                                                        <MarketAssetComponent
                                                            key={`music-${itemIndex}-${index}`}
                                                            item={item}
                                                        />
                                                    )),
                                                )}
                                            </div>

                                            {creatorNFT.hasNextPage && (
                                                <Button
                                                    className="flex w-1/2 items-center justify-center shadow-sm shadow-black md:w-1/4"
                                                    onClick={() => creatorNFT.fetchNextPage()}
                                                    disabled={creatorNFT.isFetchingNextPage}
                                                >
                                                    {creatorNFT.isFetchingNextPage
                                                        ? "Loading more..."
                                                        : "Load More"}
                                                </Button>
                                            )}
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SubscriptionPackagesSkeleton() {
    // Create an array of 3 items to represent the loading cards
    const skeletonCards = Array(3).fill(null);

    return (
        <>
            {skeletonCards.map((_, index) => (
                <div key={index}>
                    <Card className="relative h-full overflow-hidden border-2 transition-all duration-200 hover:shadow-md">
                        <div className="h-2 bg-muted" />
                        <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                                <div className="w-full">
                                    <Skeleton className="mb-2 h-6 w-3/4" />
                                    <div className="mt-2 flex items-baseline">
                                        <Skeleton className="h-8 w-20" />
                                        <Skeleton className="ml-1 h-4 w-12" />
                                    </div>
                                </div>
                                <Skeleton className="h-8 w-8 rounded-full" />
                            </div>
                            <Skeleton className="mt-2 h-4 w-full" />
                        </CardHeader>
                        <CardContent className="space-y-4 pb-2">
                            <div className="space-y-2">
                                {Array(4)
                                    .fill(null)
                                    .map((_, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <Skeleton className="mt-0.5 h-5 w-5 shrink-0 rounded-full" />
                                            <Skeleton className="h-4 w-full" />
                                        </div>
                                    ))}
                            </div>
                            <Skeleton className="h-8 w-full" />
                        </CardContent>
                        <CardFooter>
                            <div className="flex w-full items-center justify-between">
                                <Skeleton className="h-5 w-16" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            ))}
        </>
    );
}

interface CopyableFieldProps {
    label: string;
    value: string;
    description?: string;
}

function CopyableField({ label, value, description }: CopyableFieldProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            toast.success(`${label} copied to clipboard`);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error("Failed to copy to clipboard");
        }
    };

    return (
        <div className="group relative rounded-lg border border-border bg-card p-4 transition-colors hover:bg-primary/50">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                        <h4 className="text-sm font-medium text-foreground">{label}</h4>
                        {description && (
                            <span className="text-xs text-muted-foreground">
                                ({description})
                            </span>
                        )}
                    </div>
                    <p className="break-all rounded bg-muted/50 px-2 py-1 font-mono text-sm text-muted-foreground">
                        {value}
                    </p>
                </div>
                <Button
                    size="sm"
                    onClick={handleCopy}
                    className="h-8 w-8 shrink-0 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                >
                    {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                    ) : (
                        <Copy className="h-4 w-4" />
                    )}
                </Button>
            </div>
        </div>
    );
}
