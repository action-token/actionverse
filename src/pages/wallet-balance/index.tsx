import { Button } from "~/components/shadcn/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card";
import { PLATFORM_ASSET } from "~/lib/stellar/constant";

import { useSession } from "next-auth/react";
import WBRightSideBar from "~/components/wallet-balance/wb-right-sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs";

import { Plus, QrCode, Send } from "lucide-react";
import {
    checkStellarAccountActivity,
    clientsign,
} from "package/connect_wallet/src/lib/stellar/utils";
import { useCallback, useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { useModal } from "~/lib/state/augmented-reality/use-modal-store";
import TransactionHistory from "~/components/wallet-balance/transactionHistory";
import CopyToClip from "~/components/common/copy_to_Clip";
import useNeedSign from "~/lib/hook";
import { clientSelect } from "~/lib/stellar/fan/utils";
import { api } from "~/utils/api";

import { useRouter } from "next/router";
import toast from "react-hot-toast";
import Loading from "~/components/common/loading";
import ReceiveAssetsModal from "~/components/modal/receive-asset-modal";
import SendAssetsModal from "~/components/modal/send-asset-modal";
import { toast as sonner } from "sonner"
import { useWalletBalanceStore } from "~/components/store/wallet-balance-store";
import { Switch } from "~/components/shadcn/ui/switch";

const Wallets = () => {
    const session = useSession();
    const { onOpen } = useModal();
    const { needSign } = useNeedSign();
    const { setBalanceType, isCreatorMode, setCreatorStorageId } = useWalletBalanceStore();

    const [isAccountActivate, setAccountActivate] = useState(false);
    const [isAccountActivateLoading, setAccountActivateLoading] = useState(false);
    const router = useRouter();
    const [isLoading, setLoading] = useState(false);
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);
    async function checkAccountActivity(publicKey: string) {
        setAccountActivateLoading(true);
        const isActive = await checkStellarAccountActivity(publicKey);
        // console.log("isActive", isActive);
        setAccountActivate(isActive);
        setAccountActivateLoading(false);
    }
    const creator = api.fan.creator.meCreator.useQuery(undefined, {
        enabled: !!isCreatorMode
    })

    const { data: pageAssetBalance } = api.walletBalance.wallBalance.getPageAssetBalance.useQuery(
        { creatorStorageId: creator.data?.storagePub ?? "", isCreatorMode },
        { enabled: !!creator.data?.storagePub && isCreatorMode }
    );

    const {
        data: hasTrustLineOnPlatformAsset,
        isLoading: checkingPlatformLoading,
    } = api.walletBalance.wallBalance.checkingPlatformTrustLine.useQuery(
        undefined,
        {
            enabled: !!session.data?.user,
            refetchOnWindowFocus: false,
        },
    );

    const { data: platformBalance, isLoading: getPlatformLoading } =
        api.walletBalance.wallBalance.getPlatformAssetBalance.useQuery(undefined, {
            enabled: hasTrustLineOnPlatformAsset,
            refetchOnWindowFocus: false,
        });
    useEffect(() => {
        if (router.query.id) {
            onOpen("send assets"); // Update state when id is available
        }
    }, [router.query.id]);
    useEffect(() => {
        if (creator.data) {
            setCreatorStorageId(creator.data.storagePub);
        }
    }, [creator.data])
    const checkStatus = useCallback(async () => {
        const user = session.data?.user;
        if (user) {
            // console.log("user", user);
            await checkAccountActivity(user.id);
        }
    }, [session.data?.user]);

    useEffect(() => {
        void checkStatus();
    }, []);
    const creatorPageAssetCode = creator.data?.pageAsset?.code ?? creator.data?.customPageAssetCodeIssuer?.split("-")[0] ?? "";

    const AddTrustMutation =
        api.walletBalance.wallBalance.addTrustLine.useMutation({
            onSuccess: async (data) => {
                try {
                    const clientResponse = await clientsign({
                        walletType: session?.data?.user?.walletType,
                        presignedxdr: data.xdr,
                        pubkey: data.pubKey,
                        test: clientSelect(),
                    });

                    if (clientResponse) {
                        toast.success("Added trustline successfully");
                        try {
                            await api
                                .useUtils()
                                .walletBalance.wallBalance.getWalletsBalance.refetch();
                        } catch (refetchError) {
                            console.log("Error refetching balance", refetchError);
                        }
                    } else {
                        toast.error("No Data Found at TrustLine Operation");
                    }
                } catch (error: unknown) {
                    console.error("Error in test transaction", error)

                    const err = error as {
                        message?: string
                        details?: string
                        errorCode?: string
                    }

                    sonner.error(
                        typeof err?.message === "string"
                            ? err.message
                            : "Transaction Failed",
                        {
                            description: `Error Code : ${err?.errorCode ?? "unknown"}`,
                            duration: 8000,
                        }
                    )
                } finally {
                    setLoading(false);
                }
            },
            onError: (error) => {
                setLoading(false);
                toast.error(error.message);
            },
        });

    const handleSubmit = async () => {
        setLoading(true);
        AddTrustMutation.mutate({
            asset_code: PLATFORM_ASSET.code,
            asset_issuer: PLATFORM_ASSET.issuer,
            signWith: needSign(),
        });
    };


    if (isAccountActivateLoading) {
        return (
            <div className="h-[calc(100vh-10vh)] flex w-full items-center justify-center">
                <Loading />
            </div>
        );
    }

    const url = `https://app.action-tokens.com${router.pathname}?id=${session?.data?.user?.id}`;

    if (!isAccountActivate) {
        return (
            <div className="flex flex-col items-center justify-center  md:p-8">
                <div className="space-y-6">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                            Your account has not been funded yet!!
                        </h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">
                            RECEIVE ASSETS TO YOUR ACCOUNT
                        </p>
                    </div>
                    <div className="flex flex-col items-center justify-center rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
                        <div className="flex aspect-square w-full max-w-[300px] items-center justify-center rounded-lg bg-black dark:bg-white">
                            <QRCode
                                size={256}
                                style={{
                                    borderRadius: "10px",
                                }}
                                value={url}
                                viewBox={`0 0 256 256`}
                            />
                        </div>
                        <div className="mt-4 text-center text-gray-600 dark:text-gray-400">
                            Point your camera at a QR code to scan it.
                        </div>
                    </div>
                    <div className="space-y-4 rounded-lg bg-white p-6 text-center shadow-lg dark:bg-gray-800">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            Scanned Content
                        </h2>
                        <div className="text-gray-600 dark:text-gray-400">
                            <h6 className="p-1 text-[10px] md:text-xs">
                                {session?.data?.user?.id}
                            </h6>
                            <CopyToClip text={session?.data?.user?.id ?? ""} collapse={5} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className=" p-2 space-y-6  w-full"  >
            <Card className="bg-gradient-to-r  from-yellow-400 to-blue-400 text-white shadow-md">
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        <div className="mb-4 md:mb-0">
                            {
                                isCreatorMode ? <>
                                    <>
                                        <h2 className="text-2xl font-semibold mb-2">Page Asset Balance</h2>
                                        <p className="text-xl md:text-4xl font-bold">
                                            {pageAssetBalance?.toString() === "0.0000000" ? "0" : pageAssetBalance?.toString()}
                                            <span className="text-md md:text-2xl ml-2">{creatorPageAssetCode}</span>
                                        </p>
                                    </>
                                </> : <>
                                    {hasTrustLineOnPlatformAsset ? (
                                        <>
                                            <h2 className="text-2xl font-semibold mb-2">Current Balance</h2>
                                            <p className="text-xl md:text-4xl font-bold">
                                                {platformBalance?.toString() === "0.0000000" ? "0" : platformBalance?.toString()}
                                                <span className="text-md md:text-2xl ml-2">{PLATFORM_ASSET.code}</span>
                                            </p>
                                        </>
                                    ) : (
                                        <div className="text-center md:text-left">
                                            <p className="text-xl mb-2">You haven{"'t"} added trust for {PLATFORM_ASSET.code} yet!</p>
                                            <Button
                                                onClick={() => AddTrustMutation.mutate({
                                                    asset_code: PLATFORM_ASSET.code,
                                                    asset_issuer: PLATFORM_ASSET.issuer,
                                                    signWith: needSign(),
                                                })}
                                                disabled={AddTrustMutation.isLoading}
                                                variant="secondary"
                                            >
                                                {AddTrustMutation.isLoading ? "Adding Trustline..." : getPlatformLoading ? "Checking Trustline..." : "Add Trustline"}
                                            </Button>
                                        </div>
                                    )}
                                </>
                            }
                        </div>
                        <div className="flex gap-2 items-center">
                            <Button variant="default" className="shadow-lg" onClick={() => setIsReceiveModalOpen(true)}>
                                <QrCode size={18} className="mr-2" />
                                Receive
                            </Button>
                            <Button variant="default" className="shadow-lg" onClick={() => setIsSendModalOpen(true)}>
                                <Send size={18} className="mr-2" />
                                Send
                            </Button>
                            <Switch
                                checked={isCreatorMode}
                                onCheckedChange={(checked) =>
                                    setBalanceType(checked ? "creator" : "user")
                                }

                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="hidden md:grid  md:grid-cols-2 gap-6 ">
                <Card className="md:col-span-1 h-[calc(100vh-32vh)] shadow-lg">
                    <CardHeader>
                        <CardTitle >{isCreatorMode ? "Creator" : "User"} Transaction History</CardTitle>
                    </CardHeader>
                    <CardContent className="">
                        <TransactionHistory />
                    </CardContent>
                </Card>
                <Card className="h-[calc(100vh-32vh)] shadow-lg">
                    <CardHeader>
                        <CardTitle className="hidden md:block">{isCreatorMode ? "Creator" : "User"} Assets</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <WBRightSideBar />
                    </CardContent>
                </Card>
            </div>
            <div className="md:hidden">
                <Tabs defaultValue="history" className="w-full ">
                    <TabsList className="grid w-full grid-cols-2 " >
                        <TabsTrigger value="history"> {isCreatorMode ? "Creator" : "User"} Transaction History</TabsTrigger>
                        <TabsTrigger value="assets">{isCreatorMode ? "Creator" : "User"} Assets</TabsTrigger>
                    </TabsList>
                    <TabsContent value="history">
                        <Card className="h-[calc(100vh-42vh)] p-0 m-0 shadow-lg">
                            <CardHeader className="hidden md:block">
                                <CardTitle>Transaction History</CardTitle>
                            </CardHeader>
                            <CardContent className="p-2">
                                <TransactionHistory />
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="assets">
                        <Card className="h-[calc(100vh-42vh)] p-0 m-0 shadow-lg">
                            <CardHeader className="hidden md:block">
                                <CardTitle>My Assets</CardTitle>
                            </CardHeader>
                            <CardContent className="p-2 ">
                                <WBRightSideBar />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
            {
                isReceiveModalOpen &&
                <ReceiveAssetsModal
                    isOpen={isReceiveModalOpen}
                    setIsOpen={setIsReceiveModalOpen}
                />
            }
            {
                isSendModalOpen &&
                <SendAssetsModal
                    isOpen={isSendModalOpen}
                    setIsOpen={setIsSendModalOpen}
                />
            }

        </div>
    );
};
export default Wallets;