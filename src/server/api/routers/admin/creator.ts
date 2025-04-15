import { z } from "zod";

import { creatorAprovalTrustlineTrx, creatorAprovalTrx } from "~/lib/stellar/fan/creator-aproval";
import { AccountSchema, AccountType } from "~/lib/stellar/fan/utils";
import {
  adminProcedure,
  createTRPCRouter,
  creatorProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { urlToIpfsHash } from "~/utils/ipfs";
export const MAX_ASSET_LIMIT = Number("922337203685");

export const creatorRouter = createTRPCRouter({
  getCreators: adminProcedure.query(async ({ ctx }) => {
    const creators = await ctx.db.creator.findMany({
      include: {
        pageAsset: {
          select: {
            code: true,
            thumbnail: true,
          },
        },
      },
      where: { aprovalSend: true },
    });
    return creators;
  }),

  deleteCreator: adminProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.creator.delete({ where: { id: input } });
    }),

  creatorAction: adminProcedure
    .input(
      z.object({
        action: z.enum(["approve", "ban", "unban"]),
        creatorId: z.string(),
        storage: AccountSchema.optional(),
        escrow: AccountSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { action, creatorId } = input;

      if (action == "approve" && input.escrow) {
        // here storage account also created
        if (input.storage) {
          await ctx.db.creator.update({
            where: { id: creatorId },
            data: {
              approved: true,
              storagePub: input.storage.publicKey,
              storageSecret: input.storage.secretKey,

              pageAsset: {
                update: {
                  issuer: input.escrow.publicKey,
                  issuerPrivate: input.escrow.secretKey,
                },
              },
            },
          });
        }
        else {
          // here storage account already created
          await ctx.db.creator.update({
            where: { id: creatorId },
            data: {
              approved: true,
              pageAsset: {
                update: {
                  issuer: input.escrow.publicKey,
                  issuerPrivate: input.escrow.secretKey,
                },
              },
            },
          });
        }
      }

      else if (action == "approve" && input.escrow === undefined) {
        // here storage account also created
        if (input.storage) {
          await ctx.db.creator.update({
            where: { id: creatorId },
            data: {
              approved: true,
              storagePub: input.storage.publicKey,
              storageSecret: input.storage.secretKey,
            },
          });
        }
        else {
          // here storage account already created
          await ctx.db.creator.update({
            where: { id: creatorId },
            data: {
              approved: true
            },
          });
        }
      }
      else if (action == "ban") {
        await ctx.db.creator.update({
          where: { id: creatorId },
          data: {
            approved: false,
          },
        });
      } else if (action == "unban") {
        await ctx.db.creator.update({
          where: { id: creatorId },
          data: {
            approved: true,
          },
        });
      }
    }),

  creatorRequestXdr: adminProcedure
    .input(z.object({ creatorId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // here two type of request will be made
      // 1. create storage account
      // 2. create escrow account

      const creator = await ctx.db.creator.findUniqueOrThrow({
        where: { id: input.creatorId },
        select: {
          customPageAssetCodeIssuer: true,
          pageAsset: true,
          storagePub: true,
          storageSecret: true,
        }
      });

      // storageAlready created
      const validStorage = creator.storagePub.length === 56;
      const storage: AccountType = {
        publicKey: creator.storagePub,
        secretKey: creator.storageSecret,
      };

      const pageAsset = creator.pageAsset;
      const customPageAssetCodeIssuer = creator.customPageAssetCodeIssuer;
      if (pageAsset) {
        const thumbnail = pageAsset.thumbnail;
        const ipfs = urlToIpfsHash(thumbnail) ?? "ipfs";
        return await creatorAprovalTrx({
          storage: validStorage ? storage : undefined,
          pageAsset: {
            code: pageAsset.code,
            ipfs: ipfs,
            limit: MAX_ASSET_LIMIT.toString(),
          },
        });
      }
      if (customPageAssetCodeIssuer) {
        return await creatorAprovalTrustlineTrx({
          storage: validStorage ? storage : undefined,
          customPageAssetCodeIssuer: customPageAssetCodeIssuer,
        })
      }

    }),
  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
  creatorIDfromVanityURL: creatorProcedure
    .input(z.string())
    .query(async ({ input, ctx }) => {
      const creator = await ctx.db.creator.findUnique({
        where: { vanityURL: input },
        include: {
          vanitySubscription: true,
        },
      });
      return creator;
    }),
});
