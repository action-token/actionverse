"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { MediaType } from "@prisma/client";
import clsx from "clsx";
import { X } from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { clientsign } from "package/connect_wallet";
import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import Alert from "~/components/common/alert";
import { Editor } from "~/components/common/editor";
import {
  PaymentChoose,
  usePaymentMethodStore,
} from "~/components/payment/payment-options";
import { Button } from "~/components/shadcn/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/shadcn/ui/card";

import useNeedSign from "~/lib/hook";
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances";
import {
  PLATFORM_ASSET,
  PLATFORM_FEE,
  TrxBaseFeeInPlatformAsset,
} from "~/lib/stellar/constant";
import { clientSelect } from "~/lib/stellar/fan/utils";
import { UploadS3Button } from "~/pages/test";
import { api } from "~/utils/api";
import { MediaInfo } from "../CreatPost";

export const BountySchema = z.object({
  title: z
    .string()
    .max(65, {
      message: "Title can't be more than 65 characters",
    })
    .min(1, { message: "Title can't be empty" }),
  totalWinner: z
    .number({
      required_error: "Total Winner must be a number",
      invalid_type_error: "Total Winner must be a number",
    })
    .min(1, { message: "Please select at least 1 winner" }),
  prizeInUSD: z
    .number({
      required_error: "Prize  must be a number",
      invalid_type_error: "Prize must be a number",
    })
    .min(0.00001, { message: "Prize can't less than 0.00001" }),
  prize: z
    .number({
      required_error: "Prize  must be a number",
      invalid_type_error: "Prize must be a number",
    })
    .min(0.00001, { message: "Prize can't less than 0.00001" }),
  requiredBalance: z
    .number({
      required_error: "Required Balance  must be a number",
      invalid_type_error: "Required Balance must be a number",
    })
    .nonnegative({ message: "Required Balance can't be less than 0" })
    .optional(),

  content: z.string().min(2, { message: "Description can't be empty" }),
  medias: z.array(MediaInfo).optional(),
});

type MediaInfoType = z.TypeOf<typeof MediaInfo>;

