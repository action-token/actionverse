import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Operation,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import {
  networkPassphrase,
  PLATFORM_ASSET,
  PLATFORM_FEE,
  STELLAR_URL,
  TrxBaseFee,
  TrxBaseFeeInPlatformAsset,
} from "../constant";
import { MOTHER_SECRET } from "../marketplace/SECRET";
import { SignUserType, WithSing } from "../utils";

export async function SendBountyBalanceGenericToMother({
  prize,
  signWith,
  userPubKey,
  assetCode,
  assetIssuer,
  fromCreatorStorage,
  storageSecret,
}: {
  prize: number;
  signWith: SignUserType;
  userPubKey: string;
  assetCode: string;
  assetIssuer: string | null;
  fromCreatorStorage?: boolean;
  storageSecret?: string;
}) {
  const server = new Horizon.Server(STELLAR_URL);
  const motherAcc = Keypair.fromSecret(MOTHER_SECRET);

  const sourceKey =
    fromCreatorStorage && storageSecret ? Keypair.fromSecret(storageSecret) : null;
  const sourcePubKey = sourceKey ? sourceKey.publicKey() : userPubKey;

  const account = await server.loadAccount(motherAcc.publicKey());
  const asset = assetIssuer ? new Asset(assetCode, assetIssuer) : Asset.native();
  // const totalAmount = prize + fees;
  const totalAmount = prize;
  const transaction = new TransactionBuilder(account, {
    fee: TrxBaseFee,
    networkPassphrase,
  });

  // If the asset is a credit asset and the mother account doesn't yet have a
  // trustline for it, add changeTrust in the same transaction. The mother
  // account is already signing, so trust is established atomically.
  if (assetIssuer) {
    const hasTrust = account.balances.some(
      (b) =>
        (b.asset_type === "credit_alphanum4" || b.asset_type === "credit_alphanum12") &&
        b.asset_code === assetCode &&
        b.asset_issuer === assetIssuer,
    );
    if (!hasTrust) {
      transaction.addOperation(
        Operation.changeTrust({
          asset,
          source: motherAcc.publicKey(),
        }),
      );
    }
  }

  transaction.addOperation(
    Operation.payment({
      destination: motherAcc.publicKey(),
      asset,
      amount: totalAmount.toFixed(7),
      source: sourcePubKey,
    }),
  );
  transaction.setTimeout(0);

  const buildTrx = transaction.build();
  buildTrx.sign(motherAcc);

  if (sourceKey) {
    buildTrx.sign(sourceKey);
    return { xdr: buildTrx.toXDR(), pubKey: userPubKey, fullySignedByServer: true };
  }

  if (signWith && "email" in signWith) {
    const signedXdr = await WithSing({ xdr: buildTrx.toXDR(), signWith });
    return { xdr: signedXdr, pubKey: userPubKey, fullySignedByServer: false };
  }
  return { xdr: buildTrx.toXDR(), pubKey: userPubKey, fullySignedByServer: false };
}







export async function claimRewardForUser({
  pubKey,
  rewardAmount,
  assetCode,
  assetIssuer,
  signWith,
}: {
  pubKey: string;
  rewardAmount: number;
  assetCode: string;
  assetIssuer: string | null | undefined;
  signWith: SignUserType;
}): Promise<{ xdr: string; needsUserSign: boolean }> {
  const server = new Horizon.Server(STELLAR_URL);
  const motherAcc = Keypair.fromSecret(MOTHER_SECRET);

  // Verify user account exists (is activated)
  try {
    await server.loadAccount(pubKey);
  } catch {
    throw new Error("Your Stellar account is not activated. Please fund it with XLM first.");
  }

  const account = await server.loadAccount(motherAcc.publicKey());
  const asset = assetIssuer ? new Asset(assetCode, assetIssuer) : Asset.native();

  // Check mother has sufficient balance
  if (assetIssuer) {
    const motherBalance = account.balances.find(
      (b) =>
        (b.asset_type === "credit_alphanum4" || b.asset_type === "credit_alphanum12") &&
        b.asset_code === assetCode &&
        b.asset_issuer === assetIssuer,
    );
    if (!motherBalance || parseFloat(motherBalance.balance) < rewardAmount) {
      throw new Error("Mother wallet has insufficient balance to pay the reward.");
    }
  } else {
    const xlmBalance = account.balances.find((b) => b.asset_type === "native");
    if (!xlmBalance || parseFloat(xlmBalance.balance) < rewardAmount + 1) {
      throw new Error("Mother wallet has insufficient XLM balance to pay the reward.");
    }
  }

  // Check if user has a trustline for non-native assets
  let userHasTrust = true;
  if (assetIssuer) {
    const userAcc = await server.loadAccount(pubKey);
    userHasTrust = userAcc.balances.some(
      (b) =>
        (b.asset_type === "credit_alphanum4" || b.asset_type === "credit_alphanum12") &&
        b.asset_code === assetCode &&
        b.asset_issuer === assetIssuer,
    );
  }

  const transaction = new TransactionBuilder(account, {
    fee: TrxBaseFee,
    networkPassphrase,
  });

  // If user lacks trust, add changeTrust op that the user must sign
  if (!userHasTrust && assetIssuer) {
    transaction.addOperation(
      Operation.changeTrust({ asset, source: pubKey }),
    );
  }

  transaction.addOperation(
    Operation.payment({
      destination: pubKey,
      source: motherAcc.publicKey(),
      asset,
      amount: rewardAmount.toFixed(7),
    }),
  );
  transaction.setTimeout(0);

  const buildTrx = transaction.build();
  buildTrx.sign(motherAcc);

  const needsUserSign = !userHasTrust && !!assetIssuer;

  // For email-based wallets, sign changeTrust server-side so client doesn't need to
  if (needsUserSign && signWith && "email" in signWith) {
    const signedXdr = await WithSing({ xdr: buildTrx.toXDR(), signWith });
    return { xdr: signedXdr, needsUserSign: false };
  }

  return { xdr: buildTrx.toXDR(), needsUserSign };
}





export async function NativeBalance({ userPub }: { userPub: string }) {
  const server = new Horizon.Server(STELLAR_URL);

  const account = await server.loadAccount(userPub);

  const nativeBalance = account.balances.find((balance) => {
    if (balance.asset_type === "native") {
      return balance;
    }
  });

  return nativeBalance;
}








