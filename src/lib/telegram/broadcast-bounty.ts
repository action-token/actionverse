import { db } from "~/server/db";
import { BASE_URL } from "../common";

/**
 * Broadcasts a newly-created bounty to the configured Telegram channel.
 *
 * Reads bot token + chat id from the `TelegramConfig` DB row, with a small
 * in-memory cache so we don't hit the DB on every bounty creation. The cache
 * is invalidated by the admin `upsert` mutation via `invalidateTelegramConfig`.
 *
 * Designed to be called fire-and-forget from `createBounty`:
 *   void broadcastBounty({ ... }).catch(console.error);
 */

interface BountyBroadcastInput {
  id: number;
  title: string;
  summary: string;
  prizeAmount: number;
  prizeAssetCode: string;
  maxWinners: number;
  creatorName: string;
}

interface CachedConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

let cached: { cfg: CachedConfig; ts: number } | null = null;
const TTL_MS = 60_000;

async function loadConfig(): Promise<CachedConfig | null> {
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.cfg;

  const row = await db.telegramConfig.findFirst({ orderBy: { id: "asc" } });
  if (!row || !row.enabled || !row.botToken || !row.chatId) {
    cached = null;
    return null;
  }

  cached = {
    cfg: { botToken: row.botToken, chatId: row.chatId, enabled: row.enabled },
    ts: Date.now(),
  };
  return cached.cfg;
}

/** Call this after the admin upserts the config so the next broadcast picks it up immediately. */
export function invalidateTelegramConfig(): void {
  cached = null;
}

/**
 * Escape user-supplied text for Telegram MarkdownV2.
 * Per Telegram docs, these characters must be escaped inside `*…*`, `_…_`, etc.
 */
function escapeMd(text: string): string {
  // `\\` must be escaped first to avoid double-escaping the escapes we'll add next.
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

function formatPrize(amount: number, assetCode: string): string {
  // Trim trailing zeros (e.g. 50.0000000 -> 50) for readability.
  const trimmed = Number.isInteger(amount) ? amount.toString() : amount.toString();
  return `${trimmed} ${assetCode}`;
}

export function buildBountyMessage(b: BountyBroadcastInput, baseUrl: string): string {
  const url = `${baseUrl.replace(/\/$/, "")}/bounty/${b.id}`;
  return [
    "🎯 *New bounty posted*",
    "",
    `*${escapeMd(b.title)}*`,
    escapeMd(b.summary),
    "",
    `💰 Reward: ${escapeMd(formatPrize(b.prizeAmount, b.prizeAssetCode))} per verified claim`,
    `🙋 Claims available: ${b.maxWinners}`,
    `👤 Posted by: ${escapeMd(b.creatorName)}`,
    "",
    `👉 [View bounty & claim](${url})`,
  ].join("\n");
}

export async function broadcastBounty(b: BountyBroadcastInput): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg) {
    // Silently skip — Telegram isn't configured yet. Don't throw, callers fire-and-forget.
    return;
  }

  const baseUrl = BASE_URL ?? "https://www.action-tokens.com";
  const message = buildBountyMessage(b, baseUrl);

  const res = await fetch(
    `https://api.telegram.org/bot${cfg.botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text: message,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Telegram sendMessage failed: ${res.status} ${errText}`);
  }
}
