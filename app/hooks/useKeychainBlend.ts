"use client";

/**
 * useKeychainBlend encapsulates animation blend state for the keychain interactive model.
 * Manages hover blend refs, idle blend refs, and the per-frame weight interpolation loop.
 * Extracted from KeychainModels to reduce its LOC and isolate blend concerns.
 * Used only by KeychainModels.
 */

import { useCallback, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clipForNodes } from "@/app/components/keychain/keychainClipUtils";
import type { ManagedClipName } from "@/app/components/keychain/keychainInteractionConfig";
import { BLEND_BACK_SECONDS, BLEND_SECONDS, type StateNodeName } from "@/app/components/keychain/keychainInteractionConfig";

export type HoverBlendState = {
  from: THREE.AnimationAction | null;
  to: THREE.AnimationAction | null;
  fromStartWeight: number;
  fromEndWeight: number;
  toStartWeight: number;
  toEndWeight: number;
  startMs: number;
  durationMs: number;
};

export type IdleBlendState = {
  from: THREE.AnimationAction;
  to: THREE.AnimationAction;
  startMs: number;
  durationMs: number;
};

/** Cubic ease-in-out curve used for all blend interpolations. */
function cubicEaseInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

type UseKeychainBlendArgs = {
  managedClips: Partial<Record<ManagedClipName, THREE.AnimationClip | null>>;
  mixer: THREE.AnimationMixer;
  scene: THREE.Group;
  onIdleBlendComplete?: () => void;
};

type UseKeychainBlendReturn = {
  hoverBlendRef: React.MutableRefObject<HoverBlendState | null>;
  idleBlendRef: React.MutableRefObject<IdleBlendState | null>;
  hoveredNodeRef: React.MutableRefObject<StateNodeName | null>;
  hoverActionRef: React.MutableRefObject<THREE.AnimationAction | null>;
  hoverActionsRef: React.MutableRefObject<Map<string, THREE.AnimationAction>>;
  startHoverBlend: (
    from: THREE.AnimationAction | null,
    to: THREE.AnimationAction | null,
    fromStartWeight: number,
    fromEndWeight: number,
    toStartWeight: number,
    toEndWeight: number,
    durationMs: number
  ) => void;
  cancelIdleBlend: (currentActionRef: React.MutableRefObject<"Idle" | string>) => void;
  getHoverAction: (nodeName: StateNodeName) => THREE.AnimationAction | null;
  stopAllHoverActions: () => void;
};

