import { HorizonApi } from "@stellar/stellar-sdk/lib/horizon";
import { BASE_URL } from "~/lib/common";

export const getUserBalances = async () => {
  try {
    const response = await fetch(
      new URL("api/game/user/balances", BASE_URL).toString(),
      {
        method: "GET",
        credentials: "include",
      },
    );
    if (response.ok) {
      const data = (await response.json()) as {
        balances: (HorizonApi.BalanceLineNative | HorizonApi.BalanceLineAsset<"credit_alphanum4"> | HorizonApi.BalanceLineAsset<"credit_alphanum12"> | HorizonApi.BalanceLineLiquidityPool)[];
        xlm: number;
        platformAssetBal: number;
      }
      return data;
    }
  } catch (error) {
    console.error("Failed to fetch User Balance:", error);
    throw new Error("Failed to fetch User Balance");
  }
};
