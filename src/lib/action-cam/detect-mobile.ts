/**
 * Mobile detection for capture-method routing.
 *
 * Why this exists:
 *   The HTML `capture` attribute on `<input type="file">` is a hint for mobile
 *   devices to open the native camera app. Desktop browsers IGNORE the hint and
 *   always fall back to a file picker. There is no way to force desktop browsers
 *   to use the webcam via the file input alone.
 *
 *   So for Action Cam we route capture differently per device class:
 *     - Mobile  → `<input type="file" capture="environment">` (native camera app)
 *     - Desktop → in-app `getUserMedia` camera view (separate component)
 *
 * Detection: UA sniffing + touch heuristic. UA is the most reliable signal for
 * "phone vs laptop"; the touch + small-screen fallback catches tablets in
 * landscape and weird browsers that lie about UA.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent || "";
  if (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  ) {
    return true;
  }

  // Fallback: touch-capable + small viewport → treat as mobile.
  if (typeof window === "undefined") return false;
  const isTouchDevice =
    "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
  const isSmallScreen = window.innerWidth <= 768;
  return isTouchDevice && isSmallScreen;
}
