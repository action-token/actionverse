import { getAccSecretFromRubyApi } from "package/connect_wallet/src/lib/stellar/get-acc-secret";
import { z } from "zod";
import { createAccountXDRForPlatforms } from "~/lib/stellar/auth/account-activation";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const trxRouter = createTRPCRouter({
  activeAccountXDR: protectedProcedure.input(z.object({
    selectedPlatforms: z.array(
      z.object(
        {
          id: z.string(),
          name: z.string(),
          issuer: z.string(),
        }
      )
    ),
  })).mutation(async (
    { input, ctx }
  ) => {
    const { selectedPlatforms } = input;
    const currentUserPubkey = ctx.session.user.id;
    console.log("Generating activation XDR for user:", currentUserPubkey);
    const email = ctx.session.user.email
    console.log("USER EMAIL:", email);
    if (!email) {
      throw new Error("Email not found in session");
    }
    const currentUserSecret = await getAccSecretFromRubyApi(email);

    return createAccountXDRForPlatforms({
      selectedPlatforms,
      currentUserPubkey,
      currentUserSecret
    }
    );
  }),


  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});
