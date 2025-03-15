import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { clientsign } from "package/connect_wallet";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { Button } from "~/components/shadcn/ui/button";
import useNeedSign from "~/lib/hook";
import {
  PLATFORM_ASSET,
  PLATFORM_FEE,
  TrxBaseFeeInPlatformAsset,
} from "~/lib/stellar/constant";
import { clientSelect } from "~/lib/stellar/fan/utils";
import { api } from "~/utils/api";

import {
  PaymentChoose,
  usePaymentMethodStore,
} from "~/components/payment/payment-options";
import { useToast } from "~/hooks/use-toast";
import { ipfsHashToUrl } from "~/utils/ipfs";
import Alert from "~/components/common/alert";

export const MAX_ASSET_LIMIT = Number("922337203685");

export const CreatorPageAssetSchema = z.object({
  code: z
    .string()
    .min(4, { message: "Must be a minimum of 4 characters" })
    .max(12, { message: "Must be a maximum of 12 characters" })
    .refine(
      (value) => {
        // Check if the input is a single word
        return /^\w+$/.test(value);
      },
      {
        message: "Input must be a single word",
      },
    ),
  limit: z
    .number({
      required_error: "Limit must be entered as a number",
      invalid_type_error: "Limit must be entered as a number",
    })
    .min(1, { message: "Limit must be greater than 0" })
    .max(MAX_ASSET_LIMIT, {
      message: `Limit must be less than ${MAX_ASSET_LIMIT} `,
    })
    .nonnegative(),
  price: z
    .number({
      required_error: "Price must be entered as a number",
      invalid_type_error: "Price must be entered as a number",
    })
    .nonnegative()
    .min(0.01, {
      message: "Price must be greater than 0",
    })
    .default(2),
  priceUSD: z
    .number({
      required_error: "Price must be entered as a number",
      invalid_type_error: "Price must be entered as a number",
    })
    .nonnegative()
    .min(0.01, {
      message: "Price must be greater than 0",
    })
    .default(1),

  thumbnail: z.string(),
});

