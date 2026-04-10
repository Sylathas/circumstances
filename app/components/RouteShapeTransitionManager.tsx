"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { warmupProjectsCarousel } from "@/app/components/carousel/projectsWarmup";

type RouteTransitionDetail = {
  action: "Diary" | "Projects" | "Studio" | "Tag";
  route: string;
};

function parseCssDurationMs(raw: string | null | undefined, fallbackMs: number) {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return fallbackMs;
  if (value.endsWith("ms")) {
    const n = Number.parseFloat(value.slice(0, -2));
    return Number.isFinite(n) ? n : fallbackMs;
  }
  if (value.endsWith("s")) {
    const n = Number.parseFloat(value.slice(0, -1));
    return Number.isFinite(n) ? n * 1000 : fallbackMs;
  }
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallbackMs;
}

export default function RouteShapeTransitionManager() {
  const router = useRouter();
  const pathname = usePathname();
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayExpanded, setOverlayExpanded] = useState(false);
  const [fallbackDurationMs, setFallbackDurationMs] = useState(700);
  const isTransitioningRef = useRef(false);
  const fallbackModeRef = useRef(false);
  const fallbackDurationRef = useRef(700);

  useEffect(() => {
    router.prefetch("/projects");
    router.prefetch("/studio");
    router.prefetch("/diary");

    const runWarmup = () => {
      void Promise.allSettled([
        warmupProjectsCarousel({ preloadImages: true, maxImages: 10 }),
        import("@/app/components/carousel/CarouselScene"),
      ]);
    };

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof win.requestIdleCallback === "function") {
      const id = win.requestIdleCallback(runWarmup, { timeout: 1200 });
      return () => {
        if (typeof win.cancelIdleCallback === "function") {
          win.cancelIdleCallback(id);
        }
      };
    }

    const timeout = window.setTimeout(runWarmup, 450);
    return () => window.clearTimeout(timeout);
  }, [router]);

  useEffect(() => {
    const onRouteTransition = (ev: Event) => {
      const custom = ev as CustomEvent<RouteTransitionDetail>;
      const route = custom.detail?.route;
      if (!route || isTransitioningRef.current) return;

      ev.preventDefault();
      isTransitioningRef.current = true;

      const doc = document as Document & {
        startViewTransition?: (
          update: () => void | Promise<void>
        ) => { finished: Promise<void> };
      };

      // Preferred path: true old->new shared transition, where "new page"
      // is clipped from a small center square to fullscreen.
      if (typeof doc.startViewTransition === "function") {
        document.documentElement.classList.add("route-shape-vt");
        const transition = doc.startViewTransition(() => {
          sessionStorage.setItem("route-shape-nav", "1");
          router.push(route);
        });
        transition.finished.finally(() => {
          document.documentElement.classList.remove("route-shape-vt");
          isTransitioningRef.current = false;
        });
        return;
      }

      // Fallback path (non-supporting browsers).
      const cssDurationMs = parseCssDurationMs(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--route-shape-duration"
        ),
        700
      );
      const durationMs = Math.max(120, Math.min(4000, Math.round(cssDurationMs)));
      fallbackDurationRef.current = durationMs;
      setFallbackDurationMs(durationMs);

      fallbackModeRef.current = true;
      setOverlayVisible(true);
      requestAnimationFrame(() => {
        setOverlayExpanded(true);
      });
      window.setTimeout(() => {
        sessionStorage.setItem("route-shape-nav", "1");
        router.push(route);
      }, durationMs);
    };

    window.addEventListener(
      "keychain:route-transition",
      onRouteTransition as EventListener
    );
    return () => {
      window.removeEventListener(
        "keychain:route-transition",
        onRouteTransition as EventListener
      );
    };
  }, [router]);

  useEffect(() => {
    if (!isTransitioningRef.current || !fallbackModeRef.current) return;
    const t = window.setTimeout(() => {
      setOverlayVisible(false);
      setOverlayExpanded(false);
      isTransitioningRef.current = false;
      fallbackModeRef.current = false;
    }, Math.max(120, Math.round(fallbackDurationRef.current * 0.35)));
    return () => window.clearTimeout(t);
  }, [pathname]);

  if (!overlayVisible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center">
      <div
        className={`h-10 w-10 bg-black transition-transform duration-500 ease-[cubic-bezier(.22,.8,.2,1)] ${
          overlayExpanded ? "scale-[80]" : "scale-0"
        }`}
        style={{ transitionDuration: `${fallbackDurationMs}ms` }}
      />
    </div>
  );
}
