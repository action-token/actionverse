import {
  BASE_FEE,
  Keypair,
  Operation,
  Horizon,
  TransactionBuilder,
  Asset,
} from "@stellar/stellar-sdk";
import { MOTHER_SECRET, STORAGE_SECRET } from "../SECRET";
import { STELLAR_URL, PLATFORM_ASSET, networkPassphrase } from "../../constant";
import { StellarAccount } from "../test/Account";
import { submitSignedXDRToServer4User } from "package/connect_wallet/src/lib/stellar/trx/payment_fb_g";

async function checkSiteAssetTrustLine(accPub: string) {
  const server = new Horizon.Server(STELLAR_URL);
  const accRes = await server.loadAccount(accPub);
  for (const bal of accRes.balances) {
    if (
      bal.asset_type == "credit_alphanum12" ||
      bal.asset_type == "credit_alphanum4"
    ) {
      if (
        bal.asset_code == PLATFORM_ASSET.code &&
        bal.asset_issuer == PLATFORM_ASSET.issuer
      ) {
        if (bal.is_authorized) {
          return true;
        }
      }
    }
  }
  return false;
}

export async function sendSiteAsset2pub(
  pubkey: string,
  siteAssetAmount: number,
  // secret: string, // have secret means that the user don't have trust
) {
  // 1. Create trustline - wadzzo
  // 2. Send X amount - wadzzo

  const server = new Horizon.Server(STELLAR_URL);

  const motherAcc = Keypair.fromSecret(MOTHER_SECRET);
  // const userAcc = Keypair.fromSecret(secret);

  const transactionInitializer = await server.loadAccount(
    motherAcc.publicKey(),
  );

  const userAcc = await StellarAccount.create(pubkey);
  const hasTrust = userAcc.hasTrustline(
    PLATFORM_ASSET.code,
    PLATFORM_ASSET.issuer,
  );

  const Tx = new TransactionBuilder(transactionInitializer, {
    fee: BASE_FEE,
    networkPassphrase,
  });
  if (!hasTrust) {
    // creaet trustline free, as it is a new account;
    Tx.addOperation(
      Operation.payment({
        destination: pubkey,
        amount: "0.5", // 1 XLM to create trustline
        asset: Asset.native(),
        source: motherAcc.publicKey(),
      }),
    )
      .addOperation(
        Operation.changeTrust({
          asset: PLATFORM_ASSET,
          source: pubkey,
        }),
      )
      .setTimeout(0)
      .build();
  }

  const builTx = Tx.addOperation(
    Operation.payment({
      destination: pubkey,
      amount: siteAssetAmount.toFixed(7).toString(), //copy,
      asset: PLATFORM_ASSET,
      source: motherAcc.publicKey(),
    }),
  )
    .setTimeout(0)
    .build();

  builTx.sign(motherAcc);

  return builTx.toXDR();
}

/**
 * Funds a custodial buyer for a card-initiated purchase: establishes a
 * Platform Asset trustline if they don't have one yet, tops up their
 * balance by `assetAmount`, and — since fee-bump submission doesn't exist
 * yet — also ensures they hold a small XLM buffer, because a card-paying
 * buyer may never have held any XLM at all (unlike a wallet-paying buyer,
 * who already needed some to transact). Once fee-bump lands this XLM
 * top-up goes away entirely; the buyer will never need to hold XLM.
 *
 * Needs `buyerSecret` (not just the public key) because establishing a new
 * trustline requires the trustor's own signature on `changeTrust` — the
 * caller already has this for a custodial account via
 * `getAccSecretFromRubyApi`.
 */
export async function fundBuyerForCardPurchase({
  buyerPubKey,
  buyerSecret,
  assetAmount,
}: {
  buyerPubKey: string;
  buyerSecret: string;
  assetAmount: number;
}) {
  const server = new Horizon.Server(STELLAR_URL);
  const motherAcc = Keypair.fromSecret(MOTHER_SECRET);
  const buyerKeypair = Keypair.fromSecret(buyerSecret);

  const transactionInitializer = await server.loadAccount(motherAcc.publicKey());
  const buyerAcc = await StellarAccount.create(buyerPubKey);
  const hasTrust = buyerAcc.hasTrustline(PLATFORM_ASSET.code, PLATFORM_ASSET.issuer);
  const xlmBalance = buyerAcc.getNativeBalance();

  const Tx = new TransactionBuilder(transactionInitializer, {
    fee: BASE_FEE,
    networkPassphrase,
  });

  if (!hasTrust) {
    // Sends 0.5 XLM (trustline reserve) + the changeTrust op.
    Tx.addOperation(
      Operation.payment({
        destination: buyerPubKey,
        amount: "0.5",
        asset: Asset.native(),
        source: motherAcc.publicKey(),
      }),
    ).addOperation(
      Operation.changeTrust({
        asset: PLATFORM_ASSET,
        source: buyerPubKey,
      }),
    );
    if (Number(xlmBalance) < 1.5) {
      Tx.addOperation(
        Operation.payment({
          destination: buyerPubKey,
          amount: "1.5",
          asset: Asset.native(),
          source: motherAcc.publicKey(),
        }),
      );
    }
  } else if (Number(xlmBalance) < 2) {
    Tx.addOperation(
      Operation.payment({
        destination: buyerPubKey,
        amount: "2",
        asset: Asset.native(),
        source: motherAcc.publicKey(),
      }),
    );
  }

  const builtTx = Tx.addOperation(
    Operation.payment({
      destination: buyerPubKey,
      amount: assetAmount.toFixed(7),
      asset: PLATFORM_ASSET,
      source: motherAcc.publicKey(),
    }),
  )
    .setTimeout(0)
    .build();

  builtTx.sign(motherAcc);
  if (!hasTrust) builtTx.sign(buyerKeypair);

  return submitSignedXDRToServer4User(builtTx.toXDR());
}

export async function sendXLM_SiteAsset(props: {
  siteAssetAmount: number;
  pubkey: string;
  xlm: number;
  secret: string;
}) {
  const { pubkey, siteAssetAmount, xlm, secret } = props;
  // change wadzooNum to 1 fo testing

  const server = new Horizon.Server(STELLAR_URL);

  const storageAcc = Keypair.fromSecret(STORAGE_SECRET);
  const pubAcc = Keypair.fromSecret(secret);

  const transactionInializer = await server.loadAccount(storageAcc.publicKey());

  const Tx = new TransactionBuilder(transactionInializer, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.createAccount({
        destination: pubkey,
        startingBalance: xlm.toString(),
      }),
    )
    //1
    .addOperation(
      Operation.changeTrust({
        asset: PLATFORM_ASSET,
        source: pubkey,
      }),
    )

    .addOperation(
      Operation.payment({
        destination: pubkey,
        amount: siteAssetAmount.toString(), //copy,
        asset: PLATFORM_ASSET,
        source: storageAcc.publicKey(),
      }),
    )

    .setTimeout(0)
    .build();

  Tx.sign(storageAcc, pubAcc);

  const transectionXDR = Tx.toXDR();

  return transectionXDR;
}
