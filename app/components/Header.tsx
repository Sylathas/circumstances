"use client";

/**
 * Header renders the top navigation: logo, category filters, and optional admin controls.
 * Props include activeFilters, onFilterToggle, backHref, onSave, and saveState.
 * Used on the home, project, studio, and diary pages.
 */

import Link from "next/link"; // used for logo
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./auth/AuthContext";
import type { ProjectType } from "@/app/types/project";
import SongBar from "./songs/SongBar";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { navigateWithBlurTransition } from "@/app/utils/blurRouteTransition";

const HOME_ROUTES = new Set(["/", "/home", "/circumstances", "/circumstances/"]);

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

function useHomeTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  useEffect(() => {
    router.prefetch("/home");
  }, [router]);

  return (e: React.MouseEvent) => {
    if (HOME_ROUTES.has(pathname ?? "")) return; // already home
    e.preventDefault();
    const triggerOverlayFallback = () => {
      const notCancelled = window.dispatchEvent(
        new CustomEvent("keychain:route-transition", {
          cancelable: true,
          detail: { action: "Tag", route: "/home" },
        })
      );
      if (notCancelled) {
        router.push("/home");
      }
    };
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> };
    };
    if (shouldUseSimpleFadeNavigation()) {
      navigateWithBlurTransition({
        router,
        fromPath: pathname ?? "/",
        toPath: "/home",
        isMobile,
      });
      return;
    }
    if (
      typeof doc.startViewTransition === "function" &&
      !shouldDisableShapeViewTransition()
    ) {
      document.documentElement.classList.add("route-shape-vt-reverse");
      try {
        const t = doc.startViewTransition(() => {
          sessionStorage.setItem("route-shape-nav", "1");
          router.push("/home");
        });
        t.finished.finally(() => {
          document.documentElement.classList.remove("route-shape-vt-reverse");
        });
      } catch {
        document.documentElement.classList.remove("route-shape-vt-reverse");
        triggerOverlayFallback();
      }
    } else {
      triggerOverlayFallback();
    }
  };
}

const CATEGORIES = [
  "CREATIVE DIRECTION",
  "FILM",
  "STILL",
  "LIVE SHOW",
] as const;

const TYPE_MAP: Record<string, ProjectType> = {
  "CREATIVE DIRECTION": "Creative Direction",
  FILM: "Film",
  STILL: "Still",
  "LIVE SHOW": "Live Show",
};

export type ActiveFilters = Set<ProjectType>;

export type SaveState = "idle" | "loading" | "success";

export type HeaderProps = {
  activeFilters?: ActiveFilters;
  onFilterToggle?: (type: ProjectType) => void;
  /** When set, show a BACK link (e.g. "/") on the right side. */
  backHref?: string;
  /** When set and isAdmin, show SAVE button; called on click. */
  onSave?: () => void | Promise<void>;
  saveState?: SaveState;
  /** When true, show CREATIVE DIRECTION / FILM / STILL / LIVE SHOW filters. Only used on projects section. */
  showCategoryFilters?: boolean;
};

export function Header({
  activeFilters = new Set(),
  onFilterToggle = () => { },
  backHref,
  onSave,
  saveState = "idle",
  showCategoryFilters = false,
}: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAdmin, signOut } = useAuth();
  const isMobile = useIsMobile();
  const handleHomeClick = useHomeTransition();
  const handleBackClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!backHref) return;
    e.preventDefault();
    navigateWithBlurTransition({
      router,
      fromPath: pathname ?? "/",
      toPath: backHref,
      isMobile,
    });
  };
  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-transparent px-4 py-2 text-black mix-blend-difference text-white">
        <div className="flex gap-20 items-center min-w-0">
          <Link
            href="/home"
            onClick={handleHomeClick}
            className={`block h-7 w-7 shrink-0 bg-[url('/textures/logo.png')] bg-contain bg-center bg-no-repeat ${isMobile && "hidden"}`}
            aria-label="Home"
          />
          {showCategoryFilters && !isMobile && (
            <nav className="flex items-center gap-15 my-3" style={{ fontWeight: 600 }}>
              {CATEGORIES.map((label) => {
                const type = TYPE_MAP[label];
                const isActive = activeFilters.has(type);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onFilterToggle(type)}
                    className="font-inherit text-xs border-none bg-transparent p-0 cursor-pointer"
                    style={isActive ? { fontWeight: 800 } : { fontWeight: 500 }}
                  >
                    {label}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
        <div className={`flex-1 min-w-0 ${!isMobile && "px-3"}`}>
          <SongBar />
        </div>
        <div className="flex items-center gap-6 shrink-0">
          {backHref != null && isMobile && (
            <Link
              href={backHref}
              onClick={handleBackClick}
              className="font-inherit text-xs font-normal no-underline"
              style={{ fontWeight: 500 }}
            >
              BACK
            </Link>
          )}
          {isAdmin && onSave != null && (
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saveState === "loading"}
              className="font-inherit text-xs font-normal border-none bg-transparent text-[#ee82ee] cursor-pointer disabled:cursor-wait"
              style={{ fontWeight: 500 }}
            >
              {saveState === "loading"
                ? "Saving…"
                : saveState === "success"
                  ? "Saved"
                  : "SAVE"}
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => void signOut()}
              className="font-inherit text-xs font-normal border-none bg-transparent cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              LOG OUT
            </button>
          )}
        </div>
      </header>
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between bg-transparent px-2 py-2 text-black mix-blend-difference text-white">
          {showCategoryFilters && isMobile && (
            <nav className="flex items-center justify-between my-3 w-full" style={{ fontWeight: 600 }}>
              {CATEGORIES.map((label) => {
                const type = TYPE_MAP[label];
                const isActive = activeFilters.has(type);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onFilterToggle(type)}
                    className="font-inherit text-xs border-none bg-transparent p-0 cursor-pointer"
                    style={isActive ? { fontWeight: 800 } : { fontWeight: 500 }}
                  >
                    {label}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      )}
    </>
  );
}
