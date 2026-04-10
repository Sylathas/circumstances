"use client";

/**
 * PostFxEditor — dev-only leva panel for live post-processing tuning.
 * Section A: Tier Simulator — override the active device tier for testing.
 * Section B: Per-tier FX toggles — enable/disable effects per tier, updating the TierFxMatrix.
 * Section C: Color grading parameters — live-edit all CameraEffects values.
 * Only imported when process.env.NODE_ENV === "development" (tree-shaken from prod bundle).
 */

import { useControls } from "leva";
import { useEffect } from "react";
import { useDeviceTier } from "@/app/context/DeviceTierContext";
import type { DeviceTier, TierFxMatrix } from "@/app/config/deviceTier";
import { DEFAULT_TIER_FX } from "@/app/config/deviceTier";
import { ANIMATION_CONFIG } from "@/app/config/animation";
import type { FxValues } from "@/app/components/three/Scene";

type EditorValues = {
  fx: FxValues;
  emissiveIntensity: number;
};

type PostFxEditorProps = {
  onValuesChange: (values: EditorValues) => void;
};

export function PostFxEditor({ onValuesChange }: PostFxEditorProps) {
  const { setTierOverride, setFxMatrix } = useDeviceTier();
  const fx = ANIMATION_CONFIG.scenePostFx;

  // --- Section A: Tier Simulator ---
  const { activeTier } = useControls("Tier Simulator", {
    activeTier: {
      value: "desktop" as DeviceTier,
      options: ["desktop", "tablet", "mobile", "battery-saver"] as DeviceTier[],
    },
  });

  useEffect(() => {
    setTierOverride(activeTier as DeviceTier);
    return () => setTierOverride(null);
  }, [activeTier, setTierOverride]);

  // --- Section B: Per-tier FX toggles ---
  const desktopFx = useControls("Desktop FX", {
    postProcessing: DEFAULT_TIER_FX.desktop.postProcessing,
    bloom: DEFAULT_TIER_FX.desktop.bloom,
    videoBacklight: DEFAULT_TIER_FX.desktop.videoBacklight,
    maxDpr: { value: DEFAULT_TIER_FX.desktop.maxDpr, min: 0.5, max: 3, step: 0.25 },
  });
  const tabletFx = useControls("Tablet FX", {
    postProcessing: DEFAULT_TIER_FX.tablet.postProcessing,
    bloom: DEFAULT_TIER_FX.tablet.bloom,
    videoBacklight: DEFAULT_TIER_FX.tablet.videoBacklight,
    maxDpr: { value: DEFAULT_TIER_FX.tablet.maxDpr, min: 0.5, max: 3, step: 0.25 },
  });
  const mobileFx = useControls("Mobile FX", {
    postProcessing: DEFAULT_TIER_FX.mobile.postProcessing,
    bloom: DEFAULT_TIER_FX.mobile.bloom,
    videoBacklight: DEFAULT_TIER_FX.mobile.videoBacklight,
    maxDpr: { value: DEFAULT_TIER_FX.mobile.maxDpr, min: 0.5, max: 3, step: 0.25 },
  });
  const batterySaverFx = useControls("Battery-Saver FX", {
    postProcessing: DEFAULT_TIER_FX["battery-saver"].postProcessing,
    bloom: DEFAULT_TIER_FX["battery-saver"].bloom,
    videoBacklight: DEFAULT_TIER_FX["battery-saver"].videoBacklight,
    maxDpr: { value: DEFAULT_TIER_FX["battery-saver"].maxDpr, min: 0.5, max: 3, step: 0.25 },
  });

  useEffect(() => {
    const matrix: TierFxMatrix = {
      desktop: desktopFx,
      tablet: tabletFx,
      mobile: mobileFx,
      "battery-saver": batterySaverFx,
    };
    setFxMatrix(matrix);
  }, [desktopFx, tabletFx, mobileFx, batterySaverFx, setFxMatrix]);

  // --- Section C: Color grading parameters ---
  const toneMapping = useControls("Tone Mapping", {
    middleGrey: { value: fx.toneMiddleGrey, min: 0.1, max: 2, step: 0.05 },
    maxLuminance: { value: fx.toneMaxLuminance, min: 1, max: 32, step: 0.5 },
    averageLuminance: { value: fx.toneAverageLuminance, min: 0.1, max: 4, step: 0.1 },
  });
  const bloom = useControls("Bloom", {
    intensity: { value: fx.bloomIntensity, min: 0, max: 3, step: 0.05 },
    luminanceThreshold: { value: fx.bloomLuminanceThreshold, min: 0, max: 1, step: 0.01 },
    luminanceSmoothing: { value: fx.bloomLuminanceSmoothing, min: 0, max: 1, step: 0.01 },
    radius: { value: fx.bloomRadius, min: 0, max: 1, step: 0.01 },
  });
  const colorGrading = useControls("Color Grading", {
    saturation: { value: fx.saturation, min: -1, max: 1, step: 0.01 },
    brightness: { value: fx.brightness, min: -1, max: 1, step: 0.01 },
    contrast: { value: fx.contrast, min: -1, max: 1, step: 0.01 },
  });
  const vignette = useControls("Vignette", {
    offset: { value: fx.vignetteOffset, min: 0, max: 1, step: 0.01 },
    darkness: { value: fx.vignetteDarkness, min: 0, max: 2, step: 0.01 },
  });
  const noise = useControls("Noise", {
    opacity: { value: fx.noiseOpacity, min: 0, max: 0.5, step: 0.005 },
  });
  const videoBacklight = useControls("Video Backlight", {
    emissiveIntensity: { value: 1.5, min: 0, max: 5, step: 0.1 },
  });

  useEffect(() => {
    onValuesChange({
      fx: {
        enabled: true,
        toneMiddleGrey: toneMapping.middleGrey,
        toneMaxLuminance: toneMapping.maxLuminance,
        toneAverageLuminance: toneMapping.averageLuminance,
        bloomIntensity: bloom.intensity,
        bloomLuminanceThreshold: bloom.luminanceThreshold,
        bloomLuminanceSmoothing: bloom.luminanceSmoothing,
        bloomRadius: bloom.radius,
        saturation: colorGrading.saturation,
        brightness: colorGrading.brightness,
        contrast: colorGrading.contrast,
        vignetteOffset: vignette.offset,
        vignetteDarkness: vignette.darkness,
        noiseOpacity: noise.opacity,
      },
      emissiveIntensity: videoBacklight.emissiveIntensity,
    });
  }, [toneMapping, bloom, colorGrading, vignette, noise, videoBacklight, onValuesChange]);

  return null;
}
