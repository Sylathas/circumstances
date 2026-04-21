"use client";

/**
 * CarouselScene renders the 3D rotating carousel of project cards with drag and programmatic navigation.
 * It accepts the project list, admin flags, active index, and callbacks for index changes, add-click, and project-click.
 * Used on the home page to browse and select projects.
 */

import React, { useRef, useEffect, useState, Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import * as THREE from "three";
import type { Project } from "@/app/types/project";
import type { ActiveFilters } from "@/app/components/Header";
import { CarouselGroup } from "./CarouselGroup";
import { ANIMATION_CONFIG } from "@/app/config/animation";

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

const CAMERA_OFFSET = ANIMATION_CONFIG.carousel.cameraOffset;
const DRAG_SENSITIVITY = ANIMATION_CONFIG.carousel.dragSensitivity;

export type ScrollEasing = "linear" | "easeOut";

type CarouselSceneProps = {
  allProjects: Project[];
  activeFilters: ActiveFilters;
  isAdmin: boolean;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onAddClick: () => void;
  onProjectClick: (index: number) => void;
  scrollSpeed?: number;
  scrollEasing?: ScrollEasing;
  frontTurnNear?: number;
  frontTurnFar?: number;
};

export default function CarouselScene({
  allProjects,
  activeFilters,
  isAdmin,
  activeIndex,
  onActiveIndexChange,
  onAddClick,
  onProjectClick,
  scrollSpeed = ANIMATION_CONFIG.carousel.scrollSpeed,
  scrollEasing = ANIMATION_CONFIG.carousel.scrollEasing,
  frontTurnNear = ANIMATION_CONFIG.carousel.frontTurnNear,
  frontTurnFar = ANIMATION_CONFIG.carousel.frontTurnFar,
}: CarouselSceneProps) {
  const scrollRef = useRef(0);
  const targetRef = useRef(0);
  const lastReportedRef = useRef(-1);
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startTarget: 0,
  });

  const visibleOrdered = useMemo(
    () =>
      activeFilters.size === 0
        ? allProjects
        : allProjects.filter((p) => activeFilters.has(p.Type)),
    [allProjects, activeFilters]
  );

  const N = visibleOrdered.length + (isAdmin ? 1 : 0);
  const numSlots = Math.max(1, N);
  const isMobile = useIsMobile();
  const radius = isMobile
    ? ANIMATION_CONFIG.carousel.arcRadiusMobile
    : ANIMATION_CONFIG.carousel.arcRadiusDesktop;
  const [isDragging, setIsDragging] = useState(false);
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

  useEffect(() => {
    const container = document.querySelector("[data-carousel-container]");
    if (!container) return;

    const DRAG_CLICK_THRESHOLD_PX = 5;

    const onDown = (e: Event) => {
      const pe = e as PointerEvent;
      dragRef.current = {
        active: true,
        startX: pe.clientX,
        startY: pe.clientY,
        startTarget: targetRef.current,
      };
      setIsDragging(false);
    };
    const onMove = (e: Event) => {
      if (!dragRef.current.active) return;
      const pe = e as PointerEvent;
      const dx = pe.clientX - dragRef.current.startX;
      const dy = pe.clientY - dragRef.current.startY;
      const delta = isMobile ? dy : -dx;
      if (
        !isDragging &&
        Math.hypot(dx, dy) > DRAG_CLICK_THRESHOLD_PX
      ) {
        setIsDragging(true);
      }
      targetRef.current =
        dragRef.current.startTarget + delta * DRAG_SENSITIVITY;
      const wrapped =
        ((Math.round(targetRef.current) % numSlots) + numSlots) % numSlots;
      if (wrapped !== lastReportedRef.current) {
        lastReportedRef.current = wrapped;
        onActiveIndexChange(wrapped);
      }
    };
    const onUp = () => {
      dragRef.current.active = false;
      // Allow next pointerdown to be treated as a click again.
      // We keep isDragging as-is so clicks that fire immediately after a drag
      // still see isDragging === true and are ignored.
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
  }, [numSlots, onActiveIndexChange, isMobile, isDragging]);

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
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 6, 5]} intensity={0.35} />
        <Suspense fallback={null}>
          <Environment files={"/textures/monochrome_studio_04_1k.exr"} environmentRotation={[-Math.PI / 8, Math.PI / 1.15, 0]} />
        </Suspense>
        <CarouselGroup
          allProjects={allProjects}
          visibleOrdered={visibleOrdered}
          activeFilters={activeFilters}
          isAdmin={isAdmin}
          onAddClick={onAddClick}
          onProjectClick={onProjectClick}
          radius={radius}
          numSlots={numSlots}
          scrollRef={scrollRef}
          targetRef={targetRef}
          lastReportedRef={lastReportedRef}
          onActiveIndexChange={onActiveIndexChange}
          scrollSpeed={scrollSpeed}
          scrollEasing={scrollEasing}
          frontTurnNear={frontTurnNear}
          frontTurnFar={frontTurnFar}
          isMobile={isMobile}
          isDragging={isDragging}
        />
      </Canvas>
    </div>
  );
}

