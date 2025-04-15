"use client"

import { clientsign } from "package/connect_wallet"
import { useState } from "react"
import { api } from "~/utils/api"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useSession } from "next-auth/react"
import { type SubmitHandler, useForm } from "react-hook-form"
import toast from "react-hot-toast"
import useNeedSign from "~/lib/hook"
import { clientSelect } from "~/lib/stellar/fan/utils"
import { addrShort } from "~/utils/utils"
import { Button } from "~/components/shadcn/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from "~/components/shadcn/ui/dialog"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Badge } from "~/components/shadcn/ui/badge"
import { Card, CardContent } from "~/components/shadcn/ui/card"

export const BackMarketFormSchema = z.object({
    placingCopies: z
        .number({
            required_error: "Placing Copies must be a number",
            invalid_type_error: "Placing Copies must be a number",
        })
        .nonnegative()
        .int(),
    code: z
        .string()
        .min(4, { message: "Must be a minimum of 4 characters" })
        .max(12, { message: "Must be a maximum of 12 characters" }),
    issuer: z.string(),
})

type PlaceMarketFormType = z.TypeOf<typeof BackMarketFormSchema>

export default function NftBackModal({
    item,
    copy,
}: {
    item: { code: string; issuer: string }
    copy: number
}) {
    const [isOpen, setIsOpen] = useState(false)
    const session = useSession()
    const { needSign } = useNeedSign()

    const {
        register,
        handleSubmit,
        setValue,
        getValues,
        formState: { errors },
        control,
        reset,
    } = useForm<z.infer<typeof BackMarketFormSchema>>({
        resolver: zodResolver(BackMarketFormSchema),
        defaultValues: { code: item.code, issuer: item.issuer, placingCopies: 1 },
    })

    const xdrMutaion = api.marketplace.market.placeBackNftXdr.useMutation({
        onSuccess(data, variables, context) {
            const xdr = data
            const tostId = toast.loading("Signing transaction...")
            clientsign({
                presignedxdr: xdr,
                pubkey: session.data?.user.id,
                walletType: session.data?.user.walletType,
                test: clientSelect(),
            })
                .then((res) => {
                    if (res) {
                        toast.success("Success")
                    } else {
                        toast.error("Failed")
                    }
                })
                .catch((e) => console.log(e))
                .finally(() => toast.dismiss(tostId))
        },
    })

    function resetState() {
        reset()
        xdrMutaion.reset()
    }

    const onSubmit: SubmitHandler<z.infer<typeof BackMarketFormSchema>> = (data) => {
        if (copy > getValues("placingCopies")) {
            xdrMutaion.mutate({
                issuer: item.issuer,
                placingCopies: getValues("placingCopies"),
                code: item.code,
                signWith: needSign(),
            })
        } else {
            toast.error("You can't take more than you have")
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full
                shadow-sm shadow-foreground">
                    Remove from market
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Take Asset Back From Storage to Main Acc</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="grid gap-4 py-4">
                        <Card>
                            <CardContent className="pt-6">
                                <p>Asset Name: {item.code}</p>
                                <p>
                                    Asset Code: <Badge variant="secondary">{item.code}</Badge>
                                </p>
                                <p className="text-sm text-destructive">Items left: {copy}</p>
                                <p className="text-sm">Issuer: {addrShort(item.issuer, 15)}</p>
                            </CardContent>
                        </Card>
                        <div className="">
                            <Label htmlFor="placingCopies" className="text-right">
                                Quantity
                            </Label>
                            <Input
                                id="placingCopies"
                                type="number"
                                className="col-span-3"
                                {...register("placingCopies", { valueAsNumber: true })}
                                min={1}
                                step={1}
                                placeholder="How many copies to remove?"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-4">
                        <DialogClose asChild>
                            <Button type="button" variant="destructive"
                                className="w-full shadow-sm shadow-foreground"
                                onClick={resetState}>
                                Close
                            </Button>
                        </DialogClose>
                        <Button type="submit"
                            className="w-full shadow-sm shadow-foreground"

                            disabled={xdrMutaion.isLoading || xdrMutaion.isSuccess}>
                            {xdrMutaion.isLoading ? (
                                <>
                                    <span className="loading loading-spinner"></span>
                                    Processing...
                                </>
                            ) : (
                                "Proceed"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}