const CreateBounty = () => {
  const [media, setMedia] = useState<MediaInfoType[]>([]);
  const [wantMediaType, setWantMedia] = useState<MediaType>();
  const [loading, setLoading] = useState(false);
  const { needSign } = useNeedSign();
  const session = useSession();
  const [prizeInAsset, setPrizeInAsset] = useState<number>(0);
  const { platformAssetBalance } = useUserStellarAcc();
  const [isDialogOpen, setIsDialogOpen] = useState(false); // State to control modal

  const { isOpen, setIsOpen, paymentMethod } = usePaymentMethodStore();

  const totalFeees =
    2 * Number(TrxBaseFeeInPlatformAsset) + Number(PLATFORM_FEE);

  // console.log("platformAssetBalance", platformAssetBalance);
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    reset,
    trigger,
    formState: { errors, isValid },
  } = useForm<z.infer<typeof BountySchema>>({
    resolver: zodResolver(BountySchema),
    mode: "onChange",
    defaultValues: {
      content: "",
      title: "",
    },
  });

  const utils = api.useUtils();
  const CreateBountyMutation = api.bounty.Bounty.createBounty.useMutation({
    onSuccess: async (data) => {
      toast.success("Bounty Created");
      setIsDialogOpen(false);
      setPrizeInAsset(0);
      utils.bounty.Bounty.getAllBounties.refetch().catch((error) => {
        console.error("Error refetching bounties", error);
      });
    },
  });

  const SendBalanceToBountyMother =
    api.bounty.Bounty.sendBountyBalanceToMotherAcc.useMutation({
      onSuccess: async (data, { method }) => {
        if (data) {
          try {
            setLoading(true);
            const clientResponse = await clientsign({
              presignedxdr: data.xdr,
              walletType: session.data?.user?.walletType,
              pubkey: data.pubKey,
              test: clientSelect(),
            });
            if (clientResponse) {
              setLoading(true);
              CreateBountyMutation.mutate({
                title: getValues("title"),
                prizeInUSD: getValues("prizeInUSD"),
                totalWinner: getValues("totalWinner"),
                prize: getValues("prize"),
                requiredBalance: getValues("requiredBalance") ?? 0,
                priceInXLM:
                  method === "xlm"
                    ? getPlatformAssetToXLM.data?.priceInXLM
                    : undefined,
                content: getValues("content"),
                medias: media,
              });
              setLoading(false);
              reset();
              setMedia([]);
            } else {
              setLoading(false);
              reset();
              toast.error("Error in signing transaction");
              setMedia([]);
            }
            setIsOpen(false);
          } catch (error) {
            setLoading(false);
            console.error("Error sending balance to bounty mother", error);
            reset();
            toast.success("Bounty Created");
            setMedia([]);
          }
        }
      },
      onError: (error) => {
        console.error("Error creating bounty", error);
        toast.error(error.message);
        reset();
        setMedia([]);
        setLoading(false);
        setIsOpen(false);
      },
    });
  const onSubmit: SubmitHandler<z.infer<typeof BountySchema>> = (data) => {
    data.medias = media;
    setLoading(true);
    SendBalanceToBountyMother.mutate({
      signWith: needSign(),
      prize: data.prize,
      method: paymentMethod,
      costInXLM: getPlatformAssetToXLM.data?.costInXLM ?? 0,
    });
    setLoading(false);
  };

  const addMediaItem = (url: string, type: MediaType) => {
    setMedia((prevMedia) => [...prevMedia, { url, type }]);
  };
  function handleEditorChange(value: string): void {
    setValue("content", value);
  }

  const RequiredBalance = 5;
  const isCardDisabled = platformAssetBalance < RequiredBalance;
  const removeMediaItem = (index: number) => {
    setMedia((prevMedia) => prevMedia.filter((_, i) => i !== index));
  };

  //OnlyForWadzzo
  const prize = 0.01;

  const getPlatformAssetToXLM =
    api.marketplace.steller.getPlatformAssetToXLM.useQuery({
      price: prizeInAsset,
      cost: totalFeees,
    });
  return (
    <>
      {isCardDisabled ? (
        <Alert
          className="flex  items-center justify-center"
          type="error"
          // variant={"destructive"}
          content={`You don't have Sufficient Balance ,To create bounty , you need minimum ${RequiredBalance} ${PLATFORM_ASSET.code} `}
        />
      ) : (
        <div className="flex  w-full  justify-center">
          <Card
            className={clsx("w-full  md:px-8", {
              "blur-sm": isCardDisabled,
            })}
          >
            <CardHeader>
              <CardTitle className="text-center">
                Create a new Bounty{" "}
              </CardTitle>
              <CardDescription></CardDescription>
            </CardHeader>
            <CardContent className="px-1">
              <form
                onSubmit={handleSubmit(onSubmit)}
                className="bg-base-200 flex w-full flex-col gap-4 rounded-3xl p-5"
              >
                <label className="form-control w-full ">
                  <input
                    maxLength={65}
                    readOnly={loading}
                    type="text"
                    placeholder="Add a Title..."
                    {...register("title")}
                    className="input input-bordered w-full "
                  />
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>
                      {getValues("title").length >= 65 && (
                        <div className="text-left text-sm text-red-500">
                          You have reached the maximum character limit.
                        </div>
                      )}
                    </span>
                    {/* <span className=""> {getValues("title").length}/65 characters</span> */}
                  </div>

                  {errors.title && (
                    <div className="label">
                      <span className="label-text-alt text-warning">
                        {errors.title.message}
                      </span>
                    </div>
                  )}
                </label>
                <div className="h-[240px]">
                  {/* <textarea
                {...register("content")}
                className="textarea textarea-bordered h-48"
                placeholder="Add a Description..."
              ></textarea> */}
                  <Editor
                    height="200px"
                    value={getValues("content")}
                    onChange={handleEditorChange}
                    placeholder="Add a Description..."
                  />

                  {errors.content && (
                    <div className="label">
                      <span className="label-text-alt text-warning">
                        {errors.content.message}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex flex-col items-center gap-2">
                    <div className=" mt-2 flex w-full flex-col  gap-2 sm:flex-row">
                      <label className="mb-1 w-full text-xs tracking-wide text-gray-600 sm:text-sm">
                        Prize in $USD*
                        <input
                          step={0.00001}
                          readOnly={loading}
                          onChange={(e) => {
                            const value = e.target.value;
                            setValue("prizeInUSD", Number(value));
                            setValue("prize", Number(value) / Number(prize));
                            setPrizeInAsset(Number(value) / Number(prize));
                          }}
                          className="input input-bordered   w-full"
                          type="number"
                          placeholder=""
                        />
                        {errors.prizeInUSD && (
                          <div className="label">
                            <span className="label-text-alt text-warning">
                              {errors.prizeInUSD.message}
                            </span>
                          </div>
                        )}
                      </label>
                      <label className="mb-1 w-full text-xs tracking-wide text-gray-600 sm:text-sm">
                        Prize in {PLATFORM_ASSET.code}*
                        <input
                          readOnly
                          type="number"
                          {...register("prize")}
                          className="input input-bordered   w-full"
                        />
                        {errors.prize && (
                          <div className="label">
                            <span className="label-text-alt text-warning">
                              {errors.prize.message}
                            </span>
                          </div>
                        )}
                      </label>
                    </div>

                    <div className=" flex w-full flex-col gap-2  md:flex-row">
                      <label className=" mb-1 w-full text-xs tracking-wide text-gray-600 sm:text-sm">
                        Required Balance to Join this Bounty in{" "}
                        {PLATFORM_ASSET.code}*
                        <input
                          readOnly={loading}
                          type="number"
                          step={0.00001}
                          {...register("requiredBalance", {
                            valueAsNumber: true,
                          })}
                          className="input input-bordered   w-full"
                        />
                        {errors.requiredBalance && (
                          <div className="label">
                            <span className="label-text-alt text-warning">
                              {errors.requiredBalance.message}
                            </span>
                          </div>
                        )}
                      </label>
                      <label className=" mb-1 w-full text-xs tracking-wide text-gray-600 sm:text-sm">
                        How many winners will be selected?*
                        <input
                          readOnly={loading}
                          type="number"
                          step={1}
                          {...register("totalWinner", {
                            valueAsNumber: true,
                          })}
                          className="input input-bordered   w-full"
                        />
                        {errors.totalWinner && (
                          <div className="label">
                            <span className="label-text-alt text-warning">
                              {errors.totalWinner.message}
                            </span>
                          </div>
                        )}
                      </label>
                    </div>
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {media.map((item, index) => (
                          <div key={index} className="relative">
                            <Image
                              src={item.url}
                              alt={`Uploaded media ${index + 1}`}
                              width={100}
                              height={100}
                              className="rounded-md object-cover"
                            />
                            <Button
                              size="icon"
                              variant="destructive"
                              className="absolute -right-2 -top-2 h-6 w-6"
                              onClick={() => removeMediaItem(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      {media.length >= 4 && (
                        <p className="text-sm text-red-500">
                          Maximum number of uploads reached.
                        </p>
                      )}
                    </div>

                    <div>
                      <span className="text-start">
                        Choose Bounty Thumbnail
                      </span>
                      <UploadS3Button
                        disabled={
                          media.length >= 4 || isCardDisabled || loading
                        }
                        endpoint="imageUploader"
                        onClientUploadComplete={(res) => {
                          const data = res;

                          if (data?.url) {
                            addMediaItem(data.url, wantMediaType!);
                            trigger().catch((e) => console.log(e));
                            setWantMedia(undefined);
                          }
                        }}
                        onUploadError={(error: Error) => {
                          // Do something with the error.
                          toast.error(`ERROR! ${error.message}`);
                        }}
                      />
                    </div>
                  </div>
                </div>{" "}
                <CardFooter className="flex w-full justify-between">
                  {platformAssetBalance < prizeInAsset + totalFeees ? (
                    <Alert
                      type="error"
                      className="w-full text-center"
                      content={`You don't have Sufficient Balance ,To  create this bounty, you need minimum ${prizeInAsset + totalFeees} ${PLATFORM_ASSET.code},`}
                    />
                  ) : (
                    <div className="flex w-full flex-col gap-2">
                      <PaymentChoose
                        costBreakdown={[
                          {
                            label: "Cost",
                            amount:
                              paymentMethod === "asset"
                                ? prizeInAsset
                                : (getPlatformAssetToXLM.data?.priceInXLM ?? 0),
                            highlighted: true,
                            type: "cost",
                          },
                          {
                            label: "Platform Fee",
                            amount:
                              paymentMethod === "asset"
                                ? totalFeees
                                : (getPlatformAssetToXLM.data?.costInXLM ?? 0),
                            highlighted: false,
                            type: "fee",
                          },
                          {
                            label: "Total Cost",
                            amount:
                              paymentMethod === "asset"
                                ? prizeInAsset + totalFeees
                                : (getPlatformAssetToXLM.data?.costInXLM ?? 0) +
                                  (getPlatformAssetToXLM.data?.priceInXLM ?? 0),
                            highlighted: false,
                            type: "total",
                          },
                        ]}
                        XLM_EQUIVALENT={
                          (getPlatformAssetToXLM.data?.costInXLM ?? 0) +
                          (getPlatformAssetToXLM.data?.priceInXLM ?? 0)
                        }
                        handleConfirm={handleSubmit(onSubmit)}
                        loading={loading}
                        requiredToken={prizeInAsset + totalFeees}
                        trigger={
                          <Button
                            disabled={loading || !isValid}
                            className="w-full"
                          >
                            Create
                          </Button>
                        }
                      />

                      <Alert
                        type="success"
                        className="w-full text-center"
                        content={`
                          Note: You will be charged ${prizeInAsset + totalFeees} ${PLATFORM_ASSET.code} to create this bounty
                          `}
                      />
                    </div>
                  )}
                </CardFooter>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};
export default CreateBounty;
