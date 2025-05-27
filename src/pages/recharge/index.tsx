"use client";

import { useSession } from "next-auth/react";
import { submitSignedXDRToServer4User } from "package/connect_wallet/src/lib/stellar/trx/payment_fb_g";
import { useState } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import ConvertCard from "~/components/recharge/convert-card";
import OfferCard from "~/components/recharge/offer-card";
import PaymentCard from "~/components/recharge/payment-card";
import { Button } from "~/components/shadcn/ui/button";
import { useRecharge } from "~/lib/state/recharge";
import { api } from "~/utils/api";
import { Coins, CreditCard, RefreshCw } from "lucide-react";
import PaymentCardDialog from "~/components/recharge/payment-card";
import { PLATFORM_ASSET } from "~/lib/stellar/constant";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "~/components/shadcn/ui/alert";

type Offer = {
  num: number;
  price: number;
  xlm?: number; // xlm confirm that this is starting trx
};

function PayPage() {
  const { convertOpen, setOpen } = useRecharge();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="container mx-auto h-screen max-w-4xl px-4 py-8"
    >
      <div className="flex flex-col items-center justify-center gap-6">
        <motion.div
          className="mb-2 flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Coins className="h-6 w-6 text-primary" />
          <h2 className="text-3xl font-bold">
            Recharge
            <span className="text-primary">
              {" "}
              {process.env.NEXT_PUBLIC_ASSET_CODE}
            </span>{" "}
            Tokens
          </h2>
        </motion.div>

        <div className="w-full ">
          <div className="mb-6 flex justify-center">
            <div className="flex rounded-full bg-muted p-1">
              <motion.button
                disabled
                className={`rounded-full px-6 py-2 text-sm font-medium transition-colors ${!convertOpen ? "bg-primary text-primary-foreground" : "hover:bg-muted-foreground/10"}`}
                onClick={() => setOpen(false)}
                whileHover={{ scale: !convertOpen ? 1 : 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                Buy Tokens
              </motion.button>
              {/* <motion.button
                                className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${convertOpen ? 'bg-primary text-primary-foreground' : 'hover:bg-muted-foreground/10'}`}
                                onClick={() => setOpen(true)}
                                whileHover={{ scale: convertOpen ? 1 : 1.05 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                Convert Assets
                            </motion.button> */}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={convertOpen ? "convert" : "buy"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              {convertOpen ? <CovertSiteAsset /> : <SiteAssetBuy />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function CovertSiteAsset() {
  const [selected, setSelected] = useState(false);
  const xdrMuation = api.marketplace.steller.convertSiteAsset.useMutation({
    async onSuccess(data, variables, context) {
      if (data) {
        const presignedxdr = data;
        const res = await submitSignedXDRToServer4User(presignedxdr);
        if (res) {
          toast.success("Transaction successful.");
        } else {
          toast.error(
            "Transaction error, Code: Stellar. Please let any admin know.",
          );
        }
        setSelected(false);
      }
    },
  });

  function handleCovert() {
    xdrMuation.mutate({ siteAssetAmount: 20, xlm: "1" });
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6">
      <motion.div
        className="grid w-full grid-cols-1 gap-4 md:grid-cols-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <ConvertCard
          handleClick={() => setSelected(!selected)}
          selected={selected}
        />
        <div className="flex items-center justify-center">
          <motion.div
            className="flex flex-col items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <RefreshCw className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Convert your assets</p>
          </motion.div>
        </div>
      </motion.div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full"
          >
            <Button
              className="w-full py-6 text-base font-medium"
              onClick={() => handleCovert()}
              disabled={xdrMuation.isLoading}
            >
              {xdrMuation.isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="mr-2"
                >
                  <RefreshCw className="h-5 w-5" />
                </motion.div>
              ) : null}
              {xdrMuation.isLoading ? "Processing..." : "Convert Now"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SiteAssetBuy() {
  const session = useSession();
  const [xdr, setXDR] = useState<string>();

  const [selectedIdx, setSelection] = useState<number>(() => 0);
  const offersQ = api.marketplace.pay.getOffers.useQuery();
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  const xdrMutation = api.marketplace.pay.getRechargeXDR.useMutation({
    onSuccess: (data) => {
      setXDR(data);
      setIsPaymentOpen(true);

      toast.success("Transaction Ready");
    },
    onError: (e) => toast.error(`${e.message}`),
  });

  function handleOfferChange(i: number) {
    if (i == selectedIdx) return;
    setXDR(undefined);
    setSelection(i);
  }

  const offers = offersQ.data;
  if (offers) {
    const selectedOffer = offers[selectedIdx];
    return (
      <div className="flex flex-col items-center justify-center gap-6">
        <motion.div
          className="grid w-full grid-cols-3 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
        >
          {offers.map((offer, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <OfferCard
                handleClick={() => handleOfferChange(i)}
                selected={i == selectedIdx}
                num={offer.num}
                price={offer.price}
              />
            </motion.div>
          ))}
        </motion.div>

        <Alert variant="destructive">
          <AlertTitle className="text-sm font-medium">
            Note: Price may fluctuate due to market conditions.
          </AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground">
            The price of {process.env.NEXT_PUBLIC_ASSET_CODE} tokens may vary
            based on market conditions. Please check the current price before
            proceeding with your purchase.
          </AlertDescription>
        </Alert>
        <AnimatePresence>
          {selectedOffer && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full"
            >
              <SelectedOfferSummary offer={selectedOffer} />
            </motion.div>
          )}
        </AnimatePresence>

        {session.status == "authenticated" && selectedOffer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex w-full justify-center"
          >
            <Button
              variant="default"
              size="lg"
              className="w-full py-6 text-base font-medium md:w-2/3"
              disabled={xdrMutation.isLoading}
              onClick={() =>
                xdrMutation.mutate({
                  tokenNum: selectedOffer.num,
                  xlm: selectedOffer.price,
                })
              }
            >
              {xdrMutation.isLoading && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    repeat: Number.POSITIVE_INFINITY,
                    duration: 1,
                    ease: "linear",
                  }}
                  className="mr-2"
                >
                  <RefreshCw className="h-5 w-5" />
                </motion.div>
              )}
              {xdrMutation.isLoading ? "Preparing Transaction" : "Buy Now"}
            </Button>
          </motion.div>
        )}

        {/* Payment Dialog */}
        {xdr && selectedOffer && session.status === "authenticated" && (
          <PaymentCardDialog
            isOpen={isPaymentOpen}
            setIsOpen={setIsPaymentOpen}
            offer={selectedOffer}
            pubkey={session.data.user.id}
            xdr={xdr}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex justify-center p-8">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
      >
        <RefreshCw className="h-8 w-8 text-muted-foreground" />
      </motion.div>
    </div>
  );
}

interface ISelectedOfferSummary {
  offer?: Offer;
}

function SelectedOfferSummary({ offer }: ISelectedOfferSummary) {
  if (offer)
    return (
      <motion.div
        className="w-full rounded-lg bg-muted/50 p-4 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <p className="text-lg font-medium">
          Buy{" "}
          <span className="font-bold text-primary">{offer.num.toFixed(2)}</span>{" "}
          {process.env.NEXT_PUBLIC_ASSET_CODE} for{" "}
          <span className="font-bold text-primary">${offer.price}</span>
        </p>
      </motion.div>
    );
  return null;
}

export default PayPage;
