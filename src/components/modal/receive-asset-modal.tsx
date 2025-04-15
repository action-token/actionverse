import QRCode from "react-qr-code";

import { Button } from "../shadcn/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/shadcn/ui/dialog";
import { useSession } from "next-auth/react";
import { addrShort } from "~/utils/utils";
import { useRouter } from "next/router";
import CopyToClip from "../common/copy_to_Clip";

interface ReceiveAssetsModalProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
}


const ReceiveAssetsModal = ({ isOpen, setIsOpen }: ReceiveAssetsModalProps) => {
    const session = useSession();

    const router = useRouter();

    if (!session?.data?.user?.id) {
        return <div>Public Key not found</div>;
    }
    const handleClose = () => {
        setIsOpen(false);
    };
    // console.log(router.pathname);
    const url = `https://app.wadzzo.com${router.pathname}?id=${session?.data?.user?.id}`;
    return (
        <>
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="overflow-hidden " >
                    <DialogHeader className="px-6 pt-8">
                        <DialogTitle className="text-center text-2xl font-bold">
                            RECEIVE ASSETS
                        </DialogTitle>
                    </DialogHeader>
                    <div className=" flex flex-col items-center justify-center ">
                        <QRCode
                            size={256}
                            style={{
                                borderRadius: "10px",
                                backgroundColor: "white",
                                height: "150px",
                                width: "150px",
                            }}
                            value={url}
                            // value={`https://localhost:3000${router.pathname}?id=${session?.data?.user?.id}`}
                            viewBox={`0 0 256 256`}
                        />
                        <h6 className="p-1 text-[10px] md:text-xs ">
                            {addrShort(session?.data?.user?.id, 10)}
                        </h6>

                        <CopyToClip text={session?.data?.user?.id} collapse={5} />
                    </div>
                    <DialogFooter className="px-6 py-4"></DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
export default ReceiveAssetsModal;
