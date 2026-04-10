const ROUTE_READY_EVENT = "route:ready";

function normalizePath(path: string): string {
  const withoutQuery = path.split("?")[0]?.split("#")[0] ?? "/";
  if (!withoutQuery) return "/";
  return withoutQuery.endsWith("/") && withoutQuery !== "/"
    ? withoutQuery.slice(0, -1)
    : withoutQuery;
}

export function emitRouteReady(pathname: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ROUTE_READY_EVENT, {
      detail: { path: normalizePath(pathname) },
    })
  );
}

export function waitForRouteReady(pathname: string, maxWaitMs = 3500): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const target = normalizePath(pathname);
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timeout);
      window.removeEventListener(ROUTE_READY_EVENT, onReady as EventListener);
      resolve();
    };
    const onReady = (ev: Event) => {
      const custom = ev as CustomEvent<{ path?: string }>;
      const readyPath = normalizePath(custom.detail?.path ?? "");
      if (readyPath === target) finish();
    };
    const timeout = window.setTimeout(finish, maxWaitMs);
    window.addEventListener(ROUTE_READY_EVENT, onReady as EventListener);
  });
}

