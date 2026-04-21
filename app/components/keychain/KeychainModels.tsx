"use client";

/**
 * KeychainModels renders the interactive keychain 3D model with blended animations.
 * It handles idle loops, per-node hover overlays, and click-to-navigate actions for each key fob.
 * Used inside Scene as the primary interactive element on the home page.
 */

import { useAnimations, useGLTF } from "@react-three/drei";
import { type ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { KEYCHAIN_MODELS } from "./keychainAssets";
import { buildManagedClips, reportClipsTouchingStateNodes } from "./keychainClipUtils";
import { useLoading } from "@/app/context/LoadingContext";
import { useDeviceTier } from "@/app/context/DeviceTierContext";
import { useKeychainBlend, HOVER_BLEND_MS, IDLE_BLEND_MS } from "@/app/hooks/useKeychainBlend";
import { triggerRouteTransition } from "@/app/utils/keychainRouteTransition";
import {
  ACTION_NAMES,
  BLEND_SECONDS,
  type ActionName,
  findInteractiveClip,
  findInteractiveNodeName,
  MAILTO_URL,
  type ManagedClipName,
  ROOT_POS,
  ROOT_ROT,
  STATE_NODES,
  type StateNodeName,
} from "./keychainInteractionConfig";

// Preload low/high variants for progressive startup.
useGLTF.preload(KEYCHAIN_MODELS.whole);
useGLTF.preload(KEYCHAIN_MODELS.wholeLowres);
if (KEYCHAIN_MODELS.wholeLod1 !== KEYCHAIN_MODELS.wholeLowres) {
  useGLTF.preload(KEYCHAIN_MODELS.wholeLod1);
}

function clearTimeoutRef(timeoutRef: RefObject<number | null>) {
  if (timeoutRef.current !== null) {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
}

/** Keep `IdleChain` time aligned when `IdleState` is reset (same source clip, two actions). */
function restartIdleChainLoop(action: THREE.AnimationAction | null | undefined) {
  if (!action) return;
  action.reset();
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.clampWhenFinished = false;
  action.enabled = true;
  action.play();
}

type KeychainModelsProps = {
  visible?: boolean;
  interactive?: boolean;
};

export default function KeychainModels({
  visible = true,
  interactive = true,
}: KeychainModelsProps) {
  const rootRef = useRef<THREE.Group>(null);
  const suppressOutsideClearRef = useRef(false);
  const currentActionRef = useRef<"Idle" | ActionName>("Idle");
  const armedSecondClickRef = useRef<ActionName | null>(null);
  const clickBlendLockRef = useRef(false);
  const clickBlendLockTimeoutRef = useRef<number | null>(null);
  const managedActionsRef = useRef<Partial<Record<ManagedClipName, THREE.AnimationAction>>>({});
  const [animDebug, setAnimDebug] = useState(false);

  const { markGlbReady } = useLoading();
  const { tier } = useDeviceTier();
  const shouldStayLowRes = tier === "battery-saver";
  const lowResModelUrl =
    tier === "mobile" || tier === "battery-saver"
      ? KEYCHAIN_MODELS.wholeLod1
      : KEYCHAIN_MODELS.wholeLowres;
  /** One GLB per mount (no low→high swap) fixes mixer/action bugs after intro; battery-saver keeps LOD. */
  const modelUrl = shouldStayLowRes ? lowResModelUrl : KEYCHAIN_MODELS.whole;
  const { scene, animations } = useGLTF(modelUrl);
  const { mixer } = useAnimations(animations, rootRef);

  const sceneCenterOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    if (box.isEmpty()) return new THREE.Vector3(0, 0, 0);
    const center = box.getCenter(new THREE.Vector3());
    return center.multiplyScalar(-1);
  }, [scene]);

  const managedClips = useMemo(() => buildManagedClips(animations), [animations]);

  useEffect(() => {
    setAnimDebug(new URLSearchParams(window.location.search).get("keychainAnimDebug") === "1");
  }, []);

  useEffect(() => {
    if (!animDebug) return;
    const idleState = managedClips.IdleState;
    const idleChain = managedClips.IdleChain;
    console.group("[keychainAnimDebug] clips from GLB");
    console.log("modelUrl (which file is loaded):", modelUrl);
    console.table(
      animations.map((a) => ({
        name: a.name,
        duration: Number(a.duration.toFixed(4)),
        tracks: a.tracks.length,
      }))
    );
    console.log(
      "[keychainAnimDebug] STATE_NODES present in each clip (if Idle is empty here for diarykey etc., those curves are not in this GLB under that clip name):"
    );
    console.table(reportClipsTouchingStateNodes(animations, STATE_NODES));
    console.log("IdleState track count:", idleState?.tracks.length ?? 0);
    console.log("IdleChain track count:", idleChain?.tracks.length ?? 0);
    if (idleState) {
      console.log("IdleState sample track names:", idleState.tracks.slice(0, 30).map((t) => t.name));
    }
    if (idleChain) {
      console.log("IdleChain sample track names:", idleChain.tracks.slice(0, 30).map((t) => t.name));
    }
    if (idleState && idleChain) {
      const idleNames = new Set(idleState.tracks.map((t) => t.name));
      const overlap = idleChain.tracks.filter((t) => idleNames.has(t.name)).length;
      console.log(
        "Tracks present on both IdleState and IdleChain (same bindings = double-driven):",
        overlap,
        "/",
        idleChain.tracks.length
      );
    }
    console.groupEnd();
  }, [animDebug, animations, managedClips, modelUrl]);

  useEffect(() => {
    if (!animDebug) return;
    const id = window.setInterval(() => {
      const idle = managedActionsRef.current.IdleState;
      const chain = managedActionsRef.current.IdleChain;
      console.log("[keychainAnimDebug] actions ~1s", {
        idleTime: idle?.time,
        idleEffWeight: idle?.getEffectiveWeight(),
        idleWeight: idle?.weight,
        idleEnabled: idle?.enabled,
        idlePaused: idle?.paused,
        idleRunning: idle?.isRunning(),
        chainTime: chain?.time,
        chainEffWeight: chain?.getEffectiveWeight(),
        chainEnabled: chain?.enabled,
        chainPaused: chain?.paused,
        chainRunning: chain?.isRunning(),
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [animDebug, modelUrl]);

  const {
    hoverBlendRef,
    idleBlendRef,
    hoveredNodeRef,
    hoverActionRef,
    hoverActionsRef,
    startHoverBlend,
    cancelIdleBlend,
    getHoverAction,
    stopAllHoverActions,
  } = useKeychainBlend({
    managedClips,
    mixer,
    scene,
    onIdleBlendComplete: () => {
      currentActionRef.current = "Idle";
    },
  });

  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
      if (child instanceof THREE.Light) {
        if (child.name === "Accent") child.intensity = 40 * 15;
        if (child.name === "Front") child.intensity = 80 * 15;
      }
    });
    markGlbReady();
  }, [scene, markGlbReady]);

  const getAction = useCallback(
    (name: ManagedClipName): THREE.AnimationAction | null => {
      const cached = managedActionsRef.current[name];
      if (cached) return cached;
      const clip = managedClips[name];
      if (!clip) return null;
      // Always bind to the glTF root `scene` (not the outer R3F group). Mixing `rootRef` and
      // `scene` across actions or with a null ref on first call breaks PropertyBinding resolution.
      const action = mixer.clipAction(clip, scene);
      managedActionsRef.current[name] = action;
      return action;
    },
    [managedClips, mixer, scene]
  );

  useEffect(() => {
    const idle = getAction("IdleState");
    if (!idle) return;
    idle.reset();
    idle.setLoop(THREE.LoopRepeat, Infinity);
    idle.clampWhenFinished = false;
    idle.enabled = true;
    idle.play();
    restartIdleChainLoop(getAction("IdleChain"));
    return () => {
      for (const key of Object.keys(managedActionsRef.current) as ManagedClipName[]) {
        const action = managedActionsRef.current[key];
        if (!action) continue;
        action.stop();
        mixer.uncacheAction(action.getClip(), scene);
      }
      for (const action of hoverActionsRef.current.values()) {
        action.stop();
        mixer.uncacheAction(action.getClip(), scene);
      }
      hoverActionsRef.current.clear();
      clearTimeoutRef(clickBlendLockTimeoutRef);
      managedActionsRef.current = {};
    };
  }, [getAction, mixer, scene, hoverActionsRef]);

  useEffect(() => {
    const onFinished = (ev: THREE.Event & { action?: THREE.AnimationAction }) => {
      const action = ev.action;
      if (!action) return;
      for (const name of ACTION_NAMES) {
        const a = getAction(name);
        if (!a || a !== action) continue;
        a.paused = true;
        a.enabled = true;
        a.time = a.getClip().duration;
      }
    };
    mixer.addEventListener("finished", onFinished);
    return () => {
      mixer.removeEventListener("finished", onFinished);
    };
  }, [getAction, mixer]);

  const stopActionAfterBlend = useCallback((name: ActionName) => {
    window.setTimeout(() => {
      const a = getAction(name);
      if (!a) return;
      if (currentActionRef.current === name) return;
      a.stop();
      a.enabled = false;
    }, Math.round(BLEND_SECONDS * 1000) + 20);
  }, [getAction]);

  const returnToIdleFromAction = useCallback(
    (actionName: ActionName) => {
      stopAllHoverActions();
      hoverActionRef.current = null;
      hoveredNodeRef.current = null;
      idleBlendRef.current = null;
      const idle = getAction("IdleState");
      const from = getAction(actionName);
      if (!idle) {
        currentActionRef.current = "Idle";
        armedSecondClickRef.current = null;
        return;
      }
      if (!from) {
        currentActionRef.current = "Idle";
        armedSecondClickRef.current = null;
        idle.reset();
        restartIdleChainLoop(getAction("IdleChain"));
        idle.setLoop(THREE.LoopRepeat, Infinity);
        idle.clampWhenFinished = false;
        idle.setEffectiveWeight(1);
        idle.enabled = true;
        idle.play();
        return;
      }
      idle.reset();
      restartIdleChainLoop(getAction("IdleChain"));
      idle.setLoop(THREE.LoopRepeat, Infinity);
      idle.clampWhenFinished = false;
      idle.setEffectiveWeight(0);
      idle.enabled = true;
      idle.play();
      from.enabled = true;
      from.paused = false;
      from.setEffectiveWeight(1);
      idle.crossFadeFrom(from, BLEND_SECONDS, false);
      stopActionAfterBlend(actionName);
      currentActionRef.current = "Idle";
      armedSecondClickRef.current = null;
    },
    [getAction, idleBlendRef, stopActionAfterBlend, stopAllHoverActions]
  );

  const toIdle = useCallback(() => {
    armedSecondClickRef.current = null;
    if (idleBlendRef.current) return;
    stopAllHoverActions();
    const idle = getAction("IdleState");
    if (!idle) return;
    const fromName = currentActionRef.current;
    const from = hoverActionRef.current ?? (fromName === "Idle" ? null : getAction(fromName));
    if (!from) {
      currentActionRef.current = "Idle";
      hoverActionRef.current = null;
      hoveredNodeRef.current = null;
      return;
    }
    from.enabled = true;
    // Do not reset IdleState / IdleChain here: they keep advancing on the mixer during
    // hover and one-click "hold" clips; resetting made the chain idle look like it restarted
    // when clicking away back to general idle.
    idle.paused = false;
    idle.enabled = true;
    idle.setLoop(THREE.LoopRepeat, Infinity);
    idle.clampWhenFinished = false;
    idle.setEffectiveWeight(0);
    idle.play();
    idleBlendRef.current = {
      from,
      to: idle,
      startMs: performance.now(),
      durationMs: IDLE_BLEND_MS,
    };
    hoverActionRef.current = null;
    hoveredNodeRef.current = null;
  }, [getAction, hoverActionRef, hoveredNodeRef, idleBlendRef, stopAllHoverActions]);

  const setHoverTarget = useCallback(
    (nodeName: StateNodeName | null) => {
      const prevHover = hoverActionRef.current;
      const canHover =
        interactive &&
        !clickBlendLockRef.current &&
        !idleBlendRef.current &&
        currentActionRef.current === "Idle";
      const nextNode = canHover ? nodeName : null;
      if (nextNode === hoveredNodeRef.current) return;
      hoveredNodeRef.current = nextNode;

      if (!nextNode) {
        if (!prevHover) return;
        const startWeight = prevHover.getEffectiveWeight();
        if (startWeight <= 0.0001) {
          prevHover.stop();
          prevHover.enabled = false;
          prevHover.setEffectiveWeight(0);
          hoverActionRef.current = null;
          hoverBlendRef.current = null;
          return;
        }
        startHoverBlend(prevHover, null, startWeight, 0, 0, 0, IDLE_BLEND_MS);
        return;
      }

      const nextHover = getHoverAction(nextNode);
      if (!nextHover) return;
      const prevWeight =
        prevHover && prevHover !== nextHover ? prevHover.getEffectiveWeight() : 0;
      const nextWeight = nextHover.getEffectiveWeight();
      hoverActionRef.current = nextHover;
      nextHover.enabled = true;
      nextHover.paused = false;
      nextHover.setLoop(THREE.LoopOnce, 1);
      nextHover.clampWhenFinished = true;
      nextHover.timeScale = 1;
      if (nextWeight <= 0.0001) {
        nextHover.reset();
        nextHover.setEffectiveWeight(0);
      } else {
        nextHover.setEffectiveWeight(nextWeight);
      }
      nextHover.play();
      startHoverBlend(prevHover ?? null, nextHover, prevWeight, 0, nextWeight, 1, HOVER_BLEND_MS);
    },
    [getHoverAction, hoverActionRef, hoverBlendRef, hoveredNodeRef, interactive, idleBlendRef, startHoverBlend]
  );

  const playClipAndHold = useCallback((clipName: ActionName) => {
    if (clickBlendLockRef.current) return;
    cancelIdleBlend(currentActionRef);
    clickBlendLockRef.current = true;
    clearTimeoutRef(clickBlendLockTimeoutRef);
    clickBlendLockTimeoutRef.current = window.setTimeout(() => {
      clickBlendLockRef.current = false;
      clickBlendLockTimeoutRef.current = null;
    }, HOVER_BLEND_MS + 40);

    const selected = getAction(clipName);
    if (!selected) return;
    const fromName = currentActionRef.current;
    const from = fromName === "Idle" ? getAction("IdleState") : getAction(fromName);
    stopAllHoverActions();

    selected.reset();
    selected.enabled = true;
    selected.paused = false;
    selected.setEffectiveWeight(1);
    selected.setLoop(THREE.LoopOnce, 1);
    selected.clampWhenFinished = true;
    selected.timeScale = 1;
    selected.play();

    if (from && from !== selected) {
      idleBlendRef.current = null;
      from.paused = false;
      from.enabled = true;
      selected.crossFadeFrom(from, BLEND_SECONDS, false);
      if (fromName !== "Idle") {
        stopActionAfterBlend(fromName);
      }
    }
    currentActionRef.current = clipName;
  }, [cancelIdleBlend, getAction, idleBlendRef, stopActionAfterBlend, stopAllHoverActions]);

  useEffect(() => {
    const onWindowPointerDown = () => {
      if (suppressOutsideClearRef.current) {
        suppressOutsideClearRef.current = false;
        return;
      }
      toIdle();
    };
    window.addEventListener("pointerdown", onWindowPointerDown);
    return () => window.removeEventListener("pointerdown", onWindowPointerDown);
  }, [toIdle]);

  const onPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    const clip = findInteractiveClip(e.object);
    if (!clip) return;
    suppressOutsideClearRef.current = true;
    e.stopPropagation();
    if (
      clip === armedSecondClickRef.current &&
      clip === currentActionRef.current &&
      !clickBlendLockRef.current
    ) {
      returnToIdleFromAction(clip);
      if (clip === "Tag") {
        window.location.href = MAILTO_URL;
      } else {
        triggerRouteTransition(clip);
      }
      return;
    }
    armedSecondClickRef.current = clip;
    playClipAndHold(clip);
  }, [interactive, playClipAndHold, returnToIdleFromAction]);

  const onPointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    const node = findInteractiveNodeName(e.object);
    setHoverTarget(node ?? null);
  }, [interactive, setHoverTarget]);

  const onPointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    const node = findInteractiveNodeName(e.object);
    if (!node) return;
    setHoverTarget(node);
  }, [interactive, setHoverTarget]);

  const onPointerOut = useCallback(() => {
    if (!interactive) return;
    setHoverTarget(null);
  }, [interactive, setHoverTarget]);

  useEffect(() => {
    const onPointerLeave = () => setHoverTarget(null);
    const onBlur = () => setHoverTarget(null);
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onBlur);
    };
  }, [setHoverTarget]);

  useEffect(() => {
    if (interactive) return;
    setHoverTarget(null);
  }, [interactive, setHoverTarget]);

  useEffect(() => {
    const available = animations.map((a) => a.name);
    const missingRequired =
      !managedClips.IdleState ||
      !managedClips.HoveredBase ||
      !managedClips.Diary ||
      !managedClips.Projects ||
      !managedClips.Studio ||
      !managedClips.Tag;
    if (missingRequired) {
      console.warn(
        "[KeychainModels] Missing one or more required clips (Idle/Hovered/Diary/Projects/Studio/Tag).",
        available
      );
    }
    if (!managedClips.IdleChain) {
      console.warn(
        "[KeychainModels] Idle clip has no chain tracks (Bone*/Keychain).",
        available
      );
    }
  }, [animations, managedClips, modelUrl]);

  return (
    <group ref={rootRef} position={ROOT_POS} rotation={ROOT_ROT} visible={visible}>
      <group position={sceneCenterOffset}>
        <primitive
          object={scene}
          onPointerDown={interactive ? onPointerDown : undefined}
          onPointerOver={interactive ? onPointerOver : undefined}
          onPointerMove={interactive ? onPointerMove : undefined}
          onPointerOut={interactive ? onPointerOut : undefined}
        />
      </group>
    </group>
  );
}
