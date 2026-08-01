import { createTRPCRouter } from "~/server/api/trpc";
import { NftRouter } from "./nft";

export const NftRouters = createTRPCRouter({
  Nft: NftRouter,
});
