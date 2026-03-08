"use client";

import React, { useRef, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import type { Project } from "@/app/types/project";
import { ProjectCard, PlaceholderCard, AddCard } from "./CarouselCard";

class CardErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

const RADIUS = 3;
/** Camera distance from origin: circle sits closer to the screen */
const CAMERA_OFFSET = 10;
/** Pixels to drag = 1 slot rotation */
const DRAG_SENSITIVITY = 0.008;

// Position on circle: card at index p is at angle p * angleStep.
function circlePosition(
  p: number,
  radius: number,
  angleStep: number
): [number, number, number] {
  const angle = p * angleStep;
  return [radius * Math.sin(angle), 0, radius * Math.cos(angle)];
}

// BoxGeometry’s “front” face used for the main view is -Z; tangent at θ is (cos θ, 0, -sin θ), so rotation.y = π/2 - θ.
export type ScrollEasing = "linear" | "easeOut";

type CarouselSceneProps = {
  projects: Project[];
  isAdmin: boolean;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onAddClick: () => void;
  onProjectClick: (index: number) => void;
  /** Scroll speed: indices per second (linear) or time constant (easeOut). Default 2 */
  scrollSpeed?: number;
  scrollEasing?: ScrollEasing;
  /** When the card is this close to "front" (in slot distance), it fully faces the screen. Default 0.2 */
  frontTurnNear?: number;
  /** When the card is beyond this distance from "front", it stays tangent. Default 0.6. Larger = slower turn. */
  frontTurnFar?: number;
};

export default function CarouselScene({
  projects,
  isAdmin,
  activeIndex,
  onActiveIndexChange,
  onAddClick,
  onProjectClick,
  scrollSpeed = 2,
  scrollEasing = "easeOut",
  frontTurnNear = 0.3,
  frontTurnFar = 0.7,
}: CarouselSceneProps) {
  const scrollRef = useRef(0);
  const targetRef = useRef(0);
  const lastReportedRef = useRef(-1);
  const dragRef = useRef({ active: false, startX: 0, startTarget: 0 });

  const N = projects.length + (isAdmin ? 1 : 0);
  const numSlots = Math.max(1, N);
  const angleStep = (2 * Math.PI) / numSlots;

  // When parent sets activeIndex (e.g. filter), jump target to that card. Skip while dragging so easing isn’t overridden.
  useEffect(() => {
    if (dragRef.current.active) return;
    const current = scrollRef.current;
    const currentWrapped =
      ((Math.round(current) % numSlots) + numSlots) % numSlots;
    if (activeIndex !== lastReportedRef.current) {
      let d = (activeIndex - currentWrapped + numSlots) % numSlots;
      if (d > numSlots / 2) d -= numSlots;
      targetRef.current = current + d;
      lastReportedRef.current = activeIndex;
    }
  }, [activeIndex, numSlots]);

  // Drag: update target from pointer movement (attach to container so it works over empty space too)
  useEffect(() => {
    const container = document.querySelector("[data-carousel-container]");
    if (!container) return;

    const onDown = (e: Event) => {
      const pe = e as PointerEvent;
      dragRef.current = {
        active: true,
        startX: pe.clientX,
        startTarget: targetRef.current,
      };
    };
    const onMove = (e: Event) => {
      if (!dragRef.current.active) return;
      const pe = e as PointerEvent;
      const dx = pe.clientX - dragRef.current.startX;
      targetRef.current = dragRef.current.startTarget - dx * DRAG_SENSITIVITY;
      const wrapped =
        ((Math.round(targetRef.current) % numSlots) + numSlots) % numSlots;
      if (wrapped !== lastReportedRef.current) {
        lastReportedRef.current = wrapped;
        onActiveIndexChange(wrapped);
      }
    };
    const onUp = () => {
      dragRef.current.active = false;
    };

    container.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointerleave", onUp);
    return () => {
      container.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointerleave", onUp);
    };
  }, [numSlots, onActiveIndexChange]);

  return (
    <div
      data-carousel-container
      style={{
        width: "100%",
        height: "100%",
        touchAction: "none",
        cursor: "default",
      }}
    >
      <Canvas
        camera={{
          fov: 50,
          position: [0, 0, CAMERA_OFFSET],
        }}
        gl={{ alpha: false }}
        onCreated={({ gl }) => gl.setClearColor(0xffffff, 1)}
        style={{ display: "block", width: "100%", height: "100%" }}
      >
        <ambientLight intensity={0.6} />
        <Environment preset="studio" />
        <CarouselGroup
          projects={projects}
          isAdmin={isAdmin}
          onAddClick={onAddClick}
          onProjectClick={onProjectClick}
          radius={RADIUS}
          angleStep={angleStep}
          numSlots={numSlots}
          scrollRef={scrollRef}
          targetRef={targetRef}
          lastReportedRef={lastReportedRef}
          onActiveIndexChange={onActiveIndexChange}
          scrollSpeed={scrollSpeed}
          scrollEasing={scrollEasing}
          frontTurnNear={frontTurnNear}
          frontTurnFar={frontTurnFar}
        />
      </Canvas>
    </div>
  );
}

type CarouselGroupProps = {
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
};

const _lookAtTarget = new THREE.Vector3();
const _cameraTarget = new THREE.Vector3();

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function CarouselGroup({
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
      group.rotation.y = -next * angleStep;

      // Orient each card: tangent to the circle, but blend to face camera when in front (front or back by whichever is closest)
      for (let p = 0; p < numSlots; p++) {
        const card = cardRefs.current[p];
        if (!card) continue;
        const angle = p * angleStep;
        const x = radius * Math.sin(angle);
        const z = radius * Math.cos(angle);
        _lookAtTarget.set(x + Math.cos(angle), 0, z - Math.sin(angle));
        group.localToWorld(_lookAtTarget);
        // Tangent target in world (card will look at this when tangent)
        const tangentTargetX = _lookAtTarget.x;
        const tangentTargetY = _lookAtTarget.y;
        const tangentTargetZ = _lookAtTarget.z;
        // Always face the camera with the front of the card when in front (no flip to back)
        _cameraTarget.copy(camera.position);
        const isContentSlot =
          p < projects.length || (isAdmin && p === projects.length);
        let dist = p - next;
        while (dist > numSlots / 2) dist -= numSlots;
        while (dist < -numSlots / 2) dist += numSlots;
        const blend = isContentSlot
          ? 1 - smoothstep(frontTurnNear, frontTurnFar, Math.abs(dist))
          : 0;
        _lookAtTarget.set(tangentTargetX, tangentTargetY, tangentTargetZ);
        _lookAtTarget.lerp(_cameraTarget, blend);
        card.lookAt(_lookAtTarget);
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
        const pos = circlePosition(p, radius, angleStep);

        const setRef = (el: THREE.Mesh | THREE.Group | null) => {
          cardRefs.current[p] = el;
        };

        if (p < projects.length) {
          const project = projects[p];
          const coverUrl = project["Cover Image"];
          return coverUrl ? (
            <CardErrorBoundary
              key={`slot-${p}`}
              fallback={<PlaceholderCard ref={setRef} position={pos} />}
            >
              <ProjectCard
                ref={setRef}
                coverUrl={coverUrl}
                position={pos}
                onClick={() => onProjectClick(p)}
              />
            </CardErrorBoundary>
          ) : (
            <PlaceholderCard key={`slot-${p}`} ref={setRef} position={pos} />
          );
        }
        if (isAdmin && p === projects.length) {
          return (
            <AddCard
              key={`slot-${p}`}
              ref={setRef}
              position={pos}
              onClick={onAddClick}
            />
          );
        }
        return (
          <PlaceholderCard key={`slot-${p}`} ref={setRef} position={pos} />
        );
      })}
    </group>
  );
}
