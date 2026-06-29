import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "~/utils/api";

export default function SingQRPage() {
    const router = useRouter();
    const { id } = router.query;
    const [redirecting, setRedirecting] = useState(false);

    const consumePin = api.game.consumePin.useMutation({
        onSuccess: (data, variables) => {
            setRedirecting(true);
            if (data.success) {
                toast.success("Pin consumed!");
                void router.replace(`/action/collections/${variables.pinId}`);
            } else {
                toast.error("Pin could not be consumed.");
                void router.replace(`/action/collections`);
            }
        },
        onError: (err) => {
            console.error("Error consuming pin:", err);
            toast.error("Failed to consume pin.");
            setRedirecting(true);
            void router.replace(`/action/collections`);
        },
    });

    useEffect(() => {
        if (id) {
            consumePin.mutate({ pinId: id as string });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    if (!id || consumePin.isLoading || redirecting) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-primary" />
                <p className="text-sm text-gray-500">
                    {redirecting ? "Redirecting…" : "Scanning QR code…"}
                </p>
            </div>
        );
    }

    return null;
}