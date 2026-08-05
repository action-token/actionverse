import { useMemo } from "react";

// Deterministic string hash → stable pseudo-random stream so the same seed
// always produces the same tile (no external assets, no randomness on render).
function makeRng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Built from the theme's own tokens (rather than fixed hex) so generated
// tiles automatically shift with the active light/dark theme. Only 4 tokens
// give a genuinely distinct hue (primary, gold, warning, destructive), so
// palettes vary bg/opacity pairings across those plus the neutral surface
// tokens for separation — some categories intentionally read more similarly
// than the old fixed-hue set did.
const palettes = [
  ["hsl(var(--foreground))", "hsl(var(--gold))", "hsl(var(--gold) / 0.6)"],
  ["hsl(var(--secondary))", "hsl(var(--primary))", "hsl(var(--primary) / 0.5)"],
  ["hsl(var(--muted))", "hsl(var(--primary) / 0.8)", "hsl(var(--gold) / 0.7)"],
  ["hsl(var(--accent))", "hsl(var(--warning))", "hsl(var(--warning) / 0.5)"],
  ["hsl(var(--foreground) / 0.9)", "hsl(var(--destructive))", "hsl(var(--warning) / 0.6)"],
  ["hsl(var(--secondary))", "hsl(var(--gold))", "hsl(var(--gold) / 0.4)"],
];

/**
 * Original, generated abstract artwork used as a stand-in for NFT/hero media.
 * Purely a deterministic gradient + geometric composition — no copyrighted
 * imagery. Renders as an inline SVG so it scales crisply at any tile size.
 */
export function PlaceholderArt({
  seed,
  className,
}: {
  seed: string;
  className?: string;
}) {
  const svg = useMemo(() => {
    const rng = makeRng(seed);
    const palette = palettes[Math.floor(rng() * palettes.length)]!;
    const [bg, mid, hi] = palette;
    const gid = `g-${seed.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`;
    const angle = Math.floor(rng() * 360);

    const shapes: string[] = [];
    const shapeCount = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < shapeCount; i++) {
      const kind = rng();
      const fill = rng() > 0.5 ? mid : hi;
      const opacity = (0.25 + rng() * 0.55).toFixed(2);
      if (kind < 0.4) {
        const cx = (rng() * 100).toFixed(1);
        const cy = (rng() * 100).toFixed(1);
        const r = (10 + rng() * 30).toFixed(1);
        shapes.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${opacity}"/>`);
      } else if (kind < 0.75) {
        const x = (rng() * 80).toFixed(1);
        const y = (rng() * 80).toFixed(1);
        const w = (15 + rng() * 40).toFixed(1);
        const rot = Math.floor(rng() * 90);
        shapes.push(
          `<rect x="${x}" y="${y}" width="${w}" height="${w}" rx="6" fill="${fill}" opacity="${opacity}" transform="rotate(${rot} ${x} ${y})"/>`,
        );
      } else {
        const x1 = (rng() * 100).toFixed(1);
        const y1 = (rng() * 100).toFixed(1);
        const x2 = (rng() * 100).toFixed(1);
        const y2 = (rng() * 100).toFixed(1);
        const x3 = (rng() * 100).toFixed(1);
        const y3 = (rng() * 100).toFixed(1);
        shapes.push(
          `<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3}" fill="${fill}" opacity="${opacity}"/>`,
        );
      }
    }

    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${gid}" gradientTransform="rotate(${angle} 0.5 0.5)">
          <stop offset="0%" stop-color="${bg}"/>
          <stop offset="100%" stop-color="${mid}"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#${gid})"/>
      ${shapes.join("")}
    </svg>`;
  }, [seed]);

  return (
    <div
      className={className}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
