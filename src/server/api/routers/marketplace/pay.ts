import { randomUUID } from "crypto";
import { Client, Environment } from "square";
import { z } from "zod";
import { env } from "~/env";
import { getPlatformAssetPrice } from "~/lib/stellar/fan/get_token_price";
import { sendSiteAsset2pub } from "~/lib/stellar/marketplace/trx/site_asset_recharge";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
const { paymentsApi } = new Client({
  accessToken: env.SQUARE_ACCESS_TOKEN,
  environment: env.SQUARE_ENVIRONMENT as Environment,
});

// calling the squire backedapi
const url = "https://next-actionverse.vercel.app/api/square";
process.env.NODE_ENV === "production"
  ? "https://next-actionverse.vercel.app/api/square"
  : "http://localhost:3000/api/square";

export const payRouter = createTRPCRouter({
  getRechargeXDR: protectedProcedure
    .input(z.object({ tokenNum: z.number(), xlm: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user;
      if (user.email) {
        return await sendSiteAsset2pub(user.id, input.tokenNum);
      } else {
        throw new Error("Account does not have an associated email");
      }
    }),
  payment: protectedProcedure
    .input(
      z.object({
        sourceId: z.string().optional(),
        amount: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { amount: priceUSD, sourceId } = input;
      if (!sourceId) {
        throw new Error("Source ID is required for payment");
      }
      try {
        const { result } = await paymentsApi.createPayment({
          idempotencyKey: randomUUID(),
          sourceId: sourceId,
          amountMoney: {
            currency: "USD",
            amount: BigInt(priceUSD),
          },
        });

        if (result.errors) {
          console.error("Payment errors:", result.errors);
          throw new Error("Payment failed due to errors");
        }

        if (result.payment?.status === "COMPLETED") {
          return true;
        }
      } catch (error) {
        console.error("Error creating payment:", error);
      }
      return false;
    }),

  buyAsset: protectedProcedure
    .input(
      z.object({
        sourceId: z.string(),
        assetId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const user = ctx.session.user;

      const asset = await ctx.db.marketAsset.findUniqueOrThrow({
        where: { id: input.assetId },
      });

      const priceUSD = asset.priceUSD;

      /*
      const client = new Client({
        accessToken: env.SQUARE_ACCESS_TOKEN,
        environment: env.SQUARE_ENVIRONMENT as Environment,
      });


      const { result } = await client.paymentsApi.createPayment({
        idempotencyKey: randomUUID(),
        sourceId: input.sourceId,
        amountMoney: {
          currency: "USD",
          amount: BigInt(priceUSD),
        },
      });
      */

      const result = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceId: input.sourceId,
          priceUSD: priceUSD,
        }),
      });

      if (result.ok) {
        const data = (await result.json()) as { id: string; status: string };

        if (data.status === "COMPLETED") {
          return true;
        } else {
          throw new Error("Payment was not successful");
        }
      }

      if (result.status === 400) {
        throw new Error("Something went wrong with the payment");
      }
    }),
  activateAccount: protectedProcedure
    .input(
      z.object({
        token: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!input.token) {
        throw new Error("Token is required for payment");
      }
      try {
        const { result } = await paymentsApi.createPayment({
          idempotencyKey: randomUUID(),
          sourceId: input.token,
          amountMoney: {
            currency: "USD",
            amount: BigInt(200), // $2.00 for account activation
          },
        });

        if (result.errors) {
          console.error("Payment errors:", result.errors);
          throw new Error("Payment failed due to errors");
        }

        if (result.payment?.status === "COMPLETED") {
          return true;
        }
      } catch (error) {
        console.error("Error creating payment:", error);
      }
      return false
    }),
  getOffers: protectedProcedure.query(async ({ ctx }) => {
    // const tokenNumber = await getPlatfromAssetPrice();
    const bandCoinPrice = await getPlatformAssetPrice();
    const offers = [0.01, 4.99, 9.99, 19.99, 24.99, 49.99, 99.99].map(
      (price) => {
        const num = price / bandCoinPrice;
        return {
          price,
          num,
        };
      },
    );
    return offers;
  }),
});
