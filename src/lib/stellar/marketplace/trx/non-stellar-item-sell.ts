import { Asset, Horizon, Keypair, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { env } from "~/env";
import { StellarAccount } from "~/lib/stellar/marketplace/test/Account";
import {
  PLATFORM_ASSET,
  SIMPLIFIED_FEE,
  SIMPLIFIED_FEE_IN_XLM,
  STELLAR_URL,
  TrxBaseFee,
  networkPassphrase,
} from "../../constant";
import { SignUserType, WithSing } from "../../utils";

// A Non-Stellar item has no real Stellar asset to trustline/transfer, so this
// only builds the payment leg (buyer -> seller storage account). No trustline
// setup and no asset-transfer operation, unlike buildAssetBuyTransaction in
// page-asset-sell.ts.
async function buildNonStellarItemBuyTransaction({
  signWith,
  storagePub,
  userId,
  price,
  paymentAsset,
  xlm,
}: {
  signWith: SignUserType;
  storagePub: string;
  userId: string;
  price: number;
  paymentAsset: Asset;
  xlm?: boolean;
}) {
  try {
    const server = new Horizon.Server(STELLAR_URL);
    // for starting trx
    const motherKeypair = Keypair.fromSecret(env.MOTHER_SECRET);
    const motherAccount = await server.loadAccount(motherKeypair.publicKey());

    const userAccount = await StellarAccount.create(userId);

    let userBalance: number;
    if (paymentAsset.isNative()) {
      userBalance = Number(userAccount.getNativeBalance() ?? 0);
    } else {
      userBalance = userAccount.getTokenBalance(
        paymentAsset.code,
        paymentAsset.issuer,
      );
    }

    const totalFee = xlm ? SIMPLIFIED_FEE_IN_XLM : SIMPLIFIED_FEE;

    if (userBalance < price + totalFee) {
      throw new Error("User has insufficient balance for payment.");
    }

    const txBuilder = new TransactionBuilder(motherAccount, {
      fee: TrxBaseFee,
      networkPassphrase,
    });

    // Transfer payment from buyer to the seller's storage account
    txBuilder
      .addOperation(
        Operation.payment({
          destination: storagePub,
          amount: (price + totalFee).toFixed(7),
          asset: paymentAsset,
          source: userId,
        }),
      )
      .setTimeout(0);

    const buildTrx = txBuilder.build();
    buildTrx.sign(motherKeypair);
    const xdr = buildTrx.toXDR();

    const signedXdr = await WithSing({
      xdr,
      signWith,
    });

    return signedXdr;
  } catch (error) {
    console.error("Error building non-stellar item buy transaction:", error);
    throw error;
  }
}

// Buy using platform asset
export const GetNonStellarItemBuyXDRInPlatform = async (params: {
  storagePub: string;
  price: number;
  userId: string;
  signWith: SignUserType;
}) => {
  return await buildNonStellarItemBuyTransaction({
    ...params,
    paymentAsset: PLATFORM_ASSET,
  });
};

// Buy using native XLM
export const GetNonStellarItemBuyXDRInXLM = async (params: {
  storagePub: string;
  priceXLM: number;
  userId: string;
  signWith: SignUserType;
}) => {
  const { priceXLM, ...rest } = params;
  return await buildNonStellarItemBuyTransaction({
    ...rest,
    price: priceXLM,
    paymentAsset: Asset.native(),
    xlm: true,
  });
};
