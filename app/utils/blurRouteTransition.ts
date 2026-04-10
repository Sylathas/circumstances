import { ANIMATION_CONFIG } from "@/app/config/animation";
import { waitForRouteReady } from "@/app/utils/routeReady";

type RouterLike = {
  push: (href: string) => void;
};

/**
 * Module-level guard. Prevents a second blur transition from starting before
 * the first one has finished — important on mobile where rapid taps could
 * otherwise stack multiple overlays on top of each other.
 */
let transitionInProgress = false;

const HOME_ROUTES = new Set(["/", "/home", "/circumstances", "/circumstances/"]);

function normalizePath(path: string): string {
  const withoutQuery = path.split("?")[0]?.split("#")[0] ?? "/";
  if (!withoutQuery) return "/";
  return withoutQuery.endsWith("/") && withoutQuery !== "/"
    ? withoutQuery.slice(0, -1)
    : withoutQuery;
}

function isDiaryList(path: string): boolean {
  return normalizePath(path) === "/diary";
}

function isDiaryDetail(path: string): boolean {
  return /^\/diary\/[^/]+$/.test(normalizePath(path));
}

function isProjectsList(path: string): boolean {
  return normalizePath(path) === "/projects";
}

function isProjectDetail(path: string): boolean {
  const p = normalizePath(path);
  return /^\/projects\/[^/]+$/.test(p) || /^\/project\/[^/]+$/.test(p);
}

function isHomePath(path: string): boolean {
  return HOME_ROUTES.has(normalizePath(path));
}

function waitForHomeSceneReady(maxWaitMs = 2200): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timeout);
      resolve();
    };
    const onReady = () => finish();
    const timeout = window.setTimeout(finish, maxWaitMs);
    window.addEventListener("home:scene-ready", onReady, { once: true });
  });
}

/**
 * Create the full-screen overlay that masks loading between route transitions.
 *
 * On mobile we skip backdrop-filter entirely:
 *  - The overlay is already fully opaque white, so blur adds nothing visible.
 *  - backdrop-filter is GPU-expensive and causes dropped frames on low-end phones.
 *  - Removing it also avoids a WebKit compositing quirk where the filter layer
 *    occasionally flashes transparent on Safari iOS mid-transition.
 */
function createHoldBlurOverlay(mobile = false): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "9999";
  overlay.style.pointerEvents = "none";
  overlay.style.opacity = "0";
  overlay.style.background = "rgba(255,255,255,0)";
  overlay.style.transition = "none";
  if (!mobile) {
    overlay.style.backdropFilter = "blur(0px)";
    overlay.style.setProperty("-webkit-backdrop-filter", "blur(0px)");
    overlay.style.willChange = "opacity, backdrop-filter, -webkit-backdrop-filter, background-color";
  } else {
    overlay.style.willChange = "opacity, background-color";
  }
  document.body.appendChild(overlay);
  return overlay;
}

function setOverlayBlur(overlay: HTMLDivElement, blurPx: number) {
  overlay.style.backdropFilter = `blur(${blurPx}px)`;
  overlay.style.setProperty("-webkit-backdrop-filter", `blur(${blurPx}px)`);
}

function animateToMidpoint(overlay: HTMLDivElement, mobile = false): Promise<void> {
  const { phaseInMs, ease, maxBlurPx, holdOpacity, holdBackgroundAlpha } = ANIMATION_CONFIG.routeBlurTransition;
  return new Promise((resolve) => {
    if (mobile) {
      // On mobile: simple opacity + background-color, no blur.
      overlay.style.transition = `opacity ${phaseInMs}ms ${ease}, background-color ${phaseInMs}ms ${ease}`;
      requestAnimationFrame(() => {
        overlay.style.opacity = String(holdOpacity);
        overlay.style.background = `rgba(255,255,255,${holdBackgroundAlpha})`;
      });
    } else {
      overlay.style.transition = `opacity ${phaseInMs}ms ${ease}, backdrop-filter ${phaseInMs}ms ${ease}, -webkit-backdrop-filter ${phaseInMs}ms ${ease}, background-color ${phaseInMs}ms ${ease}`;
      requestAnimationFrame(() => {
        overlay.style.opacity = String(holdOpacity);
        overlay.style.background = `rgba(255,255,255,${holdBackgroundAlpha})`;
        setOverlayBlur(overlay, maxBlurPx * 0.5);
      });
    }
    window.setTimeout(resolve, phaseInMs);
  });
}

