"use client";

/**
 * Returns true when the viewport width is below the given breakpoint.
 * Re-evaluates on resize, debounced to one rAF to avoid excessive state
 * updates during drag-resize or soft-keyboard appearance on mobile.
 */
import { useState, useEffect } from "react";

export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    let rafId = 0;
    const onResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(check);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafId);
    };
  }, [breakpoint]);

  return isMobile;
}
