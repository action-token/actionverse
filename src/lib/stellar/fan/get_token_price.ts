import axios from "axios";
import { env } from "~/env";
import { PLATFORM_ASSET } from "../constant";
import { USDC_ASSET_CODE, USDC_ISSUER } from "~/lib/usdc"

interface PlatformAssetInfo {
  price: number;
}

export async function getXlmUsdPrice(): Promise<number> {
  try {
    const response = await axios.get<{ price: string }>(
      "https://api.binance.com/api/v3/avgPrice?symbol=XLMUSDT",
    );

    const xlmUsdPrice = parseFloat(response.data.price);

    return xlmUsdPrice;
  } catch (error) {
    console.error("Error fetching XLM USD price:", error);
    throw error;
  }
}

export async function getXlmNumberForUSD(usd: number): Promise<number> {
  const xlmUsdPrice = await getXlmUsdPrice();
  const xlmNumber = usd / xlmUsdPrice;
  return xlmNumber;
}

export async function getPlatformAssetNumberForUSD(
  usd: number,
): Promise<number> {
  const xlmNumber = await getXlmNumberForUSD(usd);
  const tokenNumber = await getplatformAssetNumberForXLM(xlmNumber);
  return tokenNumber;
}

export async function getXLMPrice(): Promise<number> {
  if (env.NEXT_PUBLIC_STELLAR_PUBNET) {
    try {
      const response = await axios.get<{ price: string }>(
        "https://api.stellar.expert/explorer/public/asset/XLM",
      );
      // console.log(response.data);

      const xlmUsdPrice = parseFloat(response.data.price);

      return xlmUsdPrice;

    } catch (error) {
      console.error("Error fetching XLM USD price:", error);
      throw error;
    }
  }
  else {
    return 0.5;

  }

}

export async function getAssetPrice(): Promise<number> {
  try {
    const response = await axios.get<PlatformAssetInfo>(
      `https://api.stellar.expert/explorer/public/asset/${PLATFORM_ASSET.code}-${PLATFORM_ASSET.issuer}`,
    );

    const platformAssetInfo = response.data;
    const price = platformAssetInfo.price;
    return price ?? 0.00231;
  } catch (error) {
    console.error(`Error fetching ${PLATFORM_ASSET.code}  price:`, error);
    throw error;
  }
}

export async function getPlatformAssetPrice() {
  if (env.NEXT_PUBLIC_STELLAR_PUBNET) return await getAssetPrice();
  else return 0.5;
}

export async function getplatformAssetNumberForXLM(xlm = 1.5) {
  const xlmPrice = await getXLMPrice();
  if (PLATFORM_ASSET.code.toLocaleLowerCase() === "Wadzzo".toLocaleLowerCase())
    return Math.ceil(xlm * xlmPrice * 100);
  const price = await getPlatformAssetPrice();
  return Math.ceil((xlm * xlmPrice) / price);
}

export async function getPlatformTokenNumberForUSD(
  usd: number,
): Promise<number> {
  const platformAssetPrice = await getAssetPrice();
  const platformTokenNumber = usd / platformAssetPrice;
  return platformTokenNumber;
}

export async function getAssetToUSDCRate(): Promise<number> {
  if (env.NEXT_PUBLIC_STELLAR_PUBNET) {
    try {
      // https://api.stellar.expert/explorer/public/asset/USDC-GCTDHOF4JMAULZKOX5DKAYHF3JDEQMED73JFMNCJZTO2DMDEJW6VSWIS
      const response = await axios.get<PlatformAssetInfo>(
        `https://api.stellar.expert/explorer/public/asset/${USDC_ASSET_CODE}-${USDC_ISSUER}`,
      );

      const platformAssetInfo = response.data;
      const price = platformAssetInfo.price;

      return price ?? 0.000531;
    } catch (error) {
      console.error(
        `Error fetching ${USDC_ASSET_CODE}-${USDC_ISSUER} price:`,
        error,
      );
      throw error;
    }
  }
  else {
    return 0.2
  }
}
