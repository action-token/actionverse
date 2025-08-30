import {
  Asset,
  Horizon,
  Keypair,
  Operation,
  TransactionBuilder,
  Transaction,
} from "@stellar/stellar-sdk";
import { env } from "~/env";
import { StellarAccount } from "~/lib/stellar/marketplace/test/Account";
import {
  PLATFORM_ASSET,
  PLATFORM_FEE,
  SIMPLIFIED_FEE,
  SIMPLIFIED_FEE_IN_XLM,
  STELLAR_URL,
  TrxBaseFee,
  TrxBaseFeeInPlatformAsset,
  networkPassphrase,
} from "../../constant";
import { SignUserType, WithSing } from "../../utils";
import { getplatformAssetNumberForXLM } from "../../fan/get_token_price";

// Shared helper for building and signing transaction
async function buildAssetBuyTransaction({
  signWith,
  code,
  amountToSell,
  issuer,
  storageSecret,
  userId,
  price,
  paymentAsset,
  xlm,
}: {
  signWith: SignUserType;
  code: string;
  amountToSell: number;
  issuer: string;
  price: number;
  storageSecret: string;
  userId: string;
  paymentAsset: Asset;
  xlm?: boolean;
}) {
  try {
    const assetToBuy = new Asset(code, issuer);
    const server = new Horizon.Server(STELLAR_URL);
    // for starting trx
    const motherKeypair = Keypair.fromSecret(env.MOTHER_SECRET);
    const motherAccount = await server.loadAccount(motherKeypair.publicKey());

    const storageKeypair = Keypair.fromSecret(storageSecret);
    const storageAccount = await StellarAccount.create(
      storageKeypair.publicKey(),
    );

    const userAccount = await StellarAccount.create(userId);
    console.log("Storage account:", storageAccount);
    // Validate trustline
    const hasTrust = userAccount.hasTrustline(
      assetToBuy.code,
      assetToBuy.issuer,
    );

    // Validate balances
    let storageBalance;
    if (assetToBuy.isNative()) {
      storageBalance = Number(storageAccount.getNativeBalance());
    } else {
      storageBalance = storageAccount.getTokenBalance(
        assetToBuy.code,
        assetToBuy.issuer,
      );
    }
    console.log(
      "Storage balance:",
      storageBalance,
      storageSecret,
      assetToBuy.code,
      assetToBuy.issuer,
    );
    if (storageBalance < amountToSell) {
      throw new Error("Insufficient asset balance in storage account.");
    }

    let userBalance;
    if (paymentAsset.isNative()) {
      userBalance = Number(userAccount.getNativeBalance());
    } else {
      userBalance = userAccount.getTokenBalance(
        paymentAsset.code,
        paymentAsset.issuer,
      );
    }

    if (userBalance < price) {
      throw new Error("User has insufficient balance for payment.");
    }

    // calculate fee for xlm and platform asset
    let totalFee = 0;
    const trxXlmRequired = hasTrust ? 0.5 : 0; // xlm required for trustline

    if (xlm) {
      totalFee = trxXlmRequired + SIMPLIFIED_FEE_IN_XLM;
    } else {
      const requiredAsset2refundXlm =
        await getplatformAssetNumberForXLM(trxXlmRequired);
      totalFee = requiredAsset2refundXlm + SIMPLIFIED_FEE;
    }

    const txBuilder = new TransactionBuilder(motherAccount, {
      fee: TrxBaseFee,
      networkPassphrase,
    });

    // Add trustline if missing
    if (!hasTrust) {
      console.log("don't have trustline, adding it");

      txBuilder
        .addOperation(
          Operation.payment({
            destination: userId,
            amount: "0.5",
            asset: Asset.native(),
            source: motherKeypair.publicKey(),
          }),
        )
        .addOperation(
          Operation.changeTrust({
            asset: assetToBuy,
            source: userId,
          }),
        );
    }

    // Transfer asset to user
    txBuilder
      .addOperation(
        Operation.payment({
          destination: userId,
          asset: assetToBuy,
          source: storageKeypair.publicKey(),
          amount: amountToSell.toFixed(7),
        }),
      )
      .addOperation(
        Operation.payment({
          destination: storageKeypair.publicKey(),
          asset: paymentAsset,
          source: userId,
          amount: (price + totalFee).toFixed(7),
        }),
      )
      .setTimeout(0);
    const buildTrx = txBuilder.build();
    buildTrx.sign(motherKeypair, storageKeypair);
    const xdr = buildTrx.toXDR();

    const singedXdr = await WithSing({
      xdr,
      signWith,
    });

    return {
      xdr: singedXdr,
    };
  } catch (error) {
    console.error("Error building asset buy transaction:", error);
    throw error;
  }
}

// Buy using platform asset
export const GetPageAssetBuyXDRInPlatform = async (params: {
  code: string;
  amountToSell: number;
  issuer: string;
  price: number;
  storageSecret: string;
  userId: string;
  signWith: SignUserType;
}) => {
  return await buildAssetBuyTransaction({
    ...params,
    paymentAsset: PLATFORM_ASSET,
  });
};

// Buy using native XLM
export const GetPageAssetBuyXDRInXLM = async (params: {
  code: string;
  amountToSell: number;
  issuer: string;
  priceXLM: number;
  storageSecret: string;
  userId: string;
  signWith: SignUserType;
}) => {
  const { priceXLM, ...rest } = params;
  return await buildAssetBuyTransaction({
    ...rest,
    price: priceXLM,
    paymentAsset: Asset.native(),
    xlm: true,
  });
};
