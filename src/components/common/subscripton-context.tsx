import { useSession } from "next-auth/react";
import { api } from "~/utils/api";
import ContextMenu from "./context-menu";
import { useAddSubsciptionModalStore } from "../store/add-subscription-modal-store";
import { CreatorPageAsset, Subscription } from "@prisma/client";
import toast from "react-hot-toast";

export function SubscriptionContextMenu({
    creatorId,
    subscription,
    pageAsset,
    customPageAsset

}: {
    creatorId: string;
    subscription: Subscription
    pageAsset?: CreatorPageAsset | null
    customPageAsset?: string | null

}) {
    const { data } = useSession();
    const { openForEdit } = useAddSubsciptionModalStore()
    const deleteSubscription = api.fan.creator.deleteCreatorSubscription.useMutation({
        onSuccess: () => {
            toast.success("Subscription package deleted successfully")

        },
        onError: (error) => {
            toast.error(`Error deleting package: ${error.message}`)
        },
    })

    const handleDelete = () => {
        deleteSubscription.mutate({
            id: subscription.id
        })

    };
    const handleEdit = () => {
        openForEdit({
            customPageAsset,

        }, subscription)

    }

    if (data?.user && data.user.id === creatorId) {
        return (
            <ContextMenu
                handleDelete={handleDelete}
                handleEdit={handleEdit}
            />
        );
    }
}
