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
import { getAssetToUSDCRate, getPlatformAssetPrice } from "../fan/get_token_price";

import { USDC_ASSET_CODE, USDC_ISSUER } from "~/lib/usdc"

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

export async function SendBountyBalanceToMotherAccountViaAsset({
  prize,
  signWith,
  userPubKey,
  secretKey,
  fees,
}: {
  prize: number;
  fees: number;
  signWith: SignUserType;
  userPubKey: string;
  secretKey?: string | undefined;
}) {
  const server = new Horizon.Server(STELLAR_URL);
  const motherAcc = Keypair.fromSecret(MOTHER_SECRET);
  const account = await server.loadAccount(motherAcc.publicKey());

  const transaction = new TransactionBuilder(account, {
    fee: TrxBaseFee,
    networkPassphrase,
  });

  const totalAmount = prize + fees;

  transaction.addOperation(
    Operation.payment({
      destination: motherAcc.publicKey(),
      asset: PLATFORM_ASSET,
      amount: totalAmount.toFixed(7).toString(),
      source: userPubKey,
    }),
  );
  transaction.setTimeout(0);

  const buildTrx = transaction.build();
  buildTrx.sign(motherAcc);

  if (signWith && "email" in signWith && secretKey) {
    const xdr = buildTrx.toXDR();
    const signedXDr = await WithSing({
      xdr: xdr,
      signWith: signWith,
    });
    return { xdr: signedXDr, pubKey: userPubKey };
  }
  return { xdr: buildTrx.toXDR(), pubKey: userPubKey };
}
export async function SendBountyBalanceToMotherAccountViaUSDC({
  prize,
  signWith,
  userPubKey,
  secretKey,
  fees,
}: {
  prize: number;
  fees: number;
  signWith: SignUserType;
  userPubKey: string;
  secretKey?: string | undefined;
}) {
  const server = new Horizon.Server(STELLAR_URL);
  const motherAcc = Keypair.fromSecret(MOTHER_SECRET);
  const account = await server.loadAccount(motherAcc.publicKey());
  const USDC = new Asset(USDC_ASSET_CODE, USDC_ISSUER);
  const transaction = new TransactionBuilder(account, {
    fee: TrxBaseFee,
    networkPassphrase,
  });

  transaction.addOperation(
    Operation.payment({
      destination: motherAcc.publicKey(),
      asset: USDC,
      amount: (prize + fees).toFixed(7).toString(),
      source: userPubKey,
    }),
  );
  transaction.setTimeout(0);

  const buildTrx = transaction.build();
  buildTrx.sign(motherAcc);

  if (signWith && "email" in signWith && secretKey) {
    const xdr = buildTrx.toXDR();
    const signedXDr = await WithSing({
      xdr: xdr,
      signWith: signWith,
    });
    return { xdr: signedXDr, pubKey: userPubKey };
  }
  return { xdr: buildTrx.toXDR(), pubKey: userPubKey };
}
export async function SendBountyBalanceToMotherAccountViaXLM({
  prizeInXLM,
  signWith,
  userPubKey,
  secretKey,
  fees,
}: {
  prizeInXLM: number;
  signWith: SignUserType;
  userPubKey: string;
  secretKey?: string | undefined;
  fees: number;
}) {
  const server = new Horizon.Server(STELLAR_URL);
  const motherAcc = Keypair.fromSecret(MOTHER_SECRET);

  const account = await server.loadAccount(userPubKey);

  const transaction = new TransactionBuilder(account, {
    fee: TrxBaseFee,
    networkPassphrase,
  });

  const totalAmount = prizeInXLM + fees;

  transaction.addOperation(
    Operation.payment({
      destination: motherAcc.publicKey(),
      asset: Asset.native(),
      amount: totalAmount.toFixed(7).toString(),
    }),
  );
  transaction.setTimeout(0);

  const buildTrx = transaction.build();
  buildTrx.sign(motherAcc);

  if (signWith && "email" in signWith && secretKey) {
    const xdr = buildTrx.toXDR();
    const signedXDr = await WithSing({
      xdr: xdr,
      signWith: signWith,
    });
    return { xdr: signedXDr, pubKey: userPubKey };
  }
  return { xdr: buildTrx.toXDR(), pubKey: userPubKey };
}

