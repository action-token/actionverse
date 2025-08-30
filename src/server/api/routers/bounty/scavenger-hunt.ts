import { scavengerHuntSchema } from "~/components/modal/scavenger-hunt-modal"
import { createTRPCRouter, creatorProcedure } from "../../trpc"
import { BountyType, ItemPrivacy } from "@prisma/client"
import { randomLocation } from "~/utils/map"

export const ScavengerHuntRoute = createTRPCRouter({
    // Create
    createScavengerHunt: creatorProcedure.input(scavengerHuntSchema).mutation(async ({ ctx, input }) => {
        const {
            title,
            description,
            winners,
            priceUSD,
            priceBandcoin,
            requiredBalance,
            locations,
            numberOfSteps,
            coverImageUrl,
            useSameInfoForAllSteps,
            defaultLocationInfo,
            requiredBalanceCode,
            requiredBalanceIssuer
        } = input

        const userId = ctx.session.user.id
        const numberOfPins = input.numberOfSteps
        const locationGroups = input.locations
        // Check if creator exists outside of transaction to reduce transaction time
        const creator = await ctx.db.creator.findUnique({
            where: { id: userId },
        })

        if (!creator) {
            throw new Error("Creator not found")
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
            requiredBalanceCode,
            requiredBalanceIssuer,
            bountyType: BountyType.SCAVENGER_HUNT,
            imageUrls: coverImageUrl ? coverImageUrl.map((media) => media.url) : [],
        }
        const bounty = await ctx.db.bounty.create({
            data: bountyData,
        })
        for (let groupIndex = 0; groupIndex < locationGroups.length; groupIndex++) {
            const locationGroup = locationGroups[groupIndex];
            if (!locationGroup) continue; // Skip if the group is undefined or null

            const randomLocations = Array.from({ length: numberOfPins }).map(() => {
                const randomLoc = randomLocation(
                    locationGroup.latitude,
                    locationGroup.longitude,
                    locationGroup.radius ?? 50
                );
                return {
                    autoCollect: locationGroup.autoCollect ?? false,
                    latitude: randomLoc.latitude,
                    longitude: randomLoc.longitude,
                };
            });

            // All your validations...
            if (!locationGroup.title) throw new Error("Location title is required");
            if (!locationGroup.pinImage) throw new Error("Location pin image is required");
            if (!locationGroup.pinUrl) throw new Error("Location pin URL is required");
            if (!locationGroup.startDate || !locationGroup.endDate) throw new Error("Start and end date required");
            if (locationGroup.startDate >= locationGroup.endDate) throw new Error("Start date must be before end date");
            if (!locationGroup.collectionLimit || locationGroup.collectionLimit <= 0) throw new Error("Collection limit required");
            if (locationGroup.autoCollect === undefined || locationGroup.autoCollect === null) throw new Error("Auto collect setting required");

            const createdGroup = await ctx.db.locationGroup.create({
                data: {
                    creatorId: ctx.session.user.id,
                    endDate: locationGroup.endDate,
                    startDate: locationGroup.startDate,
                    title: locationGroup.title,
                    description: locationGroup.description,
                    limit: locationGroup.collectionLimit,
                    image: locationGroup.pinImage,
                    link: locationGroup.pinUrl,
                    locations: {
                        createMany: {
                            data: randomLocations,
                        },
                    },
                    remaining: locationGroup.collectionLimit,
                },
            });

            await ctx.db.actionLocation.create({
                data: {
                    bountyId: bounty.id,
                    creatorId: userId,
                    locationGroupId: createdGroup.id, // You need the ID from the *created* group
                    serial: groupIndex + 1,
                },
            });
        }

    }),
})

