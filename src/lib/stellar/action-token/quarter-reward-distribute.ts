import {
  Claimant,
  Horizon,
  Keypair,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import {
  networkPassphrase,
  PLATFORM_ASSET,
  STELLAR_URL,
  TrxBaseFee,
} from "../constant";
import { MOTHER_SECRET } from "../marketplace/SECRET";

export async function distribute(props: {
  data: { pubkey: string; amount: number }[];
}) {
  const server = new Horizon.Server(STELLAR_URL);

  const motherAcc = Keypair.fromSecret(MOTHER_SECRET);

  const transactionInializer = await server.loadAccount(motherAcc.publicKey());

  const Tx = new TransactionBuilder(transactionInializer, {
    fee: TrxBaseFee,
    networkPassphrase,
  });

  for (const item of props.data) {
    if (item.amount === 0) {
      console.log("Skipping distribution for", item.pubkey, "with amount 0");
      continue;
    }
    //checking trust 
    const account = await server.loadAccount(item.pubkey);
    const trustlineExists = account.balances.some(
      (balance) =>
        (balance.asset_type === "credit_alphanum4" || balance.asset_type === "credit_alphanum12") &&
        (balance.asset_code === PLATFORM_ASSET.getCode() &&
          balance.asset_issuer === PLATFORM_ASSET.getIssuer()),
    );
    // If trustline does not exist, create claimable balance operation
    console.log("..................", item.amount)
    if (!trustlineExists) {
      console.log("...................", item.pubkey, "does not have trustline for", PLATFORM_ASSET.getCode());
      const claimants: Claimant[] = [
        new Claimant(item.pubkey, Claimant.predicateUnconditional()),
      ];
      Tx.addOperation(
        Operation.createClaimableBalance({
          amount: item.amount.toFixed(7),
          asset: PLATFORM_ASSET,
          claimants: claimants,
        }),
      );
    }
    else {
      Tx.addOperation(
        Operation.payment({
          destination: item.pubkey,
          asset: PLATFORM_ASSET,
          amount: item.amount.toFixed(7),
        }),
      );
    }


  }

  const buildTx = Tx.setTimeout(0).build();

  buildTx.sign(motherAcc);

  const res = await server.submitTransaction(buildTx);
  return res;
}