export async function SendBountyBalanceToUserAccount({
  prize,
  userPubKey,
}: {
  prize: number;
  userPubKey: string;
}) {
  const server = new Horizon.Server(STELLAR_URL);
  const motherAcc = Keypair.fromSecret(MOTHER_SECRET);
  const account = await server.loadAccount(motherAcc.publicKey());

  const platformAssetBalance = account.balances.find((balance) => {
    if (
      balance.asset_type === "credit_alphanum4" ||
      balance.asset_type === "credit_alphanum12"
    ) {
      return balance.asset_code === PLATFORM_ASSET.code && balance.asset_issuer === PLATFORM_ASSET.issuer
    }
    return false;
  });
  //console.log("platformAssetBalance.............", platformAssetBalance);

  if (
    !platformAssetBalance ||
    parseFloat(platformAssetBalance.balance) < prize
  ) {
    throw new Error("Balance is not enough to send the asset.");
  }

  const XLMBalance = await NativeBalance({ userPub: motherAcc.publicKey() });

  if (!XLMBalance?.balance || parseFloat(XLMBalance.balance) < 1.0) {
    throw new Error(
      "Please make sure you have at least 1 XLM in your account.",
    );
  }

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE.toString(),
    networkPassphrase,
  });

  transaction.addOperation(
    Operation.payment({
      destination: userPubKey,
      source: motherAcc.publicKey(),
      asset: PLATFORM_ASSET,
      amount: prize.toFixed(7).toString(),
    }),
  );
  transaction.setTimeout(0);

  const buildTrx = transaction.build();
  buildTrx.sign(motherAcc);
  return buildTrx.toXDR();
}
export async function SendBountyBalanceToUserAccountUSDC({
  prize,
  userPubKey,
}: {
  prize: number;
  userPubKey: string;
}) {
  const server = new Horizon.Server(STELLAR_URL);
  const motherAcc = Keypair.fromSecret(MOTHER_SECRET);
  const account = await server.loadAccount(motherAcc.publicKey());

  const platformAssetBalance = account.balances.find((balance) => {
    if (
      balance.asset_type === "credit_alphanum4" ||
      balance.asset_type === "credit_alphanum12"
    ) {
      return balance.asset_code === USDC_ASSET_CODE && balance.asset_issuer === USDC_ISSUER;
    }
    return false;
  });
  //console.log("platformAssetBalance.............", platformAssetBalance);

  if (
    !platformAssetBalance ||
    parseFloat(platformAssetBalance.balance) < prize
  ) {
    throw new Error("Balance is not enough to send the asset.");
  }

  const XLMBalance = await NativeBalance({ userPub: motherAcc.publicKey() });

  if (!XLMBalance?.balance || parseFloat(XLMBalance.balance) < 1.0) {
    throw new Error(
      "Please make sure you have at least 1 XLM in your account.",
    );
  }

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE.toString(),
    networkPassphrase,
  });

  transaction.addOperation(
    Operation.payment({
      destination: userPubKey,
      source: motherAcc.publicKey(),
      asset: new Asset(USDC_ASSET_CODE, USDC_ISSUER),
      amount: prize.toFixed(7).toString(),
    }),
  );
  transaction.setTimeout(0);

  const buildTrx = transaction.build();
  buildTrx.sign(motherAcc);
  return buildTrx.toXDR();
}
export async function claimBandCoinReward({
  pubKey,
  rewardAmount,
  signWith,
}: {
  pubKey: string;
  rewardAmount: number;
  signWith: SignUserType;
}) {
  const server = new Horizon.Server(STELLAR_URL);
  const motherAcc = Keypair.fromSecret(MOTHER_SECRET);
  const account = await server.loadAccount(motherAcc.publicKey());

  const platformAssetBalance = account.balances.find((balance) => {
    if (
      balance.asset_type === "credit_alphanum4" ||
      balance.asset_type === "credit_alphanum12"
    ) {
      return (
        balance.asset_code === PLATFORM_ASSET.code &&
        balance.asset_issuer === PLATFORM_ASSET.issuer
      );
    }
    return false;
  });
  //console.log("platformAssetBalance.............", platformAssetBalance);

  if (
    !platformAssetBalance ||
    parseFloat(platformAssetBalance.balance) < rewardAmount
  ) {
    throw new Error("Balance is not enough to send the asset.");
  }

  const XLMBalance = await NativeBalance({ userPub: motherAcc.publicKey() });

  if (!XLMBalance?.balance || parseFloat(XLMBalance.balance) < 1.0) {
    throw new Error(
      "Please make sure you have at least 1 XLM in your account.",
    );
  }

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE.toString(),
    networkPassphrase,
  });

  transaction.addOperation(
    Operation.payment({
      destination: pubKey,
      source: motherAcc.publicKey(),
      asset: PLATFORM_ASSET,
      amount: rewardAmount.toFixed(7).toString(),
    }),
  );
  transaction.setTimeout(0);

  const buildTrx = transaction.build();
  buildTrx.sign(motherAcc);
  const xdr = buildTrx.toXDR()
  return xdr;
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
export async function claimUSDCReward({
  pubKey,
  rewardAmount,
  signWith,
}: {
  pubKey: string;
  rewardAmount: number;
  signWith: SignUserType;
}) {
  const server = new Horizon.Server(STELLAR_URL);
  const motherAcc = Keypair.fromSecret(MOTHER_SECRET);
  const account = await server.loadAccount(motherAcc.publicKey());
  const asset = new Asset(USDC_ASSET_CODE, USDC_ISSUER);
  const userAcc = await server.loadAccount(pubKey);

  const platformAssetBalance = account.balances.find((balance) => {
    if (
      balance.asset_type === "credit_alphanum4" ||
      balance.asset_type === "credit_alphanum12"
    ) {
      return (
        balance.asset_code === PLATFORM_ASSET.code &&
        balance.asset_issuer === PLATFORM_ASSET.issuer
      );
    }
    return false;
  });
  //console.log("platformAssetBalance.............", platformAssetBalance);

  if (
    !platformAssetBalance ||
    parseFloat(platformAssetBalance.balance) < rewardAmount
  ) {
    throw new Error("Balance is not enough to send the asset.");
  }

  const XLMBalance = await NativeBalance({ userPub: motherAcc.publicKey() });

  if (!XLMBalance?.balance || parseFloat(XLMBalance.balance) < 1.0) {
    throw new Error(
      "Please make sure you have at least 1 XLM in your account.",
    );
  }
  const userHasTrustOnUSDC = userAcc.balances.some((balance) => {
    //console.log(balance);
    return (
      (balance.asset_type === "credit_alphanum4" ||
        balance.asset_type === "credit_alphanum12") &&
      balance.asset_code === USDC_ASSET_CODE &&
      balance.asset_issuer === USDC_ISSUER
    );
  });

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE.toString(),
    networkPassphrase,
  });

  if (!userHasTrustOnUSDC) {
    transaction.addOperation(
      Operation.changeTrust({
        asset: asset,
        source: pubKey,
      }),
    );
  }

  transaction.addOperation(
    Operation.payment({
      destination: pubKey,
      source: motherAcc.publicKey(),
      asset: asset,
      amount: rewardAmount.toFixed(7).toString(),
    }),
  );
  transaction.setTimeout(0);

  const buildTrx = transaction.build();
  buildTrx.sign(motherAcc);
  if (signWith && "email" in signWith) {
    const signedXDr = await WithSing({
      xdr: buildTrx.toXDR(),
      signWith: signWith,
    });
    return { xdr: signedXDr, needSign: false };

  }
  return {
    xdr: buildTrx.toXDR(),
    needSign: !userHasTrustOnUSDC,
  };
}
export async function SendBountyBalanceToUserAccountViaXLM({
  prizeInXLM,
  userPubKey,
}: {
  prizeInXLM: number;
  userPubKey: string;
}) {
  const server = new Horizon.Server(STELLAR_URL);
  const motherAcc = Keypair.fromSecret(MOTHER_SECRET);
  const account = await server.loadAccount(motherAcc.publicKey());

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE.toString(),
    networkPassphrase,
  });

  transaction.addOperation(
    Operation.payment({
      destination: userPubKey,
      asset: Asset.native(),
      amount: prizeInXLM.toFixed(7).toString(),
    }),
  );
  transaction.setTimeout(0);

  const buildTrx = transaction.build();
  buildTrx.sign(motherAcc);
  return buildTrx.toXDR();
}

