import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { invalidateTelegramConfig } from "~/lib/telegram/broadcast-bounty";

/**
 * Admin-only Telegram configuration.
 *
 * - `get`    — returns the masked config (never the full bot token)
 * - `upsert` — create or update the singleton config row; empty token keeps existing
 * - `test`   — sends a test message to verify the bot + chat_id actually work
 */
export const telegramRouter = createTRPCRouter({
  get: adminProcedure.query(async ({ ctx }) => {
    const cfg = await ctx.db.telegramConfig.findFirst({
      orderBy: { id: "asc" },
    });
    if (!cfg) {
      return {
        id: null,
        chatId: "",
        enabled: false,
        updatedAt: null,
        botTokenMasked: "",
        hasToken: false,
      };
    }
    // Mask token so admins see only prefix/suffix — full token never leaves the server.
    const token = cfg.botToken ?? "";
    return {
      id: cfg.id,
      chatId: cfg.chatId,
      enabled: cfg.enabled,
      updatedAt: cfg.updatedAt,
      botTokenMasked: token
        ? `${token.slice(0, 6)}…${token.slice(-4)}`
        : "",
      hasToken: token.length > 0,
    };
  }),

  upsert: adminProcedure
    .input(
      z.object({
        // Optional: if omitted, the existing token is preserved.
        botToken: z
          .string()
          .min(10, "Bot token looks too short")
          .optional()
          .or(z.literal("")),
        chatId: z.string().min(1, "Chat id is required"),
        enabled: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.telegramConfig.findFirst({
        orderBy: { id: "asc" },
      });

      const data = {
        chatId: input.chatId,
        enabled: input.enabled,
        updatedBy: ctx.session.user.id,
        // Only overwrite the token when the admin actually provided one.
        ...(input.botToken && input.botToken.length > 0
          ? { botToken: input.botToken }
          : {}),
      };

      if (existing) {
        const updated = await ctx.db.telegramConfig.update({
          where: { id: existing.id },
          data,
        });
        invalidateTelegramConfig();
        return updated;
      }

      // First-time create requires a token.
      if (!input.botToken || input.botToken.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Bot token is required for first-time setup",
        });
      }

      const created = await ctx.db.telegramConfig.create({
        data: {
          botToken: input.botToken,
          chatId: input.chatId,
          enabled: input.enabled,
          updatedBy: ctx.session.user.id,
        },
      });
      invalidateTelegramConfig();
      return created;
    }),

  test: adminProcedure
    .input(
      z
        .object({
          message: z.string().min(1).max(1000).optional(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const cfg = await ctx.db.telegramConfig.findFirst({
        orderBy: { id: "asc" },
      });
      if (!cfg?.botToken || !cfg.chatId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Telegram is not configured yet",
        });
      }

      const text =
        input?.message ??
        "✅ Test message from Action Tokens admin panel. If you see this, your Telegram bot is working correctly.";

      const res = await fetch(
        `https://api.telegram.org/bot${cfg.botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: cfg.chatId,
            text,
            disable_web_page_preview: true,
          }),
        },
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Telegram rejected the message: ${res.status} ${errText}`,
        });
      }

      return { ok: true };
    }),
});
