import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { clientsign } from "package/connect_wallet";
import React from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import Alert from "~/components/common/alert";
import useNeedSign from "~/lib/hook";
import { clientSelect } from "~/lib/stellar/fan/utils";
import { api } from "~/utils/api";

import { Button } from "~/components/shadcn/ui/button";
import { PLATFORM_ASSET } from "~/lib/stellar/constant";

export const CreatorCustomPageAssetSchema = z.object({
  code: z
    .string()
    .min(4, { message: "Must be a minimum of 4 characters" })
    .max(12, { message: "Must be a maximum of 12 characters" })
    .refine(
      (value) => {
        return /^\w+$/.test(value);
      },
      {
        message: "Input must be a single word",
      },
    ),
  issuer: z.string().length(56),
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
});

function CustomPageAssetFrom({ requiredToken }: { requiredToken: number }) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [signLoading, setSignLoading] = React.useState(false);
  const [xdr, setXDR] = React.useState<string | true>();

  const session = useSession();
  const { needSign } = useNeedSign();

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
    setValue,
    reset,
  } = useForm<z.infer<typeof CreatorCustomPageAssetSchema>>({
    resolver: zodResolver(CreatorCustomPageAssetSchema),
    defaultValues: {
      price: 2,
      priceUSD: 1,
    },
  });

  const mutation = api.fan.member.createCustomPageAsset.useMutation({
    onSuccess: () => {
      toast.success("Page Asset Created Successfully");
      reset();
    },
    onError: (error) => {
      toast.error(`error ${error.message}`);
    },
  });

  const xdrMutation = api.fan.trx.trustCustomPageAssetXDR.useMutation({
    onSuccess: (data) => {
      setXDR(data);
      console.log("data", data);
    },
    onError: (error) => {
      toast.error(`error ${error.message}`);
    },
  });

  // const assetAmount = api.fan.trx.getAssetNumberforXlm.useQuery();

  const onSubmit: SubmitHandler<
    z.infer<typeof CreatorCustomPageAssetSchema>
  > = (data) => {
    xdrMutation.mutate({ ...data, signWith: needSign() });
  };

  const loading = isModalOpen || mutation.isLoading || signLoading;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-base-300 mb-2 mt-2 flex flex-col  items-center gap-2 rounded-md p-2"
    >
      <label className="form-control w-full px-2">
        <div className="label">
          <span className="label-text">Page Asset Code</span>
        </div>
        <input
          type="text"
          placeholder="Enter page asset code"
          {...register("code")}
          className="input input-bordered w-full"
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
          <span className="label-text">Issuer</span>
        </div>
        <input
          {...register("issuer")}
          className="input input-bordered w-full"
          placeholder="Enter issuer address"
        />
        {errors.issuer && (
          <div className="label">
            <span className="label-text-alt text-warning">
              {errors.issuer.message}
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
      <div className="px-2 text-sm">
        <Alert
          type={mutation.error ? "warning" : "normal"}
          //   content={`To create this page token, you'll need ${requiredToken} ${PLATFROM_ASSET.code} for your Asset account. Additionally, there's a platform fee of ${PLATFROM_FEE} ${PLATFROM_ASSET.code}. Total: ${requiredToken + Number(PLATFROM_FEE)}`}
          content={`You might not be able to change your page asset in future. Please enter the information very carefully`}
        />
      </div>
      <ActionButton />
    </form>
  );

  function ActionButton() {
    if (xdr) {
      return (
        <button
          className="btn btn-primary mt-2 w-full max-w-xs"
          type="button"
          disabled={loading}
          onClick={() => {
            setSignLoading(true);
            if (xdr === true) {
              mutation.mutate(getValues());
            } else {
              clientsign({
                presignedxdr: xdr,
                pubkey: session.data?.user.id,
                walletType: session.data?.user.walletType,
                test: clientSelect(),
              })
                .then((res) => {
                  if (res) {
                    mutation.mutate(getValues());
                  } else {
                    toast.error("Transaction Failed");
                  }
                })
                .catch((e) => console.log(e))
                .finally(() => setSignLoading(false));
            }
          }}
        >
          {loading && <span className="loading loading-spinner"></span>}
          Set Page Asset
        </button>
      );
    } else {
      return (
        <Button
          className="w-full"
          type="submit"
          disabled={xdrMutation.isLoading || loading}
        >
          Proceed
        </Button>
      );
    }
  }
}

export default CustomPageAssetFrom;