export async function SendBountyBalanceToWinner({
  prize,
  recipientID,
}: {
  prize: number;
  recipientID: string;
}) {
  const server = new Horizon.Server(STELLAR_URL);
  const motherAcc = Keypair.fromSecret(MOTHER_SECRET);
  const account = await server.loadAccount(motherAcc.publicKey());
  //console.log("account", account);
  const receiverAcc = await server.loadAccount(recipientID);

  const platformAssetBalance = account.balances.find((balance) => {
    if (
      balance.asset_type === "credit_alphanum4" ||
      balance.asset_type === "credit_alphanum12"
    ) {
      return balance.asset_code === PLATFORM_ASSET.code && balance.asset_issuer === PLATFORM_ASSET.issuer;
    }
    return false;
  });
  if (
    !platformAssetBalance ||
    parseFloat(platformAssetBalance.balance) < prize
  ) {
    throw new Error("Balance is not enough to send the asset.");
  }

  const XLMBalance = await NativeBalance({ userPub: motherAcc.publicKey() });

  if (!XLMBalance?.balance || parseFloat(XLMBalance.balance) < 1.0) {
    throw new Error(
      "Please make sure you have at least 1 XLM in your account.",
    );
  }
  //console.log("XLMBalance", XLMBalance);

  const hasTrust = receiverAcc.balances.some((balance) => {
    //console.log(balance);
    return (
      (balance.asset_type === "credit_alphanum4" ||
        balance.asset_type === "credit_alphanum12") &&
      balance.asset_code === PLATFORM_ASSET.getCode() &&
      balance.asset_issuer === PLATFORM_ASSET.getIssuer()
    );
  });

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE.toString(),
    networkPassphrase,
  });

  if (!hasTrust) {
    throw new Error(`User Doesn't have trust, Please trust the ${PLATFORM_ASSET.code} first.`);
  }



  transaction.addOperation(
    Operation.payment({
      destination: recipientID,
      source: motherAcc.publicKey(),
      asset: PLATFORM_ASSET,
      amount: prize.toFixed(7).toString(),
    }),
  );
  transaction.setTimeout(0);
  const buildTrx = transaction.build();
  buildTrx.sign(motherAcc);
  return buildTrx.toXDR();
}

