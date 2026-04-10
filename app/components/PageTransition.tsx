"use client";

/**
 * PageTransition wraps content in a framer-motion animated div to add simple entry/exit transitions.
 * It accepts children, an optional transition type, and an optional className for styling.
 * Used by project, studio, and diary pages for soft route transitions.
 */

import { motion, type Variants } from "framer-motion";
import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { ANIMATION_CONFIG } from "@/app/config/animation";
import { emitRouteReady } from "@/app/utils/routeReady";

export type TransitionType = "fade" | "slide" | "slideUp" | "morph";

const transitionVariants: Record<TransitionType, Variants> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -24 },
  },
  slideUp: {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -24 },
  },
  morph: {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  },
};

const defaultTransition = {
  duration: ANIMATION_CONFIG.pageTransition.fadeDuration,
  ease: ANIMATION_CONFIG.pageTransition.fadeEase,
};

export type PageTransitionProps = {
  children: React.ReactNode;
  type?: TransitionType;
  className?: string;
};

export function PageTransition({
  children,
  type = "fade",
  className,
}: PageTransitionProps) {
  const pathname = usePathname();
  const skipMotionOnce = useMemo(() => {
    if (typeof window === "undefined") return false;
    const shouldSkip = sessionStorage.getItem("route-shape-nav") === "1";
    if (shouldSkip) sessionStorage.removeItem("route-shape-nav");
    return shouldSkip;
  }, []);

  useEffect(() => {
    const a = requestAnimationFrame(() => {
      requestAnimationFrame(() => emitRouteReady(pathname ?? "/"));
    });
    return () => cancelAnimationFrame(a);
  }, [pathname, skipMotionOnce]);

  if (skipMotionOnce) {
    return <div className={className}>{children}</div>;
  }

  const variants = transitionVariants[type];

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={defaultTransition}
      className={className}
    >
      {children}
    </motion.div>
  );
}
