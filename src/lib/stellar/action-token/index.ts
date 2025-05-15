import { Asset, Horizon } from "@stellar/stellar-sdk";
import axios, { AxiosError } from "axios";
// Removed unused import: import { api } from "~/utils/api";

export const server = new Horizon.Server("https://horizon.stellar.org");
export const PLOT_ASSET = new Asset(
  "PLOT",
  "GCUKXAC2PGOCVB647AELOK2Y7PTCGDPKGIOQBDK6HSBMGVHSLFM7UPAJ",
);

export const plotNFTDistributor =
  "GDZ4SHUHW2CKBIHID2X57V6YXCGJAPE7IOTZLQEFHSBE7EVULF6K5HAS";

// get balances of this acc
export async function getBalances(account: string) {
  const balances = await server.loadAccount(account);

  return balances.balances;
}

export async function getPlotNfts(pubkey: string) {
  const balances = await getBalances(pubkey);

  const filteredBalances = balances
    .filter((el) => el.asset_type === "credit_alphanum12")
    .filter((el) => {
      const match = el.asset_code.match(/^PLOT\d{5}$/);
      return match ?? false;
    });

  return filteredBalances;
}

export async function getNftHolder(asset: Asset) {
  const holders = await server.accounts().forAsset(asset).call();

  function getPlotBalance(firstHolder: Horizon.ServerApi.AccountRecord) {
    const asset = firstHolder.balances.find((balance) => {
      if (
        balance.asset_type === "credit_alphanum12" ||
        balance.asset_type === "credit_alphanum4"
      ) {
        if (
          balance.asset_code === PLOT_ASSET.code &&
          balance.asset_issuer === PLOT_ASSET.issuer
        ) {
          return true;
        }
      }
    });

    if (asset) {
      return Number(asset.balance);
    } else return 0;
  }

  return holders.records.map((record) => {
    return {
      pubkey: record.account_id,
      plotBal: getPlotBalance(record),
    };
  });
}

export async function getActionHolders() {
  const holders = await getAllHolders(ACTION_ASSET.code, ACTION_ASSET.issuer);

  console.log(holders, "holders");

  const holderWithMinAction: {
    accountId: string;
    action: number;
  }[] = [];
  for (const holder of holders) {
    const minActionBal = await getActionMinimumBalanceFromHistory(
      holder.accountId,
    );
    holderWithMinAction.push({
      ...holder,
      action: minActionBal,
    });
  }

  console.log(holderWithMinAction, "holderWithMinAction");

  return holderWithMinAction;
}

async function getAllHolders(assetCode: string, assetIssuer: string) {
  const asset = new Asset(assetCode, assetIssuer);
  const holders: Horizon.ServerApi.AccountRecord[] = [];
  // Removed unused variable: let nextPage;

  try {
    const response = await server.accounts().forAsset(asset).limit(200).call();
    // return response;

    console.log(response, ">>");

    // Loop through pages to gather all holders
    while (response.records.length > 0) {
      holders.push(...response.records);
      break;

      /* This code is unreachable due to the break statement above
      if (response.next) {
        response = await response.next();
      } else {
        break;
      }
      */
    }

    return holders.map((holder) => ({
      accountId: holder.account_id,
    }));
  } catch (error) {
    console.error("Error fetching asset holders:", error);
    throw error;
  }
}

export class NftHolder {
  private asset: Asset;
  public holders: Horizon.ServerApi.CollectionPage<Horizon.ServerApi.AccountRecord>;
  constructor(
    holders: Horizon.ServerApi.CollectionPage<Horizon.ServerApi.AccountRecord>,
    asset: Asset,
  ) {
    this.holders = holders;
    this.asset = asset;
  }

  static async initiate({ code, issuer }: { code: string; issuer: string }) {
    const asset = new Asset(code, issuer);
    const holders = await server.accounts().forAsset(asset).call();

    return new NftHolder(holders, asset);
  }

  getHolders() {
    return this.holders.records.map((record) => {
      const pubkey = record.account_id;
      const amount = this.getAssetBalance(record);
      return {
        pubkey,
        amount,
        rank: 10,
      };
    });
  }

  private getAssetBalance(acc: Horizon.ServerApi.AccountRecord) {
    const asset = acc.balances.find((balance) => {
      if (
        balance.asset_type === "credit_alphanum12" ||
        balance.asset_type === "credit_alphanum4"
      ) {
        if (
          balance.asset_code === this.asset.code &&
          balance.asset_issuer === this.asset.issuer
        ) {
          return true;
        }
      }
    });

    if (asset) {
      return Number(asset.balance);
    } else return 0;
  }
}

export const ACTION_ASSET = new Asset(
  "ACTION",
  "GABHBO4IAEAKYODTIQC5G43MPD55BREA4P3MAXAMZKLEVQNF3S7PZFDU",
);

export function getActionMinimumBalanceFromHistory(accountId: string) {
  return getMinimumBalanceFromHistory({
    accountId,
    code: ACTION_ASSET.code,
    issuer: ACTION_ASSET.issuer,
  });
}

interface BalanceHistoryResponse {
  data: [number, string][];
}

async function getMinimumBalanceFromHistory({
  accountId,
  code,
  issuer,
}: {
  accountId: string;
  code: string;
  issuer: string;
}): Promise<number> {
  const apiUrl = `https://api.stellar.expert/explorer/public/account/${accountId}/balance/${code}-${issuer}/history`;
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

  const MAX_RETRIES = 5; // Maximum number of retries
  const BASE_DELAY = 1000; // Base delay in milliseconds for backoff

  const fetchWithRetry = async (
    retries: number,
  ): Promise<[number, string][]> => {
    try {
      const response = await axios.get<BalanceHistoryResponse>(apiUrl);
      return response.data.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 429 && retries > 0) {
        const retryAfter =
          parseInt(axiosError.response.headers["retry-after"] as string, 10) || 1;
        const delay =
          Math.pow(2, MAX_RETRIES - retries) * BASE_DELAY + retryAfter * 1000; // Exponential backoff
        console.warn(
          `Rate limit hit. Retrying after ${delay / 1000} seconds...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithRetry(retries - 1);
      }
      console.error("Error fetching balance history:", axiosError.message);
      throw error;
    }
  };

  try {
    const history: [number, string][] = await fetchWithRetry(MAX_RETRIES);

    // Filter for entries in the last 90 days
    const recentHistory = history.filter(
      ([timestamp]) => timestamp * 1000 >= ninetyDaysAgo,
    );

    // Find the minimum balance
    const minBalance = recentHistory.reduce((min, [, balance]) => {
      return Math.min(min, parseFloat(balance));
    }, Infinity);

    return minBalance === Infinity ? 0 : minBalance * 0.0000001; // Return 0 if no records are found
  } catch (error) {
    console.error(
      "Failed to fetch minimum balance history after retries:",
      error,
    );
    throw error;
  }
}