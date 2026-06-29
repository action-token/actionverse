import { useState, useRef, useCallback, useEffect } from "react";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FrameOptions {
    thickness: number;
    depth: number;
    color: string;
}

interface LoadedImage {
    img: HTMLImageElement;
    aspectRatio: number;
}

type AppState = "idle" | "loading" | "ready" | "error";

// Fixed Unsplash image (landscape photo, reliable CORS)

// ─── Helpers ─────────────────────────────────────────────────────────────────
function loadImageFromUrl(url: string): Promise<LoadedImage> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        const proxyImage = (url: string) => {
            try {
                const encoded = encodeURIComponent(url)
                return `/api/proxy-image?url=${encoded}`
            } catch {
                return url
            }
        }
        const rawUrl = url ?? "https://bandcoin.io/images/logo.png"
        const imageUrl = rawUrl.startsWith("/") || rawUrl.startsWith(window.location.origin)
            ? rawUrl // same-origin, no need to proxy
            : proxyImage(rawUrl);

        img.onload = () =>
            resolve({ img, aspectRatio: img.naturalWidth / img.naturalHeight });
        img.onerror = reject;
        img.src = imageUrl;
    });
}

function hexToColor(hex: string): THREE.Color {
    return new THREE.Color(
        parseInt(hex.slice(1, 3), 16) / 255,
        parseInt(hex.slice(3, 5), 16) / 255,
        parseInt(hex.slice(5, 7), 16) / 255
    );
}

function buildFrameGLB(
    img: HTMLImageElement,
    aspectRatio: number,
    opts: FrameOptions
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const scene = new THREE.Scene();
        const H = 1.0;
        const W = H * aspectRatio;
        const T = opts.thickness;
        const D = opts.depth;

        const frameMat = new THREE.MeshStandardMaterial({
            color: hexToColor(opts.color),
            roughness: 0.7,
            metalness: 0.1,
        });

        function addBar(
            px: number, py: number, pz: number,
            sx: number, sy: number, sz: number
        ) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), frameMat);
            mesh.position.set(px, py, pz);
            scene.add(mesh);
        }

        addBar(0, H / 2 + T / 2, 0, W + T * 2, T, D);
        addBar(0, -H / 2 - T / 2, 0, W + T * 2, T, D);
        addBar(-W / 2 - T / 2, 0, 0, T, H, D);
        addBar(W / 2 + T / 2, 0, 0, T, H, D);

        const MAX = 1024;
        const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        (texture as any).colorSpace = "srgb";

        const imgMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(W, H),
            new THREE.MeshStandardMaterial({
                map: texture,
                side: THREE.DoubleSide,
                roughness: 1,
                metalness: 0,
            })
        );
        imgMesh.position.set(0, 0, D / 2 + 0.001);
        scene.add(imgMesh);

        const exporter = new GLTFExporter();
        exporter.parse(
            scene,
            (result: ArrayBuffer) => {
                resolve(new Blob([result], { type: "model/gltf-binary" }));
            },
            (err: Error) => reject(err),
            { binary: true, embedImages: true } as any
        );
    });
}



