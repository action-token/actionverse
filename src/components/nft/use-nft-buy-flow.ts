import { TRPCClientError } from "@trpc/client";
import { useSession } from "next-auth/react";
import { clientSignOnly, submitSignedXDRToServer } from "package/connect_wallet";
import { useState } from "react";
import toast from "react-hot-toast";
import { clientSelect } from "~/lib/stellar/fan/utils";
import { type NftPaymentToken } from "~/lib/stellar/oz/nft";
import { api } from "~/utils/api";

/** True when `error` is the specific `PRECONDITION_FAILED`/`code` signal a
 *  buy mutation throws for a wallet-connected buyer who needs to run
 *  `ActivationModal` or the "Trust & Buy" flow first — see
 *  `ensureBuyerReady` in `src/server/api/routers/nft.ts`. */
/** Recognises the server's precondition signals (see `ensureBuyerReady`).
 *  Exported so the card checkout can react to `NEEDS_ACTIVATION` too —
 *  it does not go through this hook, but hits the same guard. */
export function isPreconditionSignal(error: unknown, code: "NEEDS_ACTIVATION" | "NEEDS_TRUSTLINE_SETUP"): boolean {
  return (
    error instanceof TRPCClientError &&
    (error.data as { code?: string } | undefined)?.code === "PRECONDITION_FAILED" &&
    error.message === code
  );
}

/**
 * Shared buy flow for both nft_oz buy pages (`src/pages/nft/[id].tsx`,
 * `src/pages/smart-contract/[id].tsx`) — everything past "call the tRPC
 * mutation" (fee-bump submission mechanics, sign-only wallet dispatch, the
 * `NEEDS_ACTIVATION`/`NEEDS_TRUSTLINE_SETUP` precondition signals) lives
 * here once instead of duplicated across both pages.
 *
 * A custodial buyer's mutation call already does everything server-side
 * (`submitted: true` in the response) — this only ever round-trips a
 * client-side signature for a wallet-connected buyer, using that wallet's
 * own sign-only function (never its sign-and-submit wrapper) so treasury,
 * not the buyer, ends up paying the transaction's network fee via
 * fee-bump. See the nft_oz payment design's Part B/C.
 */
export function useNftBuyFlow() {
  const { data: session } = useSession();
  const utils = api.useContext();

  const getBuyEditionXDR = api.nft.getBuyEditionXDR.useMutation();
  const confirmBuyEdition = api.nft.confirmBuyEdition.useMutation();
  const getBuyXDR = api.nft.getBuyXDR.useMutation();
  const confirmBuy = api.nft.confirmBuy.useMutation();
  const getBuyBatchXDR = api.nft.getBuyBatchXDR.useMutation();
  const confirmBuyBatch = api.nft.confirmBuyBatch.useMutation();
  const getEstablishTrustlineXDR = api.nft.getEstablishTrustlineXDR.useMutation();

  const [isBuyingPrimary, setIsBuyingPrimary] = useState(false);
  const [isBuyingResale, setIsBuyingResale] = useState(false);
  const [needsActivation, setNeedsActivation] = useState(false);

  async function signOnly(xdr: string): Promise<string> {
    const signed = await clientSignOnly({
      presignedxdr: xdr,
      walletType: session!.user.walletType,
      pubkey: session!.user.id,
      test: clientSelect(),
    });
    if (!signed) throw new Error("Signing was cancelled or failed.");
    return signed;
  }

  /** The one-time "Trust & Buy" step (see `buildEstablishTrustlineXDR`'s doc
   *  comment): treasury already fronted the fee and pre-signed, so the
   *  buyer's wallet only has to add its own authorization and this submits
   *  as a plain classic transaction — no fee-bump needed, treasury is
   *  already this transaction's fee-paying source. */
  async function establishTrustline(): Promise<void> {
    const { xdr } = await getEstablishTrustlineXDR.mutateAsync();
    const signed = await signOnly(xdr);
    const result = await submitSignedXDRToServer(signed);
    if (!result?.successful) {
      throw new Error("Could not set up your Platform Asset trustline.");
    }
  }

  /** Runs `fn` once, transparently handling the "needs trustline" signal by
   *  running `establishTrustline` and retrying exactly once. The "needs
   *  activation" signal can't be resolved inline the same way — activation
   *  is its own paid flow the buyer has to complete in `ActivationModal` —
   *  so this just flags `needsActivation` and surfaces a message telling
   *  them to retry afterward. */
  async function withPreconditionHandling<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (isPreconditionSignal(e, "NEEDS_TRUSTLINE_SETUP")) {
        await establishTrustline();
        return fn();
      }
      if (isPreconditionSignal(e, "NEEDS_ACTIVATION")) {
        setNeedsActivation(true);
        throw new Error("Activate your account, then try buying again.");
      }
      throw e;
    }
  }

  async function buyEdition(
    nftId: string,
    { paymentToken, quantity }: { paymentToken: NftPaymentToken; quantity: number },
    /** Defaults to a plain "N copies purchased!" — pass a custom one for a
     *  page that wants to say more (e.g. mentioning gated reward items). */
    successMessage: string = quantity > 1 ? `${quantity} copies purchased!` : "Purchase complete!",
  ): Promise<boolean> {
    setIsBuyingPrimary(true);
    try {
      await withPreconditionHandling(async () => {
        const result = await getBuyEditionXDR.mutateAsync({ nftId, paymentToken, quantity });
        if (!result.submitted) {
          const signedXdr = await signOnly(result.xdr);
          await confirmBuyEdition.mutateAsync({ nftId, purchaseId: result.purchaseId, signedXdr });
        }
      });
      toast.success(successMessage);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purchase failed");
      return false;
    } finally {
      setIsBuyingPrimary(false);
    }
  }

  async function buyResale(tokenId: string, paymentToken: NftPaymentToken): Promise<boolean> {
    setIsBuyingResale(true);
    try {
      await withPreconditionHandling(async () => {
        const result = await getBuyXDR.mutateAsync({ tokenId, paymentToken });
        if (!result.submitted) {
          const signedXdr = await signOnly(result.xdr);
          await confirmBuy.mutateAsync({ tokenId, signedXdr });
        }
      });
      toast.success("Purchase complete!");
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purchase failed");
      return false;
    } finally {
      setIsBuyingResale(false);
    }
  }

  async function buyResaleBatch(tokenIds: string[], paymentToken: NftPaymentToken): Promise<boolean> {
    if (tokenIds.length === 0) return false;
    setIsBuyingResale(true);
    try {
      await withPreconditionHandling(async () => {
        const result = await getBuyBatchXDR.mutateAsync({ tokenIds, paymentToken });
        if (!result.submitted) {
          const signedXdr = await signOnly(result.xdr);
          await confirmBuyBatch.mutateAsync({ tokenIds, signedXdr });
        }
      });
      toast.success(tokenIds.length > 1 ? `${tokenIds.length} copies purchased!` : "Purchase complete!");
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purchase failed");
      return false;
    } finally {
      setIsBuyingResale(false);
    }
  }

  return {
    isBuyingPrimary,
    isBuyingResale,
    needsActivation,
    setNeedsActivation,
    buyEdition,
    buyResale,
    buyResaleBatch,
    utils,
  };
}
