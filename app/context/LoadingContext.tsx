"use client";

/**
 * LoadingContext tracks readiness signals that gate the initial home-page loading screen:
 * glbReady (keychain GLB parsed), sceneReady (WebGL canvas created), introReady (scene assets mounted).
 * Video readiness is tracked but does not gate the overlay, so intro rendering is never delayed by video decode.
 * On non-home routes all signals are pre-resolved so the screen is skipped instantly.
 * Used by LoadingScreen (overlay) and wired into HomeExperience + KeychainModels.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type LoadingContextValue = {
  isReady: boolean;
  markGlbReady: () => void;
  markSceneReady: () => void;
  markIntroReady: () => void;
  markVideoReady: () => void;
};

const LoadingContext = createContext<LoadingContextValue | null>(null);

const HOME_ROUTES = new Set(["/", "/home", "/circumstances", "/circumstances/"]);

const MIN_DISPLAY_MS = 600;
const FAILSAFE_MAX_WAIT_MS = 15000;

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomePage = HOME_ROUTES.has(pathname ?? "/");

  // On non-home pages all signals are pre-resolved.
  const [glbReady, setGlbReady] = useState(!isHomePage);
  const [sceneReady, setSceneReady] = useState(!isHomePage);
  const [introReady, setIntroReady] = useState(!isHomePage);
  const [minTimeElapsed, setMinTimeElapsed] = useState(!isHomePage);

  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!isHomePage) return;
    const elapsed = Date.now() - startedAt.current;
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
    const t = setTimeout(() => setMinTimeElapsed(true), remaining);
    return () => clearTimeout(t);
  }, [isHomePage]);

  // Failsafe: never leave users on a permanent black loading screen
  // if one of the readiness signals does not fire (e.g. video decode/load issue).
  useEffect(() => {
    if (!isHomePage) return;
    const t = setTimeout(() => {
      setGlbReady(true);
      setSceneReady(true);
      setIntroReady(true);
      setMinTimeElapsed(true);
    }, FAILSAFE_MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, [isHomePage]);

  const isReady = glbReady && sceneReady && introReady && minTimeElapsed;

  const markGlbReady = useCallback(() => setGlbReady(true), []);
  const markSceneReady = useCallback(() => setSceneReady(true), []);
  const markIntroReady = useCallback(() => setIntroReady(true), []);
  // Kept for compatibility with existing callers; video no longer gates the loading overlay.
  const markVideoReady = useCallback(() => { }, []);

  return (
    <LoadingContext.Provider value={{ isReady, markGlbReady, markSceneReady, markIntroReady, markVideoReady }}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading(): LoadingContextValue {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error("useLoading must be used within LoadingProvider");
  return ctx;
}