// ─── Main Component ───────────────────────────────────────────────────────────
export default function ARPhotoFrame({ imageUrl }: { imageUrl: string }) {
    console.log("Rendering ARPhotoFrame with imageUrl:", imageUrl);
    const [thickness, setThickness] = useState(0.07);
    const [depth, setDepth] = useState(0.04);
    const [color, setColor] = useState("#8B5E3C");
    const [appState, setAppState] = useState<AppState>("idle");
    const [statusMsg, setStatusMsg] = useState("");
    const [modelUrl, setModelUrl] = useState<string | null>(null);
    const currentBlobUrl = useRef<string | null>(null);
    const loadedImageRef = useRef<LoadedImage | null>(null);

    useEffect(() => {
        if (!document.getElementById("ar-frame-keyframes")) {
            const styleEl = document.createElement("style");
            styleEl.id = "ar-frame-keyframes";
            styleEl.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
            document.head.appendChild(styleEl);
        }
        if (!customElements.get("model-viewer")) {
            const script = document.createElement("script");
            script.type = "module";
            script.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js";
            document.head.appendChild(script);
        }
    }, []);
    // Pre-load the fixed image and auto-generate on mount
    useEffect(() => {
        setStatusMsg("Loading photo…");
        setAppState("loading");
        loadImageFromUrl(imageUrl)
            .then((loaded) => {
                loadedImageRef.current = loaded;
                // Auto-generate with default values
                return buildFrameGLB(loaded.img, loaded.aspectRatio, { thickness, depth, color });
            })
            .then((blob) => {
                if (currentBlobUrl.current) URL.revokeObjectURL(currentBlobUrl.current);
                currentBlobUrl.current = URL.createObjectURL(blob);
                setModelUrl(currentBlobUrl.current);
                setAppState("ready");
                setStatusMsg("Frame ready! Adjust settings and tap View in AR to place it.");
            })
            .catch(() => {
                setAppState("error");
                setStatusMsg("Failed to load the photo. Please refresh.");
            });
    }, [imageUrl]);



    return (
        <div style={styles.page}>

            <div style={styles.card}>



                {/* Controls - Always visible as settings panel */}
                {/* <div style={styles.controls} data-controls>
                    <h3 style={styles.controlsTitle}>Frame Settings</h3>
                    <div style={styles.controlsGrid}>
                        <RangeRow
                            label="Frame thickness"
                            id="thickness"
                            min={0.02} max={0.2} step={0.01}
                            value={thickness}
                            onChange={setThickness}
                        />
                        <RangeRow
                            label="Frame depth"
                            id="depth"
                            min={0.01} max={0.15} step={0.01}
                            value={depth}
                            onChange={setDepth}
                        />
                        <label style={styles.label}>
                            <span style={styles.labelText}>Frame colour</span>
                            <div style={styles.row}>
                                <input
                                    type="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    style={styles.colorInput}
                                />
                                <span style={{ ...styles.valBadge, fontFamily: "monospace", letterSpacing: "0.05em" }}>
                                    {color}
                                </span>
                            </div>
                        </label>
                    </div>
                </div> */}

                {/* Status message */}
                {/* {statusMsg && (
                    <p style={{
                        ...styles.status,
                        color: appState === "error" ? "#E07B54" :
                            appState === "ready" ? "#6FCF97" : "#A0907A",
                    }}>
                        {statusMsg}
                    </p>
                )} */}

                {/* Model viewer */}
                {modelUrl && (
                    <div style={styles.viewerWrap}>
                        {/* Settings button - top right */}
                        {/* <button
                            onClick={() => {
                                const controls = document.querySelector('[data-controls]');
                                if (controls) {
                                    controls.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                }
                            }}
                            style={styles.settingsBtn}
                            title="Adjust frame settings"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24" />
                            </svg>
                        </button> */}

                        {/* @ts-ignore */}
                        <model-viewer
                            src={modelUrl}
                            ar
                            ar-modes="webxr scene-viewer quick-look"
                            camera-controls
                            auto-rotate
                            shadow-intensity="1"
                            style={styles.modelViewer}
                        >
                            {/* AR button - bottom left */}
                            <button
                                // @ts-ignore
                                slot="ar-button"
                                style={styles.arButton}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 3H3v2M3 19v2h2M19 3h2v2M21 19v2h-2" />
                                    <rect x="7" y="7" width="10" height="10" rx="1" />
                                </svg>
                                View in AR
                            </button>

                            {/* Generate button - bottom right next to AR */}
                            {/* <button
                                onClick={generate}
                                disabled={appState === "loading"}
                                style={{
                                    ...styles.generateBtnSmall,
                                    ...(appState === "loading" ? styles.generateBtnDisabled : {}),
                                }}
                                title="Regenerate with current settings"
                            >
                                {appState === "loading" ? (
                                    <span style={styles.spinner} />
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M1 4v6h6M23 20v-6h-6" />
                                        <path d="M20.49 9A9 9 0 0 0 5.64 5.64M3.51 15A9 9 0 0 0 18.36 18.36" />
                                    </svg>
                                )}
                            </button> */}
                            {/* @ts-ignore */}
                        </model-viewer>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
    page: {
        background: "#0F0D0B",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        fontFamily: "'Georgia', 'Times New Roman', serif",
        position: "relative",
        overflow: "hidden",
        borderRadius: "20px",
    },
    bgCircle1: {
        position: "fixed",
        top: "-120px",
        right: "-80px",
        width: "480px",
        height: "480px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(224,123,84,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
    },
    bgCircle2: {
        position: "fixed",
        bottom: "-160px",
        left: "-100px",
        width: "520px",
        height: "520px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(111,207,151,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
    },
    card: {
        width: "100%",
        maxWidth: "520px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        zIndex: 1,
    },
    header: {
        display: "flex",
        alignItems: "center",
        gap: "14px",
        paddingBottom: "8px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
    },
    iconWrap: {
        width: "52px",
        height: "52px",
        borderRadius: "14px",
        background: "rgba(224,123,84,0.12)",
        border: "1px solid rgba(224,123,84,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#E07B54",
        flexShrink: 0,
    },
    title: {
        margin: 0,
        fontSize: "1.5rem",
        fontWeight: "normal",
        color: "#F2EDE8",
        letterSpacing: "0.03em",
    },
    subtitle: {
        margin: "2px 0 0",
        fontSize: "0.8rem",
        color: "#6B5E52",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
    },
    photoWrap: {
        position: "relative",
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.07)",
    },
    previewImg: {
        width: "100%",
        maxHeight: "280px",
        objectFit: "cover",
        display: "block",
    },
    photoBadge: {
        position: "absolute",
        bottom: "10px",
        left: "10px",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "0.7rem",
        color: "rgba(255,255,255,0.7)",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(6px)",
        padding: "4px 10px",
        borderRadius: "50px",
        letterSpacing: "0.04em",
    },
    controls: {
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "16px",
        padding: "24px",
    },
    controlsTitle: {
        margin: "0 0 8px 0",
        fontSize: "0.9rem",
        color: "#F2EDE8",
        letterSpacing: "0.05em",
        fontWeight: "normal",
    },
    controlsGrid: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    label: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        cursor: "default",
    },
    labelText: {
        fontSize: "0.78rem",
        color: "#8C7A6B",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
    },
    row: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    range: {
        flex: 1,
        accentColor: "#E07B54",
        cursor: "pointer",
        height: "4px",
    },
    valBadge: {
        fontSize: "0.82rem",
        color: "#C4AD98",
        minWidth: "44px",
        textAlign: "right",
        background: "rgba(255,255,255,0.04)",
        padding: "2px 8px",
        borderRadius: "6px",
        border: "1px solid rgba(255,255,255,0.06)",
    },
    colorInput: {
        width: "44px",
        height: "34px",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "8px",
        cursor: "pointer",
        background: "none",
        padding: "2px",
    },
    generateBtn: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "13px 28px",
        background: "linear-gradient(135deg, #E07B54 0%, #C45E38 100%)",
        color: "#fff",
        border: "none",
        borderRadius: "10px",
        fontSize: "0.95rem",
        fontFamily: "'Georgia', serif",
        letterSpacing: "0.04em",
        cursor: "pointer",
        transition: "opacity 0.2s, transform 0.15s",
        boxShadow: "0 4px 20px rgba(224,123,84,0.3)",
    },
    generateBtnDisabled: {
        opacity: 0.6,
        cursor: "not-allowed",
        transform: "none",
    },
    spinner: {
        width: "14px",
        height: "14px",
        border: "2px solid rgba(255,255,255,0.3)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        display: "inline-block",
        animation: "spin 0.7s linear infinite",
    },
    status: {
        fontSize: "0.85rem",
        letterSpacing: "0.03em",
        textAlign: "center",
        padding: "10px 16px",
        borderRadius: "8px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        lineHeight: 1.5,
    },
    viewerWrap: {
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.07)",
        position: "relative",
    },
    modelViewer: {
        width: "100%",
        height: "400px",
        background: "#1A1612",
        display: "block",
    } as React.CSSProperties,
    arButton: {
        position: "absolute",
        bottom: "16px",
        right: "16px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 18px",
        background: "rgba(224,123,84,0.9)",
        backdropFilter: "blur(8px)",
        color: "#fff",
        border: "none",
        borderRadius: "50px",
        fontSize: "0.88rem",
        fontFamily: "'Georgia', serif",
        cursor: "pointer",
        letterSpacing: "0.04em",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        transition: "background 0.2s",
    },
    settingsBtn: {
        position: "absolute",
        top: "16px",
        right: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "40px",
        height: "40px",
        background: "rgba(224,123,84,0.85)",
        backdropFilter: "blur(8px)",
        color: "#fff",
        border: "none",
        borderRadius: "50%",
        cursor: "pointer",
        zIndex: 10,
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        transition: "background 0.2s",
    },
    generateBtnSmall: {
        position: "absolute",
        bottom: "16px",
        transform: "translateX(50%)",
        right: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        width: "40px",
        height: "40px",
        background: "rgba(111,207,151,0.85)",
        backdropFilter: "blur(8px)",
        color: "#fff",
        border: "none",
        borderRadius: "50%",
        cursor: "pointer",
        zIndex: 9,
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        transition: "background 0.2s",
        fontSize: "0.75rem",
    },

};