import { WalletType } from "~/types/wallet/wallet-types";

export function isRechargeAbleClient(walletType: WalletType): boolean {
    return (
        walletType == WalletType.facebook ||
        walletType == WalletType.google ||
        walletType == WalletType.emailPass ||
        walletType == WalletType.apple
    );
}