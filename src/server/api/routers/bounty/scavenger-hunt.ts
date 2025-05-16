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
            coverImageUrl,
            useSameInfoForAllSteps,
            defaultLocationInfo,
        } = input

        const userId = ctx.session.user.id

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
            bountyType: BountyType.SCAVENGER_HUNT,
            imageUrls: coverImageUrl ? coverImageUrl.map((media) => media.url) : [],
        }

        if (!locations || locations.length === 0) {
            throw new Error("Locations are required")
        }

        // Pre-calculate all random locations before starting transaction
        const locationGroupsData = locations.map((location) => {
            // Apply validation checks for required fields
            // Check coordinates and radius
            if (!location.latitude || !location.longitude || !location.radius) {
                throw new Error("Location latitude, longitude, and radius are required")
            }

            // Check title
            if (!location.title) {
                throw new Error("Location title is required")
            }

            // Check images and URLs
            if (!location.pinImage) {
                throw new Error("Location pin image is required")
            }

            if (!location.pinUrl) {
                throw new Error("Location pin URL is required")
            }

            // Check dates
            if (!location.startDate || !location.endDate) {
                throw new Error("Location start date and end date are required")
            }

            if (location.startDate >= location.endDate) {
                throw new Error("Location start date must be before end date")
            }

            // Check collection limit
            if (!location.collectionLimit || location.collectionLimit <= 0) {
                throw new Error("Location collection limit is required and must be greater than 0")
            }

            // Check autoCollect (should be boolean)
            if (location.autoCollect === undefined || location.autoCollect === null) {
                throw new Error("Location auto collect setting is required")
            }

            // Use type assertions after validation to satisfy TypeScript
            const latitude = location.latitude
            const longitude = location.longitude
            const radius = location.radius
            const title = location.title
            const pinImage = location.pinImage
            const pinUrl = location.pinUrl
            const startDate = location.startDate
            const endDate = location.endDate
            const collectionLimit = location.collectionLimit
            const autoCollect = location.autoCollect

            const randomLocations = Array.from({ length: collectionLimit }).map(() => {
                const randomLoc = randomLocation(latitude, longitude, radius)
                return {
                    autoCollect,
                    latitude: randomLoc.latitude,
                    longitude: randomLoc.longitude,
                }
            })

            return {
                location: {
                    ...location,
                    // Ensure all required fields are properly typed
                    latitude,
                    longitude,
                    radius,
                    title,
                    pinImage,
                    pinUrl,
                    startDate,
                    endDate,
                    collectionLimit,
                    autoCollect,
                },
                randomLocations,
            }
        })

        // Use a shorter transaction with less nested async operations
        const result = await ctx.db.$transaction(
            async (tx) => {
                // Create bounty
                const bounty = await tx.bounty.create({
                    data: bountyData,
                })

                // Create all location groups and their associations in parallel
                const locationGroupPromises = locationGroupsData.map(async ({ location, randomLocations }, idx) => {
                    // Create LocationGroup with locations
                    const locationGroup = await tx.locationGroup.create({
                        data: {
                            creatorId: userId,
                            endDate: location.endDate,
                            startDate: location.startDate,
                            title: location.title,
                            description: location.description ?? "", // Only description can be optional
                            limit: location.collectionLimit,
                            image: location.pinImage,
                            link: location.pinUrl,
                            privacy: ItemPrivacy.PUBLIC,
                            remaining: location.collectionLimit,
                            locations: {
                                createMany: {
                                    data: randomLocations,
                                },
                            },
                        },
                    })

                    // Create actionLocation association
                    await tx.actionLocation.create({
                        data: {
                            bountyId: bounty.id,
                            creatorId: userId,
                            locationGroupId: locationGroup.id,
                            serial: idx + 1,
                        },
                    })

                    return locationGroup
                })

                // Wait for all location groups to be created
                return await Promise.all(locationGroupPromises)
            },
            {
                // Increase the transaction timeout if your database supports it
                timeout: 30000, // 30 seconds instead of default
            },
        )

        return result
    }),
})
