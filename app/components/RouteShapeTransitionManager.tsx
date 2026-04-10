"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { warmupProjectsCarousel } from "@/app/components/carousel/projectsWarmup";
import { navigateWithBlurTransition } from "@/app/utils/blurRouteTransition";

type RouteTransitionDetail = {
  action?: "Diary" | "Projects" | "Studio" | "Tag";
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

function shouldUseSimpleFadeNavigation(): boolean {
  if (typeof window === "undefined") return false;
  const prefersCoarsePointer =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const narrowViewport = window.innerWidth <= 900;
  return prefersCoarsePointer || narrowViewport;
}

function shouldDisableShapeViewTransition(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isiOS =
    /iP(hone|ad|od)/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isWebKit = /WebKit/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return isiOS && isWebKit;
}

export default function RouteShapeTransitionManager() {
  const router = useRouter();
  const pathname = usePathname();
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayExpanded, setOverlayExpanded] = useState(false);
  const [overlayStyle, setOverlayStyle] = useState<"keyhole" | "fade">("keyhole");
  const [fallbackDurationMs, setFallbackDurationMs] = useState(700);
  const isTransitioningRef = useRef(false);
  const fallbackModeRef = useRef(false);
  const fallbackDurationRef = useRef(700);

  useEffect(() => {
    router.prefetch("/projects");
    router.prefetch("/studio");
    router.prefetch("/diary");

    if (shouldUseSimpleFadeNavigation()) return;

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

      // Mobile: lightweight white-fade overlay that holds until the destination
      // page signals ready. isTransitioningRef stays true for the guard above;
      // blurRouteTransition has its own module-level lock against stacking overlays.
      if (shouldUseSimpleFadeNavigation()) {
        navigateWithBlurTransition({
          router,
          fromPath: pathname ?? "/",
          toPath: route,
          isMobile: true,
        });
        // Reset after a tick so the guard above can still catch rapid double-taps
        // before the async transition has had a chance to install its own lock.
        window.setTimeout(() => {
          isTransitioningRef.current = false;
          fallbackModeRef.current = false;
        }, 80);
        return;
      }

      const doc = document as Document & {
        startViewTransition?: (
          update: () => void | Promise<void>
        ) => { finished: Promise<void> };
      };

      // Preferred path: true old->new shared transition, where "new page"
      // is clipped from a small center square to fullscreen.
      if (
        typeof doc.startViewTransition === "function" &&
        !shouldDisableShapeViewTransition()
      ) {
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

      // Fallback path (non-supporting browsers / WebKit-safe).
      const cssDurationMs = parseCssDurationMs(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--route-shape-duration"
        ),
        700
      );
      const durationMs = Math.max(120, Math.min(4000, Math.round(cssDurationMs)));
      const safeDurationMs = shouldDisableShapeViewTransition()
        ? Math.min(durationMs, 950)
        : durationMs;
      fallbackDurationRef.current = safeDurationMs;
      setFallbackDurationMs(safeDurationMs);
      setOverlayStyle("keyhole");

      fallbackModeRef.current = true;
      setOverlayVisible(true);
      requestAnimationFrame(() => {
        setOverlayExpanded(true);
      });
      window.setTimeout(() => {
        sessionStorage.setItem("route-shape-nav", "1");
        router.push(route);
      }, safeDurationMs);
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
      setOverlayStyle("keyhole");
      isTransitioningRef.current = false;
      fallbackModeRef.current = false;
    }, Math.max(120, Math.round(fallbackDurationRef.current * (overlayStyle === "fade" ? 0.6 : 0.35))));
    return () => window.clearTimeout(t);
  }, [pathname, overlayStyle]);

  if (!overlayVisible) return null;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[200] flex items-center justify-center bg-black transition-opacity ease-[cubic-bezier(.22,.8,.2,1)] ${
        overlayExpanded ? "opacity-100" : "opacity-0"
      }`}
      // Fade mode uses a neutral white flash; keyhole mode keeps black background.
      style={{
        transitionDuration: `${fallbackDurationMs}ms`,
        backgroundColor: overlayStyle === "fade" ? "#fff" : "#000",
      }}
    >
      <div
        className={`h-12 w-6 bg-[url('/Keyhole.svg')] bg-contain bg-center bg-no-repeat transition-transform ease-[cubic-bezier(.22,.8,.2,1)] ${
          overlayStyle === "fade" ? "scale-0 opacity-0" : overlayExpanded ? "scale-[120]" : "scale-0"
        }`}
        style={{ transitionDuration: `${fallbackDurationMs}ms` }}
      />
    </div>
  );
}
