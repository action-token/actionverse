/**
 * A one-shot confetti shower for a completed purchase.
 *
 * Hand-rolled on a canvas rather than pulling in a dependency: it runs once
 * per purchase, needs no configuration, and cleans itself up.
 *
 * Respects `prefers-reduced-motion` — callers don't need to check.
 */
const COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#eab308"];

type Piece = {
  x: number; y: number; vx: number; vy: number;
  size: number; color: string; rot: number; vr: number;
};

export function fireConfetti({ pieces = 140, durationMs = 4000 } = {}): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  document.body.appendChild(canvas);

  const dpr = window.devicePixelRatio || 1;
  const resize = () => {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);

  const w = window.innerWidth;
  const h = window.innerHeight;
  // Falls across the full width rather than firing from two corners: the
  // modal that follows sits in the middle, and side cannons throw everything
  // straight at it.
  const items: Piece[] = Array.from({ length: pieces }, (_, i) => ({
    x: Math.random() * w,
    // Staggered above the fold so they arrive as a shower, not a single line.
    y: -Math.random() * h * 0.6 - 20,
    vx: (Math.random() - 0.5) * 3,
    vy: 2 + Math.random() * 4,
    size: 5 + Math.random() * 7,
    color: COLORS[i % COLORS.length]!,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.25,
  }));

  const started = performance.now();
  let raf = 0;

  function frame(now: number) {
    const elapsed = now - started;
    ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);
    // Fade out over the last third rather than vanishing mid-flight.
    const fade = Math.max(0, 1 - Math.max(0, elapsed - durationMs * 0.66) / (durationMs * 0.34));

    for (const p of items) {
      p.vy = Math.min(p.vy + 0.06, 7); // gravity, with a terminal velocity
      p.vx += Math.sin((now + p.y) / 400) * 0.06; // drift, so it doesn't fall straight
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;

      ctx!.save();
      ctx!.globalAlpha = fade;
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.fillStyle = p.color;
      ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx!.restore();
    }

    if (elapsed < durationMs) {
      raf = requestAnimationFrame(frame);
    } else {
      cleanup();
    }
  }

  function cleanup() {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    canvas.remove();
  }

  raf = requestAnimationFrame(frame);
}
