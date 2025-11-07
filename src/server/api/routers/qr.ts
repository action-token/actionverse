import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc"
import { TRPCError } from "@trpc/server"
import { AssetSelectAllProperty } from "./marketplace/marketplace";
import { StellarAccount } from "~/lib/stellar/marketplace/test/Account";
import { ItemPrivacy } from "@prisma/client";

export const qrRouter = createTRPCRouter({
    // Get all QR items for the current user/organization
    getQRItems: protectedProcedure

        .query(async ({ ctx, input }) => {
            if (ctx.session?.user.id) {
                const currentUserId = ctx.session.user.id;

                const items = await ctx.db.marketAsset.findMany({

                    include: {
                        asset: {
                            select: {
                                ...AssetSelectAllProperty,
                                tier: {
                                    select: {
                                        price: true,
                                    },
                                },
                                creator: {
                                    select: {
                                        pageAsset: {
                                            select: {
                                                code: true,
                                                issuer: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    where: { placerId: { not: null }, isQRItem: true, },
                });

                const stellarAcc = await StellarAccount.create(currentUserId);

                // Filter items based on privacy and conditions
                const array = items.filter((item) => {
                    const creatorPageAsset = item.asset.creator?.pageAsset;

                    if (item.asset.privacy === ItemPrivacy.PUBLIC) {
                        return true;
                    }

                    if (item.asset.creatorId !== item.placerId) {
                        return true;
                    }

                    if (item.asset.privacy === ItemPrivacy.PRIVATE) {
                        return (
                            creatorPageAsset &&
                            stellarAcc.hasTrustline(
                                creatorPageAsset.code,
                                creatorPageAsset.issuer,
                            )
                        );
                    }

                    if (item.asset.privacy === ItemPrivacy.TIER) {
                        return (
                            creatorPageAsset &&
                            item.asset.tier &&
                            item.asset.tier.price <=
                            stellarAcc.getTokenBalance(
                                creatorPageAsset.code,
                                creatorPageAsset.issuer,
                            )
                        );
                    }

                    return false;
                });

                return array.slice(0, 5);
            }
            else {


                const items = await ctx.db.marketAsset.findMany({

                    include: {
                        asset: {
                            select: {
                                ...AssetSelectAllProperty,
                                tier: {
                                    select: {
                                        price: true,
                                    },
                                },
                                creator: {
                                    select: {
                                        pageAsset: {
                                            select: {
                                                code: true,
                                                issuer: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    where: { placerId: { not: null } },
                });

                return items.slice(0, 5);
            }

        }),


});
