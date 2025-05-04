import { scavengerHuntSchema } from "~/components/modal/scavenger-hunt-modal";
import { createTRPCRouter, creatorProcedure, protectedProcedure } from "../../trpc";
import { BountyType, ItemPrivacy } from "@prisma/client";
import { randomLocation } from "~/utils/map";

export const ScavengerHuntRoute = createTRPCRouter({
    // Create
    createScavengerHunt: creatorProcedure.input(scavengerHuntSchema).mutation(async ({ ctx, input }) => {
        const { title, description, winners, priceUSD, priceBandcoin, requiredBalance, pinImageUrl, pinUrl, startDate, endDate, locations, coverImageUrl } = input;
        const userId = ctx.session.user.id;

        // Check if creator exists outside of transaction to reduce transaction time
        const creator = await ctx.db.creator.findUnique({
            where: { id: userId },
        });

        if (!creator) {
            throw new Error("Creator not found");
        }

        // Prepare all the data structures before starting the transaction
        const bountyData = {
            title,
            description,
            totalWinner: winners,
            priceInUSD: priceUSD,
            priceInBand: priceBandcoin,
            requiredBalance,
            creatorId: userId,
            bountyType: BountyType.SCAVENGER_HUNT,
            imageUrls: coverImageUrl ? coverImageUrl.map((media) => media.url) : [],
        };

        // Pre-calculate all random locations before starting transaction
        const locationGroupsData = locations.map((location) => {
            const randomLocations = Array.from({ length: location.collectionLimit }).map(() => {
                const randomLoc = randomLocation(location.latitude, location.longitude, location.radius);
                return {
                    autoCollect: location.autoCollect,
                    latitude: randomLoc.latitude,
                    longitude: randomLoc.longitude,
                };
            });

            return {
                location,
                randomLocations,
            };
        });

        // Use a shorter transaction with less nested async operations
        const result = await ctx.db.$transaction(async (tx) => {
            // Create bounty
            const bounty = await tx.bounty.create({
                data: bountyData,
            });

            // Create all location groups and their associations in parallel
            const locationGroupPromises = locationGroupsData.map(async ({ location, randomLocations }, idx) => {
                // Create LocationGroup with locations
                const locationGroup = await tx.locationGroup.create({
                    data: {
                        creatorId: userId,
                        endDate,
                        startDate,
                        title: location.title,
                        description: location.description,
                        limit: location.collectionLimit,
                        image: pinImageUrl,
                        link: pinUrl,
                        privacy: ItemPrivacy.PRIVATE,
                        remaining: location.collectionLimit,
                        locations: {
                            createMany: {
                                data: randomLocations,
                            },
                        },
                    },
                });

                // Create actionLocation association
                await tx.actionLocation.create({
                    data: {
                        bountyId: bounty.id,
                        creatorId: userId,
                        locationGroupId: locationGroup.id,
                        serial: idx + 1
                    },
                });

                return locationGroup;
            });

            // Wait for all location groups to be created
            return await Promise.all(locationGroupPromises);
        }, {
            // Increase the transaction timeout if your database supports it
            // This value depends on your database, for example with Prisma+PostgreSQL:
            timeout: 30000, // 30 seconds instead of default
            // Some databases may not support this option
        });

        return result;
    }),
});