export async function SendBountyBalanceToWinnerViaXLM({
  prizeInXLM,
  recipientID,
}: {
  prizeInXLM: number;
  recipientID: string;
}) {
  const server = new Horizon.Server(STELLAR_URL);
  const motherAcc = Keypair.fromSecret(MOTHER_SECRET);

  const account = await server.loadAccount(motherAcc.publicKey());

  const XLMBalance = await NativeBalance({ userPub: motherAcc.publicKey() });

  if (!XLMBalance?.balance || parseFloat(XLMBalance.balance) < 1.0) {
    throw new Error(
      "Please make sure you have at least 1 XLM in your account.",
    );
  }

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE.toString(),
    networkPassphrase,
  });

  transaction.addOperation(
    Operation.payment({
      destination: recipientID,
      source: motherAcc.publicKey(),
      asset: Asset.native(),
      amount: prizeInXLM.toFixed(7).toString(),
    }),
  );

  transaction.setTimeout(0);
  const buildTrx = transaction.build();
  buildTrx.sign(motherAcc);
  return buildTrx.toXDR();
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

export async function SwapUserAssetToMotherUSDC({
  priceInBand,
  priceInUSD,
  userPubKey,
  secretKey,
  signWith,
}: {
  priceInBand: number;
  priceInUSD: number;
  userPubKey: string;
  secretKey?: string | undefined;
  signWith: SignUserType;
}) {
  const server = new Horizon.Server(STELLAR_URL);
  const motherAcc = Keypair.fromSecret(MOTHER_SECRET);
  const account = await server.loadAccount(motherAcc.publicKey());
  const senderAcc = await server.loadAccount(userPubKey);
  const transaction = new TransactionBuilder(account, {
    fee: TrxBaseFee,
    networkPassphrase,
  });

  const platformAssetBalance = senderAcc.balances.find((balance) => {
    if (
      balance.asset_type === "credit_alphanum4" ||
      balance.asset_type === "credit_alphanum12"
    ) {
      return balance.asset_code === PLATFORM_ASSET.code && balance.asset_issuer === PLATFORM_ASSET.issuer;
    }
    return false;
  });

  const asset = new Asset(USDC_ASSET_CODE, USDC_ISSUER);

  const senderHasTrustOnUSDC = senderAcc.balances.some((balance) => {
    //console.log(balance);
    return (
      (balance.asset_type === "credit_alphanum4" ||
        balance.asset_type === "credit_alphanum12") &&
      balance.asset_code === USDC_ASSET_CODE &&
      balance.asset_issuer === USDC_ISSUER
    );
  });

  const receiverHasTrustOnUSDC = account.balances.some((balance) => {
    //console.log(balance);
    return (
      (balance.asset_type === "credit_alphanum4" ||
        balance.asset_type === "credit_alphanum12") &&
      balance.asset_code === USDC_ASSET_CODE &&
      balance.asset_issuer === USDC_ISSUER
    );
  });

  if (!receiverHasTrustOnUSDC) {
    throw new Error("Please Contact Admin to add USDC trustline");
  }

  if (!senderHasTrustOnUSDC) {
    if (
      !platformAssetBalance ||
      parseFloat(platformAssetBalance.balance) < priceInBand
    ) {
      throw new Error(
        `You don't have total amount of ${priceInBand} ${PLATFORM_ASSET.code} to send.`,
      );
    }
    transaction.addOperation(
      Operation.changeTrust({
        asset: asset,
        source: userPubKey,
      }),
    );
  }
  if (
    !platformAssetBalance ||
    parseFloat(platformAssetBalance.balance) < priceInBand
  ) {
    throw new Error(
      `You don't have total amount of ${priceInBand} ${PLATFORM_ASSET.code} to send.`,
    );
  }
  transaction
    .addOperation(
      Operation.payment({
        destination: motherAcc.publicKey(),
        asset: PLATFORM_ASSET,
        amount: priceInBand.toFixed(7).toString(),
        source: userPubKey,
      }),
    )
    .addOperation(
      Operation.payment({
        destination: userPubKey,
        asset: asset,
        amount: priceInUSD.toFixed(7).toString(),
        source: motherAcc.publicKey(),
      }),
    );

  transaction.setTimeout(0);

  const buildTrx = transaction.build();
  buildTrx.sign(motherAcc);

  if (signWith && "email" in signWith && secretKey) {
    const xdr = buildTrx.toXDR();
    const signedXDr = await WithSing({
      xdr: xdr,
      signWith: signWith,
    });
    return { xdr: signedXDr, pubKey: userPubKey };
  }
  return { xdr: buildTrx.toXDR(), pubKey: userPubKey };
}

