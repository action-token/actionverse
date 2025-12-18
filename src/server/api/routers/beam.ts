import { BeamType, StyleCategory } from "@prisma/client"
import { z } from "zod"
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc"

export const beamRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        type: z.nativeEnum(BeamType),
        senderName: z.string().min(1),
        recipientName: z.string().min(1),
        message: z.string().optional(),
        contentUrl: z.string().optional(),
        styleCategory: z.nativeEnum(StyleCategory).optional(),
        style: z.string().optional(),
        customPrompt: z.string().optional(),
        overlayText: z.string().optional(),
        arEnabled: z.boolean().default(false),
        isPublic: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.beam.create({
        data: {
          ...input,
          userId: ctx.session.user.id
        },
      })
    }),

  getById: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const beam = await ctx.db.beam.findUnique({
      where: { id: input.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    })

    if (!beam) {
      throw new Error("Beam not found")
    }

    // Increment view count
    await ctx.db.beam.update({
      where: { id: input.id },
      data: { viewCount: { increment: 1 } },
    })

    return beam
  }),

  getMyBeams: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.beam.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        reactions: true,
        comments: true,
      },
      orderBy: { createdAt: "desc" },
    })
  }),

  getPublicBeams: publicProcedure
    .input(
      z.object({
        type: z.nativeEnum(BeamType).optional(),
        styleCategory: z.nativeEnum(StyleCategory).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.beam.findMany({
        where: {
          isPublic: true,
          ...(input.type && { type: input.type }),
          ...(input.styleCategory && { styleCategory: input.styleCategory }),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          reactions: true,
          comments: true,
        },
        orderBy: { createdAt: "desc" },
      })
    }),

  addReaction: protectedProcedure
    .input(
      z.object({
        beamId: z.string(),
        emoji: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.beamReaction.upsert({
        where: {
          beamId_userId: {
            beamId: input.beamId,
            userId: ctx.session.user.id,
          },
        },
        update: {
          emoji: input.emoji,
        },
        create: {
          beamId: input.beamId,
          userId: ctx.session.user.id,
          emoji: input.emoji,
        },
      })
    }),

  addComment: protectedProcedure
    .input(
      z.object({
        beamId: z.string(),
        content: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.beamComment.create({
        data: {
          beamId: input.beamId,
          userId: ctx.session.user.id,
          content: input.content,
        },
      })
    }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const beam = await ctx.db.beam.findUnique({
      where: { id: input.id },
    })

    if (!beam || beam.userId !== ctx.session.user.id) {
      throw new Error("Unauthorized")
    }

    return ctx.db.beam.delete({
      where: { id: input.id },
    })
  }),
})
