import { Creator } from "@prisma/client";
import { type Session } from "next-auth";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { clientsign } from "package/connect_wallet";
import { useState } from "react";
import toast from "react-hot-toast";

import { Coins, DollarSign, Loader } from "lucide-react";
import { Label } from "~/components/shadcn/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/shadcn/ui/radio-group";

import { Button } from "~/components/shadcn/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/shadcn/ui/dialog";
import { PLATFORM_ASSET } from "~/lib/stellar/constant";
// import { PaymentMethod, PaymentMethodEnum } from "~/components/BuyItem";
import { api } from "~/utils/api";
import useNeedSign from "~/lib/hook";
import { CREATOR_TERM } from "~/utils/term";
import { PaymentMethod, PaymentMethodEnum } from "../payment/payment-process";
import { clientSelect } from "~/lib/stellar/fan/utils";
import Link from "next/link";
import Alert from "../shadcn/alert";
import RechargeLink from "../payment/recharge-link";
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances";

export function CreateStorage({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    PaymentMethodEnum.enum.asset,
  );

  const { platformAssetBalance, getXLMBalance } = useUserStellarAcc();
  const { needSign } = useNeedSign();
  const session = useSession();

  const xlmBalance = getXLMBalance() ?? "0";

  const requiredToken = api.fan.trx.getRequiredPlatformAsset.useQuery({
    xlm: 3.5,
  });

  const makeCreatorMutation = api.fan.creator.makeMeCreator.useMutation({
    onSuccess: () => {
      toast.success("Storage account created successfully");
      setIsOpen(false);
    },
    onError: (err) => {
      toast.error(err.message);
    }
  });

  const [signLoading, setSignLoading] = useState(false);

  const xdr = api.fan.trx.createStorageAccount.useMutation({
    onSuccess: (data) => {
      const { xdr, storage } = data;
      setSignLoading(true);
      const toastId = toast.loading("Creating account");
      clientsign({
        presignedxdr: xdr,
        pubkey: session.data?.user.id,
        walletType: session.data?.user.walletType,
        test: clientSelect(),
      })
        .then((isSuccess) => {
          if (isSuccess) {
            makeCreatorMutation.mutate(storage);
          } else {
            toast.error("Failed to create account");
          }
        })
        .catch((e) => toast.error("Error signing transaction: " + e))
        .finally(() => {
          setIsOpen(false);
          toast.dismiss(toastId);
          setSignLoading(false);
        });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const loading =
    xdr.isLoading || makeCreatorMutation.isLoading || signLoading;

  const handleConfirm = () => {
    xdr.mutate({
      signWith: needSign(),
      native: paymentMethod === PaymentMethodEnum.enum.xlm,
    });
  };

  const XLM_EQUIVALENT = 3;
  const requiredTokenNumber = requiredToken.data ?? 0;

  const hasSufficientBalance =
    platformAssetBalance >= requiredTokenNumber || Number(xlmBalance) >= 1;

  // Derive modal content based on balance state
  const renderModalContent = () => {
    if (requiredToken.isLoading) {
      return (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      );
    }

    if (!hasSufficientBalance) {
      return (
        <div className="flex flex-col gap-3 py-2">
          <Alert
            type="error"
            content={`Insufficient balance. You need at least ${requiredTokenNumber} ${PLATFORM_ASSET.code} to create a storage account.`}
          />
          <RechargeLink />
        </div>
      );
    }

    return (
      <>
        <p className="text-center text-sm text-muted-foreground">
          Your account will be charged to create the storage account.
        </p>

        <RadioGroup
          value={paymentMethod}
          onValueChange={(e) => setPaymentMethod(e as PaymentMethod)}
          className="mt-4 space-y-3"
        >
          {/* PLATFORM ASSET option */}
          <Label
            htmlFor={PaymentMethodEnum.enum.asset}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
          >
            <RadioGroupItem
              value={PaymentMethodEnum.enum.asset}
              id={PaymentMethodEnum.enum.asset}
            />
            <Coins className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <div className="font-medium">
                Pay with {PLATFORM_ASSET.code.toUpperCase()}
              </div>
              <div className="text-xs text-muted-foreground">
                Use platform tokens
              </div>
            </div>
            <span className="font-semibold">
              {requiredTokenNumber} {PLATFORM_ASSET.code.toUpperCase()}
            </span>
          </Label>

          {/* XLM option */}
          <Label
            htmlFor={PaymentMethodEnum.enum.xlm}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
          >
            <RadioGroupItem
              value={PaymentMethodEnum.enum.xlm}
              id={PaymentMethodEnum.enum.xlm}
            />
            <DollarSign className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <div className="font-medium">Pay with XLM</div>
              <div className="text-xs text-muted-foreground">
                Use Stellar Lumens
              </div>
            </div>
            <span className="font-semibold">{XLM_EQUIVALENT} XLM</span>
          </Label>
        </RadioGroup>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          You will be charged{" "}
          {paymentMethod === PaymentMethodEnum.enum.asset
            ? `${requiredTokenNumber} ${PLATFORM_ASSET.code}`
            : `${XLM_EQUIVALENT} XLM`}{" "}
          to create storage account.
        </p>

        <DialogFooter className="mt-6 flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Confirm Payment"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={loading}
            className="w-full"
          >
            Cancel
          </Button>
        </DialogFooter>
      </>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={className} disabled={requiredToken.isLoading}>
          {requiredToken.isLoading && (
            <Loader className="mr-2 h-4 w-4 animate-spin" />
          )}
          Place in Storage
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold">
            {hasSufficientBalance
              ? "Create Storage Account"
              : "Insufficient Balance"}
          </DialogTitle>
          {hasSufficientBalance && (
            <DialogDescription className="text-center">
              Choose how you&apos;d like to pay for your storage account.
            </DialogDescription>
          )}
        </DialogHeader>

        {renderModalContent()}
      </DialogContent>
    </Dialog>
  );
}