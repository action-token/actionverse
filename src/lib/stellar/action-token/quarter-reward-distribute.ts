import {
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
  data: { pubkey: string; amount: string }[];
}) {
  const server = new Horizon.Server(STELLAR_URL);

  const motherAcc = Keypair.fromSecret(MOTHER_SECRET);

  const transactionInializer = await server.loadAccount(motherAcc.publicKey());

  const Tx = new TransactionBuilder(transactionInializer, {
    fee: TrxBaseFee,
    networkPassphrase,
  });

  for (const item of props.data) {
    Tx.addOperation(
      Operation.payment({
        destination: item.pubkey,
        asset: PLATFORM_ASSET,
        amount: item.amount,
      }),
    );
  }

  const buildTx = Tx.setTimeout(0).build();

  buildTx.sign(motherAcc);

  const res = await server.submitTransaction(buildTx);
  return res;
}
