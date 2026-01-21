
import {
    Asset,
    BASE_FEE,
    Horizon,
    Keypair,
    Operation,
    TransactionBuilder,
} from "@stellar/stellar-sdk";

import { env } from "~/env";

import { USDC_ASSET_CODE, USDC_ISSUER } from "~/lib/usdc"
import { networkPassphrase, STELLAR_URL, TrxBaseFee } from "../constant";
import { MOTHER_SECRET } from "../marketplace/SECRET";

const log = console;

export async function createAccountXDRForPlatforms({
    selectedPlatforms,
    currentUserPubkey,
    currentUserSecret
}: {
    selectedPlatforms: Array<{ id: string; name: string; issuer: string }>;
    currentUserPubkey: string;
    currentUserSecret: string;
}) {

    const server = new Horizon.Server(STELLAR_URL);

    // Extract public key from the secret key
    const motherKeypair = Keypair.fromSecret(MOTHER_SECRET);
    const motherAcc = await server.loadAccount(motherKeypair.publicKey());

    const tx = new TransactionBuilder(motherAcc, {
        fee: TrxBaseFee,
        networkPassphrase,
    })
    tx.addOperation(
        Operation.createAccount({
            destination: currentUserPubkey,
            startingBalance: "5", // 5 XLM to cover multiple trustlines and fees
        })
    );


    selectedPlatforms.forEach((platform) => {

        const asset = new Asset(platform.name, platform.issuer);
        tx.addOperation(
            Operation.changeTrust({
                asset: asset,
                source: currentUserPubkey,
            })
        );

    });

    tx.setTimeout(0);
    const transaction = tx.build();
    transaction.sign(motherKeypair, Keypair.fromSecret(currentUserSecret));
    const xdr = transaction.toXDR();
    return xdr;

}


