/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/prefer-optional-chain */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import axios from "axios";
import cryptoRandomString from "crypto-random-string";
import { env } from "~/env";

const url = env.NEXT_PUBLIC_STAGE === "dev" ? "https://horizon-testnet.stellar.org" : "https://horizon.stellar.org";

export function getFileIdClient(length?: number): string {
  return cryptoRandomString({ length: length ?? 8, type: "ascii-printable" });
}
export async function checkStellarAccountActivity(
  publicKey: string,
): Promise<boolean> {
  try {
    const response = await axios.get(
      `${url}/accounts/${publicKey}`,
    );
    const accountData = response.data;

    // Check if the account exists and has a balance
    if (
      accountData &&
      accountData.id &&
      accountData.balances &&
      accountData.balances.length > 0
    ) {
      return true; // Active account
    }

    return false; // Inactive account
  } catch (error) {
    return false;
  }
}

export function extractHostnameFromURL(url: string): string | null {
  try {
    const parsedURL = new URL(url);
    return parsedURL.hostname;
  } catch (error) {
    console.error("Invalid URL:", error);
    return null;
  }
}
