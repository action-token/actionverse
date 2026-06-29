"use client";

import { useEffect, useRef } from "react";

interface ARAudioFrameProps {
  audioUrl: string;
  brandLogoUrl?: string;
  brandName?: string;
  trackTitle?: string;
  accentColor?: string;
}

function AR_AUDIO_HTML(
  audioUrl: string,
  brandLogoUrl: string,
  brandName: string,
  trackTitle: string,
  accent: string,
): string {
  const accentDim = accent + "99";
  const initial = brandName.charAt(0).toUpperCase();

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
    <script src="https://aframe.io/releases/1.7.1/aframe.min.js"><\/script>
    <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"><\/script>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #000; overflow: hidden; font-family: system-ui, sans-serif; }

      #hud {
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
        display: flex; flex-direction: column; align-items: center;
        padding: 0 0 36px; pointer-events: none;
      }
      #track-card {
        pointer-events: all;
        width: min(340px, 88vw);
        background: rgba(6,6,10,0.82);
        backdrop-filter: blur(24px) saturate(1.4);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 22px; padding: 16px 20px 18px;
        box-shadow: 0 24px 64px rgba(0,0,0,0.65);
      }
      #track-title {
        font-size: 14px; font-weight: 700; color: #f0f0f0;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        letter-spacing: -0.02em; margin-bottom: 2px;
      }
      #brand-name {
        font-size: 11px; color: ${accent};
        font-weight: 600; letter-spacing: 0.06em;
        text-transform: uppercase; margin-bottom: 12px;
      }
      #waveform {
        display: flex; align-items: center; gap: 2px; height: 24px;
        margin-bottom: 10px; opacity: 0.4; transition: opacity 0.3s;
      }
      #waveform.playing { opacity: 1; }
      .bar {
        width: 3px; border-radius: 2px; background: ${accent};
        animation: wave 0.85s ease-in-out infinite alternate paused;
      }
      #waveform.playing .bar { animation-play-state: running; }
      ${Array.from({ length: 28 }, (_, i) => `
        .bar:nth-child(${i + 1}) {
          height:${7 + Math.abs(Math.sin(i * 0.72)) * 10}px;
          animation-delay:${(i * 0.065).toFixed(3)}s;
          opacity:${(0.45 + Math.abs(Math.sin(i * 0.5)) * 0.55).toFixed(2)};
        }
      `).join('')}
      @keyframes wave { from { transform:scaleY(0.25); } to { transform:scaleY(1.3); } }

      #time-row {
        display:flex; justify-content:space-between;
        font-size:10px; color:rgba(255,255,255,0.3);
        margin-bottom:8px; font-variant-numeric:tabular-nums; letter-spacing:0.04em;
      }
      #prog-wrap {
        height:3px; background:rgba(255,255,255,0.10);
        border-radius:2px; margin-bottom:14px; overflow:hidden; cursor:pointer;
      }
      #prog-bar {
        height:100%; width:0%;
        background:linear-gradient(to right,${accent},${accent}bb);
        border-radius:2px; transition:width 0.4s linear;
      }
      #controls { display:flex; align-items:center; justify-content:center; gap:16px; }
      .ctrl {
        width:40px; height:40px; border-radius:50%;
        background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.10);
        display:flex; align-items:center; justify-content:center;
        cursor:pointer; color:#ccc; font-size:13px;
        transition:all 0.15s; -webkit-tap-highlight-color:transparent; user-select:none;
      }
      .ctrl:active { transform:scale(0.88); }
      #play-btn {
        width:50px; height:50px; font-size:16px;
        background:${accent}; border:none; color:#fff;
        box-shadow:0 0 24px ${accentDim};
      }

      /* tap-to-start overlay */
      #overlay {
        position:fixed; inset:0; z-index:200;
        display:flex; flex-direction:column;
        align-items:center; justify-content:center; gap:16px;
        background:rgba(0,0,0,0.50); backdrop-filter:blur(4px);
        cursor:pointer; transition:opacity 0.3s;
      }
      #overlay.hidden { opacity:0; pointer-events:none; }
      #overlay-btn {
        width:72px; height:72px; border-radius:50%;
        background:${accent}; display:flex; align-items:center; justify-content:center;
        font-size:28px; color:#fff; box-shadow:0 0 48px ${accentDim};
        animation:pulse 2s ease-in-out infinite;
      }
      #overlay-label {
        font-size:13px; color:rgba(255,255,255,0.65); letter-spacing:0.04em;
      }
      @keyframes pulse {
        0%,100%{box-shadow:0 0 32px ${accentDim};transform:scale(1);}
        50%{box-shadow:0 0 60px ${accent};transform:scale(1.06);}
      }

      #badge {
        position:fixed; bottom:14px; right:14px;
        background:rgba(0,0,0,.65); color:${accent};
        font-size:10px; padding:4px 10px; border-radius:6px;
        letter-spacing:.08em; text-transform:uppercase; z-index:999;
        border:1px solid ${accent}44; font-family:monospace;
      }
    </style>
  </head>
  <body>

    <div id="overlay">
      <div id="overlay-btn">▶</div>
      <div id="overlay-label">Tap to start AR experience</div>
    </div>

    <div id="hud">
      <div id="track-card">
        <div id="track-title">${trackTitle}</div>
        <div id="brand-name">${brandName}</div>
        <div id="waveform">${Array.from({ length: 28 }, () => `<div class="bar"></div>`).join('')}</div>
        <div id="time-row"><span id="time-cur">0:00</span><span id="time-dur">–:––</span></div>
        <div id="prog-wrap"><div id="prog-bar"></div></div>
        <div id="controls">
          <div class="ctrl" id="seek-back">⏮</div>
          <div class="ctrl" id="play-btn">▶</div>
          <div class="ctrl" id="seek-fwd">⏭</div>
        </div>
      </div>
    </div>

    <div id="badge">AR · Vinyl</div>

    <a-scene embedded arjs="debugUIEnabled:false; sourceType:webcam;">
      <a-assets id="assets"></a-assets>

      <!--
        KEY FIX: All spinning parts (disc, label, grooves, glow ring) are wrapped
        in a single <a-entity id="vinyl-group">. Only this group gets rotated in
        the rAF loop, so every child spins together perfectly in sync.
        The needle arm stays OUTSIDE the group so it doesn't spin.
      -->
      <a-entity id="vinyl-group" position="0 1.6 -2.2" rotation="0 0 0">

        <!-- Vinyl disc cylinder (local origin = centre of disc) -->
        <a-cylinder
          id="vinyl-disc"
          radius="0.55" height="0.03"
          position="0 0 0"
          rotation="90 0 0"
          segments-radial="72"
          material="color:#111; roughness:0.35; metalness:0.2; side:double;"
        ></a-cylinder>

        <!-- Brand logo label circle on front face -->
        <a-circle
          id="vinyl-label"
          radius="0.19"
          position="0 0 0.016"
          rotation="0 0 0"
          segments="48"
          material="color:#111; roughness:0.5; side:double;"
        ></a-circle>

        <!-- Groove rings -->
        ${[0.20, 0.27, 0.33, 0.38, 0.42, 0.46, 0.50].map(r => `
        <a-torus
          radius="${r}" radius-tubular="0.002" segments-radial="72" segments-tubular="8"
          position="0 0 0.017" rotation="0 0 0"
          material="color:#222; roughness:0.6; metalness:0.3;">
        </a-torus>`).join('')}

        <!-- Accent glow ring at disc edge -->
        <a-torus
          id="glow-ring"
          radius="0.565" radius-tubular="0.013"
          segments-radial="72" segments-tubular="16"
          position="0 0 0.017" rotation="0 0 0"
          material="color:${accent}; emissive:${accent}; emissiveIntensity:1.4; roughness:1; metalness:0;"
        ></a-torus>

        <!-- Centre hole -->
        <a-cylinder
          radius="0.018" height="0.035"
          position="0 0 0"
          rotation="90 0 0"
          material="color:#000; roughness:1; metalness:0; side:double;"
        ></a-cylinder>

      </a-entity>

      <!-- Needle arm: outside the group, never spins -->
      <a-box
        id="needle-arm"
        width="0.55" height="0.012" depth="0.012"
        position="0.64 1.6 -2.17"
        rotation="0 0 -30"
        material="color:#888; roughness:0.3; metalness:0.85;"
      ></a-box>
      <a-sphere
        id="needle-tip"
        radius="0.022"
        position="-0.01 1.6 -2.17"
        material="color:${accent}; emissive:${accent}; emissiveIntensity:0.9;"
      ></a-sphere>

      <a-light type="ambient"     color="#fff" intensity="0.55"></a-light>
      <a-light type="directional" color="#fff" intensity="0.85" position="1 3 2"></a-light>
      <a-light type="point" color="${accent}" intensity="0.8" distance="5" position="0 1.6 -1.6"></a-light>

      <a-entity camera look-controls></a-entity>
    </a-scene>

    <script>
      // ── Build vinyl texture ────────────────────────────────────────
      function buildVinylTex() {
        const c = document.createElement('canvas');
        c.width = c.height = 512;
        const ctx = c.getContext('2d');
        const cx = 256, cy = 256;

        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath(); ctx.arc(cx,cy,256,0,Math.PI*2); ctx.fill();

        for (let r = 24; r < 256; r += 5) {
          const a = 0.025 + Math.sin(r*0.2)*0.015;
          ctx.strokeStyle = \`rgba(255,255,255,\${a})\`;
          ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
        }
        // Subtle rainbow sheen
        const g = ctx.createRadialGradient(cx-80,cy-80,0,cx,cy,256);
        g.addColorStop(0,'rgba(160,140,255,0.07)');
        g.addColorStop(0.5,'rgba(80,220,255,0.04)');
        g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,256,0,Math.PI*2); ctx.fill();

        ctx.fillStyle='#000';
        ctx.beginPath(); ctx.arc(cx,cy,9,0,Math.PI*2); ctx.fill();
        return c.toDataURL();
      }

      // ── Build logo texture ─────────────────────────────────────────
      function buildLogoTex(onDone) {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const ctx = c.getContext('2d');
        const cx=128,cy=128,R=128;

        ctx.fillStyle='#111';
        ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fill();

        ctx.strokeStyle='${accent}';
        ctx.lineWidth=6;
        ctx.beginPath(); ctx.arc(cx,cy,R-6,0,Math.PI*2); ctx.stroke();

        function finish() {
          ctx.strokeStyle='${accent}44';
          ctx.lineWidth=2;
          ctx.beginPath(); ctx.arc(cx,cy,R-14,0,Math.PI*2); ctx.stroke();
          onDone(c.toDataURL());
        }

        ${brandLogoUrl ? `
        const img = new Image();
        img.crossOrigin='anonymous';
        img.onload = () => {
          ctx.save();
          ctx.beginPath(); ctx.arc(cx,cy,R-14,0,Math.PI*2); ctx.clip();
          ctx.drawImage(img,14,14,228,228);
          ctx.restore();
          finish();
        };
        img.onerror = () => { drawInitial(); finish(); };
        img.src = '${brandLogoUrl}';
        ` : `drawInitial(); finish();`}

        function drawInitial() {
          ctx.fillStyle='${accent}22';
          ctx.beginPath(); ctx.arc(cx,cy,R-14,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#fff';
          ctx.font='bold 88px system-ui';
          ctx.textAlign='center';
          ctx.textBaseline='middle';
          ctx.fillText('${initial}',cx,cy+4);
        }
      }

      // ── Inject textures into A-Frame assets & apply ────────────────
      const assets = document.getElementById('assets');

      // Vinyl texture → apply to the disc
      const vinylImg = document.createElement('img');
      vinylImg.id = 'vinyl-tex';
      vinylImg.src = buildVinylTex();
      assets.appendChild(vinylImg);
      document.getElementById('vinyl-disc')
        .setAttribute('material','src:#vinyl-tex; side:double; roughness:0.3; metalness:0.18;');

      // Logo texture (async if loading image)
      buildLogoTex((dataUrl) => {
        const logoImg = document.createElement('img');
        logoImg.id = 'logo-tex';
        logoImg.src = dataUrl;
        assets.appendChild(logoImg);
        document.getElementById('vinyl-label')
          .setAttribute('material','src:#logo-tex; side:double; roughness:0.45;');
      });

      // ── Audio + playback ──────────────────────────────────────────
      const audio    = new Audio('${audioUrl}');
      audio.crossOrigin = 'anonymous';

      // Rotate the GROUP, not individual elements
      const vinylGroup = document.getElementById('vinyl-group');
      const needleArm  = document.getElementById('needle-arm');
      const waveform   = document.getElementById('waveform');
      const playBtn    = document.getElementById('play-btn');
      const progBar    = document.getElementById('prog-bar');
      const timeCur    = document.getElementById('time-cur');
      const timeDur    = document.getElementById('time-dur');
      const overlay    = document.getElementById('overlay');

      let playing = false;
      // angle around Z axis (disc faces the camera in the XY plane)
      let angle   = 0;
      let lastTS  = null;

      function fmt(s) {
        if (!isFinite(s)) return '–:––';
        return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
      }

      function setPlaying(v) {
        playing = v;
        playBtn.textContent = v ? '⏸' : '▶';
        waveform.classList.toggle('playing', v);
        // Needle: playing → hovering on groove, paused → lifted away
        needleArm.setAttribute('rotation', v ? '0 0 -18' : '0 0 -36');
      }

      // Spin loop — rotates the entire vinyl-group around Z (disc faces camera)
      // RPM 33⅓ → 33.33 rev/min → 33.33/60 rev/s → × 360 °/rev = 200 °/s
      function spinLoop(ts) {
        requestAnimationFrame(spinLoop);
        if (!playing) { lastTS = null; return; }
        if (lastTS === null) { lastTS = ts; return; }
        const dt = (ts - lastTS) / 1000;
        lastTS = ts;
        angle = (angle + dt * 200) % 360;
        // Group's base rotation keeps the disc flat and facing forward (cylinder rotated 90° on X inside group).
        // We spin around Z to rotate in the plane of the screen.
        vinylGroup.setAttribute('rotation', \`0 0 \${angle.toFixed(2)}\`);
      }
      requestAnimationFrame(spinLoop);

      audio.addEventListener('loadedmetadata', () => { timeDur.textContent = fmt(audio.duration); });
      audio.addEventListener('timeupdate', () => {
        timeCur.textContent = fmt(audio.currentTime);
        if (audio.duration) progBar.style.width=(audio.currentTime/audio.duration*100)+'%';
      });
      audio.addEventListener('ended', () => setPlaying(false));

      function startAudio() {
        audio.play().then(() => { setPlaying(true); overlay.classList.add('hidden'); })
          .catch(console.error);
      }

      overlay.addEventListener('click', startAudio);
      playBtn.addEventListener('click', () => {
        if (playing) { audio.pause(); setPlaying(false); }
        else { audio.play().then(() => setPlaying(true)).catch(console.error); }
      });
      document.getElementById('seek-back').addEventListener('click', () => {
        audio.currentTime = Math.max(0, audio.currentTime-10);
      });
      document.getElementById('seek-fwd').addEventListener('click', () => {
        audio.currentTime = Math.min(audio.duration||0, audio.currentTime+10);
      });
      document.getElementById('prog-wrap').addEventListener('click', (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        audio.currentTime = ((e.clientX-r.left)/r.width) * (audio.duration||0);
      });
    <\/script>
  </body>
</html>`;
}

export default function ARAudioFrame({
  audioUrl,
  brandLogoUrl = "https://bandcoin.io/images/logo.png",
  brandName = "Artist",
  trackTitle = "Unknown Track",
  accentColor = "#a855f7",
}: ARAudioFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const html = AR_AUDIO_HTML(audioUrl, brandLogoUrl, brandName, trackTitle, accentColor);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    if (iframeRef.current) iframeRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [audioUrl, brandLogoUrl, brandName, trackTitle, accentColor]);

  return (
    <iframe
      ref={iframeRef}
      allow="camera; gyroscope; accelerometer; microphone"
      style={{ width: "100%", height: "100%", border: "none", display: "block" }}
    />
  );
}