function NewPageAssetFrom({ requiredToken }: { requiredToken: number }) {
  const [signLoading, setSignLoading] = React.useState(false);
  const [uploading, setUploading] = useState(false);
  const [coverUrl, setCover] = useState<string>();
  const { isOpen, setIsOpen, paymentMethod } = usePaymentMethodStore();
  const { toast: shadToast } = useToast();
  const totalFeees = Number(TrxBaseFeeInPlatformAsset) + Number(PLATFORM_FEE);

  // pinta upload
  const [file, setFile] = useState<File>();
  const [ipfs, setCid] = useState<string>();

  const session = useSession();
  const { needSign } = useNeedSign();

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
    setValue,
    trigger,
    reset,
  } = useForm<z.infer<typeof CreatorPageAssetSchema>>({
    resolver: zodResolver(CreatorPageAssetSchema),
    defaultValues: {
      price: 2,
      priceUSD: 1,
    },
  });

  const mutation = api.fan.member.createCreatePageAsset.useMutation({
    onSuccess: () => {
      toast.success("Page Asset Created Successfully");
      setIsOpen(false);
      reset();
    },
  });

  // const assetAmount = api.fan.trx.getAssetNumberforXlm.useQuery();

  const trxMutation = api.fan.trx.createCreatorPageAsset.useMutation({
    onSuccess: async (data) => {
      setSignLoading(true);
      // sign the transaction for fbgoogle
      const toastId = toast.loading("Signing Transaction");

      clientsign({
        walletType: session.data?.user.walletType,
        presignedxdr: data.trx,
        pubkey: session.data?.user.id,
        test: clientSelect(),
      })
        .then((res) => {
          if (res) {
            mutation.mutate({
              code: getValues("code"),
              limit: getValues("limit"),
              issuer: data.escrow,
              thumbnail: getValues("thumbnail"),
              price: getValues("price"),
              priceUSD: getValues("priceUSD"),
            });
          } else {
            toast.error("Transaction failed", { id: toastId });
            shadToast({
              title: "Transaction failed",
              description: "Failed to sign transaction",
            });
          }
        })
        .catch((e) => {
          toast.error("Transaction failed", { id: toastId });
          shadToast({
            title: "Transaction failed",
          });
        })
        .finally(() => {
          toast.dismiss(toastId);
          setSignLoading(false);
        });
    },
    onError: (e) => {
      shadToast({
        title: "Transaction failed",
        description: e.message,
      });
    },
  });

  const onSubmit = async () => {
    if (ipfs) {
      trxMutation.mutate({
        ipfs,
        code: getValues("code"),
        signWith: needSign(),
        limit: getValues("limit"),
        method: paymentMethod,
      });
    } else {
      toast.error("Please upload a file");
    }
  };

  const loading = trxMutation.isLoading || mutation.isLoading || signLoading;

  const uploadFile = async (fileToUpload: File) => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", fileToUpload, fileToUpload.name);
      // console.log("formData", fileToUpload);
      const res = await fetch("/api/file", {
        method: "POST",
        body: formData,
      });
      const ipfsHash = await res.text();
      const thumbnail = ipfsHashToUrl(ipfsHash);
      setCover(thumbnail);
      setValue("thumbnail", thumbnail);
      setCid(ipfsHash);

      setUploading(false);
    } catch (e) {
      setUploading(false);
      alert("Trouble uploading file");
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    if (files) {
      if (files.length > 0) {
        const file = files[0];
        if (file) {
          if (file.size > 1024 * 1024) {
            toast.error("File size should be less than 1MB");
            return;
          }
          setFile(file);
          await uploadFile(file);
        }
      }
    }
  };
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-base-300 mb-2 mt-2 flex flex-col  items-center gap-2 rounded-md p-2"
    >
      <label className="form-control w-full px-2">
        <div className="label">
          <span className="label-text">Page Asset Name</span>
        </div>
        <input
          type="text"
          placeholder="Enter Page Asset Code"
          {...register("code")}
          className="input input-bordered w-full "
        />
        {errors.code && (
          <div className="label">
            <span className="label-text-alt text-warning">
              {errors.code.message}
            </span>
          </div>
        )}
      </label>

      <label className="form-control w-full px-2">
        <div className="label">
          <span className="label-text">Limit</span>
        </div>
        <input
          type="number"
          {...register("limit", { valueAsNumber: true })}
          min={1}
          max={MAX_ASSET_LIMIT}
          step={1}
          className="input input-bordered w-full"
          placeholder="Enter Asset Limit"
        />
        {errors.limit && (
          <div className="label">
            <span className="label-text-alt text-warning">
              {errors.limit.message}
            </span>
          </div>
        )}
      </label>
      <label className=" form-control w-full px-2 ">
        <div className="label">
          <span className="label-text">
            Price in $USD<span className="text-red-600">*</span>
          </span>
        </div>
        <input
          // disabled={trxdata?.successful ? true : false}
          type="number"
          {...register("priceUSD", { valueAsNumber: true })}
          className="input input-bordered w-full"
          placeholder="Enter Price in USD"
        />
        {errors.priceUSD && (
          <div className="label">
            <span className="label-text-alt text-warning">
              {errors.priceUSD.message}
            </span>
          </div>
        )}
      </label>
      <label className="form-control w-full px-2">
        <span className="label-text">
          Price in {PLATFORM_ASSET.code}
          <span className="text-red-600">*</span>
        </span>
        <input
          // disabled={trxdata?.successful ? true : false}
          type="number"
          {...register("price", { valueAsNumber: true })}
          className="input input-bordered w-full"
          placeholder={`Enter Price in ${PLATFORM_ASSET.code}`}
        />
        {errors.price && (
          <div className="label">
            <span className="label-text-alt text-warning">
              {errors.price.message}
            </span>
          </div>
        )}
      </label>
      <label className="form-control w-full px-2">
        <input
          type="file"
          id="file"
          accept=".jpg, .png"
          onChange={handleChange}
        />
        {uploading && (
          <progress className="progress mt-2 w-full px-2"></progress>
        )}
        {coverUrl && (
          <>
            <Image
              className="p-2"
              width={120}
              height={120}
              alt="preview image"
              src={coverUrl}
            />
          </>
        )}
      </label>

      <div className="px-2 text-sm">
        <Alert
          className=""
          type={mutation.error ? "warning" : "normal"}
          content={`To create this page token, you'll need ${requiredToken} ${PLATFORM_ASSET.code} for your Asset account.`}
        />
      </div>

      <PaymentChoose
        costBreakdown={[
          {
            label: "Cost",
            amount: paymentMethod === "asset" ? requiredToken - totalFeees : 2,
            type: "cost",
            highlighted: true,
          },
          {
            label: "Platform Fee",
            amount: paymentMethod === "asset" ? totalFeees : 2,
            highlighted: false,
            type: "fee",
          },
          {
            label: "Total Cost",
            amount: paymentMethod === "asset" ? requiredToken : 2 + 2,
            highlighted: false,
            type: "total",
          },
        ]}
        XLM_EQUIVALENT={2 + 2}
        handleConfirm={() => onSubmit()}
        loading={loading}
        requiredToken={requiredToken}
        beforeTrigger={async () => {
          const ok = await trigger();
          return ok;
        }}
        trigger={
          <Button className="w-full" disabled={loading || !ipfs}>
            Create Page Asset
          </Button>
        }
      />
    </form>
  );
}

export default NewPageAssetFrom;
