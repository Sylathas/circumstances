import * as THREE from "three";
import {
  IDLE_ONLY_NODES,
  IDLE_ONLY_PREFIXES,
  STATE_NODES,
  normalizeToken,
} from "./keychainInteractionConfig";

export function trackNodeTokens(trackName: string): string[] {
  const rawNode = trackName.split(".")[0]?.trim() ?? "";
  return rawNode
    .split(/[\/|]/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((n) => normalizeToken(n.replace(/[._-]\d+$/g, "")));
}

export type ClipForNodesOptions = {
  /**
   * When true (default), if filtering keeps fewer than ~35% of tracks, use the
   * full clip — helps when node names in the GLB drift from STATE_NODES.
   * When false, use whatever tracks matched (non-empty only). Use this for
   * second-pass filters (e.g. per-node hover on an already scoped HoveredBase);
   * otherwise a small match count incorrectly falls back to the whole hover clip
   * and every key animates together.
   */
  sparseFallback?: boolean;
};

export function clipForNodes(
  clip: THREE.AnimationClip,
  nodeNames: readonly string[],
  options?: ClipForNodesOptions
): THREE.AnimationClip {
  const sparseFallback = options?.sparseFallback !== false;
  const normalizedSet = new Set(nodeNames.map((n) => normalizeToken(n)));
  const cloned = clip.clone();
  cloned.name = clip.name;
  const filtered = cloned.tracks.filter((track) =>
    trackNodeTokens(track.name).some((token) => normalizedSet.has(token))
  );
  if (!sparseFallback) {
    cloned.tracks = filtered;
    return cloned;
  }
  // Some optimized/decimated exports can rename hierarchy nodes in tracks.
  // If filtering keeps too little, fall back to the full clip so interaction
  // animations remain functional.
  const minTrackThreshold = Math.max(4, Math.floor(clip.tracks.length * 0.35));
  cloned.tracks =
    filtered.length >= minTrackThreshold
      ? filtered
      : clip.tracks.map((t) => t.clone());
  return cloned;
}

function trackMatchesIdleOnlyRule(track: THREE.KeyframeTrack): boolean {
  const exactSet = new Set(IDLE_ONLY_NODES.map((n) => normalizeToken(n)));
  const prefixSet = new Set(IDLE_ONLY_PREFIXES.map((n) => normalizeToken(n)));
  const tokens = trackNodeTokens(track.name);
  return tokens.some((token) => {
    if (exactSet.has(token)) return true;
    for (const prefix of prefixSet) {
      if (token === prefix || token.startsWith(prefix)) return true;
    }
    return false;
  });
}

export function clipForIdleOnlyNodes(clip: THREE.AnimationClip): THREE.AnimationClip {
  const cloned = clip.clone();
  cloned.name = clip.name;
  cloned.tracks = cloned.tracks.filter((track) => trackMatchesIdleOnlyRule(track));
  return cloned;
}

/** Complement of `clipForIdleOnlyNodes`: tracks that must not run on `IdleChain` (e.g. key ring). */
export function clipExcludingIdleOnlyNodes(clip: THREE.AnimationClip): THREE.AnimationClip {
  const cloned = clip.clone();
  cloned.name = clip.name;
  cloned.tracks = cloned.tracks.filter((track) => !trackMatchesIdleOnlyRule(track));
  cloned.resetDuration();
  return cloned;
}

export function resolveClipByAlias(
  clipsByName: Map<string, THREE.AnimationClip>,
  aliases: readonly string[]
): THREE.AnimationClip | null {
  if (clipsByName.size === 0) return null;
  const entries = Array.from(clipsByName.entries());
  for (const alias of aliases) {
    const target = normalizeToken(alias);
    const exact = entries.find(([name]) => normalizeToken(name) === target);
    if (exact) return exact[1];
  }
  for (const alias of aliases) {
    const target = normalizeToken(alias);
    const partial = entries.find(([name]) => normalizeToken(name).includes(target));
    if (partial) return partial[1];
  }
  return null;
}

/**
 * Debug helper: for each glTF animation clip, list which `STATE_NODES` appear in track paths.
 * Use when Blender NLA shows per-object Idle but the runtime `Idle` clip looks “too small” —
 * curves may have landed under another clip name or been omitted by the exporter.
 */
export function reportClipsTouchingStateNodes(
  animations: THREE.AnimationClip[],
  stateNodes: readonly string[]
): { clip: string; duration: number; tracks: number; stateNodeHits: string }[] {
  const want = new Set(stateNodes.map((n) => normalizeToken(n)));
  return animations.map((clip) => {
    const hit = new Set<string>();
    for (const track of clip.tracks) {
      for (const token of trackNodeTokens(track.name)) {
        if (want.has(token)) hit.add(token);
      }
    }
    return {
      clip: clip.name,
      duration: clip.duration,
      tracks: clip.tracks.length,
      stateNodeHits: hit.size ? [...hit].sort().join(", ") : "—",
    };
  });
}

export function buildManagedClips(animations: THREE.AnimationClip[]) {
  const clipsByName = new Map<string, THREE.AnimationClip>();
  for (const clip of animations) clipsByName.set(clip.name, clip);

  const idle = resolveClipByAlias(clipsByName, ["Idle"]);
  const diary = resolveClipByAlias(clipsByName, ["Diary"]);
  const projects = resolveClipByAlias(clipsByName, ["Projects", "Project"]);
  const studio = resolveClipByAlias(clipsByName, ["Studio"]);
  const tag = resolveClipByAlias(clipsByName, ["Tag"]);
  const hovered = resolveClipByAlias(clipsByName, ["Hovered", "Hover"]);

  let IdleState: THREE.AnimationClip | null = null;
  let IdleChain: THREE.AnimationClip | null = null;

  if (idle) {
    /**
     * Partition `Idle` so no track is bound by two actions at once:
     * IdleChain = bones + keychain (idle-only), IdleState = the rest (e.g. Key_Ring).
     * Never use the GLB `Chain` clip here.
     */
    const idleChainPart = clipForIdleOnlyNodes(idle);
    const idleStatePart = clipExcludingIdleOnlyNodes(idle);
    if (idleChainPart.tracks.length > 0 && idleStatePart.tracks.length > 0) {
      IdleChain = idleChainPart;
      IdleState = idleStatePart;
    } else {
      IdleState = idle.clone();
      IdleChain = idleChainPart.tracks.length > 0 ? idleChainPart : null;
    }
  }

  return {
    IdleState,
    IdleChain,
    HoveredBase: hovered ? clipForNodes(hovered, STATE_NODES) : null,
    Diary: diary ? clipForNodes(diary, STATE_NODES) : null,
    Projects: projects ? clipForNodes(projects, STATE_NODES) : null,
    Studio: studio ? clipForNodes(studio, STATE_NODES) : null,
    Tag: tag ? clipForNodes(tag, STATE_NODES) : null,
  };
}
