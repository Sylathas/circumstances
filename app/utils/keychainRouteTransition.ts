/**
 * triggerRouteTransition dispatches a "keychain:route-transition" CustomEvent
 * so RouteShapeTransitionManager can intercept and play the keyhole animation.
 * Falls back to window.location.assign if no listener handles the event.
 * Extracted from KeychainModels to keep navigation logic separate from 3D rendering.
 */

import { ACTION_ROUTE, type ActionName } from "@/app/components/keychain/keychainInteractionConfig";

export function triggerRouteTransition(actionName: ActionName): void {
  const route = ACTION_ROUTE[actionName];
  if (!route) return;
  const notCancelled = window.dispatchEvent(
    new CustomEvent("keychain:route-transition", {
      cancelable: true,
      detail: { action: actionName, route },
    })
  );
  if (notCancelled) {
    window.location.assign(route);
  }
}
