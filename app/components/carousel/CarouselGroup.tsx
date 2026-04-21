"use client";

import { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Project } from "@/app/types/project";
import type { ActiveFilters } from "@/app/components/Header";
import { ProjectCard, PlaceholderCard, AddCard } from "./CarouselCard";
import type { ScrollEasing } from "./CarouselScene";
import { ANIMATION_CONFIG } from "@/app/config/animation";

function filterTransitionTotalMs(ft: typeof ANIMATION_CONFIG.carousel.filterTransition): number {
  const { hideMs, arcDelayMs, arcMs, showDelayMs, showMs } = ft;
  return Math.max(hideMs, arcDelayMs + arcMs, showDelayMs + showMs);
}

type ArcSnap = {
  angleStep: number;
  slotByProjectId: Map<string, number>;
  addSlotIndex: number;
};

function buildArcSnap(visible: Project[], isAdmin: boolean): ArcSnap {
  const n = visible.length + (isAdmin ? 1 : 0);
  const angleStep = (2 * Math.PI) / Math.max(1, n);
  const slotByProjectId = new Map(visible.map((p, i) => [p.id, i]));
  const addSlotIndex = isAdmin ? visible.length : -1;
  return { angleStep, slotByProjectId, addSlotIndex };
}

function cubicEaseIn(t: number): number {
  return t * t * t;
}

function cubicEaseOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function cubicEaseInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Shortest rotation from a → b so cards slide a small arc, not the long way around. */
function lerpAngleShortest(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

function circlePositionFromAngle(
  angle: number,
  radius: number,
  vertical: boolean
): [number, number, number] {
  if (vertical) {
    return [0, radius * Math.sin(angle), radius * Math.cos(angle)];
  }
  return [radius * Math.sin(angle), 0, radius * Math.cos(angle)];
}

export type CarouselGroupProps = {
  allProjects: Project[];
  visibleOrdered: Project[];
  activeFilters: ActiveFilters;
  isAdmin: boolean;
  onAddClick: () => void;
  onProjectClick: (index: number) => void;
  radius: number;
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
  allProjects,
  visibleOrdered,
  activeFilters,
  isAdmin,
  onAddClick,
  onProjectClick,
  radius,
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
  const lastRoundedRef = useRef(0);

  const filterTransitionKey = useMemo(() => {
    if (activeFilters.size === 0) return "__all__";
    return [...activeFilters].sort().join("\x1e");
  }, [activeFilters]);

  const ft = ANIMATION_CONFIG.carousel.filterTransition;
  const filterTotalMs = filterTransitionTotalMs(ft);

  const committedSnapRef = useRef<ArcSnap>(buildArcSnap(visibleOrdered, isAdmin));
  const transitionStartRef = useRef<number | null>(null);
  /** Layout before the current filter transition (slots + angle step). */
  const layoutFromSnapRef = useRef<ArcSnap>(committedSnapRef.current);
  const hasMountedFilterEffectRef = useRef(false);
  const angleStepEffPrevRef = useRef(-1);

  useEffect(() => {
    const n = allProjects.length + (isAdmin ? 1 : 0);
    if (cardRefs.current.length < n) {
      cardRefs.current = [
        ...cardRefs.current,
        ...new Array(n - cardRefs.current.length).fill(null),
      ];
    } else if (cardRefs.current.length > n) {
      cardRefs.current = cardRefs.current.slice(0, n);
    }
  }, [allProjects.length, isAdmin]);

  useEffect(() => {
    if (!hasMountedFilterEffectRef.current) {
      hasMountedFilterEffectRef.current = true;
      return;
    }
    const oldSnap = committedSnapRef.current;
    const newSnap = buildArcSnap(visibleOrdered, isAdmin);
    layoutFromSnapRef.current = oldSnap;
    transitionStartRef.current = performance.now();
    const ratio = oldSnap.angleStep / newSnap.angleStep;
    scrollRef.current *= ratio;
    targetRef.current *= ratio;
    angleStepEffPrevRef.current = newSnap.angleStep;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filter changes only
  }, [filterTransitionKey]);

  useFrame((_, delta) => {
    const targetSnap = buildArcSnap(visibleOrdered, isAdmin);
    const angleStep = targetSnap.angleStep;
    const tStart = transitionStartRef.current;
    const elapsed =
      tStart != null ? performance.now() - tStart : filterTotalMs + 1;
    const inFilterTransition = tStart != null && elapsed < filterTotalMs;

    const {
      hideMs,
      arcDelayMs,
      arcMs,
      showDelayMs,
      showMs,
    } = ft;
    const uHide = Math.min(1, elapsed / Math.max(1, hideMs));
    const arcElapsed = elapsed - arcDelayMs;
    const uArc = cubicEaseInOut(
      Math.min(1, Math.max(0, arcElapsed) / Math.max(1, arcMs))
    );
    const showElapsed = elapsed - showDelayMs;
    const uShow = Math.min(1, Math.max(0, showElapsed) / Math.max(1, showMs));

    if (!inFilterTransition && tStart != null) {
      transitionStartRef.current = null;
      committedSnapRef.current = targetSnap;
    }

    if (!inFilterTransition && transitionStartRef.current == null) {
      if (angleStepEffPrevRef.current < 0) {
        angleStepEffPrevRef.current = angleStep;
      } else if (Math.abs(angleStep - angleStepEffPrevRef.current) > 1e-9) {
        const ratio = angleStepEffPrevRef.current / angleStep;
        scrollRef.current *= ratio;
        targetRef.current *= ratio;
        angleStepEffPrevRef.current = angleStep;
      } else {
        angleStepEffPrevRef.current = angleStep;
      }
    }

    const layoutFrom = inFilterTransition
      ? layoutFromSnapRef.current
      : targetSnap;

    const targetScroll = targetRef.current;
    const currentScroll = scrollRef.current;
    const diffScroll = targetScroll - currentScroll;
    const lerpFactor =
      scrollEasing === "easeOut"
        ? 1 - Math.exp(-scrollSpeed * delta)
        : Math.min(1, scrollSpeed * delta);
    const next = currentScroll + diffScroll * lerpFactor;
    scrollRef.current = next;

    const slotBefore = (id: string) => layoutFrom.slotByProjectId.get(id) ?? -1;
    const slotAfter = (id: string) => targetSnap.slotByProjectId.get(id) ?? -1;
    const addSlotBefore = layoutFrom.addSlotIndex;
    const addSlotAfter = targetSnap.addSlotIndex;

    const group = groupRef.current;
    if (group) {
      if (isMobile) {
        group.rotation.set(next * angleStep, 0, 0);
      } else {
        group.rotation.set(0, -next * angleStep, 0);
      }

      const processCard = (
        card: THREE.Mesh | THREE.Group | null,
        visB: boolean,
        visA: boolean,
        slB: number,
        slA: number,
        projectId: string | null
      ) => {
        if (!card) return;

        let scale = 1;
        if (!visB && !visA) {
          scale = 0;
        } else if (!visB && visA) {
          scale = cubicEaseOut(uShow);
        } else if (visB && !visA) {
          scale = 1 - cubicEaseIn(uHide);
        }

        const aOld = layoutFrom.angleStep;
        const aNew = angleStep;
        let theta: number;
        if (visB && !visA) {
          theta = slB * aOld;
        } else if (!visB && visA) {
          theta = slA * aNew;
        } else if (visB && visA) {
          const theta0 = slB * aOld;
          const theta1 = slA * aNew;
          theta = lerpAngleShortest(theta0, theta1, uArc);
        } else {
          theta = 0;
        }

        const pos = circlePositionFromAngle(theta, radius, isMobile);
        card.position.set(pos[0], pos[1], pos[2]);
        card.scale.setScalar(scale);

        const angle = theta;
        if (isMobile) {
          const y = pos[1];
          const z = pos[2];
          tangentA.set(0, y + Math.cos(angle), z - Math.sin(angle));
          tangentB.set(0, y - Math.cos(angle), z + Math.sin(angle));
        } else {
          const x = pos[0];
          const z = pos[2];
          tangentA.set(x + Math.cos(angle), 0, z - Math.sin(angle));
          tangentB.set(x - Math.cos(angle), 0, z + Math.sin(angle));
        }
        group.localToWorld(tangentA);
        group.localToWorld(tangentB);
        cameraTarget.copy(camera.position);

        const effectiveSlot =
          visA ? slA : inFilterTransition && visB ? slB : -1;
        let dist =
          effectiveSlot >= 0 ? effectiveSlot - next : 10;
        while (dist > numSlots / 2) dist -= numSlots;
        while (dist < -numSlots / 2) dist += numSlots;

        const isContentSlot =
          (projectId != null && (visA || (inFilterTransition && visB))) ||
          (projectId == null &&
            (addSlotAfter >= 0 || (inFilterTransition && addSlotBefore >= 0)));

        const blend = isContentSlot
          ? 1 - smoothstep(frontTurnNear, frontTurnFar, Math.abs(dist))
          : 0;

        const distA = cameraTarget.distanceToSquared(tangentA);
        const distB = cameraTarget.distanceToSquared(tangentB);
        lookAtTarget.copy(distA <= distB ? tangentA : tangentB);
        lookAtTarget.lerp(cameraTarget, blend);
        card.lookAt(lookAtTarget);
      };

      let refIdx = 0;
      for (const project of allProjects) {
        const slB = slotBefore(project.id);
        const slA = slotAfter(project.id);
        const visB = slB >= 0;
        const visA = slA >= 0;
        const card = cardRefs.current[refIdx];
        processCard(card, visB, visA, slB, slA, project.id);
        refIdx++;
      }

      if (isAdmin) {
        const visB = addSlotBefore >= 0;
        const visA = addSlotAfter >= 0;
        const card = cardRefs.current[refIdx];
        processCard(card, visB, visA, addSlotBefore, addSlotAfter, null);
      }
    }

    const rounded = Math.round(next);
    if (rounded !== lastRoundedRef.current) {
      lastRoundedRef.current = rounded;
    }

    const wrapped = ((rounded % numSlots) + numSlots) % numSlots;
    if (wrapped !== lastReportedRef.current) {
      lastReportedRef.current = wrapped;
      onActiveIndexChange(wrapped);
    }
  });

  let renderIdx = 0;
  const setRef =
    (idx: number) =>
    (el: THREE.Mesh | THREE.Group | null) => {
      cardRefs.current[idx] = el;
    };

  return (
    <group ref={groupRef}>
      {allProjects.map((project) => {
        const idx = renderIdx++;
        const coverUrl = project["Cover Image"];
        const inVisible = visibleOrdered.findIndex((p) => p.id === project.id);
        return coverUrl ? (
          <ProjectCard
            key={project.id}
            ref={setRef(idx)}
            coverUrl={coverUrl}
            position={[0, 0, 0]}
            onClick={() => {
              if (!isDragging && inVisible >= 0) onProjectClick(inVisible);
            }}
            isMobile={isMobile}
          />
        ) : (
          <PlaceholderCard key={project.id} ref={setRef(idx)} position={[0, 0, 0]} isMobile={isMobile} />
        );
      })}
      {isAdmin && (
        <AddCard
          key="__add__"
          ref={setRef(renderIdx)}
          position={[0, 0, 0]}
          onClick={() => {
            if (!isDragging) onAddClick();
          }}
          isMobile={isMobile}
        />
      )}
    </group>
  );
}
