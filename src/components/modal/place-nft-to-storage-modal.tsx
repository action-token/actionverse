import { clientsign } from "package/connect_wallet/src/lib/stellar/utils";
import { useRef } from "react";
import { api } from "~/utils/api";
import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/shadcn/ui/dialog";

import { z } from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Button } from "~/components/shadcn/ui/button";
import useNeedSign from "~/lib/hook";
import { clientSelect } from "~/lib/stellar/fan/utils";
import { addrShort } from "~/utils/utils";
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Badge } from "../shadcn/ui/badge";
import { Label } from "../shadcn/ui/label";
import { Input } from "../shadcn/ui/input";

export const PlaceMarketFormSchema = z.object({
    placingCopies: z
        .number({
            required_error: "Placing Copies  must be a number",
            invalid_type_error: "Placing Copies must be a number",
        })
        .nonnegative()
        .int(),
    code: z
        .string()
        .min(4, { message: "Must be a minimum of 4 characters" })
        .max(12, { message: "Must be a maximum of 12 characters" }),
    issuer: z.string(),
});

export type PlaceMarketFormType = z.TypeOf<typeof PlaceMarketFormSchema>;

export default function StorageCreateDialog({
    item,
}: {
    item: { code: string; issuer: string; copies: number; name: string };
}) {
    const storage = api.admin.user.hasStorage.useQuery();

    if (storage.data) {
        const storagePub = storage.data.storage;
        if (storagePub) {
            return <PlaceNFT2StorageModal item={item} />;
        } else {
            // create storage
            return <StorageCreate />;
        }
    }
}

function StorageCreate() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">Place in storage (*)</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Need to Create Storage Account</DialogTitle>
                    <DialogDescription>
                        First you need to create your storage account , then try placing the
                        item to the storage
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    );
}

function PlaceNFT2StorageModal({
    item,
}: {
    item: {
        code: string
        issuer: string
        copies: number
        name: string
    }
}) {
    const [isOpen, setOpen] = useState(false)
    const session = useSession()
    const { needSign } = useNeedSign()

    const {
        register,
        handleSubmit,
        getValues,
        formState: { errors },
        reset,
    } = useForm<z.infer<typeof PlaceMarketFormSchema>>({
        resolver: zodResolver(PlaceMarketFormSchema),
        defaultValues: { code: item.code, issuer: item.issuer, placingCopies: 1 },
    })

    const xdrMutation = api.marketplace.market.placeNft2StorageXdr.useMutation({
        onSuccess(data) {
            const xdr = data
            const toastId = toast.loading("Signing transaction...")
            clientsign({
                presignedxdr: xdr,
                pubkey: session.data?.user.id,
                walletType: session.data?.user.walletType,
                test: clientSelect(),
            })
                .then(() => {
                    toast.success("NFT has been placed to storage")
                })
                .catch(() => {
                    toast.error("Error signing transaction")
                })
                .finally(() => toast.dismiss(toastId))
        },
    })

    function resetState() {
        reset()
        xdrMutation.reset()
    }

    const onSubmit: SubmitHandler<z.infer<typeof PlaceMarketFormSchema>> = (data) => {
        const placingCopies = getValues("placingCopies")
        if (placingCopies <= item.copies) {
            xdrMutation.mutate({
                issuer: item.issuer,
                placingCopies: placingCopies,
                code: item.code,
                signWith: needSign(),
            })
        } else {
            toast.error("You can't place more copies than available")
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="vibrant" className="shadow-sm shadow-foreground"
                    onClick={() => setOpen(true)}>
                    Place item for sale
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[425px]">
                <div className="grid gap-4 py-4">
                    <h3 className="text-lg font-semibold">Place in storage</h3>

                    <Card>
                        <CardContent className="pt-6">
                            <p className="mb-2">Asset Name: {item.name}</p>
                            <p className="mb-2">
                                Asset Code: <Badge variant="secondary">{item.code}</Badge>
                            </p>
                            <p className="mb-2 text-sm text-destructive">Items left: {item.copies}</p>
                            <p className="text-sm text-muted-foreground">Issuer: {addrShort(item.issuer, 15)}</p>
                        </CardContent>
                    </Card>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="placingCopies">Quantity</Label>
                            <Input
                                id="placingCopies"
                                type="number"
                                {...register("placingCopies", {
                                    valueAsNumber: true,
                                    max: item.copies,
                                })}
                                min={1}
                                step={1}
                            />
                            {errors.placingCopies && <p className="text-sm text-destructive">{errors.placingCopies.message}</p>}
                        </div>

                        <Button type="submit" className="shadow-sm w-full shadow-foreground"
                            disabled={xdrMutation.isLoading || xdrMutation.isSuccess}>
                            {xdrMutation.isLoading ? (
                                <>
                                    <svg
                                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </svg>
                                    Processing...
                                </>
                            ) : (
                                "Submit"
                            )}
                        </Button>
                    </form>

                    <Button
                        variant="destructive"
                        className="shadow-sm shadow-foreground"
                        onClick={() => {
                            resetState()
                            setOpen(false)
                        }}
                    >
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
