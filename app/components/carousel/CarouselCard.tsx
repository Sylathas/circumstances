"use client";

import { forwardRef, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useMemo } from "react";

const CARD_WIDTH = 2.5;
const CARD_HEIGHT = 4;
const CARD_DEPTH = 0.08;

const HOVER_SCALE = 1.1;
const SCALE_LERP = 0.05;

type ProjectCardProps = {
  coverUrl: string;
  position: [number, number, number];
  onClick?: () => void;
};

const PLANE_MARGIN = 0.1;

export const ProjectCard = forwardRef<THREE.Group, ProjectCardProps>(
  function ProjectCard({ coverUrl, position, onClick }, ref) {
    const texture = useTexture(coverUrl);
    const texMemo = useMemo(() => {
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }, [coverUrl, texture]);

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
            <boxGeometry args={[CARD_WIDTH - 0.01, CARD_HEIGHT - 0.01, CARD_DEPTH]} />
            <meshPhysicalMaterial
              transmission={0.99}
              roughness={0.1}
              metalness={0.0}
              ior={1.45}
              clearcoat={1.0}
              clearcoatRoughness={0.03}
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
              args={[CARD_WIDTH - PLANE_MARGIN, CARD_HEIGHT - PLANE_MARGIN]}
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
};

export const PlaceholderCard = forwardRef<THREE.Mesh, PlaceholderCardProps>(
  function PlaceholderCard({ position }, ref) {
    return (
      <mesh ref={ref} position={position}>
        <boxGeometry args={[CARD_WIDTH, CARD_HEIGHT, CARD_DEPTH]} />
        <meshPhysicalMaterial
          transmission={0}
          roughness={0.05}
          metalness={0.0}
          ior={1.45}
          clearcoat={1.0}
          clearcoatRoughness={0.03}
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
};

export const AddCard = forwardRef<THREE.Group, AddCardProps>(
  function AddCard({ position, onClick }, ref) {
    return (
      <group ref={ref} position={position}>
        <mesh
          renderOrder={0}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <boxGeometry args={[CARD_WIDTH, CARD_HEIGHT, CARD_DEPTH]} />
          <meshPhysicalMaterial
            transmission={0.95}
            roughness={0.05}
            metalness={0.0}
            ior={1.45}
            clearcoat={1.0}
            clearcoatRoughness={0.03}
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
