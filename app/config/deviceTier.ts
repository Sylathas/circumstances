/**
 * Device tier detection and per-tier effect configuration.
 * Used by DeviceTierContext and CameraEffects to gate GPU-intensive features per device class.
 */

export type DeviceTier = "desktop" | "tablet" | "mobile" | "battery-saver";

/**
 * Per-tier matrix of toggleable GPU features.
 * These are the production defaults; the dev leva panel can override them at runtime.
 */
export type TierFxMatrix = {
  [T in DeviceTier]: {
    postProcessing: boolean;
    bloom: boolean;
    videoBacklight: boolean;
    maxDpr: number;
  };
};

export const DEFAULT_TIER_FX: TierFxMatrix = {
  desktop: { postProcessing: true, bloom: true, videoBacklight: true, maxDpr: 2.0 },
  tablet: { postProcessing: true, bloom: false, videoBacklight: false, maxDpr: 1.5 },
  mobile: { postProcessing: false, bloom: false, videoBacklight: false, maxDpr: 1.25 },
  "battery-saver": { postProcessing: false, bloom: false, videoBacklight: false, maxDpr: 1.0 },
};

/**
 * Synchronously detect device tier from media queries and screen size.
 * Battery API downgrade happens asynchronously after mount (see DeviceTierContext).
 */
export function detectDeviceTier(): DeviceTier {
  if (typeof window === "undefined") return "desktop";

  const isTouchPrimary = !window.matchMedia("(pointer: fine)").matches;
  const width = window.screen.width;

  if (!isTouchPrimary) return "desktop";
  if (width >= 768) return "tablet";
  return "mobile";
}
