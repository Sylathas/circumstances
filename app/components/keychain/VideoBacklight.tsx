"use client";

/**
 * VideoBacklight places an emissive plane behind the keychain that samples the background video texture.
 * This simulates the video screen casting colored light onto the model — the same approach as a
 * Blender emission plane — without the expensive per-frame PMREM generation of LiveVideoEnvironment.
 * Used inside IntroScene in place of LiveVideoEnvironment.
 */

import { useMemo, useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { RefObject } from "react";
import { useDeviceTier } from "@/app/context/DeviceTierContext";

type VideoBacklightProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Emissive intensity of the backlight plane. Tunable via leva in dev. */
  emissiveIntensity?: number;
};

export function VideoBacklight({ videoRef, emissiveIntensity = 0.35 }: VideoBacklightProps) {
  const { tier, fxMatrix } = useDeviceTier();
  const videoBacklightEnabled = fxMatrix[tier].videoBacklight;
  const [videoReady, setVideoReady] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const { camera } = useThree();
  const zPos = -42;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onData = () => setVideoReady(true);
    el.addEventListener("loadeddata", onData);
    if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) setVideoReady(true);
    return () => el.removeEventListener("loadeddata", onData);
  }, [videoRef]);

  const texture = useMemo(() => {
    if (!videoBacklightEnabled || !videoReady || !videoRef.current) return null;
    const t = new THREE.VideoTexture(videoRef.current);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return t;
  }, [videoBacklightEnabled, videoReady, videoRef]);

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  // Stable Color instance — avoids allocating a new object every render.
  const emissiveColor = useMemo(() => new THREE.Color(1, 1, 1), []);

  // Mark texture dirty only when the video is actually advancing.
  // Skipping needsUpdate on a paused/ended video saves a GPU upload each frame.
  useFrame(() => {
    const el = videoRef.current;
    if (texture && el && !el.paused && !el.ended) texture.needsUpdate = true;

    const mesh = meshRef.current;
    if (!mesh) return;
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const distance = Math.max(0.001, camera.position.z - zPos);
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const height = 2 * Math.tan(vFov / 2) * distance;
    const width = height * camera.aspect;
    mesh.scale.set(width, height, 1);
  });

  if (!videoBacklightEnabled || !texture) return null;

  return (
    <mesh ref={meshRef} position={[0, 0, zPos]}>
      <planeGeometry />
      <meshStandardMaterial
        ref={materialRef}
        emissiveMap={texture}
        emissive={emissiveColor}
        emissiveIntensity={emissiveIntensity}
        toneMapped
      />
    </mesh>
  );
}
