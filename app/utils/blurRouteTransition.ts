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
const HOME_MENU_ONCE_KEY = "circumstances-home-menu-once";

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

function createHoldBlurOverlay(): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "9999";
  overlay.style.pointerEvents = "none";
  overlay.style.opacity = "0";
  overlay.style.background = "#fff";
  overlay.style.transition = "none";
  overlay.style.willChange = "opacity";
  document.body.appendChild(overlay);
  return overlay;
}

function addLoadingKeyhole(overlay: HTMLDivElement): HTMLDivElement {
  const holder = document.createElement("div");
  holder.style.position = "absolute";
  holder.style.inset = "0";
  holder.style.display = "flex";
  holder.style.alignItems = "center";
  holder.style.justifyContent = "center";

  const icon = document.createElement("div");
  icon.style.width = "48px";
  icon.style.height = "48px";
  icon.style.backgroundImage = "url('/Keyhole.svg')";
  icon.style.backgroundRepeat = "no-repeat";
  icon.style.backgroundPosition = "center";
  icon.style.backgroundSize = "contain";
  icon.style.opacity = "0.8";
  icon.style.animation = "route-loader-pulse 1.4s ease-in-out infinite";

  holder.appendChild(icon);
  overlay.appendChild(holder);
  return holder;
}

function waitForOverlayTransitionEnd(
  overlay: HTMLDivElement,
  expectedMs: number
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      overlay.removeEventListener("transitionend", onEnd);
      resolve();
    };

    const onEnd = (ev: TransitionEvent) => {
      if (ev.target !== overlay) return;
      if (ev.propertyName !== "opacity") return;
      finish();
    };

    const timeoutId = window.setTimeout(finish, Math.max(120, expectedMs + 120));
    overlay.addEventListener("transitionend", onEnd);
  });
}

function animateToMidpoint(overlay: HTMLDivElement, mobile = false): Promise<void> {
  const { phaseInMs, ease, holdOpacity } = ANIMATION_CONFIG.routeBlurTransition;
  return new Promise((resolve) => {
    overlay.style.transition = `opacity ${phaseInMs}ms ${ease}`;
    requestAnimationFrame(() => {
      overlay.style.opacity = String(holdOpacity);
    });
    void waitForOverlayTransitionEnd(overlay, phaseInMs).then(resolve);
  });
}

function animateOut(overlay: HTMLDivElement, outMs: number, mobile = false): Promise<void> {
  const { ease } = ANIMATION_CONFIG.routeBlurTransition;
  return new Promise((resolve) => {
    overlay.style.transition = `opacity ${outMs}ms ${ease}`;
    requestAnimationFrame(() => {
      overlay.style.opacity = "0";
    });
    void waitForOverlayTransitionEnd(overlay, outMs).then(resolve);
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

  const cfg = ANIMATION_CONFIG.routeBlurTransition;
  const phaseInMs = mobile ? Math.max(140, Math.round(cfg.phaseInMs * 0.5)) : cfg.phaseInMs;
  const phaseOutMs = mobile ? Math.max(180, Math.round(cfg.phaseOutMs * 0.6)) : cfg.phaseOutMs;
  const phaseOutFastMs = mobile
    ? Math.max(140, Math.round(cfg.phaseOutFastMs * 0.5))
    : cfg.phaseOutFastMs;
  const pushDelayMs = mobile ? Math.min(cfg.pushDelayMs, 70) : cfg.pushDelayMs;
  const overlay = createHoldBlurOverlay();
  const loaderRef: { current: HTMLDivElement | null } = { current: null };
  const loaderTimeout = window.setTimeout(() => {
    loaderRef.current = addLoadingKeyhole(overlay);
  }, 5000);
  let readyResolved = false;

  const readyPromise = waitForReady().then(() => {
    readyResolved = true;
  });
  const phaseInPromise = animateToMidpoint(overlay, mobile);

  window.setTimeout(() => {
    sessionStorage.setItem("route-shape-nav", "1");
    router.push(toPath);
  }, Math.max(0, pushDelayMs));

  // Do not force a full "midpoint hold" once the destination is already ready.
  // Racing phase-in vs readiness prevents the extra white pulse (in->hold->out)
  // and turns this into a single continuous blur/fade for fast navigations.
  await Promise.race([phaseInPromise, readyPromise]);
  const readyDuringPhaseIn = readyResolved;

  if (!readyResolved) {
    await readyPromise;
  }

  await animateOut(overlay, readyDuringPhaseIn ? phaseOutFastMs : phaseOutMs, mobile);
  window.clearTimeout(loaderTimeout);
  loaderRef.current?.remove();
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
  const from = normalizePath(fromPath);
  const to = normalizePath(toPath);
  if (!HOME_ROUTES.has(from) && HOME_ROUTES.has(to)) {
    sessionStorage.setItem(HOME_MENU_ONCE_KEY, "1");
  }

  const shouldUseBlur = shouldUseBlurRouteTransition({ fromPath, toPath, isMobile });
  if (!shouldUseBlur) {
    router.push(toPath);
    return;
  }

  void navigateWithLoadingAwareBlur({
    router,
    toPath,
    mobile: isMobile,
    waitForReady: () => {
      if (isHomePath(toPath)) {
        return waitForHomeSceneReady(ANIMATION_CONFIG.routeBlurTransition.homeMaxWaitMs);
      }
      const routeMaxWaitMs = isMobile
        ? Math.min(ANIMATION_CONFIG.routeBlurTransition.maxWaitMs, 1600)
        : ANIMATION_CONFIG.routeBlurTransition.maxWaitMs;
      return waitForRouteReady(toPath, routeMaxWaitMs);
    },
  });
}
