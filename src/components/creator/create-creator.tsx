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

export function CreateStorage() {
  const [isOpen, setIsOpen] = useState(false);
  const { needSign } = useNeedSign();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    PaymentMethodEnum.enum.asset,
  );

  const session = useSession();
  const { data: requiredToken } = api.fan.trx.getRequiredPlatformAsset.useQuery(
    {
      xlm: 1.5,
    },
  );
  const makeCreatorMutation = api.fan.creator.makeMeCreator.useMutation({
    onSuccess: () => {
      toast.success("You are now a creator");
      setIsOpen(false);
    },
  });
  const [signLoading, setSingLoading] = useState(false);

  const xdr = api.fan.trx.createStorageAccount.useMutation({
    onSuccess: (data) => {
      const { xdr, storage } = data;

      setSingLoading(true);

      const toastId = toast.loading("Creating account");

      clientsign({
        presignedxdr: xdr,
        pubkey: session.data?.user.id,
        walletType: session.data?.user.walletType,
        test: clientSelect(),
      })
        .then((isSucces) => {
          if (isSucces) {
            makeCreatorMutation.mutate(storage);
          } else {
            toast.error("Failed to create account");
          }
        })
        .catch((e) => console.log(e))
        .finally(() => {
          setIsOpen(false);
          toast.dismiss(toastId);
          setSingLoading(false);
        });
    },
  });

  const handleConfirm = () => {
    xdr.mutate({
      signWith: needSign(),
      native: paymentMethod === PaymentMethodEnum.enum.xlm,
    });
  };

  const XLM_EQUIVALENT = 3;

  const loading = xdr.isLoading || makeCreatorMutation.isLoading || signLoading;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          {loading && <Loader className="animate mr-2 animate-spin" />}
          Join as a {CREATOR_TERM.toLowerCase()}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="mb-4 text-center text-2xl font-bold">
            Choose Payment Method
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <RadioGroup
            value={paymentMethod}
            onValueChange={(e) => setPaymentMethod(e as PaymentMethod)}
            className="space-y-4"
          >
            <div className="flex items-center space-x-2 rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50">
              <RadioGroupItem
                value={PaymentMethodEnum.enum.asset}
                id={PaymentMethodEnum.enum.asset}
                className="border-primary"
              />
              <Label
                htmlFor={PLATFORM_ASSET.code}
                className="flex flex-1 cursor-pointer items-center"
              >
                <Coins className="mr-3 h-6 w-6 text-primary" />
                <div className="flex-grow">
                  <div className="font-medium">
                    Pay with {PLATFORM_ASSET.code.toUpperCase()}
                  </div>
                  <div className="text-sm text-gray-500">
                    Use platform tokens
                  </div>
                </div>
                <div className="text-right font-medium">
                  {requiredToken} {PLATFORM_ASSET.code.toUpperCase()}
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50">
              <RadioGroupItem
                value={PaymentMethodEnum.enum.xlm}
                id={PaymentMethodEnum.enum.xlm}
                className="border-primary"
              />
              <Label
                htmlFor={PaymentMethodEnum.enum.xlm}
                className="flex flex-1 cursor-pointer items-center"
              >
                <DollarSign className="mr-3 h-6 w-6 text-primary" />
                <div className="flex-grow">
                  <div className="font-medium">Pay with XLM</div>
                  <div className="text-sm text-gray-500">
                    Use Stellar Lumens
                  </div>
                </div>
                <div className="text-right font-medium">
                  {XLM_EQUIVALENT} XLM
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>
        <div className="mt-4 text-center text-sm text-gray-500">
          Your account will be charged{" "}
          {paymentMethod == PaymentMethodEnum.enum.asset
            ? `${requiredToken} ${PLATFORM_ASSET.code}`
            : `${XLM_EQUIVALENT} XLM`}{" "}
          to be a {CREATOR_TERM.toLowerCase()}.
        </div>
        <DialogFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            className="mb-2 w-full"
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading} className="w-full">
            {loading ? "Processing..." : "Confirm Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
