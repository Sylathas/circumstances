"use client";

/**
 * CarouselCard exports 3D card primitives used by the project carousel.
 * ProjectCard shows a textured cover with hover scaling, PlaceholderCard renders a neutral slot, and AddCard shows a plus card for creating projects.
 * Used only inside CarouselScene.
 */

import { forwardRef, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import {
  ROUGHNESS_MR_TEXTURE_URL,
  ROUGHNESS_ZOOM,
  useRoughnessFromMRMap,
} from "./carouselRoughness";
import { useDeviceTier } from "@/app/context/DeviceTierContext";

const CARD_WIDTH = 2.5;
const CARD_HEIGHT = 4;
const CARD_DEPTH = 0.08;

const CARD_WIDTH_MOBILE = 3.5;
const CARD_HEIGHT_MOBILE = 2.5;

const HOVER_SCALE = 1.1;
const SCALE_LERP = 0.05;

/** Shared 1×1 white map for covers until Firebase image loads. */
const WHITE_COVER_TEXTURE = (() => {
  const data = new Uint8Array([255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();

function useGlassReady(roughnessEnabled: boolean, roughnessTex: THREE.Texture | null): boolean {
  return roughnessEnabled ? roughnessTex != null : true;
}

/** CARD COVER FIT LOGIC (non-stretch, contain) is implemented in fitCoverTextureToPlane below. */

/**
 * fitCoverTextureToPlane
 *
 * Given a texture and the physical size of the card plane, adjust the texture’s
 * repeat/center so that:
 * - the final rendered image keeps its original aspect ratio (no stretching)
 * - the image is fully visible (contain, not cover)
 * - the image is centered on the plane
 *
 * This is the equivalent of CSS `background-size: contain` for the card cover.
 */
function fitCoverTextureToPlane(
  coverTex: THREE.Texture,
  planeWidth: number,
  planeHeight: number
) {
  const image: any = coverTex.image;
  if (!image || !image.width || !image.height || planeWidth <= 0 || planeHeight <= 0) {
    coverTex.center.set(0.5, 0.5);
    coverTex.repeat.set(1, 1);
    coverTex.offset.set(0, 0);
    coverTex.needsUpdate = true;
    return;
  }

  const imgAspect = image.width / image.height; // Wimg / Himg
  const planeAspect = planeWidth / planeHeight; // Wplane / Hplane
  const k = imgAspect / planeAspect; // desiredAspect / planeAspect

  let repeatX = 1;
  let repeatY = 1;
  if (k >= 1) {
    // Image wider than plane: fill width, letterbox top/bottom.
    repeatX = 1;
    repeatY = 1 / k;
  } else {
    // Image taller than plane: fill height, letterbox left/right.
    repeatX = 1 / k;
    repeatY = 1;
  }

  coverTex.center.set(0.5, 0.5);
  coverTex.repeat.set(repeatX, repeatY);
  coverTex.offset.set(0, 0);
  coverTex.needsUpdate = true;
}

type ProjectCardProps = {
  coverUrl: string;
  position: [number, number, number];
  onClick?: () => void;
  isMobile: boolean;
};

const PLANE_MARGIN = 0.1;

export const ProjectCard = forwardRef<THREE.Group, ProjectCardProps>(
  function ProjectCard({ coverUrl, position, onClick, isMobile }, ref) {
    const { tier } = useDeviceTier();
    const roughnessEnabled = tier !== "mobile" && tier !== "battery-saver";
    const planeWidth = isMobile
      ? CARD_WIDTH_MOBILE - PLANE_MARGIN
      : CARD_WIDTH - PLANE_MARGIN;
    const planeHeight = isMobile
      ? CARD_HEIGHT_MOBILE - PLANE_MARGIN
      : CARD_HEIGHT - PLANE_MARGIN;
    const [coverMap, setCoverMap] = useState<THREE.Texture>(() => WHITE_COVER_TEXTURE);
    const coverMapRef = useRef(coverMap);
    coverMapRef.current = coverMap;
    useEffect(
      () => () => {
        const t = coverMapRef.current;
        if (t !== WHITE_COVER_TEXTURE) t.dispose();
      },
      []
    );
    useEffect(() => {
      let cancelled = false;
      setCoverMap((prev) => {
        if (prev !== WHITE_COVER_TEXTURE) prev.dispose();
        return WHITE_COVER_TEXTURE;
      });
      const loader = new THREE.TextureLoader();
      loader.crossOrigin = "anonymous";
      loader.load(
        coverUrl,
        (tex) => {
          if (cancelled) {
            tex.dispose();
            return;
          }
          tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.colorSpace = THREE.SRGBColorSpace;
          fitCoverTextureToPlane(tex, planeWidth, planeHeight);
          setCoverMap((prev) => {
            if (prev !== WHITE_COVER_TEXTURE) prev.dispose();
            return tex;
          });
        },
        undefined,
        () => {
          /* keep white placeholder on error */
        }
      );
      return () => {
        cancelled = true;
      };
    }, [coverUrl, planeWidth, planeHeight]);
    const repeatW = isMobile ? CARD_WIDTH_MOBILE * ROUGHNESS_ZOOM : CARD_WIDTH * ROUGHNESS_ZOOM;
    const repeatH = isMobile ? CARD_HEIGHT_MOBILE * ROUGHNESS_ZOOM : CARD_HEIGHT * ROUGHNESS_ZOOM;
    const roughnessTex = useRoughnessFromMRMap(
      ROUGHNESS_MR_TEXTURE_URL,
      repeatW,
      repeatH,
      roughnessEnabled
    );
    const glassReady = useGlassReady(roughnessEnabled, roughnessTex);

    const scaleGroupRef = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);
    const scaleRef = useRef(1);

    useFrame(() => {
      const target = hovered ? HOVER_SCALE : 1;
      const diff = target - scaleRef.current;
      // Skip write when the scale has fully settled to avoid redundant GPU uploads.
      if (Math.abs(diff) < 0.001) return;
      scaleRef.current += diff * SCALE_LERP;
      const g = scaleGroupRef.current;
      if (g) g.scale.setScalar(scaleRef.current);
    });

    const pointerProps = {
      onPointerOver: (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      },
      onPointerOut: () => {
        setHovered(false);
        document.body.style.cursor = "default";
      },
      onClick: (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        onClick?.();
      },
    };

    return (
      <group ref={ref} position={position}>
        <group ref={scaleGroupRef}>
          {/* Glass draws first (renderOrder 0) so transmission samples the scene/other cards; then plane draws on top (renderOrder 1) */}
          <mesh renderOrder={0} {...pointerProps}>
            <boxGeometry args={[isMobile ? CARD_WIDTH_MOBILE - 0.01 : CARD_WIDTH - 0.01, isMobile ? CARD_HEIGHT_MOBILE - 0.01 : CARD_HEIGHT - 0.01, CARD_DEPTH]} />
            <meshPhysicalMaterial
              transmission={glassReady ? 0.98 : 0}
              roughness={0.3}
              roughnessMap={glassReady && roughnessTex ? roughnessTex : undefined}
              metalness={0.0}
              ior={1.5}
              clearcoat={1.0}
              clearcoatRoughness={0.1}
              clearcoatRoughnessMap={glassReady && roughnessTex ? roughnessTex : undefined}
              envMapIntensity={1.5}
              transparent={true}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh
            position={[0, 0, CARD_DEPTH / 2 - 0.01]}
            renderOrder={1}
            {...pointerProps}
          >
            <planeGeometry
              args={[isMobile ? CARD_WIDTH_MOBILE - PLANE_MARGIN : CARD_WIDTH - PLANE_MARGIN, isMobile ? CARD_HEIGHT_MOBILE - PLANE_MARGIN : CARD_HEIGHT - PLANE_MARGIN]}
            />
            <meshBasicMaterial
              map={coverMap}
              side={THREE.DoubleSide}
              toneMapped={false}
              depthWrite={true}
              depthTest={true}
            />
          </mesh>
        </group>
      </group>
    );
  }
);

type PlaceholderCardProps = {
  position: [number, number, number];
  isMobile: boolean;
};

export const PlaceholderCard = forwardRef<THREE.Mesh, PlaceholderCardProps>(
  function PlaceholderCard({ position, isMobile }, ref) {
    const { tier } = useDeviceTier();
    const roughnessEnabled = tier !== "mobile" && tier !== "battery-saver";
    const repeatW = isMobile ? CARD_WIDTH_MOBILE * ROUGHNESS_ZOOM : CARD_WIDTH * ROUGHNESS_ZOOM;
    const repeatH = isMobile ? CARD_HEIGHT_MOBILE * ROUGHNESS_ZOOM : CARD_HEIGHT * ROUGHNESS_ZOOM;
    const roughnessTex = useRoughnessFromMRMap(
      ROUGHNESS_MR_TEXTURE_URL,
      repeatW,
      repeatH,
      roughnessEnabled
    );
    const glassReady = useGlassReady(roughnessEnabled, roughnessTex);
    return (
      <mesh ref={ref} position={position}>
        <boxGeometry args={[isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH, isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT, CARD_DEPTH]} />
        <meshPhysicalMaterial
          transmission={0}
          roughness={0.15}
          roughnessMap={glassReady && roughnessTex ? roughnessTex : undefined}
          metalness={0.0}
          ior={1.45}
          clearcoat={1.0}
          clearcoatRoughness={0.12}
          clearcoatRoughnessMap={glassReady && roughnessTex ? roughnessTex : undefined}
          envMapIntensity={1.5}
          transparent={true}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    );
  }
);

type AddCardProps = {
  position: [number, number, number];
  onClick: () => void;
  isMobile: boolean;
};

export const AddCard = forwardRef<THREE.Group, AddCardProps>(
  function AddCard({ position, onClick, isMobile }, ref) {
    const { tier } = useDeviceTier();
    const roughnessEnabled = tier !== "mobile" && tier !== "battery-saver";
    const repeatW = isMobile ? CARD_WIDTH_MOBILE * ROUGHNESS_ZOOM : CARD_WIDTH * ROUGHNESS_ZOOM;
    const repeatH = isMobile ? CARD_HEIGHT_MOBILE * ROUGHNESS_ZOOM : CARD_HEIGHT * ROUGHNESS_ZOOM;
    const roughnessTex = useRoughnessFromMRMap(
      ROUGHNESS_MR_TEXTURE_URL,
      repeatW,
      repeatH,
      roughnessEnabled
    );
    const glassReady = useGlassReady(roughnessEnabled, roughnessTex);
    return (
      <group ref={ref} position={position}>
        <mesh
          renderOrder={0}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <boxGeometry args={[isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH, isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT, CARD_DEPTH]} />
          <meshPhysicalMaterial
            transmission={glassReady ? 0.98 : 0}
            roughness={0.3}
            roughnessMap={glassReady && roughnessTex ? roughnessTex : undefined}
            metalness={0.0}
            ior={1.5}
            clearcoat={1.0}
            clearcoatRoughness={0.1}
            clearcoatRoughnessMap={glassReady && roughnessTex ? roughnessTex : undefined}
            envMapIntensity={1.5}
            transparent={true}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh renderOrder={1} position={[0, 0, CARD_DEPTH / 2 + 0.005]}>
          <boxGeometry args={[1, 0.2, 0.01]} />
          <meshStandardMaterial
            color="#808080"
            metalness={0.3}
            roughness={0.5}
            depthWrite={false}
          />
        </mesh>
        <mesh renderOrder={1} position={[0, 0, CARD_DEPTH / 2 + 0.005]}>
          <boxGeometry args={[0.2, 1, 0.01]} />
          <meshStandardMaterial
            color="#808080"
            metalness={0.3}
            roughness={0.5}
            depthWrite={false}
          />
        </mesh>
      </group>
    );
  }
);
