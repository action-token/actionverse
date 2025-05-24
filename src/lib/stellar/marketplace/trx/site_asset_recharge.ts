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