export function useKeychainBlend({
  managedClips,
  mixer,
  scene,
  onIdleBlendComplete,
}: UseKeychainBlendArgs): UseKeychainBlendReturn {
  const hoverBlendRef = useRef<HoverBlendState | null>(null);
  const idleBlendRef = useRef<IdleBlendState | null>(null);
  const hoveredNodeRef = useRef<StateNodeName | null>(null);
  const hoverActionRef = useRef<THREE.AnimationAction | null>(null);
  const hoverActionsRef = useRef<Map<string, THREE.AnimationAction>>(new Map());

  const startHoverBlend = useCallback(
    (
      from: THREE.AnimationAction | null,
      to: THREE.AnimationAction | null,
      fromStartWeight: number,
      fromEndWeight: number,
      toStartWeight: number,
      toEndWeight: number,
      durationMs: number
    ) => {
      hoverBlendRef.current = {
        from,
        to,
        fromStartWeight,
        fromEndWeight,
        toStartWeight,
        toEndWeight,
        startMs: performance.now(),
        durationMs,
      };
    },
    []
  );

  const cancelIdleBlend = useCallback(
    (currentActionRef: React.MutableRefObject<"Idle" | string>) => {
      const blend = idleBlendRef.current;
      if (!blend) return;
      blend.from.stop();
      blend.from.enabled = false;
      blend.to.enabled = true;
      blend.to.setEffectiveWeight(1);
      idleBlendRef.current = null;
      currentActionRef.current = "Idle";
    },
    []
  );

  const getHoverAction = useCallback(
    (nodeName: StateNodeName): THREE.AnimationAction | null => {
      const cached = hoverActionsRef.current.get(nodeName);
      if (cached) return cached;
      const base = managedClips.HoveredBase;
      if (!base) return null;
      const hoverClip = clipForNodes(base, [nodeName], { sparseFallback: false });
      if (hoverClip.tracks.length === 0) return null;
      const action = mixer.clipAction(hoverClip, scene);
      hoverActionsRef.current.set(nodeName, action);
      return action;
    },
    [managedClips.HoveredBase, mixer, scene]
  );

  const stopAllHoverActions = useCallback(() => {
    hoverBlendRef.current = null;
    hoveredNodeRef.current = null;
    hoverActionRef.current = null;
    for (const action of hoverActionsRef.current.values()) {
      action.stop();
      action.enabled = false;
      action.setEffectiveWeight(0);
    }
  }, []);

  useFrame(() => {
    // Skip the whole tick when nothing is blending — avoids any per-frame cost at rest.
    if (!hoverBlendRef.current && !idleBlendRef.current) return;

    // Hover blend tick
    const hoverBlend = hoverBlendRef.current;
    if (hoverBlend) {
      const elapsed = performance.now() - hoverBlend.startMs;
      const t = Math.min(1, elapsed / hoverBlend.durationMs);
      const eased = cubicEaseInOut(t);
      const lerp = (a: number, b: number) => a + (b - a) * eased;
      if (hoverBlend.from) {
        hoverBlend.from.enabled = true;
        hoverBlend.from.setEffectiveWeight(lerp(hoverBlend.fromStartWeight, hoverBlend.fromEndWeight));
      }
      if (hoverBlend.to) {
        hoverBlend.to.enabled = true;
        hoverBlend.to.setEffectiveWeight(lerp(hoverBlend.toStartWeight, hoverBlend.toEndWeight));
      }
      if (t >= 1) {
        if (hoverBlend.from) {
          hoverBlend.from.setEffectiveWeight(hoverBlend.fromEndWeight);
          if (hoverBlend.fromEndWeight <= 0.0001) {
            hoverBlend.from.stop();
            hoverBlend.from.enabled = false;
          }
        }
        if (hoverBlend.to) {
          hoverBlend.to.enabled = true;
          hoverBlend.to.setEffectiveWeight(hoverBlend.toEndWeight);
          if (hoverBlend.toEndWeight <= 0.0001) {
            hoverBlend.to.stop();
            hoverBlend.to.enabled = false;
          }
        }
        if (
          hoverActionRef.current &&
          hoveredNodeRef.current === null &&
          hoverActionRef.current.getEffectiveWeight() <= 0.0001
        ) {
          hoverActionRef.current = null;
        }
        hoverBlendRef.current = null;
      }
    }

    // Idle blend tick
    const blend = idleBlendRef.current;
    if (!blend) return;
    const elapsed = performance.now() - blend.startMs;
    const t = Math.min(1, elapsed / blend.durationMs);
    const eased = cubicEaseInOut(t);
    blend.from.enabled = true;
    blend.to.enabled = true;
    blend.from.setEffectiveWeight(1 - eased);
    blend.to.setEffectiveWeight(eased);
    if (t >= 1) {
      blend.to.setEffectiveWeight(1);
      blend.from.stop();
      blend.from.enabled = false;
      idleBlendRef.current = null;
      onIdleBlendComplete?.();
    }
  });

  return {
    hoverBlendRef,
    idleBlendRef,
    hoveredNodeRef,
    hoverActionRef,
    hoverActionsRef,
    startHoverBlend,
    cancelIdleBlend,
    getHoverAction,
    stopAllHoverActions,
  };
}

export const HOVER_BLEND_MS = Math.round(BLEND_SECONDS * 1000);
export const IDLE_BLEND_MS = Math.round(BLEND_BACK_SECONDS * 1000);
