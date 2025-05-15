import { Asset } from "@stellar/stellar-sdk";
import { getNftHolder, getPlotNfts, plotNFTDistributor } from ".";
import { z } from "zod";

interface PlotNFT {
  asset_code: string;
  asset_issuer: string;
}

interface Holder {
  pubkey: string;
  plotBal: number;
}

interface PlotWithHolders {
  plotNft: PlotNFT;
  holder: Holder[];
}

export interface HolderWithPlots {
  pubkey: string;
  plotBal: number;

  plots: {
    asset_code: string;
    asset_issuer: string;
    balance: string;
  }[];
}

export const holderWithPlotsSchema = z.object({
  pubkey: z.string(),
  plotBal: z.number(),

  plots: z.array(
    z.object({
      asset_code: z.string(),
      asset_issuer: z.string(),
      balance: z.string(),
    }),
  ),
});

export async function allHolders() {
  const tokens = await getPlotNfts(plotNFTDistributor);

  const plotNfts = await Promise.all(
    tokens.map(async (token) => {
      const data = (
        await getNftHolder(new Asset(token.asset_code, token.asset_issuer))
      ).filter((el) => el.pubkey != plotNFTDistributor);

      return { plotNft: token, holder: data };
    }),
  );

  return plotNfts;
}

export async function getPlotsByHolder(): Promise<HolderWithPlots[]> {
  const data = await allHolders();
  const holderMap = new Map<string, HolderWithPlots>();

  data.forEach(({ plotNft, holder }) => {
    holder.forEach(({ pubkey, plotBal }) => {
      if (!holderMap.has(pubkey)) {
        holderMap.set(pubkey, { pubkey, plots: [], plotBal });
      }

      holderMap.get(pubkey)!.plots.push({
        asset_code: plotNft.asset_code,
        asset_issuer: plotNft.asset_issuer,
        balance: plotNft.balance,
      });
    });
  });

  return Array.from(holderMap.values());
}
