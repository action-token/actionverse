"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MediaType } from "@prisma/client";
import { motion, AnimatePresence } from "framer-motion";
import {
    PlusIcon,
    Upload,
    Check,
    X,
    Loader2,
    Eye,
    EyeOff,
    Music,
    Video,
    ImageIcon,
    CuboidIcon as Cube,
    ArrowRight,
    DollarSign,
    Coins,
    PlusCircle,
    Package,
    MapPin,
    Sparkles,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { clientsign, extractTxHash } from "package/connect_wallet";
import { submitSignedXDRToServer4User } from "package/connect_wallet/src/lib/stellar/trx/payment_fb_g";
import { WalletType } from "package/connect_wallet/src/lib/enums";
import { type ChangeEvent, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription,
} from "~/components/shadcn/ui/dialog";
import useNeedSign from "~/lib/hook";
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances";
import {
    PLATFORM_ASSET,
    PLATFORM_FEE,
    PLATFORM_FEE_IN_XLM,
    SIMPLIFIED_FEE_IN_XLM,
    TrxBaseFeeInPlatformAsset,
    trxBaseFeeInXLM,
} from "~/lib/stellar/constant";
import { AccountSchema, clientSelect } from "~/lib/stellar/fan/utils";
import { api } from "~/utils/api";
import { BADWORDS } from "~/utils/banned-word";

import * as React from "react";

import { Button } from "../shadcn/ui/button";

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "~/components/shadcn/ui/select";

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/shadcn/ui/tooltip";
import { ipfsHashToPinataGatewayUrl } from "~/utils/ipfs";

import { Label } from "../shadcn/ui/label";
import { Input } from "../shadcn/ui/input";
import { Textarea } from "../shadcn/ui/textarea";
import { Card, CardContent } from "../shadcn/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../shadcn/ui/tabs";
import { Badge } from "../shadcn/ui/badge";
import { Separator } from "../shadcn/ui/separator";
import {
    PaymentChoose,
    usePaymentMethodStore,
} from "../common/payment-options";
import { UploadS3Button } from "../common/upload-button";
import { Alert, AlertDescription } from "../shadcn/ui/alert";
import RechargeLink from "../payment/recharge-link";
import { useNFTCreateModalStore } from "../store/nft-create-modal-store";
import { Switch } from "~/components/shadcn/ui/switch";
import { LockedMediaEditor, type LockedMediaDraft } from "~/components/smart-contract/locked-media-editor";
import { UnlockLocationPicker, type UnlockPoint } from "~/components/smart-contract/unlock-location-picker";
import { cn } from "~/lib/utils";

export const ExtraSongInfo = z.object({
    artist: z.string(),
    albumId: z.number(),
});

const FORM_STEPS = ["details", "media", "pricing"];
export const NftFormSchema = z.object({
    name: z.string().refine(
        (value) => {
            return !BADWORDS.some((word) => value.includes(word));
        },
        {
            message: "Input contains banned words.",
        },
    ),
    description: z.string(),
    mediaUrl: z.string({
        message: "Media is required",
        required_error: "Media is required",
    }),
    coverImgUrl: z.string().min(1, { message: "Thumbnail is required" }),
    mediaType: z.nativeEnum(MediaType),
    price: z
        .number({
            required_error: "Price must be entered as a number",
            invalid_type_error: "Price must be entered as a number",
        })
        .nonnegative()
        .default(2),
    priceUSD: z
        .number({
            required_error: "Limit must be entered as a number",
            invalid_type_error: "Limit must be entered as a number",
        })
        .nonnegative()
        .default(1),
    limit: z
        .number({
            required_error: "Limit must be entered as a number",
            invalid_type_error: "Limit must be entered as a number",
        })
        .nonnegative(),
    code: z
        .string()
        .min(4, { message: "Must be a minimum of 4 characters" })
        .max(12, { message: "Must be a maximum of 12 characters" }),
    issuer: AccountSchema.optional(),
    songInfo: ExtraSongInfo.optional(),
    isAdmin: z.boolean().optional(),
    tier: z.string().optional(),
});

export default function NftCreateModal() {
    const { isOpen: isNFTModalOpen, setIsOpen: setNFTModalOpen } =
        useNFTCreateModalStore();
    const [method, setMethod] = useState<
        "choice" | "classic" | "smart-contract" | "non-stellar"
    >("choice");

    function handleClose() {
        setNFTModalOpen(false);
        setMethod("choice");
    }

    return (
        <Dialog open={isNFTModalOpen} onOpenChange={handleClose}>
            <DialogContent
                onInteractOutside={(e) => e.preventDefault()}
                className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-xl p-0"
            >
                {method === "choice" && (
                    <MintMethodChoice onSelect={setMethod} onClose={handleClose} />
                )}
                {method === "classic" && (
                    <ClassicNftForm
                        onBack={() => setMethod("choice")}
                        onClose={handleClose}
                    />
                )}
                {method === "smart-contract" && (
                    <SmartContractNftForm
                        onBack={() => setMethod("choice")}
                        onClose={handleClose}
                    />
                )}
                {method === "non-stellar" && (
                    <NonStellarItemForm
                        onBack={() => setMethod("choice")}
                        onClose={handleClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function MintMethodChoice({
    onSelect,
    onClose,
}: {
    onSelect: (method: "classic" | "smart-contract" | "non-stellar") => void;
    onClose: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
        >
            <DialogHeader className="px-6 py-4">
                <DialogTitle className="text-xl">Mint New Item</DialogTitle>
                <DialogDescription>
                    Choose how you want to create this item.
                </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 px-6 py-6 sm:grid-cols-3">
                <button
                    type="button"
                    onClick={() => onSelect("classic")}
                    className="flex flex-col items-start gap-2 rounded-xl border p-5 text-left transition-colors hover:border-primary hover:bg-muted"
                >
                    <Coins className="h-6 w-6 text-primary" />
                    <span className="font-semibold">Classic NFT</span>
                    <span className="text-sm text-muted-foreground">
                        Mint as a classic Stellar asset, distributed through your
                        storage account — the existing, battle-tested way.
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => onSelect("smart-contract")}
                    className="flex flex-col items-start gap-2 rounded-xl border p-5 text-left transition-colors hover:border-primary hover:bg-muted"
                >
                    <Cube className="h-6 w-6 text-primary" />
                    <span className="font-semibold">Smart Contract NFT</span>
                    <span className="text-sm text-muted-foreground">
                        Mint on the NFT marketplace smart contract — on-chain
                        ownership, royalties, and resale built in.
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => onSelect("non-stellar")}
                    className="flex flex-col items-start gap-2 rounded-xl border p-5 text-left transition-colors hover:border-primary hover:bg-muted"
                >
                    <Package className="h-6 w-6 text-primary" />
                    <span className="font-semibold">Non Stellar Item</span>
                    <span className="text-sm text-muted-foreground">
                        List a regular digital item — nothing is minted on-chain, it{"'"}s
                        just added to your store.
                    </span>
                </button>
            </div>
            <DialogFooter className="border-t px-6 py-4">
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                </Button>
            </DialogFooter>
        </motion.div>
    );
}

function ClassicNftForm({
    onBack,
    onClose,
}: {
    onBack: () => void;
    onClose: () => void;
}) {
    // cost in xlm
    const requiredXlm = 2;
    const feeInXLM = SIMPLIFIED_FEE_IN_XLM; //Number(trxBaseFeeInXLM) + Number(PLATFORM_FEE_IN_XLM);
    const totalXlmCost = requiredXlm + feeInXLM;

    const requiredToken = api.fan.trx.getRequiredPlatformAsset.useQuery({
        xlm: requiredXlm,
    });

    const session = useSession();
    const { platformAssetBalance } = useUserStellarAcc();
    const [isOpen, setIsOpen] = useState(false);
    const [parentIsOpen, setParentIsOpen] = useState(false);
    // pinta upload
    const [file, setFile] = useState<File>();
    const [ipfs, setCid] = useState<string>();
    const [uploading, setUploading] = useState(false);
    const [mediaUpload, setMediaUpload] = useState(false);
    const inputFile = useRef(null);

    // tier options
    const [tier, setTier] = useState<string>();

    // other
    const modalRef = useRef<HTMLDialogElement>(null);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [mediaUploadSuccess, setMediaUploadSuccess] = useState(false);
    const [mediaType, setMediaType] = useState<MediaType>(MediaType.IMAGE);
    const [activeStep, setActiveStep] = useState<string>("details");

    const [mediaUrl, setMediaUrl] = useState<string>();
    const [coverUrl, setCover] = useState<string>();
    const { needSign } = useNeedSign();

    const walletType = session.data?.user.walletType ?? WalletType.none;

    // Wait for the required token data to be loaded
    const requiredTokenAmount = requiredToken.data ?? 0;
    const totalFees = Number(TrxBaseFeeInPlatformAsset) + Number(PLATFORM_FEE);

    const { paymentMethod, setIsOpen: setPaymentModalOpen } =
        usePaymentMethodStore();

    const {
        register,
        handleSubmit,
        setValue,
        getValues,
        reset,
        formState: { errors, isValid },
        control,
        trigger,
    } = useForm<z.infer<typeof NftFormSchema>>({
        resolver: zodResolver(NftFormSchema),
        mode: "onChange",
        defaultValues: {
            mediaType: MediaType.IMAGE,
            price: 2,
            priceUSD: 1,
        },
    });

    const tiers = api.fan.member.getAllMembership.useQuery({});

    const addAsset = api.fan.asset.createAsset.useMutation({
        onSuccess: () => {
            toast.success("NFT Created", {
                position: "top-center",
                duration: 4000,
            });
            setParentIsOpen(false);
            setPaymentModalOpen(false);
            setIsOpen(false);
            setMediaUploadSuccess(false);
            setMediaUrl(undefined);
            setCover(undefined);
            handleClose();
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });

    const xdrMutation = api.fan.trx.createUniAssetTrx.useMutation({
        onSuccess(data, variables, context) {
            const { issuer, xdr } = data;
            setValue("issuer", issuer);

            setSubmitLoading(true);

            toast.promise(
                clientsign({
                    presignedxdr: xdr,
                    pubkey: session.data?.user.id,
                    walletType,
                    test: clientSelect(),
                })
                    .then((res) => {
                        if (res) {
                            setValue("tier", tier);
                            const data = getValues();

                            addAsset.mutate({ ...data });
                        } else {
                            toast.error("Transaction Failed");
                        }
                    })
                    .catch((e) => console.log(e))
                    .finally(() => setSubmitLoading(false)),
                {
                    loading: "Signing Transaction",
                    success: "",
                    error: "Signing Transaction Failed",
                },
            );
        },
    });

    const onSubmit = () => {
        console.log("vlaues", getValues());
        if (ipfs) {
            xdrMutation.mutate({
                code: getValues("code"),
                limit: getValues("limit"),
                signWith: needSign(),
                ipfsHash: ipfs,
                native: paymentMethod === "xlm",
            });
        } else {
            toast.error("Please upload a thumbnail image.");
        }
    };

    function getEndpoint(mediaType: MediaType) {
        switch (mediaType) {
            case MediaType.IMAGE:
                return "imageUploader";
            case MediaType.MUSIC:
                return "musicUploader";
            case MediaType.VIDEO:
                return "videoUploader";
            case MediaType.THREE_D:
                return "modelUploader";
            default:
                return "imageUploader";
        }
    }

    function handleMediaChange(media: MediaType) {
        setMediaType(media);
        setValue("mediaType", media);
        setMediaUrl(undefined);
    }

    const uploadFile = async (fileToUpload: File) => {
        try {
            setUploading(true);
            const formData = new FormData();
            formData.append("file", fileToUpload, fileToUpload.name);
            const res = await fetch("/api/file", {
                method: "POST",
                body: formData,
            });
            const ipfsHash = await res.text();
            const thumbnail = ipfsHashToPinataGatewayUrl(ipfsHash);
            setCover(thumbnail);
            setValue("coverImgUrl", thumbnail);
            setCid(ipfsHash);
            toast.success("Thumbnail uploaded successfully");
            await trigger();

            setUploading(false);
        } catch (e) {
            setUploading(false);
            toast.error("Failed to upload file");
        }
    };

    const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;

        if (files) {
            if (files.length > 0) {
                const file = files[0];
                if (file) {
                    if (file.size > 2 * 1024 * 1024) {
                        toast.error("File size should be less than 2MB");
                        return;
                    }
                    setFile(file);
                    await uploadFile(file);
                }
            }
        }
    };

    const loading =
        xdrMutation.isLoading ??
        addAsset.isLoading ??
        submitLoading ??
        requiredToken.isLoading;

    const getMediaIcon = (type: MediaType) => {
        switch (type) {
            case MediaType.IMAGE:
                return <ImageIcon className="h-4 w-4" />;
            case MediaType.MUSIC:
                return <Music className="h-4 w-4" />;
            case MediaType.VIDEO:
                return <Video className="h-4 w-4" />;
            case MediaType.THREE_D:
                return <Cube className="h-4 w-4" />;
            default:
                return <ImageIcon className="h-4 w-4" />;
        }
    };

    const nextStep = () => {
        const currentIndex = FORM_STEPS.indexOf(activeStep);
        if (currentIndex < FORM_STEPS.length - 1) {
            const nextStep = FORM_STEPS[currentIndex + 1];
            if (nextStep) {
                setActiveStep(nextStep);
            }
        }
    };

    const prevStep = () => {
        const currentIndex = FORM_STEPS.indexOf(activeStep);
        if (currentIndex <= 0) {
            onBack();
            return;
        }
        const previousStep = FORM_STEPS[currentIndex - 1];
        if (previousStep) {
            setActiveStep(previousStep);
        }
    };

    const handleClose = () => {
        setActiveStep("details");
        setMediaUploadSuccess(false);
        setMediaUrl(undefined);
        setCover(undefined);
        reset();
        onClose();
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="flex h-full flex-col"
        >
            <DialogHeader className=" px-6 py-4">
                <DialogTitle className="flex items-center gap-2 text-xl">
                            Create Store Item
                        </DialogTitle>
                        <div className="flex items-center justify-between gap-2">
                            <DialogDescription>
                                Create you nft and place it to marketplace.
                            </DialogDescription>
                            <div className="flex items-center gap-1.5">
                                {FORM_STEPS.map((step) => (
                                    <span
                                        key={step}
                                        className={cn(
                                            "h-2 rounded-full transition-all",
                                            activeStep === step
                                                ? "w-6 border border-foreground/30 bg-primary shadow-sm"
                                                : "w-2 bg-muted-foreground/40",
                                        )}
                                    />
                                ))}
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="overflow-y-auto px-6 py-4">
                        <form
                            id="nft-form"
                            onSubmit={handleSubmit(onSubmit)}
                            className="space-y-4"
                        >

                            {activeStep === "details" && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <Card>
                                        <CardContent className="space-y-4 pt-6">
                                            <div className="space-y-2">
                                                <Label htmlFor="name">Item name</Label>
                                                <Input
                                                    id="name"
                                                    {...register("name")}
                                                    placeholder="Enter a name for your item"
                                                />
                                                {errors.name && (
                                                    <p className="text-sm text-destructive">
                                                        {errors.name.message}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="description">Description</Label>
                                                <Textarea
                                                    id="description"
                                                    {...register("description")}
                                                    placeholder="Describe your NFT"
                                                    className="min-h-24 resize-none"
                                                />
                                                {errors.description && (
                                                    <p className="text-sm text-destructive">
                                                        {errors.description.message}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="code">Asset Code</Label>
                                                <Input
                                                    id="code"
                                                    {...register("code")}
                                                    placeholder="Enter asset code (4-12 characters)"
                                                />
                                                {errors.code && (
                                                    <p className="text-sm text-destructive">
                                                        {errors.code.message}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="limit">Supply Limit</Label>
                                                <Input
                                                    id="limit"
                                                    type="number"
                                                    {...register("limit", { valueAsNumber: true })}
                                                    placeholder="Enter supply limit (default: 1)"
                                                />
                                                {errors.limit && (
                                                    <p className="text-sm text-destructive">
                                                        {errors.limit.message}
                                                    </p>
                                                )}
                                                <p className="text-xs text-muted-foreground">
                                                    This determines how many copies of this Item can exist
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )}
                            {activeStep === "media" && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <Card>
                                        <CardContent className="pt-6">
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <Label className="mb-2 block text-sm font-medium">
                                                            Media Type
                                                        </Label>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {Object.values(MediaType).map((media, i) => {
                                                                const isSelected = media === mediaType;
                                                                return (
                                                                    <Button
                                                                        key={i}
                                                                        type="button"
                                                                        size="sm"
                                                                        variant={isSelected ? "destructive" : "muted"}
                                                                        onClick={() => handleMediaChange(media)}
                                                                        className={cn(
                                                                            "gap-1.5 text-xs",
                                                                            isSelected
                                                                                ? "px-3 shadow-sm shadow-foreground"
                                                                                : "w-9 px-0 justify-center",
                                                                        )}
                                                                    >
                                                                        {getMediaIcon(media)}
                                                                        {isSelected && (
                                                                            <span>
                                                                                {media === MediaType.THREE_D ? "3D" : media}
                                                                            </span>
                                                                        )}
                                                                    </Button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {tiers.data && (
                                                        <div>
                                                            <Label className="mb-2 block text-sm font-medium">
                                                                Access Tier
                                                            </Label>
                                                            <TiersOptions
                                                                value={tier}
                                                                handleTierChange={(value: string) => {
                                                                    setTier(value);
                                                                }}
                                                                tiers={tiers.data}
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-sm font-medium flex items-center gap-2">
                                                        Thumbnail Image
                                                        <span className="text-xs text-muted-foreground">
                                                            (This will be your NFT image and item Thumbnail)
                                                        </span>
                                                    </Label>
                                                    <AnimatePresence>
                                                        {!coverUrl ? (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                onClick={() =>
                                                                    document.getElementById("coverImg")?.click()
                                                                }
                                                                className="relative flex h-36 w-full  flex-col items-center justify-center gap-2 border-dashed"
                                                            >
                                                                <Upload className="h-6 w-6 text-muted-foreground" />
                                                                <span className="text-sm text-muted-foreground">
                                                                    Upload Thumbnail
                                                                </span>
                                                                {uploading && (
                                                                    <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                                                                        <Loader2 className="h-6 w-6 animate-spin " />
                                                                    </div>
                                                                )}
                                                            </Button>
                                                        ) : (
                                                            <motion.div
                                                                initial={{ opacity: 0, scale: 0.9 }}
                                                                animate={{ opacity: 1, scale: 1 }}
                                                                exit={{ opacity: 0, scale: 0.9 }}
                                                                className="relative h-36 overflow-hidden rounded-md"
                                                            >
                                                                <Image
                                                                    fill
                                                                    alt="preview image"
                                                                    src={coverUrl ?? "/placeholder.svg"}
                                                                    className="object-cover"
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="destructive"
                                                                    size="icon"
                                                                    className="absolute right-1 top-1 h-6 w-6"
                                                                    onClick={() => {
                                                                        setCover(undefined);
                                                                        setValue("coverImgUrl", "");
                                                                        setCid(undefined);
                                                                    }}
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </Button>
                                                                <div className="absolute bottom-0 left-0 right-0 bg-background/80 px-2 py-1">
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="bg-green-100 text-green-800"
                                                                    >
                                                                        <Check className="mr-1 h-3 w-3" /> Uploaded
                                                                    </Badge>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                    <Input
                                                        id="coverImg"
                                                        type="file"
                                                        accept=".jpg, .png"
                                                        onChange={handleChange}
                                                        className="hidden"
                                                    />

                                                    {errors.coverImgUrl && (
                                                        <p className="text-sm text-destructive">
                                                            {errors.coverImgUrl.message}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-sm font-medium">
                                                        Locked Content
                                                    </Label>
                                                    <div className="flex flex-col gap-2">
                                                        <UploadS3Button
                                                            endpoint={getEndpoint(mediaType)}
                                                            variant="button"
                                                            label={`UPLOAD ${mediaType !== "THREE_D" ? mediaType : "3D"} CONTENT`}
                                                            className="w-full"
                                                            onClientUploadComplete={(res) => {
                                                                const data = res;
                                                                if (data?.url) {
                                                                    setMediaUrl(data.url);
                                                                    setValue("mediaUrl", data.url);
                                                                    setMediaUpload(false);
                                                                    setMediaUploadSuccess(true);
                                                                    trigger("mediaUrl")
                                                                }
                                                            }}
                                                            onUploadError={(error: Error) => {
                                                                toast.error(`ERROR! ${error.message}`);
                                                            }}
                                                        />

                                                        {mediaType === "THREE_D" && (
                                                            <Alert variant="info">
                                                                <AlertDescription>
                                                                    <p className="text-center text-xs text-muted-foreground">
                                                                        Only .obj files are accepted
                                                                    </p>
                                                                </AlertDescription>
                                                            </Alert>
                                                        )}

                                                        <AnimatePresence>
                                                            {mediaUrl && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, y: 10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    exit={{ opacity: 0, y: 10 }}
                                                                    transition={{ duration: 0.3 }}
                                                                    className="mt-2"
                                                                >
                                                                    <Card className="overflow-hidden">
                                                                        <CardContent className="p-3">
                                                                            <PlayableMedia
                                                                                mediaType={mediaType}
                                                                                mediaUrl={mediaUrl}
                                                                            />
                                                                        </CardContent>
                                                                    </Card>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>

                                                        {errors.mediaUrl && (
                                                            <p className="text-sm text-destructive">
                                                                {errors.mediaUrl.message}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )}

                            {activeStep === "pricing" && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <Card>
                                        <CardContent className="space-y-4 pt-6">
                                            <div className="space-y-2">
                                                <Label
                                                    htmlFor="priceUSD"
                                                    className="flex items-center gap-2"
                                                >
                                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                    Price in USD
                                                </Label>
                                                <Input
                                                    id="priceUSD"
                                                    type="number"
                                                    {...register("priceUSD", { valueAsNumber: true })}
                                                    placeholder="Enter price in USD"
                                                />
                                                {errors.priceUSD && (
                                                    <p className="text-sm text-destructive">
                                                        {errors.priceUSD.message}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label
                                                    htmlFor="price"
                                                    className="flex items-center gap-2"
                                                >
                                                    <Coins className="h-4 w-4 text-muted-foreground" />
                                                    Price in {PLATFORM_ASSET.code}
                                                </Label>
                                                <Input
                                                    id="price"
                                                    type="number"
                                                    {...register("price", { valueAsNumber: true })}
                                                    placeholder={`Enter price in ${PLATFORM_ASSET.code}`}
                                                />
                                                {errors.price && (
                                                    <p className="text-sm text-destructive">
                                                        {errors.price.message}
                                                    </p>
                                                )}
                                            </div>

                                            <Separator className="my-4" />

                                            <Alert
                                                variant={
                                                    requiredTokenAmount > platformAssetBalance
                                                        ? "destructive"
                                                        : "default"
                                                }
                                            >
                                                <AlertDescription>
                                                    {`You'll need ${requiredTokenAmount} ${PLATFORM_ASSET.code} in your wallet to create an NFT`}
                                                </AlertDescription>
                                            </Alert>

                                            {requiredTokenAmount > platformAssetBalance && (
                                                <div className="mt-2">
                                                    <RechargeLink />
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )}
                        </form>
                    </div>

                    <DialogFooter className="border-t px-6 py-4 ">
                        <div className="flex w-full items-center justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={prevStep}
                                className="flex items-center gap-1"
                            >
                                Previous
                            </Button>

                            {activeStep !== "pricing" ? (
                                <Button
                                    type="button"
                                    onClick={nextStep}
                                    className="flex items-center gap-1 shadow-sm shadow-foreground"
                                >
                                    Next
                                    <ArrowRight className="ml-1 h-4 w-4" />
                                </Button>
                            ) : (
                                <PaymentChoose
                                    costBreakdown={[
                                        {
                                            label: "Stellar Fee",
                                            amount:
                                                paymentMethod === "asset"
                                                    ? requiredTokenAmount - totalFees
                                                    : requiredXlm,
                                            type: "cost",
                                            highlighted: true,
                                        },
                                        {
                                            label: "Platform Fee",
                                            amount: paymentMethod === "asset" ? totalFees : feeInXLM,
                                            highlighted: false,
                                            type: "fee",
                                        },
                                        {
                                            label: "Total Cost",
                                            amount:
                                                paymentMethod === "asset"
                                                    ? requiredTokenAmount
                                                    : totalXlmCost,
                                            highlighted: false,
                                            type: "total",
                                        },
                                    ]}
                                    XLM_EQUIVALENT={totalXlmCost}
                                    handleConfirm={handleSubmit(onSubmit)}
                                    loading={loading}
                                    requiredToken={requiredTokenAmount}
                                    trigger={
                                        <Button
                                            variant="default"
                                            disabled={
                                                loading ||
                                                requiredTokenAmount > platformAssetBalance ||
                                                !isValid
                                            }
                                            className="flex items-center gap-1 shadow-sm shadow-foreground"
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Creating NFT...
                                                </>
                                            ) : (
                                                "Create NFT"
                                            )}
                                        </Button>
                                    }
                                />
                            )}
                        </div>
                    </DialogFooter>
        </motion.div>
    );
}

const NON_STELLAR_FORM_STEPS = ["details", "media", "pricing"];
export const NonStellarItemFormSchema = z.object({
    name: z.string().refine(
        (value) => {
            return !BADWORDS.some((word) => value.includes(word));
        },
        {
            message: "Input contains banned words.",
        },
    ),
    description: z.string(),
    mediaUrl: z.string().optional(),
    coverImgUrl: z.string().min(1, { message: "Thumbnail is required" }),
    mediaType: z.nativeEnum(MediaType),
    price: z
        .number({
            required_error: "Price must be entered as a number",
            invalid_type_error: "Price must be entered as a number",
        })
        .nonnegative()
        .default(2),
    priceUSD: z
        .number({
            required_error: "Limit must be entered as a number",
            invalid_type_error: "Limit must be entered as a number",
        })
        .nonnegative()
        .default(1),
    limit: z
        .number({
            required_error: "Limit must be entered as a number",
            invalid_type_error: "Limit must be entered as a number",
        })
        .nonnegative(),
    tier: z.string().optional(),
});

function NonStellarItemForm({
    onBack,
    onClose,
}: {
    onBack: () => void;
    onClose: () => void;
}) {
    const [file, setFile] = useState<File>();
    const [uploading, setUploading] = useState(false);
    const [mediaUpload, setMediaUpload] = useState(false);

    const [tier, setTier] = useState<string>();

    const [submitLoading, setSubmitLoading] = useState(false);
    const [mediaUploadSuccess, setMediaUploadSuccess] = useState(false);
    const [mediaType, setMediaType] = useState<MediaType>(MediaType.IMAGE);
    const [activeStep, setActiveStep] = useState<string>("details");
    const [mediaUrl, setMediaUrl] = useState<string>();
    const [coverUrl, setCover] = useState<string>();

    const {
        register,
        handleSubmit,
        setValue,
        getValues,
        reset,
        formState: { errors, isValid },
        trigger,
    } = useForm<z.infer<typeof NonStellarItemFormSchema>>({
        resolver: zodResolver(NonStellarItemFormSchema),
        mode: "onChange",
        defaultValues: {
            limit: 1,
            mediaType: MediaType.IMAGE,
            price: 2,
            priceUSD: 1,
        },
    });

    const tiers = api.fan.member.getAllMembership.useQuery({});

    const addNonStellarAsset = api.fan.asset.createNonStellarAsset.useMutation({
        onSuccess: () => {
            toast.success("Item Created", {
                position: "top-center",
                duration: 4000,
            });
            handleClose();
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });

    const onSubmit = () => {
        setValue("tier", tier);
        const data = getValues();
        setSubmitLoading(true);
        addNonStellarAsset.mutate(data, {
            onSettled: () => setSubmitLoading(false),
        });
    };

    function getEndpoint(type: MediaType) {
        switch (type) {
            case MediaType.IMAGE:
                return "imageUploader";
            case MediaType.MUSIC:
                return "musicUploader";
            case MediaType.VIDEO:
                return "videoUploader";
            case MediaType.THREE_D:
                return "modelUploader";
            default:
                return "imageUploader";
        }
    }

    function handleMediaChange(media: MediaType) {
        setMediaType(media);
        setValue("mediaType", media);
        setMediaUrl(undefined);
    }

    const uploadFile = async (fileToUpload: File) => {
        try {
            setUploading(true);
            const formData = new FormData();
            formData.append("file", fileToUpload, fileToUpload.name);
            const res = await fetch("/api/file", {
                method: "POST",
                body: formData,
            });
            const ipfsHash = await res.text();
            const thumbnail = ipfsHashToPinataGatewayUrl(ipfsHash);
            setCover(thumbnail);
            setValue("coverImgUrl", thumbnail);
            toast.success("Thumbnail uploaded successfully");
            await trigger();

            setUploading(false);
        } catch (e) {
            setUploading(false);
            toast.error("Failed to upload file");
        }
    };

    const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;

        if (files) {
            if (files.length > 0) {
                const file = files[0];
                if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                        toast.error("File size should be less than 10MB");
                        return;
                    }
                    setFile(file);
                    await uploadFile(file);
                }
            }
        }
    };

    const loading = addNonStellarAsset.isLoading || submitLoading;

    const getMediaIcon = (type: MediaType) => {
        switch (type) {
            case MediaType.IMAGE:
                return <ImageIcon className="h-4 w-4" />;
            case MediaType.MUSIC:
                return <Music className="h-4 w-4" />;
            case MediaType.VIDEO:
                return <Video className="h-4 w-4" />;
            case MediaType.THREE_D:
                return <Cube className="h-4 w-4" />;
            default:
                return <ImageIcon className="h-4 w-4" />;
        }
    };

    const nextStep = () => {
        const currentIndex = NON_STELLAR_FORM_STEPS.indexOf(activeStep);
        if (currentIndex < NON_STELLAR_FORM_STEPS.length - 1) {
            const next = NON_STELLAR_FORM_STEPS[currentIndex + 1];
            if (next) {
                setActiveStep(next);
            }
        }
    };

    const prevStep = () => {
        const currentIndex = NON_STELLAR_FORM_STEPS.indexOf(activeStep);
        if (currentIndex <= 0) {
            onBack();
            return;
        }
        const previous = NON_STELLAR_FORM_STEPS[currentIndex - 1];
        if (previous) {
            setActiveStep(previous);
        }
    };

    const handleClose = () => {
        setActiveStep("details");
        setMediaUploadSuccess(false);
        setMediaUrl(undefined);
        setCover(undefined);
        reset();
        onClose();
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="flex h-full flex-col"
        >
            <DialogHeader className=" px-6 py-4">
                <DialogTitle className="flex items-center gap-2 text-xl">
                    Create Store Item
                </DialogTitle>
                <div className="flex items-center justify-between gap-2">
                    <DialogDescription>
                        List a non-Stellar item — nothing is minted on-chain.
                    </DialogDescription>
                    <div className="flex items-center gap-1.5">
                        {NON_STELLAR_FORM_STEPS.map((step) => (
                            <span
                                key={step}
                                className={cn(
                                    "h-2 rounded-full transition-all",
                                    activeStep === step
                                        ? "w-6 border border-foreground/30 bg-primary shadow-sm"
                                        : "w-2 bg-muted-foreground/40",
                                )}
                            />
                        ))}
                    </div>
                </div>
            </DialogHeader>
            <div className="overflow-y-auto px-6 py-4">
                <form
                    id="non-stellar-form"
                    onSubmit={handleSubmit(onSubmit)}
                    className="space-y-4"
                >
                    {activeStep === "details" && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card>
                                <CardContent className="space-y-4 pt-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="ns-name">Item name</Label>
                                        <Input
                                            id="ns-name"
                                            {...register("name")}
                                            placeholder="Enter a name for your item"
                                        />
                                        {errors.name && (
                                            <p className="text-sm text-destructive">
                                                {errors.name.message}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="ns-description">Description</Label>
                                        <Textarea
                                            id="ns-description"
                                            {...register("description")}
                                            placeholder="Describe your item"
                                            className="min-h-24 resize-none"
                                        />
                                        {errors.description && (
                                            <p className="text-sm text-destructive">
                                                {errors.description.message}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="ns-limit">Supply Limit</Label>
                                        <Input
                                            id="ns-limit"
                                            type="number"
                                            {...register("limit", { valueAsNumber: true })}
                                            placeholder="Enter supply limit (default: 1)"
                                        />
                                        {errors.limit && (
                                            <p className="text-sm text-destructive">
                                                {errors.limit.message}
                                            </p>
                                        )}
                                        <p className="text-xs text-muted-foreground">
                                            This determines how many copies of this item can exist
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                    {activeStep === "media" && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label className="mb-2 block text-sm font-medium">
                                                    Media Type
                                                </Label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {Object.values(MediaType).map((media, i) => {
                                                        const isSelected = media === mediaType;
                                                        return (
                                                            <Button
                                                                key={i}
                                                                type="button"
                                                                size="sm"
                                                                variant={isSelected ? "destructive" : "muted"}
                                                                onClick={() => handleMediaChange(media)}
                                                                className={cn(
                                                                    "gap-1.5 text-xs",
                                                                    isSelected
                                                                        ? "px-3 shadow-sm shadow-foreground"
                                                                        : "w-9 px-0 justify-center",
                                                                )}
                                                            >
                                                                {getMediaIcon(media)}
                                                                {isSelected && (
                                                                    <span>
                                                                        {media === MediaType.THREE_D ? "3D" : media}
                                                                    </span>
                                                                )}
                                                            </Button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {tiers.data && (
                                                <div>
                                                    <Label className="mb-2 block text-sm font-medium">
                                                        Access Tier
                                                    </Label>
                                                    <TiersOptions
                                                        value={tier}
                                                        handleTierChange={(value: string) => {
                                                            setTier(value);
                                                        }}
                                                        tiers={tiers.data}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium flex items-center gap-2">
                                                Thumbnail Image
                                                <span className="text-xs text-muted-foreground">
                                                    (This will be your item{"'"}s Thumbnail)
                                                </span>
                                            </Label>
                                            <AnimatePresence>
                                                {!coverUrl ? (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() =>
                                                            document.getElementById("ns-coverImg")?.click()
                                                        }
                                                        className="relative flex h-36 w-full  flex-col items-center justify-center gap-2 border-dashed"
                                                    >
                                                        <Upload className="h-6 w-6 text-muted-foreground" />
                                                        <span className="text-sm text-muted-foreground">
                                                            Upload Thumbnail
                                                        </span>
                                                        {uploading && (
                                                            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                                                                <Loader2 className="h-6 w-6 animate-spin " />
                                                            </div>
                                                        )}
                                                    </Button>
                                                ) : (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0.9 }}
                                                        className="relative h-36 overflow-hidden rounded-md"
                                                    >
                                                        <Image
                                                            fill
                                                            alt="preview image"
                                                            src={coverUrl ?? "/placeholder.svg"}
                                                            className="object-cover"
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="icon"
                                                            className="absolute right-1 top-1 h-6 w-6"
                                                            onClick={() => {
                                                                setCover(undefined);
                                                                setValue("coverImgUrl", "");
                                                            }}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                        <div className="absolute bottom-0 left-0 right-0 bg-background/80 px-2 py-1">
                                                            <Badge
                                                                variant="outline"
                                                                className="bg-green-100 text-green-800"
                                                            >
                                                                <Check className="mr-1 h-3 w-3" /> Uploaded
                                                            </Badge>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                            <Input
                                                id="ns-coverImg"
                                                type="file"
                                                accept=".jpg, .png"
                                                onChange={handleChange}
                                                className="hidden"
                                            />

                                            {errors.coverImgUrl && (
                                                <p className="text-sm text-destructive">
                                                    {errors.coverImgUrl.message}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium">
                                                Locked Content
                                            </Label>
                                            <div className="flex flex-col gap-2">
                                                <UploadS3Button
                                                    endpoint={getEndpoint(mediaType)}
                                                    variant="button"
                                                    label={`UPLOAD ${mediaType !== "THREE_D" ? mediaType : "3D"} CONTENT`}
                                                    className="w-full"
                                                    onClientUploadComplete={(res) => {
                                                        const data = res;
                                                        if (data?.url) {
                                                            setMediaUrl(data.url);
                                                            setValue("mediaUrl", data.url);
                                                            setMediaUpload(false);
                                                            setMediaUploadSuccess(true);
                                                            trigger("mediaUrl");
                                                        }
                                                    }}
                                                    onUploadError={(error: Error) => {
                                                        toast.error(`ERROR! ${error.message}`);
                                                    }}
                                                />

                                                {mediaType === "THREE_D" && (
                                                    <Alert variant="info">
                                                        <AlertDescription>
                                                            <p className="text-center text-xs text-muted-foreground">
                                                                Only .obj files are accepted
                                                            </p>
                                                        </AlertDescription>
                                                    </Alert>
                                                )}

                                                <AnimatePresence>
                                                    {mediaUrl && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: 10 }}
                                                            transition={{ duration: 0.3 }}
                                                            className="mt-2"
                                                        >
                                                            <Card className="overflow-hidden">
                                                                <CardContent className="p-3">
                                                                    <PlayableMedia
                                                                        mediaType={mediaType}
                                                                        mediaUrl={mediaUrl}
                                                                    />
                                                                </CardContent>
                                                            </Card>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                {errors.mediaUrl && (
                                                    <p className="text-sm text-destructive">
                                                        {errors.mediaUrl.message}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {activeStep === "pricing" && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card>
                                <CardContent className="space-y-4 pt-6">
                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="ns-priceUSD"
                                            className="flex items-center gap-2"
                                        >
                                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                                            Price in USD
                                        </Label>
                                        <Input
                                            id="ns-priceUSD"
                                            type="number"
                                            {...register("priceUSD", { valueAsNumber: true })}
                                            placeholder="Enter price in USD"
                                        />
                                        {errors.priceUSD && (
                                            <p className="text-sm text-destructive">
                                                {errors.priceUSD.message}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="ns-price" className="flex items-center gap-2">
                                            <Coins className="h-4 w-4 text-muted-foreground" />
                                            Price in {PLATFORM_ASSET.code}
                                        </Label>
                                        <Input
                                            id="ns-price"
                                            type="number"
                                            {...register("price", { valueAsNumber: true })}
                                            placeholder={`Enter price in ${PLATFORM_ASSET.code}`}
                                        />
                                        {errors.price && (
                                            <p className="text-sm text-destructive">
                                                {errors.price.message}
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </form>
            </div>

            <DialogFooter className="border-t px-6 py-4 ">
                <div className="flex w-full items-center justify-between">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={prevStep}
                        className="flex items-center gap-1"
                    >
                        Previous
                    </Button>

                    {activeStep !== "pricing" ? (
                        <Button
                            type="button"
                            onClick={nextStep}
                            disabled={
                                activeStep === "media" && !!errors.coverImgUrl
                            }
                            className="flex items-center gap-1 shadow-sm shadow-foreground"
                        >
                            Next
                            <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="default"
                            disabled={loading || !isValid}
                            onClick={handleSubmit(onSubmit)}
                            className="flex items-center gap-1 shadow-sm shadow-foreground"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating Item...
                                </>
                            ) : (
                                "Create Item"
                            )}
                        </Button>
                    )}
                </div>
            </DialogFooter>
        </motion.div>
    );
}

function isValidHttpUrl(value: string) {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

const SC_FORM_STEPS = ["details", "pricing", "locked", "unlock"];

function SmartContractNftForm({
    onBack,
    onClose,
}: {
    onBack: () => void;
    onClose: () => void;
}) {
    const utils = api.useContext();

    const [activeStep, setActiveStep] = useState<string>("details");
    const [submitLoading, setSubmitLoading] = useState(false);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [royaltyPercent, setRoyaltyPercent] = useState(0);
    const [supply, setSupply] = useState(1);
    // Empty string means "not offered in this currency" — at least one of
    // the two must end up positive. Kept as separate fields (rather than a
    // generic array) to match the fixed two-column grid asked for; a third
    // column (USDC, etc.) is one more field plus one more entry in
    // `handleCreate`'s `prices` array, not a redesign.
    const [priceXlm, setPriceXlm] = useState("1");
    const [priceAsset, setPriceAsset] = useState("");

    // The thumbnail *is* the item's own visible content here — there's no
    // separate "media" upload step. `contentMimeType` is the thumbnail
    // file's own mime type, captured at upload time, since `nft.create`
    // still needs some `mediaType` even though this form never asks the
    // creator to pick one.
    const [thumbnailUrl, setThumbnailUrl] = useState<string>();
    const [contentMimeType, setContentMimeType] = useState<string>();
    const [thumbnailUploading, setThumbnailUploading] = useState(false);

    // Optional "VIP ticket" gating — see VIP_TICKET_UNLOCK_PLAN.md. Neither
    // step below is required; leaving lockedMedia empty and unlockEnabled
    // false produces an ordinary, ungated listing exactly as before.
    const [lockedMedia, setLockedMedia] = useState<LockedMediaDraft[]>([]);
    const [unlockEnabled, setUnlockEnabled] = useState(false);
    const [unlockPoints, setUnlockPoints] = useState<UnlockPoint[]>([]);

    const createNft = api.nft.create.useMutation();

    async function uploadThumbnail(file: File) {
        try {
            setThumbnailUploading(true);
            const formData = new FormData();
            formData.append("file", file, file.name);
            const res = await fetch("/api/file", { method: "POST", body: formData });
            const ipfsHash = await res.text();
            setThumbnailUrl(ipfsHashToPinataGatewayUrl(ipfsHash));
            setContentMimeType(file.type);
            toast.success("Thumbnail uploaded successfully");
        } catch {
            toast.error("Failed to upload file");
        } finally {
            setThumbnailUploading(false);
        }
    }

    function handleThumbnailChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            toast.error("File size should be less than 2MB");
            return;
        }
        void uploadThumbnail(file);
    }

    function nextStep() {
        const i = SC_FORM_STEPS.indexOf(activeStep);
        const next = SC_FORM_STEPS[i + 1];
        if (next) {
            setActiveStep(next);
        }
    }

    function prevStep() {
        const i = SC_FORM_STEPS.indexOf(activeStep);
        if (i <= 0) {
            onBack();
            return;
        }
        const prev = SC_FORM_STEPS[i - 1];
        if (prev) {
            setActiveStep(prev);
        }
    }

    const parsedPriceXlm = Number(priceXlm) || 0;
    const parsedPriceAsset = Number(priceAsset) || 0;

    const completeLockedMedia = lockedMedia.filter(
        (m): m is LockedMediaDraft & { url: string } => !!m.url && isValidHttpUrl(m.url),
    );

    const canSubmit =
        name.trim().length > 0 &&
        !!thumbnailUrl &&
        !!contentMimeType &&
        supply >= 1 &&
        (parsedPriceXlm > 0 || parsedPriceAsset > 0) &&
        completeLockedMedia.length > 0 &&
        (!unlockEnabled || unlockPoints.length > 0);

    /**
     * A plain database write — no XDR, no signature, nothing for the creator
     * to sign or pay for. Nothing mints here: the row becomes a live,
     * buyable marketplace entry immediately, and `buy_edition` registers it
     * on-chain (from this same data) the moment someone actually buys a
     * copy. See the module doc on `contracts/nft_oz`'s `buy_edition`.
     */
    async function handleCreate() {
        if (!thumbnailUrl || !contentMimeType) return;
        setSubmitLoading(true);
        try {
            const prices: { paymentToken: "xlm" | "asset"; price: number }[] = [];
            if (parsedPriceXlm > 0) prices.push({ paymentToken: "xlm", price: parsedPriceXlm });
            if (parsedPriceAsset > 0) prices.push({ paymentToken: "asset", price: parsedPriceAsset });

            await createNft.mutateAsync({
                name: name.trim(),
                description: description.trim(),
                thumbnail: thumbnailUrl,
                // No separate "content" upload in this form — the thumbnail
                // is the item's own visible content.
                contentUrl: thumbnailUrl,
                mediaType: contentMimeType,
                royaltyBps: Math.round(royaltyPercent * 100),
                supply,
                prices,
                lockedMedia: completeLockedMedia.map((m) => ({
                    url: m.url,
                    type: m.type,
                    label: m.label.trim() || undefined,
                })),
                ...(unlockEnabled && unlockPoints.length > 0
                    ? {
                          unlockLocationPoints: unlockPoints.map((p) => ({
                              lat: p.lat,
                              lng: p.lng,
                              label: p.label,
                          })),
                      }
                    : {}),
            });

            toast.success("Listing created!");
            onClose();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to create listing");
        } finally {
            await Promise.all([utils.nft.list.invalidate(), utils.nft.myCreated.invalidate()]);
            setSubmitLoading(false);
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="flex h-full flex-col"
        >
            <DialogHeader className="px-6 py-4">
                <DialogTitle className="flex items-center gap-2 text-xl">
                    Create Smart Contract NFT
                </DialogTitle>
                <div className="flex items-center justify-between gap-2">
                    <DialogDescription>
                        On-chain ownership, royalties, and resale built in — you sign
                        nothing and pay nothing to create this. Copies mint straight to
                        each buyer when they buy.
                    </DialogDescription>
                    <div className="flex items-center gap-1.5">
                        {SC_FORM_STEPS.map((step) => (
                            <span
                                key={step}
                                className={cn(
                                    "h-2 rounded-full transition-all",
                                    activeStep === step
                                        ? "w-6 border border-foreground/30 bg-primary shadow-sm"
                                        : "w-2 bg-muted-foreground/40",
                                )}
                            />
                        ))}
                    </div>
                </div>
            </DialogHeader>

            <div className="overflow-y-auto px-6 py-4">
                {activeStep === "details" && (
                    <Card>
                        <CardContent className="space-y-4 pt-6">
                            <div className="space-y-2">
                                <Label htmlFor="sc-name">Item name</Label>
                                <Input
                                    id="sc-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter a name for your item"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sc-description">Description</Label>
                                <Textarea
                                    id="sc-description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Describe your NFT"
                                    className="min-h-24 resize-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Thumbnail Image</Label>
                                <AnimatePresence>
                                    {!thumbnailUrl ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => document.getElementById("sc-coverImg")?.click()}
                                            className="relative flex h-36 w-full flex-col items-center justify-center gap-2 border-dashed"
                                        >
                                            <Upload className="h-6 w-6 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground">
                                                Upload Thumbnail
                                            </span>
                                            {thumbnailUploading && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                                                    <Loader2 className="h-6 w-6 animate-spin" />
                                                </div>
                                            )}
                                        </Button>
                                    ) : (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            className="relative h-36 overflow-hidden rounded-md"
                                        >
                                            <Image
                                                fill
                                                alt="preview image"
                                                src={thumbnailUrl}
                                                className="object-cover"
                                            />
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="icon"
                                                className="absolute right-1 top-1 h-6 w-6"
                                                onClick={() => setThumbnailUrl(undefined)}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                            <div className="absolute bottom-0 left-0 right-0 bg-background/80 px-2 py-1">
                                                <Badge variant="outline" className="bg-green-100 text-green-800">
                                                    <Check className="mr-1 h-3 w-3" /> Uploaded
                                                </Badge>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                <Input
                                    id="sc-coverImg"
                                    type="file"
                                    accept=".jpg, .png"
                                    onChange={handleThumbnailChange}
                                    className="hidden"
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {activeStep === "pricing" && (
                    <Card>
                        <CardContent className="space-y-4 pt-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="sc-royalty">Creator royalty (%)</Label>
                                    <Input
                                        id="sc-royalty"
                                        type="number"
                                        min={0}
                                        max={50}
                                        step="0.1"
                                        value={royaltyPercent}
                                        onChange={(e) => setRoyaltyPercent(Number(e.target.value) || 0)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Earned on every resale
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="sc-supply">Supply limit</Label>
                                    <Input
                                        id="sc-supply"
                                        type="number"
                                        min={1}
                                        step="1"
                                        value={supply}
                                        onChange={(e) => setSupply(Math.max(1, Math.round(Number(e.target.value) || 1)))}
                                        placeholder="Default: 1"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Copies ever mintable
                                    </p>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <p className="text-sm font-medium">Price per copy</p>
                                <p className="text-xs text-muted-foreground">
                                    Buyers pick whichever currency they want to pay with —
                                    leave a field empty to not offer that currency. More
                                    currencies (like USDC) can be added later without changing
                                    anything about this item.
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="sc-price-xlm" className="flex items-center gap-2">
                                            <Coins className="h-4 w-4 text-muted-foreground" />
                                            Price (XLM)
                                        </Label>
                                        <Input
                                            id="sc-price-xlm"
                                            type="number"
                                            min={0}
                                            step="any"
                                            value={priceXlm}
                                            onChange={(e) => setPriceXlm(e.target.value)}
                                            placeholder="e.g. 5"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="sc-price-asset" className="flex items-center gap-2">
                                            <Coins className="h-4 w-4 text-muted-foreground" />
                                            Price ({PLATFORM_ASSET.code})
                                        </Label>
                                        <Input
                                            id="sc-price-asset"
                                            type="number"
                                            min={0}
                                            step="any"
                                            value={priceAsset}
                                            onChange={(e) => setPriceAsset(e.target.value)}
                                            placeholder="Optional"
                                        />
                                    </div>
                                </div>
                                {parsedPriceXlm <= 0 && parsedPriceAsset <= 0 && (
                                    <p className="text-sm text-destructive">
                                        Set a price in at least one currency.
                                    </p>
                                )}
                            </div>

                            <Alert>
                                <AlertDescription>
                                    Creating this doesn{"'"}t touch the blockchain or ask for a
                                    signature — it just lists the item. Copies mint on-chain
                                    straight to each buyer, right when they buy.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                )}

                {activeStep === "locked" && (
                    <Card>
                        <CardContent className="space-y-4 pt-6">
                            <div>
                                <Label className="mb-1 flex items-center gap-2 text-sm font-medium">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    Locked content
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Songs, images, videos, or links that stay hidden from every
                                    buyer until they unlock this copy. Add at least one — this is
                                    the reward the ticket is actually for.
                                </p>
                            </div>
                            <LockedMediaEditor items={lockedMedia} onChange={setLockedMedia} />
                            {completeLockedMedia.length === 0 && (
                                <p className="text-sm text-destructive">
                                    Add at least one reward item (with a valid link, if using
                                    "Link") to continue.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                )}

                {activeStep === "unlock" && (
                    <Card>
                        <CardContent className="space-y-4 pt-6">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <Label className="flex items-center gap-2 text-sm font-medium">
                                        <MapPin className="h-4 w-4 text-primary" />
                                        Require visiting locations to unlock
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Applies separately to every copy sold — buying 4 copies of
                                        a 3-location rule drops 12 pins in total, not 3.
                                    </p>
                                </div>
                                <Switch checked={unlockEnabled} onCheckedChange={setUnlockEnabled} />
                            </div>

                            {unlockEnabled && (
                                <UnlockLocationPicker points={unlockPoints} onChange={setUnlockPoints} />
                            )}

                            {unlockEnabled && unlockPoints.length === 0 && (
                                <p className="text-sm text-destructive">
                                    Add at least one location, or turn this off.
                                </p>
                            )}

                            {!unlockEnabled && (
                                <Alert>
                                    <AlertDescription>
                                        No rule set — every buyer unlocks their copy{"'"}s reward
                                        immediately, just by owning it.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            <DialogFooter className="border-t px-6 py-4">
                <div className="flex w-full items-center justify-between">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={prevStep}
                    >
                        Previous
                    </Button>

                    {activeStep !== SC_FORM_STEPS[SC_FORM_STEPS.length - 1] ? (
                        <Button
                            type="button"
                            onClick={nextStep}
                            className="flex items-center gap-1 shadow-sm shadow-foreground"
                            disabled={
                                (activeStep === "details" &&
                                    (name.trim().length === 0 || !thumbnailUrl || !contentMimeType)) ||
                                (activeStep === "pricing" && parsedPriceXlm <= 0 && parsedPriceAsset <= 0) ||
                                (activeStep === "locked" && completeLockedMedia.length === 0)
                            }
                        >
                            Next
                            <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            onClick={() => void handleCreate()}
                            disabled={!canSubmit || submitLoading}
                            className="flex items-center gap-1 shadow-sm shadow-foreground"
                        >
                            {submitLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                "Create Listing"
                            )}
                        </Button>
                    )}
                </div>
            </DialogFooter>
        </motion.div>
    );
}

function TiersOptions({
    tiers,
    value,
    handleTierChange,
}: {
    tiers: { id: number; name: string; price: number }[];
    value?: string;
    handleTierChange: (value: string) => void;
}) {
    return (
        <Select value={value} onValueChange={handleTierChange}>
            <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a tier" />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>Choose Tier</SelectLabel>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Only Members</SelectItem>                    {tiers.map((model) => (
                        <SelectItem key={model.id} value={model.id.toString()}>
                            <div className="flex w-full items-center justify-between">
                                <span>{model.name}</span>
                                <Badge variant="outline">{model.price}</Badge>
                            </div>
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}

function PlayableMedia({
    mediaUrl,
    mediaType,
}: {
    mediaUrl?: string;
    mediaType: MediaType;
}) {
    return (
        mediaUrl && <MediaComponent mediaType={mediaType} mediaUrl={mediaUrl} />
    );

    function MediaComponent({
        mediaType,
        mediaUrl,
    }: {
        mediaType: MediaType;
        mediaUrl: string;
    }) {
        const [isLoading, setIsLoading] = useState(true);

        React.useEffect(() => {
            // Simulate loading
            const timer = setTimeout(() => {
                setIsLoading(false);
            }, 1000);

            return () => clearTimeout(timer);
        }, []);

        if (isLoading) {
            return (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-8 w-8 animate-spin " />
                </div>
            );
        }

        switch (mediaType) {
            case MediaType.IMAGE:
                return (
                    <div className="relative aspect-square w-full overflow-hidden rounded-md">
                        <Image
                            alt="NFT preview"
                            src={mediaUrl ?? "/placeholder.svg"}
                            fill
                            className="object-cover"
                        />
                    </div>
                );
            case MediaType.MUSIC:
                return (
                    <div className="w-full">
                        <audio controls className="w-full">
                            <source src={mediaUrl} type="audio/mpeg" />
                            Your browser does not support the audio element.
                        </audio>
                    </div>
                );
            case MediaType.VIDEO:
                return (
                    <div className="aspect-video w-full overflow-hidden rounded-md">
                        <video controls className="h-full w-full">
                            <source src={mediaUrl} type="video/mp4" />
                            Your browser does not support the video element.
                        </video>
                    </div>
                );
            case MediaType.THREE_D:
                return (
                    <div className="flex items-center justify-center rounded-md bg-green-50 p-4">
                        <div className="flex items-center gap-2 text-green-600">
                            <Check className="h-5 w-5" />
                            <span className="font-medium">
                                3D Model Uploaded Successfully
                            </span>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    }
}

interface VisibilityToggleProps {
    isVisible: boolean;
    toggleVisibility: () => void;
}

export function VisibilityToggle({
    isVisible,
    toggleVisibility,
}: VisibilityToggleProps) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={toggleVisibility}
                        aria-label={isVisible ? "Set to private" : "Set to visible"}
                    >
                        {isVisible ? (
                            <Eye className="h-4 w-4" />
                        ) : (
                            <EyeOff className="h-4 w-4" />
                        )}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{isVisible ? "Visible to all" : "Private"}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
