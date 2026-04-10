"use client";

/**
 * CarouselCard exports 3D card primitives used by the project carousel.
 * ProjectCard shows a textured cover with hover scaling, PlaceholderCard renders a neutral slot, and AddCard shows a plus card for creating projects.
 * Used only inside CarouselScene.
 */

import { forwardRef, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
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

const CARD_WIDTH_MOBILE = 3;
const CARD_HEIGHT_MOBILE = 2;

const HOVER_SCALE = 1.1;
const SCALE_LERP = 0.05;

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
    const coverTex = useTexture(coverUrl);
    const planeWidth = isMobile
      ? CARD_WIDTH_MOBILE - PLANE_MARGIN
      : CARD_WIDTH - PLANE_MARGIN;
    const planeHeight = isMobile
      ? CARD_HEIGHT_MOBILE - PLANE_MARGIN
      : CARD_HEIGHT - PLANE_MARGIN;
    const texMemo = useMemo(() => {
      coverTex.wrapS = coverTex.wrapT = THREE.ClampToEdgeWrapping;
      coverTex.colorSpace = THREE.SRGBColorSpace;
      fitCoverTextureToPlane(coverTex, planeWidth, planeHeight);
      return coverTex;
    }, [coverUrl, coverTex, planeWidth, planeHeight]);
    const repeatW = isMobile ? CARD_WIDTH_MOBILE * ROUGHNESS_ZOOM : CARD_WIDTH * ROUGHNESS_ZOOM;
    const repeatH = isMobile ? CARD_HEIGHT_MOBILE * ROUGHNESS_ZOOM : CARD_HEIGHT * ROUGHNESS_ZOOM;
    const roughnessTex = useRoughnessFromMRMap(ROUGHNESS_MR_TEXTURE_URL, repeatW, repeatH, roughnessEnabled);

    const scaleGroupRef = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);
    const scaleRef = useRef(1);

    useFrame(() => {
      const target = hovered ? HOVER_SCALE : 1;
      scaleRef.current += (target - scaleRef.current) * SCALE_LERP;
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
              transmission={0.98}
              roughness={0.3}
              roughnessMap={roughnessTex ?? undefined}
              metalness={0.0}
              ior={1.5}
              clearcoat={1.0}
              clearcoatRoughness={0.1}
              clearcoatRoughnessMap={roughnessTex ?? undefined}
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
              map={texMemo}
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
    const roughnessTex = useRoughnessFromMRMap(ROUGHNESS_MR_TEXTURE_URL, repeatW, repeatH, roughnessEnabled);
    return (
      <mesh ref={ref} position={position}>
        <boxGeometry args={[isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH, isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT, CARD_DEPTH]} />
        <meshPhysicalMaterial
          transmission={0}
          roughness={0.15}
          roughnessMap={roughnessTex ?? undefined}
          metalness={0.0}
          ior={1.45}
          clearcoat={1.0}
          clearcoatRoughness={0.12}
          clearcoatRoughnessMap={roughnessTex ?? undefined}
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
    const roughnessTex = useRoughnessFromMRMap(ROUGHNESS_MR_TEXTURE_URL, repeatW, repeatH, roughnessEnabled);
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
            transmission={0.98}
            roughness={0.3}
            roughnessMap={roughnessTex ?? undefined}
            metalness={0.0}
            ior={1.5}
            clearcoat={1.0}
            clearcoatRoughness={0.1}
            clearcoatRoughnessMap={roughnessTex ?? undefined}
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
