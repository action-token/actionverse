
"use client";

import { useEffect, useRef } from "react";

export type FrameStyle = "wood" | "metal" | "ornate" | "neon" | "minimal";

interface FrameConfig {
  style: FrameStyle;
  color?: string;       // hex override
  thickness?: number;   // world units (default 0.12)
  depth?: number;       // world units (default 0.08)
  cornerSize?: number;  // multiplier on thickness (default 1.6)
}

// ── Per-style material defaults ───────────────────────────────────────────────
const STYLE_DEFAULTS: Record<FrameStyle, {
  color: string; roughness: number; metalness: number; emissive?: string;
}> = {
  wood: { color: "#8B5E3C", roughness: 0.85, metalness: 0.05 },
  metal: { color: "#C0C0C0", roughness: 0.25, metalness: 0.90 },
  ornate: { color: "#C8A84B", roughness: 0.40, metalness: 0.60 },
  neon: { color: "#00ffe7", roughness: 1.00, metalness: 0.00, emissive: "#00ffe7" },
  minimal: { color: "#1a1a1a", roughness: 0.60, metalness: 0.20 },
};

// ── Core HTML builder ─────────────────────────────────────────────────────────
function AR_HTML(videoUrl: string, aspectRatio: number, cfg: FrameConfig): string {
  const H = 1.8;                       // video height (world units)
  const W = H * aspectRatio;           // video width  (dynamic!)
  const T = cfg.thickness ?? 0.12;
  const D = cfg.depth ?? 0.08;
  const CS = cfg.cornerSize ?? 1.6;

  const sd = STYLE_DEFAULTS[cfg.style];
  const col = cfg.color ?? sd.color;
  const rou = sd.roughness;
  const met = sd.metalness;
  const emi = sd.emissive ?? "#000000";

  const VZ = -4;                     // video z
  const FZ = VZ - D / 2 - 0.01;     // frame z (slightly behind video)
  const CX = 0;
  const CY = 1.6;

  const topY = CY + H / 2 + T / 2;
  const botY = CY - H / 2 - T / 2;
  const leftX = CX - W / 2 - T / 2;
  const rightX = CX + W / 2 + T / 2;
  const barW = W + T * 2;
  const cS = T * CS;

  const mat = `color="${col}" roughness="${rou}" metalness="${met}"`;
  const f = (n: number) => n.toFixed(4);

  // Style-specific extras
  const neonRing = cfg.style === "neon" ? `
      <a-torus position="${f(CX)} ${f(CY)} ${f(FZ + D + 0.02)}"
        radius="${f(Math.max(W, H) / 2 + T * 1.1)}" radius-tubular="0.015"
        segments-radial="80" segments-tubular="12"
        material="color:${col};emissive:${emi};emissiveIntensity:1.5;roughness:1;metalness:0;">
      </a-torus>` : "";

  const ornateCorners = cfg.style === "ornate"
    ? [[leftX, topY], [rightX, topY], [leftX, botY], [rightX, botY]]
      .map(([x, y]) => `<a-sphere position="${f(x)} ${f(y)} ${f(FZ + D / 2 + 0.02)}"
          radius="${f(T * 0.55)}" material="${mat};emissive:#997733;emissiveIntensity:0.35;">
        </a-sphere>`).join("\n      ")
    : "";

  const neonLight = cfg.style === "neon" ? `
      <a-light type="point" color="${col}" intensity="1.4" distance="6"
        position="${f(CX)} ${f(CY)} ${f(FZ + 0.5)}">
      </a-light>` : "";

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
    <script src="https://aframe.io/releases/1.7.1/aframe.min.js"><\/script>
    <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"><\/script>
    <style>
      body { margin:0; overflow:hidden; background:#000; }
      #playBtn {
        position:fixed; top:50%; left:50%;
        transform:translate(-50%,-50%);
        background:rgba(0,0,0,0.85); color:#fff;
        border:2px solid ${col};
        padding:18px 38px; border-radius:12px;
        font-size:17px; font-family:system-ui,sans-serif;
        letter-spacing:.05em; cursor:pointer; z-index:1000;
        box-shadow:0 0 24px ${col}66; transition:opacity .3s;
      }
      #playBtn.hidden { opacity:0; pointer-events:none; }
      #badge {
        position:fixed; bottom:14px; right:14px;
        background:rgba(0,0,0,.6); color:${col};
        font-family:system-ui,sans-serif; font-size:11px;
        padding:5px 10px; border-radius:6px;
        letter-spacing:.08em; text-transform:uppercase;
        z-index:999; border:1px solid ${col}55;
      }
    </style>
  </head>
  <body>
    <button id="playBtn">▶ Play Video</button>
    <div id="badge">${cfg.style} · ${aspectRatio.toFixed(2)}:1</div>

    <a-scene embedded arjs="debugUIEnabled:false;">
      <a-assets>
        <video id="video" src="${videoUrl}" loop  crossorigin="anonymous"></video>
      </a-assets>

      <!-- Video -->
      <a-video src="#video" width="${f(W)}" height="${f(H)}" position="${f(CX)} ${f(CY)} ${f(VZ)}"></a-video>

      <!-- Frame bars -->
      <a-box ${mat} width="${f(barW)}" height="${f(T)}" depth="${f(D)}" position="${f(CX)} ${f(topY)} ${f(FZ)}"></a-box>
      <a-box ${mat} width="${f(barW)}" height="${f(T)}" depth="${f(D)}" position="${f(CX)} ${f(botY)} ${f(FZ)}"></a-box>
      <a-box ${mat} width="${f(T)}" height="${f(H)}" depth="${f(D)}" position="${f(leftX)} ${f(CY)} ${f(FZ)}"></a-box>
      <a-box ${mat} width="${f(T)}" height="${f(H)}" depth="${f(D)}" position="${f(rightX)} ${f(CY)} ${f(FZ)}"></a-box>

      <!-- Corner caps -->
      <a-box ${mat} width="${f(cS)}" height="${f(cS)}" depth="${f(D * 1.15)}" position="${f(leftX)}  ${f(topY)} ${f(FZ)}"></a-box>
      <a-box ${mat} width="${f(cS)}" height="${f(cS)}" depth="${f(D * 1.15)}" position="${f(rightX)} ${f(topY)} ${f(FZ)}"></a-box>
      <a-box ${mat} width="${f(cS)}" height="${f(cS)}" depth="${f(D * 1.15)}" position="${f(leftX)}  ${f(botY)} ${f(FZ)}"></a-box>
      <a-box ${mat} width="${f(cS)}" height="${f(cS)}" depth="${f(D * 1.15)}" position="${f(rightX)} ${f(botY)} ${f(FZ)}"></a-box>

      <!-- Style extras -->
      ${neonRing}
      ${ornateCorners}

      <!-- Lights -->
      <a-light type="ambient"     color="#fff" intensity="0.6"></a-light>
      <a-light type="directional" color="#fff" intensity="0.9" position="1 2 3"></a-light>
      ${neonLight}

      <a-entity camera look-controls></a-entity>
    </a-scene>

         <script>
  const video = document.getElementById('video');
  const playBtn = document.getElementById('playBtn');

  function tryMutedAutoplay() {
    video.muted = true;
    return video.play().catch(() => {
      // Autoplay failed, keep button visible
    });
  }

  // Try muted autoplay (won't hide button - user must click to unmute)
  document.querySelector('a-scene').addEventListener('loaded', () => tryMutedAutoplay());
  video.addEventListener('canplay', () => { if (video.paused) tryMutedAutoplay(); });

  // On explicit user tap — unmute and play with sound
  playBtn.addEventListener('click', () => {
    video.muted = false;
    video.volume = 1.0; // Ensure volume is at max
    video.play().then(() => {
      playBtn.classList.add('hidden');
    }).catch(() => {
      // If unmuted play fails, try muted fallback
      video.muted = true;
      video.play().then(() => {
        playBtn.classList.add('hidden');
      }).catch(() => {
        // Still show button if everything fails
        playBtn.classList.remove('hidden');
      });
    });
  });
</script>
  </body>
</html>`;
}
interface ARVideoFrameProps {
  videoUrl: string;
  aspectRatio?: number;   // width / height  (default 16/9)
  frame?: FrameConfig;
}

export default function ARVideoFrame({ videoUrl,
  aspectRatio = 16 / 9,
  frame = { style: "wood" }, }: ARVideoFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const blob = new Blob([AR_HTML(videoUrl, aspectRatio, frame)], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    if (iframeRef.current) {
      iframeRef.current.src = url;
    }

    return () => URL.revokeObjectURL(url);
  }, [videoUrl]);

  return (
    <iframe
      ref={iframeRef}
      allow="camera; gyroscope; accelerometer"
      style={{
        width: "100vw",
        height: "100vh",
        border: "none",
        display: "block",
      }}
    />
  );
}
