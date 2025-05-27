"use client";

import { CreditCard, PaymentForm } from "react-square-web-payments-sdk";
import { api } from "~/utils/api";
import { useState } from "react";
import { env } from "~/env";
import toast from "react-hot-toast";
import { submitSignedXDRToServer4User } from "package/connect_wallet/src/lib/stellar/trx/payment_fb_g";
import { motion } from "framer-motion";
import { CreditCardIcon, CheckCircle, AlertCircle, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/shadcn/ui/dialog";
type Offer = {
  num: number;
  price: number;
  xlm?: number; // xlm confirm that this is starting trx
};
type PaymentCardDialogDialogProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  offer: Offer;
  pubkey: string;
  xdr: string;
};

export default function PaymentCardDialog({
  isOpen,
  setIsOpen,
  offer,
  pubkey,
  xdr,
}: PaymentCardDialogDialogProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");

  const paymentMutation = api.marketplace.pay.payment.useMutation({
    async onSuccess(data, variables, context) {
      if (data) {
        setStatus("processing");
        const toastId = toast.loading("Submitting transaction");

        try {
          const result = await submitSignedXDRToServer4User(xdr);
          if (result) {
            setStatus("success");
            toast.success("Payment Successful");
            // Close dialog after success with a delay
            setTimeout(() => {
              setIsOpen(false);
              setStatus("idle");
            }, 3000);
          } else {
            setStatus("error");
            toast.error("Payment failed, Contact an admin");
          }
        } catch (e) {
          console.log(e);
          setStatus("error");
          toast.error("Payment failed");
        } finally {
          toast.dismiss(toastId);
          setLoading(false);
        }
      } else {
        setStatus("error");
        toast.error("Payment failed. Please try again.");
        setLoading(false);
      }
    },
  });

  const handleClose = () => {
    if (!loading) {
      setIsOpen(false);
      setStatus("idle");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCardIcon className="h-5 w-5 text-primary" />
              <DialogTitle>Complete Your Purchase</DialogTitle>
            </div>
          </div>
          <DialogDescription>
            Securely pay for your tokens using your credit or debit card.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Payment Summary */}
          <div className="rounded-lg bg-muted/50 p-4">
            <h4 className="mb-2 font-medium">Order Summary</h4>
            <div className="flex items-center justify-between text-sm">
              <span>{offer.num} Tokens</span>
              <span className="font-medium">${offer.price}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 font-medium">
              <span>Total</span>
              <span className="text-primary">${offer.price}</span>
            </div>
          </div>

          {/* Payment Form */}
          {status === "idle" && (
            <div className="space-y-4">
              <h4 className="font-medium">Payment Details</h4>
              <PaymentForm
                applicationId={env.NEXT_PUBLIC_SQUARE_APP_ID}
                cardTokenizeResponseReceived={(token, verifiedBuyer) => {
                  setLoading(true);
                  setStatus("processing");

                  paymentMutation.mutate({
                    sourceId: token.token,
                    amount: offer.price * 100, // payment gateway takes cent input
                  });
                }}
                locationId={env.NEXT_PUBLIC_SQUARE_LOCATION}
                createPaymentRequest={() => ({
                  countryCode: "US",
                  currencyCode: "USD",
                  total: {
                    amount: `${offer.price}`,
                    label: `${offer.num} Tokens`,
                  },
                })}
              >
                <CreditCard
                  style={{
                    ".message-text": {
                      color: "green",
                    },
                    ".message-icon": {
                      color: "green",
                    },
                  }}
                />
                <button
                  type="submit"
                  className="mt-4 w-full rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  disabled={loading}
                >
                  Pay ${offer.price}
                </button>
              </PaymentForm>
            </div>
          )}

          {/* Processing State */}
          {status === "processing" && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  repeat: Number.POSITIVE_INFINITY,
                  duration: 1.5,
                  ease: "linear",
                }}
                className="text-primary"
              >
                <svg
                  className="h-12 w-12"
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
              </motion.div>
              <p className="text-center font-medium">
                Processing your payment...
              </p>
              <p className="text-center text-sm text-muted-foreground">
                Please don{"'t"} close this window.
              </p>
            </div>
          )}

          {/* Success State */}
          {status === "success" && (
            <motion.div
              className="flex flex-col items-center justify-center space-y-4 py-8"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="text-center text-xl font-semibold">
                Payment Successful!
              </h3>
              <p className="text-center text-muted-foreground">
                Your {offer.num} tokens have been added to your account.
              </p>
            </motion.div>
          )}

          {/* Error State */}
          {status === "error" && (
            <motion.div
              className="flex flex-col items-center justify-center space-y-4 py-8"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="rounded-full bg-red-100 p-3">
                <AlertCircle className="h-10 w-10 text-red-600" />
              </div>
              <h3 className="text-center text-xl font-semibold">
                Payment Failed
              </h3>
              <p className="text-center text-muted-foreground">
                There was an issue processing your payment. Please try again or
                contact support.
              </p>
              <button
                onClick={() => setStatus("idle")}
                className="rounded-md bg-muted px-4 py-2 font-medium transition-colors hover:bg-muted/80"
              >
                Try Again
              </button>
            </motion.div>
          )}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          {status === "idle" && (
            <p className="text-center text-xs text-muted-foreground sm:text-left">
              Your payment information is securely processed. We don{"'t"} store
              your card details.
            </p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