export async function getHasMotherTrustOnUSDC() {
  const server = new Horizon.Server(STELLAR_URL);
  const motherAcc = Keypair.fromSecret(MOTHER_SECRET);
  const account = await server.loadAccount(motherAcc.publicKey());
  const motherHasTrust = account.balances.some((balance) => {
    //console.log(balance);
    return (
      (balance.asset_type === "credit_alphanum4" ||
        balance.asset_type === "credit_alphanum12") &&
      balance.asset_code === USDC_ASSET_CODE &&
      balance.asset_issuer === USDC_ISSUER
    );
  });
  if (motherHasTrust) {
    return true;
  }
  return false;
}

export async function getHasUserHasTrustOnUSDC(userPubKey: string) {
  const server = new Horizon.Server(STELLAR_URL);
  const account = await server.loadAccount(userPubKey);
  const userHasTrust = account.balances.some((balance) => {
    //console.log(balance);
    return (
      (balance.asset_type === "credit_alphanum4" ||
        balance.asset_type === "credit_alphanum12") &&
      balance.asset_code === USDC_ASSET_CODE &&
      balance.asset_issuer === USDC_ISSUER
    );
  });

  return userHasTrust;
}

export async function checkXDRSubmitted(xdr: string) {
  try {
    const server = new Horizon.Server(STELLAR_URL);
    const transaction = new Transaction(xdr, networkPassphrase);
    const txHash = transaction.hash().toString("hex");

    try {
      const transactionResult = await server
        .transactions()
        .transaction(txHash)
        .call();
      //console.log("Transaction already submitted:", transactionResult);
      return true;
    } catch (error) {
      //console.log("Transaction not submitted yet:", error);
      return false;
    }
  } catch (error) {
    //console.log("Error in checkXDRSubmitted:", error);
    return true;
  }
}

export async function getUserHasTrustOnUSDC(userPubKey: string) {
  const server = new Horizon.Server(STELLAR_URL);
  const account = await server.loadAccount(userPubKey);
  const userHasTrust = account.balances.some((balance) => {
    //console.log(balance);
    return (
      (balance.asset_type === "credit_alphanum4" ||
        balance.asset_type === "credit_alphanum12") &&
      balance.asset_code === USDC_ASSET_CODE &&
      balance.asset_issuer === USDC_ISSUER
    );
  });

  return userHasTrust;
}

