"use client";

import { useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Project } from "@/app/types/project";
import { ProjectCard, PlaceholderCard, AddCard } from "./CarouselCard";
import type { ScrollEasing } from "./CarouselScene";

// Position on circle: card at index p is at angle p * angleStep.
// When vertical is false, cards move left/right around Y axis (desktop).
// When vertical is true, cards move up/down around X axis (mobile).
function circlePosition(
  p: number,
  radius: number,
  angleStep: number,
  vertical: boolean
): [number, number, number] {
  const angle = p * angleStep;
  if (vertical) {
    // Orbit around X axis -> movement in Y/Z plane
    return [0, radius * Math.sin(angle), radius * Math.cos(angle)];
  }
  // Default: orbit around Y axis -> movement in X/Z plane
  return [radius * Math.sin(angle), 0, radius * Math.cos(angle)];
}

export type CarouselGroupProps = {
  projects: Project[];
  isAdmin: boolean;
  onAddClick: () => void;
  onProjectClick: (index: number) => void;
  radius: number;
  angleStep: number;
  numSlots: number;
  scrollRef: React.MutableRefObject<number>;
  targetRef: React.MutableRefObject<number>;
  lastReportedRef: React.MutableRefObject<number>;
  onActiveIndexChange: (index: number) => void;
  scrollSpeed: number;
  scrollEasing: ScrollEasing;
  frontTurnNear: number;
  frontTurnFar: number;
  isMobile: boolean;
  isDragging: boolean;
};

const lookAtTarget = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const tangentA = new THREE.Vector3();
const tangentB = new THREE.Vector3();

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function CarouselGroup({
  projects,
  isAdmin,
  onAddClick,
  onProjectClick,
  radius,
  angleStep,
  numSlots,
  scrollRef,
  targetRef,
  lastReportedRef,
  onActiveIndexChange,
  scrollSpeed,
  scrollEasing,
  frontTurnNear,
  frontTurnFar,
  isMobile,
  isDragging,
}: CarouselGroupProps) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const cardRefs = useRef<(THREE.Mesh | THREE.Group | null)[]>([]);
  const [roundedScroll, setRoundedScroll] = useState(0);
  const lastRoundedRef = useRef(0);

  useFrame((_, delta) => {
    const target = targetRef.current;
    const current = scrollRef.current;
    const diff = target - current;
    const lerpFactor =
      scrollEasing === "easeOut"
        ? 1 - Math.exp(-scrollSpeed * delta)
        : Math.min(1, scrollSpeed * delta);
    const next = current + diff * lerpFactor;
    scrollRef.current = next;

    const group = groupRef.current;
    if (group) {
      if (isMobile) {
        // Vertical carousel: rotate around X so cards travel top ↔ bottom
        group.rotation.set(next * angleStep, 0, 0);
      } else {
        // Desktop: horizontal carousel (existing behavior)
        group.rotation.set(0, -next * angleStep, 0);
      }

      for (let p = 0; p < numSlots; p++) {
        const card = cardRefs.current[p];
        if (!card) continue;
        const pos = circlePosition(p, radius, angleStep, isMobile);

        // Two tangent orientations (front/back along the curve); pick the one
        // closest to the camera to avoid abrupt 180° flips when leaving front.
        const angle = p * angleStep;
        if (isMobile) {
          const y = pos[1];
          const z = pos[2];
          // Tangent directions in Y/Z plane
          tangentA.set(0, y + Math.cos(angle), z - Math.sin(angle));
          tangentB.set(0, y - Math.cos(angle), z + Math.sin(angle));
        } else {
          const x = pos[0];
          const z = pos[2];
          tangentA.set(
            x + Math.cos(angle),
            0,
            z - Math.sin(angle)
          );
          tangentB.set(
            x - Math.cos(angle),
            0,
            z + Math.sin(angle)
          );
        }
        group.localToWorld(tangentA);
        group.localToWorld(tangentB);
        cameraTarget.copy(camera.position);

        const isContentSlot =
          p < projects.length || (isAdmin && p === projects.length);
        let dist = p - next;
        while (dist > numSlots / 2) dist -= numSlots;
        while (dist < -numSlots / 2) dist += numSlots;
        const blend = isContentSlot
          ? 1 - smoothstep(frontTurnNear, frontTurnFar, Math.abs(dist))
          : 0;

        const distA = cameraTarget.distanceToSquared(tangentA);
        const distB = cameraTarget.distanceToSquared(tangentB);
        lookAtTarget.copy(distA <= distB ? tangentA : tangentB);
        lookAtTarget.lerp(cameraTarget, blend);
        card.lookAt(lookAtTarget);
      }
    }

    const rounded = Math.round(next);
    if (rounded !== lastRoundedRef.current) {
      lastRoundedRef.current = rounded;
      setRoundedScroll(rounded);
    }

    const wrapped = ((rounded % numSlots) + numSlots) % numSlots;
    if (wrapped !== lastReportedRef.current) {
      lastReportedRef.current = wrapped;
      onActiveIndexChange(wrapped);
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: numSlots }, (_, p) => {
        const pos = circlePosition(p, radius, angleStep, isMobile);

        const setRef = (el: THREE.Mesh | THREE.Group | null) => {
          cardRefs.current[p] = el;
        };

        if (p < projects.length) {
          const project = projects[p];
          const coverUrl = project["Cover Image"];
          return coverUrl ? (
            <ProjectCard
              key={`slot-${p}`}
              ref={setRef}
              coverUrl={coverUrl}
              position={pos}
              onClick={() => {
                if (!isDragging) onProjectClick(p);
              }}
              isMobile={isMobile}
            />
          ) : (
            <PlaceholderCard key={`slot-${p}`} ref={setRef} position={pos} isMobile={isMobile} />
          );
        }
        if (isAdmin && p === projects.length) {
          return (
            <AddCard
              key={`slot-${p}`}
              ref={setRef}
              position={pos}
              onClick={() => {
                if (!isDragging) onAddClick();
              }}
              isMobile={isMobile}
            />
          );
        }
        return (
          <PlaceholderCard key={`slot-${p}`} ref={setRef} position={pos} isMobile={isMobile} />
        );
      })}
    </group>
  );
}

