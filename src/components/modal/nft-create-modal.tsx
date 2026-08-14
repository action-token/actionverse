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
import { useDebounce } from "~/hooks/useDebounce";
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
import { cn } from "~/lib/utils";
import { Progress } from "../shadcn/ui/progress";

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
    const [method, setMethod] = useState<"choice" | "classic" | "smart-contract">(
        "choice",
    );

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
            </DialogContent>
        </Dialog>
    );
}

function MintMethodChoice({
    onSelect,
    onClose,
}: {
    onSelect: (method: "classic" | "smart-contract") => void;
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
            <div className="grid grid-cols-1 gap-4 px-6 py-6 sm:grid-cols-2">
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
    const [formProgress, setFormProgress] = useState(25);

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

    // Update progress based on active step
    React.useEffect(() => {
        const stepIndex = FORM_STEPS.indexOf(activeStep);
        setFormProgress((stepIndex + 1) * (100 / FORM_STEPS.length));
    }, [activeStep]);

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
                        <DialogDescription>
                            Create you nft and place it to marketplace.
                        </DialogDescription>
                        <Progress value={formProgress} className="mt-2 h-2" />

                        <div className="w-full px-6 ">
                            <div className="flex items-center justify-between">
                                {FORM_STEPS.map((step, index) => (
                                    <div key={step} className="flex flex-col items-center">
                                        <div
                                            className={cn(
                                                "mb-1 flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium ",
                                                activeStep === step
                                                    ? "bg-primary  shadow-sm shadow-foreground"
                                                    : "bg-muted text-muted-foreground",
                                            )}
                                        >
                                            {index + 1}
                                        </div>
                                        <span
                                            className={cn(
                                                "text-xs",
                                                activeStep === step
                                                    ? " font-medium"
                                                    : "text-muted-foreground",
                                            )}
                                        >
                                            {step === "media"
                                                ? "Media Info"
                                                : step === "details"
                                                    ? "Asset Info"
                                                    : "Price & Payment"}
                                        </span>
                                    </div>
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
                                                <div>
                                                    <Label className="mb-2 block text-sm font-medium">
                                                        Media Type
                                                    </Label>
                                                    <div className="grid grid-cols-4 gap-2">
                                                        {Object.values(MediaType).map((media, i) => (
                                                            <Button
                                                                key={i}
                                                                type="button"
                                                                variant={
                                                                    media === mediaType ? "destructive" : "muted"
                                                                }
                                                                onClick={() => handleMediaChange(media)}
                                                                className={`flex items-center gap-2 ${media === mediaType ? "shadow-sm shadow-foreground" : ""} `}
                                                            >
                                                                {getMediaIcon(media)}
                                                                <span>
                                                                    {media === MediaType.THREE_D ? "3D" : media}
                                                                </span>
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {tiers.data && (
                                                    <div>
                                                        <Label className="mb-2 block text-sm font-medium">
                                                            Access Tier
                                                        </Label>
                                                        <TiersOptions
                                                            handleTierChange={(value: string) => {
                                                                setTier(value);
                                                            }}
                                                            tiers={tiers.data}
                                                        />
                                                    </div>
                                                )}

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

const SC_FORM_STEPS = ["details", "media"];

// Mirrors `editionSize: z.number().int().min(1).max(10_000)` in
// `nft.getMintXDR` — the contract itself has no ceiling (an OZ fungible
// token's supply is an i128), this cap is purely this app's own policy. Kept
// here too so the form can reject an out-of-range value before a wallet
// round-trip, instead of only finding out from the server after minting.
const MAX_EDITION_SIZE = 10_000;

function SmartContractNftForm({
    onBack,
    onClose,
}: {
    onBack: () => void;
    onClose: () => void;
}) {
    const session = useSession();
    const walletType = session.data?.user.walletType ?? WalletType.none;
    const { needSign } = useNeedSign();
    const utils = api.useContext();

    const [activeStep, setActiveStep] = useState<string>("details");
    const [formProgress, setFormProgress] = useState(100 / SC_FORM_STEPS.length);
    const [submitLoading, setSubmitLoading] = useState(false);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [copies, setCopies] = useState(1);
    const [royaltyPercent, setRoyaltyPercent] = useState(0);
    const [price, setPrice] = useState(1);
    // A one-of-one is a token in the shared collection contract; an edition
    // deploys its own fungible token whose supply is the print run.
    const [kind, setKind] = useState<"ONE_OF_ONE" | "EDITION">("ONE_OF_ONE");
    const [symbol, setSymbol] = useState("");

    const [mediaType, setMediaType] = useState<MediaType>(MediaType.IMAGE);
    const [contentMimeType, setContentMimeType] = useState<string>();
    const [thumbnailUrl, setThumbnailUrl] = useState<string>();
    const [contentUrl, setContentUrl] = useState<string>();
    const [thumbnailUploading, setThumbnailUploading] = useState(false);

    const createNft = api.nft.create.useMutation();
    const deletePendingNft = api.nft.deletePendingNft.useMutation();
    const getMintXDR = api.nft.getMintXDR.useMutation();
    const confirmMint = api.nft.confirmMint.useMutation();

    const debouncedSymbol = useDebounce(symbol, 400);
    const symbolCheck = api.ft.checkSymbolAvailability.useQuery(
        { symbol: debouncedSymbol },
        { enabled: kind === "EDITION" && debouncedSymbol.length > 0 },
    );

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

    function getMediaIcon(type: MediaType) {
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
    }

    async function uploadThumbnail(file: File) {
        try {
            setThumbnailUploading(true);
            const formData = new FormData();
            formData.append("file", file, file.name);
            const res = await fetch("/api/file", { method: "POST", body: formData });
            const ipfsHash = await res.text();
            setThumbnailUrl(ipfsHashToPinataGatewayUrl(ipfsHash));
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
            setFormProgress(((i + 2) / SC_FORM_STEPS.length) * 100);
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
            setFormProgress(((i) / SC_FORM_STEPS.length) * 100);
        }
    }

    const canSubmit =
        name.trim().length > 0 &&
        !!thumbnailUrl &&
        !!contentUrl &&
        !!contentMimeType &&
        copies >= 1 &&
        (kind === "ONE_OF_ONE" || copies <= MAX_EDITION_SIZE) &&
        price > 0 &&
        (kind === "ONE_OF_ONE" ||
            (symbol.length > 0 && symbolCheck.data?.available === true));

    // Same build-XDR -> sign (server-side or via clientsign) -> confirm shape
    // as the bounty escrow flow (see src/pages/bounty/create.tsx) — no
    // wallet-specific Soroban signing code, no SDK signAndSend/RPC decoding.
    async function signAndSubmit(xdr: string, fullySignedByServer: boolean) {
        if (fullySignedByServer) {
            return extractTxHash(await submitSignedXDRToServer4User(xdr));
        }
        const clientResponse = await clientsign({
            presignedxdr: xdr,
            walletType,
            pubkey: session.data!.user.id,
            test: clientSelect(),
        });
        return extractTxHash(clientResponse);
    }

    /**
     * One signature: the contract mints and lists atomically (`mint_and_list`
     * for a 1-of-1, or `ft_oz`'s constructor for an edition), so there's only
     * ever one transaction to sign and one confirmation to wait for here.
     */
    async function handleMint() {
        if (!session.data?.user || !thumbnailUrl || !contentUrl || !contentMimeType) return;
        setSubmitLoading(true);
        let nftId: string | undefined;
        // Once a real transaction hash exists, the mint (and its listing) may
        // already be on-chain — deleting the row past this point would orphan
        // a real artwork with no DB record, so the row is only ever cleaned up
        // before this is set.
        let mintHash: string | undefined;
        try {
            const nft = await createNft.mutateAsync({
                name: name.trim(),
                description: description.trim(),
                thumbnail: thumbnailUrl,
                contentUrl,
                mediaType: contentMimeType,
                kind,
                royaltyBps: Math.round(royaltyPercent * 100),
                symbol: kind === "EDITION" ? symbol : undefined,
            });
            nftId = nft.id;

            // Edition size is never persisted — it's only needed here, to size
            // the deploy transaction. The contract's own state becomes the
            // sole source of truth for it the moment this mint lands.
            const mintTx = await getMintXDR.mutateAsync({
                nftId: nft.id,
                price,
                editionSize: kind === "EDITION" ? copies : undefined,
                signWith: needSign(),
            });
            mintHash = await signAndSubmit(mintTx.xdr, mintTx.fullySignedByServer);
            if (!mintHash) {
                // Wallet dialog was closed/cancelled, or the transaction didn't
                // land — don't leave a fake "minted" row behind.
                toast.error("Minting transaction could not be confirmed.");
                await deletePendingNft.mutateAsync({ nftId: nft.id });
                return;
            }

            await confirmMint.mutateAsync({ nftId: nft.id, txHash: mintHash });

            toast.success(kind === "EDITION" ? "Edition minted and listed!" : "NFT minted and listed!");
            onClose();
        } catch (e) {
            const message = e instanceof Error ? e.message : "Minting failed";
            if (mintHash) {
                // The transaction was submitted — it likely landed on-chain and
                // only the confirmation step failed to catch up. Don't discard
                // the row; leave it PENDING so it's retryable/inspectable
                // rather than silently orphaning a real mint.
                toast.error(
                    `Your transaction was submitted, but confirming it timed out: ${message}. It likely still went through — check your collection in a moment before minting again.`,
                );
            } else {
                toast.error(message);
                if (nftId) {
                    await deletePendingNft.mutateAsync({ nftId }).catch(() => undefined);
                }
            }
        } finally {
            await Promise.all([
                utils.nft.myOwned.invalidate(),
                utils.nft.myCreated.invalidate(),
                utils.nft.list.invalidate(),
                // Covers the case where this item's manage/detail page was
                // already open in another tab and had cached a pre-mint
                // ("not minted yet") snapshot before this call landed.
                ...(nftId ? [utils.nft.onChainInsights.invalidate({ id: nftId })] : []),
            ]);
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
                    Mint Smart Contract NFT
                </DialogTitle>
                <DialogDescription>
                    Minted directly on the NFT marketplace smart contract — on-chain
                    ownership, royalties, and resale built in.
                </DialogDescription>
                <Progress value={formProgress} className="mt-2 h-2" />
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
                                <Label>Artwork type</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setKind("ONE_OF_ONE")}
                                        className={`rounded-lg border p-3 text-left transition ${kind === "ONE_OF_ONE"
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:bg-muted/50"
                                            }`}
                                    >
                                        <span className="block text-sm font-medium">One of one</span>
                                        <span className="block text-xs text-muted-foreground">
                                            A single unique piece with one owner
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setKind("EDITION")}
                                        className={`rounded-lg border p-3 text-left transition ${kind === "EDITION"
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:bg-muted/50"
                                            }`}
                                    >
                                        <span className="block text-sm font-medium">Edition</span>
                                        <span className="block text-xs text-muted-foreground">
                                            A print run — its own token, one unit per copy
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {kind === "EDITION" && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="sc-copies">Edition size</Label>
                                        <Input
                                            id="sc-copies"
                                            type="number"
                                            min={1}
                                            max={MAX_EDITION_SIZE}
                                            value={copies}
                                            onChange={(e) => setCopies(Math.round(Number(e.target.value)) || 0)}
                                            aria-invalid={copies < 1 || copies > MAX_EDITION_SIZE}
                                        />
                                        {copies > MAX_EDITION_SIZE ? (
                                            <p className="text-xs text-destructive">
                                                Max edition size is {MAX_EDITION_SIZE.toLocaleString()}.
                                            </p>
                                        ) : copies < 1 ? (
                                            <p className="text-xs text-destructive">
                                                Edition size must be at least 1.
                                            </p>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">
                                                Fixed forever at mint — the supply can never be increased
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="sc-symbol">Token symbol</Label>
                                        <Input
                                            id="sc-symbol"
                                            value={symbol}
                                            maxLength={12}
                                            onChange={(e) =>
                                                setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                                            }
                                            placeholder="SUNSET"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            {symbolCheck.data
                                                ? symbolCheck.data.message
                                                : "1-12 letters or digits, unique across the platform"}
                                        </p>
                                    </div>
                                </>
                            )}
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
                                    You earn this percentage on every resale
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sc-price" className="flex items-center gap-2">
                                    <Coins className="h-4 w-4 text-muted-foreground" />
                                    Price (XLM)
                                </Label>
                                <Input
                                    id="sc-price"
                                    type="number"
                                    min={0.0000001}
                                    step="any"
                                    value={price}
                                    onChange={(e) => setPrice(Number(e.target.value) || 0)}
                                    placeholder="Enter price in XLM"
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {activeStep === "media" && (
                    <Card>
                        <CardContent className="space-y-4 pt-6">
                            <div>
                                <Label className="mb-2 block text-sm font-medium">Media Type</Label>
                                <div className="grid grid-cols-4 gap-2">
                                    {Object.values(MediaType).map((media, i) => (
                                        <Button
                                            key={i}
                                            type="button"
                                            variant={media === mediaType ? "destructive" : "muted"}
                                            onClick={() => {
                                                setMediaType(media);
                                                setContentUrl(undefined);
                                                setContentMimeType(undefined);
                                            }}
                                            className={`flex items-center gap-2 ${media === mediaType ? "shadow-sm shadow-foreground" : ""}`}
                                        >
                                            {getMediaIcon(media)}
                                            <span>{media === MediaType.THREE_D ? "3D" : media}</span>
                                        </Button>
                                    ))}
                                </div>
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

                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Content</Label>
                                <UploadS3Button
                                    endpoint={getEndpoint(mediaType)}
                                    variant="button"
                                    label={`UPLOAD ${mediaType !== "THREE_D" ? mediaType : "3D"} CONTENT`}
                                    className="w-full"
                                    onBeforeUploadBegin={(file) => {
                                        setContentMimeType(file.type);
                                        return file;
                                    }}
                                    onClientUploadComplete={(res) => {
                                        if (res?.url) {
                                            setContentUrl(res.url);
                                            toast.success("Content uploaded successfully");
                                        }
                                    }}
                                    onUploadError={(error: Error) => {
                                        toast.error(`ERROR! ${error.message}`);
                                    }}
                                />
                                {contentUrl && (
                                    <Badge variant="outline" className="bg-green-100 text-green-800">
                                        <Check className="mr-1 h-3 w-3" /> Content uploaded
                                    </Badge>
                                )}
                            </div>

                            <Alert>
                                <AlertDescription>
                                    Minting calls the smart contract directly from your
                                    connected wallet — no storage account needed.
                                </AlertDescription>
                            </Alert>
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

                    {activeStep !== "media" ? (
                        <Button
                            type="button"
                            onClick={nextStep}
                            className="flex items-center gap-1 shadow-sm shadow-foreground"
                            disabled={activeStep === "media" && (!thumbnailUrl || !contentUrl)}
                        >
                            Next
                            <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            onClick={() => void handleMint()}
                            disabled={!canSubmit || submitLoading}
                            className="flex items-center gap-1 shadow-sm shadow-foreground"
                        >
                            {submitLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Minting...
                                </>
                            ) : (
                                "Mint NFT"
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
    handleTierChange,
}: {
    tiers: { id: number; name: string; price: number }[];
    handleTierChange: (value: string) => void;
}) {
    return (
        <Select onValueChange={handleTierChange}>
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
