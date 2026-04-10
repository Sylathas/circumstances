"use client";

/**
 * DeviceTierContext provides the detected device tier and per-tier FX config to the component tree.
 * Tier is detected synchronously on mount, then potentially downgraded to "battery-saver" via the Battery API.
 * The leva dev panel (PostFxEditor) can override both the active tier and the TierFxMatrix at runtime.
 * Used by CameraEffects, VideoBacklight, HomeExperience, and CarouselScene.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  DEFAULT_TIER_FX,
  detectDeviceTier,
  type DeviceTier,
  type TierFxMatrix,
} from "@/app/config/deviceTier";

type DeviceTierContextValue = {
  tier: DeviceTier;
  fxMatrix: TierFxMatrix;
  /** Dev-only: override the active tier (e.g. from leva Tier Simulator). */
  setTierOverride: (tier: DeviceTier | null) => void;
  /** Dev-only: override the full fx matrix (e.g. from leva per-tier toggles). */
  setFxMatrix: (matrix: TierFxMatrix) => void;
};

const DeviceTierContext = createContext<DeviceTierContextValue | null>(null);

export function DeviceTierProvider({ children }: { children: React.ReactNode }) {
  const [detectedTier, setDetectedTier] = useState<DeviceTier>("desktop");
  const [tierOverride, setTierOverride] = useState<DeviceTier | null>(null);
  const [fxMatrix, setFxMatrix] = useState<TierFxMatrix>(DEFAULT_TIER_FX);

  useEffect(() => {
    const t = detectDeviceTier();
    setDetectedTier(t);

    // Async Battery API downgrade (Chrome only)
    if (t !== "desktop") return;
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{ level: number; charging: boolean }>;
    };
    if (typeof nav.getBattery !== "function") return;
    nav.getBattery().then((battery) => {
      if (!battery.charging && battery.level < 0.2) {
        setDetectedTier("battery-saver");
      }
    }).catch(() => { /* ignore */ });
  }, []);

  const tier = tierOverride ?? detectedTier;

  const handleSetTierOverride = useCallback((t: DeviceTier | null) => {
    setTierOverride(t);
  }, []);

  const handleSetFxMatrix = useCallback((matrix: TierFxMatrix) => {
    setFxMatrix(matrix);
  }, []);

  return (
    <DeviceTierContext.Provider
      value={{ tier, fxMatrix, setTierOverride: handleSetTierOverride, setFxMatrix: handleSetFxMatrix }}
    >
      {children}
    </DeviceTierContext.Provider>
  );
}

export function useDeviceTier(): DeviceTierContextValue {
  const ctx = useContext(DeviceTierContext);
  if (!ctx) throw new Error("useDeviceTier must be used within DeviceTierProvider");
  return ctx;
}
