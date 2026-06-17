import { Horizon } from "@stellar/stellar-sdk";
import { PLATFORM_ASSET } from "~/lib/stellar/constant";
import { create } from "zustand";

export type AccBalanceType =
  | Horizon.HorizonApi.BalanceLineNative
  | Horizon.HorizonApi.BalanceLineAsset<"credit_alphanum4">
  | Horizon.HorizonApi.BalanceLineAsset<"credit_alphanum12">
  | Horizon.HorizonApi.BalanceLineLiquidityPool;

type CreditAssetBalance = Horizon.HorizonApi.BalanceLineAsset<
  "credit_alphanum4" | "credit_alphanum12"
>;

const isCreditAsset = (balance: AccBalanceType): balance is CreditAssetBalance =>
  balance.asset_type === "credit_alphanum4" ||
  balance.asset_type === "credit_alphanum12";

interface Balance {
  balances: AccBalanceType[] | undefined;
  getAssetBalance: (props: {
    code?: string;
    issuer?: string;
  }) => string | undefined;
  setBalance: (balances: AccBalanceType[]) => void;
  platformAssetBalance: number;
  setPlatformAssetBalance: (balances: AccBalanceType[]) => void;
  active: boolean;
  setActive: (active: boolean) => void;
  getXLMBalance: () => string | undefined;
  hasTrust: (code: string, issuer: string) => boolean | undefined;
}

export const useUserStellarAcc = create<Balance>((set, get) => ({
  active: false,
  setActive: (active) => set({ active }),

  platformAssetBalance: 0,
  balances: undefined,

  setBalance: (balances) => {
    set({ balances });
    get().setPlatformAssetBalance(balances);
  },

  getAssetBalance: ({ code, issuer }) =>
    get().balances?.find(
      (balance) =>
        isCreditAsset(balance) &&
        balance.asset_code === code &&
        balance.asset_issuer === issuer,
    )?.balance,

  setPlatformAssetBalance: (balances) => {
    const platformBalance = balances.find(
      (balance) =>
        isCreditAsset(balance) &&
        balance.asset_code === PLATFORM_ASSET.code &&
        balance.asset_issuer === PLATFORM_ASSET.issuer,
    );

    if (platformBalance) {
      set({ platformAssetBalance: Number(platformBalance.balance) });
    }
  },

  getXLMBalance: () =>
    get().balances?.find((balance) => balance.asset_type === "native")?.balance,

  hasTrust: (code, issuer) =>
    get().balances?.some(
      (balance) =>
        isCreditAsset(balance) &&
        balance.asset_code === code &&
        balance.asset_issuer === issuer,
    ),
}));

interface CreatorBalance {
  balances: AccBalanceType[] | undefined;
  getXLMBalance: () => string | undefined;
  getAssetBalance: (props: { code?: string; issuer?: string }) => number;
  setBalance: (balances: AccBalanceType[]) => void;
}

export const useCreatorStorageAcc = create<CreatorBalance>((set, get) => ({
  balances: undefined,

  setBalance: (balances) => set({ balances }),

  getAssetBalance: ({ code, issuer }) =>
    Number(
      get().balances?.find(
        (balance) =>
          isCreditAsset(balance) &&
          balance.asset_code === code &&
          balance.asset_issuer === issuer,
      )?.balance ?? 0,
    ),

  getXLMBalance: () =>
    get().balances?.find((balance) => balance.asset_type === "native")?.balance,
}));