function animateOut(overlay: HTMLDivElement, outMs: number, mobile = false): Promise<void> {
  const { ease } = ANIMATION_CONFIG.routeBlurTransition;
  return new Promise((resolve) => {
    if (mobile) {
      overlay.style.transition = `opacity ${outMs}ms ${ease}, background-color ${outMs}ms ${ease}`;
      requestAnimationFrame(() => {
        overlay.style.opacity = "0";
        overlay.style.background = "rgba(255,255,255,0)";
      });
    } else {
      overlay.style.transition = `opacity ${outMs}ms ${ease}, backdrop-filter ${outMs}ms ${ease}, -webkit-backdrop-filter ${outMs}ms ${ease}, background-color ${outMs}ms ${ease}`;
      requestAnimationFrame(() => {
        overlay.style.opacity = "0";
        overlay.style.background = "rgba(255,255,255,0.04)";
        setOverlayBlur(overlay, 0);
      });
    }
    window.setTimeout(resolve, outMs);
  });
}

async function navigateWithLoadingAwareBlur({
  router,
  toPath,
  waitForReady,
  mobile = false,
}: {
  router: RouterLike;
  toPath: string;
  waitForReady: () => Promise<void>;
  mobile?: boolean;
}): Promise<void> {
  // Prevent overlapping transitions (critical on mobile where taps can fire
  // multiple events before the first transition has finished).
  if (transitionInProgress) return;
  transitionInProgress = true;

  const {
    phaseInMs,
    phaseOutMs,
    phaseOutFastMs,
    pushDelayMs,
  } = ANIMATION_CONFIG.routeBlurTransition;
  const overlay = createHoldBlurOverlay(mobile);
  let readyResolved = false;

  const readyPromise = waitForReady().then(() => {
    readyResolved = true;
  });
  const phaseInPromise = animateToMidpoint(overlay, mobile);

  window.setTimeout(() => {
    sessionStorage.setItem("route-shape-nav", "1");
    router.push(toPath);
  }, Math.max(0, pushDelayMs));

  await phaseInPromise;

  if (!readyResolved) {
    await readyPromise;
    await animateOut(overlay, phaseOutMs, mobile);
  } else {
    await animateOut(overlay, phaseOutFastMs, mobile);
  }
  overlay.remove();
  transitionInProgress = false;
}

export function shouldUseBlurRouteTransition({
  fromPath,
  toPath,
  isMobile,
}: {
  fromPath: string;
  toPath: string;
  isMobile: boolean;
}): boolean {
  const from = normalizePath(fromPath);
  const to = normalizePath(toPath);

  if (from === to) return false;
  if (HOME_ROUTES.has(from) || HOME_ROUTES.has(to)) {
    // Home transitions stay on the keyhole path (desktop).
    return isMobile;
  }

  if (isMobile) return true;

  const diaryPair = (isDiaryList(from) && isDiaryDetail(to)) || (isDiaryDetail(from) && isDiaryList(to));
  if (diaryPair) return true;

  const projectPair = (isProjectsList(from) && isProjectDetail(to)) || (isProjectDetail(from) && isProjectsList(to));
  return projectPair;
}

export function navigateWithBlurTransition({
  router,
  fromPath,
  toPath,
  isMobile,
}: {
  router: RouterLike;
  fromPath: string;
  toPath: string;
  isMobile: boolean;
}): void {
  const shouldUseBlur = shouldUseBlurRouteTransition({ fromPath, toPath, isMobile });
  if (!shouldUseBlur) {
    router.push(toPath);
    return;
  }

  void navigateWithLoadingAwareBlur({
    router,
    toPath,
    mobile: isMobile,
    waitForReady: () =>
      isHomePath(toPath)
        ? waitForHomeSceneReady(ANIMATION_CONFIG.routeBlurTransition.homeMaxWaitMs)
        : waitForRouteReady(toPath, ANIMATION_CONFIG.routeBlurTransition.maxWaitMs),
  });
}
