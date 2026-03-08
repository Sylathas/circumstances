"use client";

import { motion, type Variants } from "framer-motion";

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

const defaultTransition = { duration: 0.25, ease: "easeInOut" };

type PageTransitionProps = {
  children: React.ReactNode;
  type?: TransitionType;
  className?: string;
};

export default function PageTransition({
  children,
  type = "fade",
  className,
}: PageTransitionProps) {
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
