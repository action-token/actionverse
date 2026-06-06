const BOUNTY_URL_PATTERN = /(?:https?:\/\/[^\s/]+)?\/bounty\/(\d+)/g

export function extractBountyIds(content: string): number[] {
  const matches = [...content.matchAll(BOUNTY_URL_PATTERN)]
  const ids = matches.map((m) => Number(m[1])).filter((id) => !isNaN(id))
  return [...new Set(ids)]
}
