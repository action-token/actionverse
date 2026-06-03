import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { clientsign } from "package/connect_wallet"
import { useEffect } from "react"
import toast from "react-hot-toast"
import { PaymentChoose, usePaymentMethodStore } from "~/components/common/payment-options"
import { Button } from "~/components/shadcn/ui/button"
import useNeedSign from "~/lib/hook"
import { PLATFORM_FEE, TrxBaseFeeInPlatformAsset } from "~/lib/stellar/constant"
import { clientSelect } from "~/lib/stellar/fan/utils"
import { api } from "~/utils/api"

interface CreateButtonProps {
    type: "AI" | "IMAGE" | "VIDEO"
    senderName: string
    recipientName: string
    message: string
    arEnabled: boolean
    isPublic: boolean
    contentUrl: string
    customPrompt?: string
}

export function CreateButton({
    type,
    senderName,
    recipientName,
    message,
    arEnabled,
    isPublic,
    contentUrl,
    customPrompt,
}: CreateButtonProps) {
    const router = useRouter()
    const { needSign } = useNeedSign()
    const session = useSession()
    const totalFees = Number(TrxBaseFeeInPlatformAsset) + Number(PLATFORM_FEE)
    const { isOpen, setIsOpen, paymentMethod, setPaymentMethod } = usePaymentMethodStore()


    const createBeamMutation = api.beam.create.useMutation({
        onSuccess: (data) => {
            toast.success("Beam created successfully!")
            router.push(`/beam/${data.id}`)
        },
        onError: (error) => {
            toast.error(`Error creating beam: ${error.message}`)
        },
    })
    const CreateBeamXDR = api.beam.createBeamXDR.useMutation({
        onSuccess: (xdr) => {
            if (xdr) {
                clientsign({
                    presignedxdr: xdr,
                    pubkey: session.data?.user.id,
                    walletType: session.data?.user.walletType,
                    test: clientSelect(),
                })
                    .then((res) => {
                        if (res) {
                            createBeamMutation.mutate({
                                type,
                                senderName,
                                recipientName,
                                message,
                                contentUrl,
                                ...(type === "AI" && { customPrompt }),
                                arEnabled,
                                isPublic,
                            })
                        }
                    })
                    .catch((e) => console.log(e))
                    .finally(() => {
                        console.log("completed");
                    });

            }


        }
    })



    const handleSubmit = () => {
        if (!senderName || !recipientName) {
            toast.error("Please provide both sender and recipient names.")
            return
        }

        if (type === "AI") {
            if (!customPrompt) {
                toast.error("Please provide a prompt for AI image generation.")
                return
            }
            if (!contentUrl) {
                toast.error("Please generate an image before creating the beam.")
                return
            }
        } else {
            if (!contentUrl) {
                toast.error("Please upload content before creating the beam.")
                return
            }
        }
        CreateBeamXDR.mutate({
            signWith: needSign(),
            amount: 400 + totalFees,
        })
    }

    useEffect(() => {
        setPaymentMethod("asset")
    }, [])

    return (
        <>
            <PaymentChoose
                costBreakdown={[
                    {
                        label: "Cost",
                        amount: 400,
                        highlighted: true,
                        type: "cost",
                    },
                    {
                        label: "Platform Fee",
                        amount: totalFees,
                        highlighted: false,
                        type: "fee",
                    },
                    {
                        label: "Total Cost",
                        amount: 400 + totalFees,
                        highlighted: false,
                        type: "total",
                    },
                ]}
                requiredToken={400 + totalFees}
                handleConfirm={handleSubmit}

                loading={createBeamMutation.isLoading}
                trigger={
                    <Button size="sm" disabled={createBeamMutation.isLoading || !contentUrl} className="flex-1">
                        {createBeamMutation.isLoading ? "Creating..." : "Create Beam"}
                    </Button>
                }
            />

        </>
    )
}