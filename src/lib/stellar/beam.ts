import {
    Asset,
    Horizon,
    Keypair,
    Operation,
    TransactionBuilder,
} from "@stellar/stellar-sdk";
import { env } from "~/env";
import {
    PLATFORM_ASSET,
    PLATFORM_FEE,
    STELLAR_URL,
    TrxBaseFee,
    TrxBaseFeeInPlatformAsset,
    networkPassphrase,
} from "./constant";
import { getplatformAssetNumberForXLM } from "./fan/get_token_price";
import { AccountType } from "./fan/utils";
import { SignUserType, WithSing } from "./utils";
import { StellarAccount } from "./marketplace/test/Account";


// transection variables

export async function beamXDRForAsset({
    userId,
    signWith,
    amount

}: {
    userId: string;
    signWith: SignUserType;
    amount: number;
}) {
    const server = new Horizon.Server(STELLAR_URL);
    console.log("Amount for Beam XDR:", amount);
    const motherAcc = Keypair.fromSecret(env.MOTHER_SECRET);
    const transactionInializer = await server.loadAccount(motherAcc.publicKey());
    const userAccount = await StellarAccount.create(userId)
    //checking buyer has enough balance of usdc
    const balance = userAccount.getTokenBalance(PLATFORM_ASSET.code, PLATFORM_ASSET.issuer);
    if (Number(balance) < Number(amount)) {
        throw new Error(`You have insufficient ${PLATFORM_ASSET.code} balance`);
    }
    const Tx1 = new TransactionBuilder(transactionInializer, {
        fee: TrxBaseFee,
        networkPassphrase,
    });
    Tx1.addOperation(
        Operation.payment({
            destination: motherAcc.publicKey(),
            source: userId,
            asset: PLATFORM_ASSET,
            amount: amount.toString(),
        }),
    ).setTimeout(0);

    const buildTrx = Tx1.build();

    buildTrx.sign(motherAcc);

    const xdr = buildTrx.toXDR();
    const singedXdr = await WithSing({ xdr, signWith });
    return singedXdr;
}
