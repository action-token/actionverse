"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "~/components/shadcn/ui/card";
import { Button } from "~/components/shadcn/ui/button";
import { Input } from "~/components/shadcn/ui/input";
import { Label } from "~/components/shadcn/ui/label";
import { Textarea } from "~/components/shadcn/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/shadcn/ui/select";
import { Upload, ImageIcon, Music, Video, Box, X, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import useNeedSign from "~/lib/hook";
import { clientsign, extractTxHash } from "package/connect_wallet";
import { clientSelect } from "~/lib/stellar/fan/utils";
import { submitSignedXDRToServer4User } from "package/connect_wallet/src/lib/stellar/trx/payment_fb_g";
import axios from "axios";
import type { EndPointType } from "~/server/s3";

type MediaType = "image" | "video" | "audio" | "3d";

async function computeSHA256(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getEndpointForMediaType(mediaType: MediaType): EndPointType {
    switch (mediaType) {
        case "image": return "imageUploader";
        case "video": return "videoUploader";
        case "audio": return "musicUploader";
        case "3d": return "modelUploader";
    }
}

interface NFTFormData {
    name: string;
    description: string;
    mediaType: MediaType;
    mediaFile: File | null;
    mediaPreview: string;
    copies: number;
    price: string;
}

const initialFormData: NFTFormData = {
    name: "",
    description: "",
    mediaType: "image",
    mediaFile: null,
    mediaPreview: "",
    copies: 1,
    price: "",
};

const CreateNFTPage = () => {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { needSign } = useNeedSign();

    const [formData, setFormData] = useState<NFTFormData>(initialFormData);
    const [step, setStep] = useState<"form" | "uploading" | "minting" | "done">("form");

    const createNftMutation = api.nft.Nft.createNft.useMutation();
    const getMintXDRMutation = api.nft.Nft.getMintNftXDR.useMutation();
    const confirmMintMutation = api.nft.Nft.confirmNftMinted.useMutation({
        onSuccess: () => {
            setStep("done");
            toast.success("NFT minted successfully!");
            setFormData(initialFormData);
        },
        onError: (e) => {
            toast.error(e.message);
            setStep("form");
        },
    });

    const getSignedURL = api.s3.getSignedURL.useMutation();

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (file) {
            const preview = URL.createObjectURL(file);
            setFormData((prev) => ({
                ...prev,
                mediaFile: file,
                mediaPreview: preview,
            }));
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: getAcceptedTypes(formData.mediaType),
        maxFiles: 1,
    });

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleMediaTypeChange = (value: MediaType) => {
        setFormData((prev) => ({
            ...prev,
            mediaType: value,
            mediaFile: null,
            mediaPreview: "",
        }));
    };

    const removeMedia = () => {
        if (formData.mediaPreview) {
            URL.revokeObjectURL(formData.mediaPreview);
        }
        setFormData((prev) => ({
            ...prev,
            mediaFile: null,
            mediaPreview: "",
        }));
    };

    const uploadToS3 = async (file: File): Promise<string> => {
        const checksum = await computeSHA256(file);
        const endpoint = getEndpointForMediaType(formData.mediaType);

        const { uploadUrl, fileUrl } = await getSignedURL.mutateAsync({
            fileType: file.type,
            fileSize: file.size,
            checksum,
            endPoint: endpoint,
            fileName: file.name,
        });

        await axios.put(uploadUrl, file, {
            headers: { "Content-Type": file.type },
        });

        return fileUrl;
    };

    const handleCreate = async () => {
        if (!formData.name || !formData.mediaFile || !formData.price) {
            toast.error("Please fill in all required fields");
            return;
        }

        setStep("uploading");

        try {
            const contentUrl = await uploadToS3(formData.mediaFile);
            const thumbnail = contentUrl;

            const nft = await createNftMutation.mutateAsync({
                name: formData.name,
                description: formData.description,
                thumbnail,
                contentUrl,
                mediaType: formData.mediaType,
                copies: formData.copies,
                price: parseFloat(formData.price),
            });

            setStep("minting");

            const { xdr, fullySignedByServer } = await getMintXDRMutation.mutateAsync({
                nftId: nft.id,
                signWith: needSign(),
            });

            let txHash: string | undefined;
            if (fullySignedByServer) {
                const result = await submitSignedXDRToServer4User(xdr);
                txHash = extractTxHash(result);
            } else {
                const clientResponse = await clientsign({
                    presignedxdr: xdr,
                    walletType: session?.user.walletType,
                    pubkey: session?.user.id,
                    test: clientSelect(),
                });
                txHash = extractTxHash(clientResponse);
            }

            if (!txHash) {
                toast.error("Minting transaction failed");
                setStep("form");
                return;
            }

            await confirmMintMutation.mutateAsync({
                nftId: nft.id,
                txHash,
                onChainTokenId: "1", // Parsed from event
            });
        } catch (e) {
            console.error(e);
            toast.error("Failed to create NFT");
            setStep("form");
        }
    };

    const isDisabled = step !== "form";

    if (status === "unauthenticated") {
        return (
            <div className="flex h-[calc(100vh-10.8vh)] items-center justify-center">
                <Card className="p-8 text-center">
                    <h2 className="text-xl font-bold">Please sign in to create NFTs</h2>
                    <Button className="mt-4" onClick={() => router.push("/")}>
                        Go to Home
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-10.8vh)] gap-4 overflow-hidden p-4">
            {/* Left Side - Form */}
            <Card className="flex w-1/2 flex-col overflow-hidden">
                <CardHeader className="border-b bg-secondary">
                    <CardTitle>Create New NFT</CardTitle>
                    <CardDescription>
                        Mint your digital asset on the Stellar blockchain (SEP-50)
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-6 overflow-y-auto p-6">
                    {/* NFT Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">NFT Name *</Label>
                        <Input
                            id="name"
                            name="name"
                            placeholder="Enter NFT name"
                            value={formData.name}
                            onChange={handleInputChange}
                            disabled={isDisabled}
                            required
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            name="description"
                            placeholder="Describe your NFT..."
                            value={formData.description}
                            onChange={handleInputChange}
                            disabled={isDisabled}
                            rows={3}
                        />
                    </div>

                    {/* Media Type */}
                    <div className="space-y-2">
                        <Label>Media Type</Label>
                        <Select
                            value={formData.mediaType}
                            onValueChange={handleMediaTypeChange}
                            disabled={isDisabled}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select media type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="image">
                                    <div className="flex items-center gap-2">
                                        <ImageIcon className="h-4 w-4" />
                                        Image
                                    </div>
                                </SelectItem>
                                <SelectItem value="video">
                                    <div className="flex items-center gap-2">
                                        <Video className="h-4 w-4" />
                                        Video
                                    </div>
                                </SelectItem>
                                <SelectItem value="audio">
                                    <div className="flex items-center gap-2">
                                        <Music className="h-4 w-4" />
                                        Audio
                                    </div>
                                </SelectItem>
                                <SelectItem value="3d">
                                    <div className="flex items-center gap-2">
                                        <Box className="h-4 w-4" />
                                        3D Object
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* File Upload */}
                    <div className="space-y-2">
                        <Label>Upload Media *</Label>
                        {formData.mediaPreview ? (
                            <div className="relative rounded-lg border-2 border-dashed p-4">
                                <button
                                    onClick={removeMedia}
                                    className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-white"
                                    disabled={isDisabled}
                                >
                                    <X className="h-4 w-4" />
                                </button>
                                <MediaPreview
                                    type={formData.mediaType}
                                    src={formData.mediaPreview}
                                />
                            </div>
                        ) : (
                            <div
                                {...getRootProps()}
                                className={cn(
                                    "cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors",
                                    isDragActive
                                        ? "border-primary bg-primary/10"
                                        : "border-muted-foreground/25 hover:border-primary",
                                    isDisabled && "pointer-events-none opacity-50",
                                )}
                            >
                                <input {...getInputProps()} />
                                <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {isDragActive
                                        ? "Drop the file here..."
                                        : "Drag & drop or click to upload"}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {getAcceptedFormats(formData.mediaType)}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Copies */}
                    <div className="space-y-2">
                        <Label htmlFor="copies">Number of Copies</Label>
                        <Input
                            id="copies"
                            name="copies"
                            type="number"
                            min={1}
                            value={formData.copies}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    copies: parseInt(e.target.value) || 1,
                                }))
                            }
                            disabled={isDisabled}
                        />
                    </div>

                    {/* Price */}
                    <div className="space-y-2">
                        <Label htmlFor="price">Price (XLM) *</Label>
                        <Input
                            id="price"
                            name="price"
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="0.00"
                            value={formData.price}
                            onChange={handleInputChange}
                            disabled={isDisabled}
                            required
                        />
                    </div>

                    {/* Create Button */}
                    <Button
                        onClick={handleCreate}
                        disabled={
                            isDisabled ||
                            !formData.name ||
                            !formData.mediaFile ||
                            !formData.price
                        }
                        className="w-full shadow-sm shadow-black"
                    >
                        {step === "uploading" ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Uploading...
                            </>
                        ) : step === "minting" ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Minting NFT...
                            </>
                        ) : step === "done" ? (
                            "NFT Created!"
                        ) : (
                            "Create & Mint NFT"
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* Right Side - Preview */}
            <Card className="flex w-1/2 flex-col overflow-hidden">
                <CardHeader className="border-b bg-secondary">
                    <CardTitle>Preview</CardTitle>
                    <CardDescription>See how your NFT will appear</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 items-center justify-center p-6">
                    {formData.name || formData.mediaPreview ? (
                        <NFTPreviewCard formData={formData} />
                    ) : (
                        <div className="text-center text-muted-foreground">
                            <ImageIcon className="mx-auto h-16 w-16 opacity-50" />
                            <p className="mt-4 text-lg">Fill in the form to see preview</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

function MediaPreview({ type, src }: { type: MediaType; src: string }) {
    switch (type) {
        case "image":
            return (
                <div className="relative mx-auto h-48 w-full">
                    <Image
                        src={src}
                        alt="Preview"
                        fill
                        className="rounded-lg object-contain"
                    />
                </div>
            );
        case "video":
            return (
                <video
                    src={src}
                    controls
                    className="mx-auto h-48 w-full rounded-lg object-contain"
                />
            );
        case "audio":
            return (
                <div className="flex flex-col items-center gap-4 py-8">
                    <Music className="h-16 w-16 text-primary" />
                    <audio src={src} controls className="w-full" />
                </div>
            );
        case "3d":
            return (
                <div className="flex flex-col items-center gap-4 py-8">
                    <Box className="h-16 w-16 text-primary" />
                    <p className="text-sm text-muted-foreground">3D Object uploaded</p>
                </div>
            );
    }
}

function NFTPreviewCard({ formData }: { formData: NFTFormData }) {
    return (
        <Card className="w-full max-w-sm overflow-hidden shadow-lg">
            <div className="relative h-64 bg-gradient-to-br from-gray-100 to-gray-200">
                {formData.mediaPreview && formData.mediaType === "image" ? (
                    <Image
                        src={formData.mediaPreview}
                        alt={formData.name || "NFT Preview"}
                        fill
                        className="object-cover"
                    />
                ) : formData.mediaPreview ? (
                    <div className="flex h-full items-center justify-center">
                        <MediaTypeIcon type={formData.mediaType} />
                    </div>
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
                    </div>
                )}
            </div>
            <CardContent className="p-4">
                <h3 className="truncate text-lg font-bold">
                    {formData.name || "Untitled NFT"}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {formData.description || "No description"}
                </p>
                <div className="mt-4 flex items-center justify-between">
                    <div>
                        <p className="text-lg font-bold">
                            {formData.price || "0"} XLM
                        </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {formData.copies} {formData.copies === 1 ? "copy" : "copies"}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

function MediaTypeIcon({ type }: { type: MediaType }) {
    const iconClass = "h-16 w-16 text-muted-foreground";
    switch (type) {
        case "image":
            return <ImageIcon className={iconClass} />;
        case "video":
            return <Video className={iconClass} />;
        case "audio":
            return <Music className={iconClass} />;
        case "3d":
            return <Box className={iconClass} />;
    }
}

function getAcceptedTypes(mediaType: MediaType): Record<string, string[]> {
    switch (mediaType) {
        case "image":
            return { "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"] };
        case "video":
            return { "video/*": [".mp4", ".webm", ".mov"] };
        case "audio":
            return { "audio/*": [".mp3", ".wav", ".ogg", ".flac"] };
        case "3d":
            return { "model/*": [".glb", ".gltf", ".obj"] };
    }
}

function getAcceptedFormats(mediaType: MediaType): string {
    switch (mediaType) {
        case "image":
            return "PNG, JPG, GIF, WEBP";
        case "video":
            return "MP4, WEBM, MOV";
        case "audio":
            return "MP3, WAV, OGG, FLAC";
        case "3d":
            return "GLB, GLTF, OBJ";
    }
}

export default CreateNFTPage;
