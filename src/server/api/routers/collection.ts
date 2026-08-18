import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

// User ids are Stellar public keys (56-char strkeys) — never a valid match,
// used so the `likes` include can stay an unconditional array shape for
// logged-out requests instead of branching the query's return type.
const NO_SUCH_USER = "__anonymous__";

export const collectionRouter = createTRPCRouter({
  // Grid of collections with a cover, item count and floor price derived from
  // their listed NFTs.
  list: publicProcedure
    .input(
      z.object({
        search: z.string().trim().max(128).optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user.id;
      const collections = await ctx.db.collection.findMany({
        where: input?.search
          ? { name: { contains: input.search, mode: "insensitive" } }
          : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          creator: { select: { id: true, name: true, image: true } },
          _count: { select: { nfts: true, likes: true } },
          nfts: {
            select: { thumbnail: true, lowestActivePrice: true },
          },
          likes: { where: { userId: userId ?? NO_SUCH_USER }, select: { id: true } },
        },
      });

      return collections.map((c) => {
        const floorPrice = c.nfts.reduce<number | null>(
          (min, n) =>
            n.lowestActivePrice === null || n.lowestActivePrice === undefined
              ? min
              : min === null || n.lowestActivePrice < min
                ? n.lowestActivePrice
                : min,
          null,
        );

        return {
          id: c.id,
          name: c.name,
          description: c.description,
          cover: c.coverImage ?? c.nfts[0]?.thumbnail ?? null,
          creator: c.creator,
          itemCount: c._count.nfts,
          floorPrice,
          likeCount: c._count.likes,
          isLiked: c.likes.length > 0,
        };
      });
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user.id;
      const collection = await ctx.db.collection.findUnique({
        where: { id: input.id },
        include: {
          creator: { select: { id: true, name: true, image: true } },
          _count: { select: { likes: true } },
          likes: { where: { userId: userId ?? NO_SUCH_USER }, select: { id: true } },
          nfts: {
            orderBy: { createdAt: "desc" },
            include: {
              creator: { select: { id: true, name: true, image: true } },
              prices: true,
              _count: { select: { likes: true } },
              likes: { where: { userId: userId ?? NO_SUCH_USER }, select: { id: true } },
              tokens: {
                include: {
                  listing: { include: { seller: { select: { id: true, name: true, image: true } } } },
                },
              },
            },
          },
        },
      });
      if (!collection) throw new TRPCError({ code: "NOT_FOUND" });

      type CollectionCard = {
        id: string;
        name: string;
        thumbnail: string;
        status: (typeof collection.nfts)[number]["status"];
        creator: (typeof collection.nfts)[number]["creator"];
        lowestActivePrice: number | null;
        activeListingCount: number;
        likeCount: number;
        isLiked: boolean;
        // The edition's own "buy a new copy" price, from its price grid —
        // null once sold out (or if it never had one, which shouldn't
        // happen in practice).
        primaryPrice: number | null;
        listing?: {
          sellerId: string;
          sellerName: string | null;
          sellerImage: string | null;
          price: number;
          isResale: boolean;
        };
      };

      // One card per active *resale* listing (so a resold copy shows as its
      // own "Resold by X" card, mirroring the main marketplace grid),
      // falling back to a single plain card (priced via `primaryPrice`) for
      // editions with no active resale listing so the collection still
      // reads as a full inventory/catalog.
      const cards = collection.nfts.flatMap((n): CollectionCard[] => {
        const { likes, _count, prices, tokens, ...nft } = n;
        const base = {
          id: nft.id,
          name: nft.name,
          thumbnail: nft.thumbnail,
          status: nft.status,
          creator: nft.creator,
          lowestActivePrice: nft.lowestActivePrice,
          activeListingCount: nft.activeListingCount,
          likeCount: _count.likes,
          isLiked: likes.length > 0,
          primaryPrice: prices.length ? Math.min(...prices.map((p) => p.price)) : null,
        };
        const activeListings = tokens.filter((t) => t.listing?.isActive);
        if (activeListings.length === 0) return [base];
        return activeListings.map((t) => ({
          ...base,
          listing: {
            sellerId: t.listing!.sellerId,
            sellerName: t.listing!.seller.name,
            sellerImage: t.listing!.seller.image,
            price: t.listing!.price,
            isResale: t.listing!.sellerId !== nft.creatorId,
          },
        }));
      });

      const floorPrice = collection.nfts.reduce<number | null>(
        (min, n) =>
          n.lowestActivePrice === null || n.lowestActivePrice === undefined
            ? min
            : min === null || n.lowestActivePrice < min
              ? n.lowestActivePrice
              : min,
        null,
      );

      return {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        cover: collection.coverImage ?? collection.nfts[0]?.thumbnail ?? null,
        creator: collection.creator,
        itemCount: collection.nfts.length,
        floorPrice,
        likeCount: collection._count.likes,
        isLiked: collection.likes.length > 0,
        cards,
      };
    }),

  myCollections: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.collection.findMany({
      where: { creatorId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        coverImage: true,
      },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(128),
        description: z.string().trim().max(2000).optional(),
        coverImage: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const collection = await ctx.db.collection.upsert({
        where: {
          creatorId_name: { creatorId: ctx.session.user.id, name: input.name },
        },
        create: {
          name: input.name,
          description: input.description || null,
          coverImage: input.coverImage || null,
          creatorId: ctx.session.user.id,
        },
        update: {
          description: input.description || undefined,
          coverImage: input.coverImage || undefined,
        },
      });
      return collection;
    }),

  toggleLike: protectedProcedure
    .input(z.object({ collectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.collectionLike.findUnique({
        where: {
          collectionId_userId: { collectionId: input.collectionId, userId: ctx.session.user.id },
        },
      });
      if (existing) {
        await ctx.db.collectionLike.delete({ where: { id: existing.id } });
        return { liked: false };
      }
      await ctx.db.collectionLike.create({
        data: { collectionId: input.collectionId, userId: ctx.session.user.id },
      });
      return { liked: true };
    }),
});
