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

export function clipForNodes(
  clip: THREE.AnimationClip,
  nodeNames: readonly string[]
): THREE.AnimationClip {
  const normalizedSet = new Set(nodeNames.map((n) => normalizeToken(n)));
  const cloned = clip.clone();
  cloned.name = clip.name;
  cloned.tracks = cloned.tracks.filter((track) =>
    trackNodeTokens(track.name).some((token) => normalizedSet.has(token))
  );
  return cloned;
}

export function clipForIdleOnlyNodes(clip: THREE.AnimationClip): THREE.AnimationClip {
  const exactSet = new Set(IDLE_ONLY_NODES.map((n) => normalizeToken(n)));
  const prefixSet = new Set(IDLE_ONLY_PREFIXES.map((n) => normalizeToken(n)));
  const cloned = clip.clone();
  cloned.name = clip.name;
  cloned.tracks = cloned.tracks.filter((track) => {
    const tokens = trackNodeTokens(track.name);
    return tokens.some((token) => {
      if (exactSet.has(token)) return true;
      for (const prefix of prefixSet) {
        if (token === prefix || token.startsWith(prefix)) return true;
      }
      return false;
    });
  });
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

export function buildManagedClips(animations: THREE.AnimationClip[]) {
  const clipsByName = new Map<string, THREE.AnimationClip>();
  for (const clip of animations) clipsByName.set(clip.name, clip);

  const idle = resolveClipByAlias(clipsByName, ["Idle"]);
  const diary = resolveClipByAlias(clipsByName, ["Diary"]);
  const projects = resolveClipByAlias(clipsByName, ["Projects", "Project"]);
  const studio = resolveClipByAlias(clipsByName, ["Studio"]);
  const tag = resolveClipByAlias(clipsByName, ["Tag"]);
  const hovered = resolveClipByAlias(clipsByName, ["Hovered", "Hover"]);
  const idleChain = idle ? clipForIdleOnlyNodes(idle) : null;
  const hasIdleChainTracks = Boolean(idleChain && idleChain.tracks.length > 0);

  return {
    IdleState: idle ? clipForNodes(idle, STATE_NODES) : null,
    IdleChain: hasIdleChainTracks ? idleChain : null,
    HoveredBase: hovered ? clipForNodes(hovered, STATE_NODES) : null,
    Diary: diary ? clipForNodes(diary, STATE_NODES) : null,
    Projects: projects ? clipForNodes(projects, STATE_NODES) : null,
    Studio: studio ? clipForNodes(studio, STATE_NODES) : null,
    Tag: tag ? clipForNodes(tag, STATE_NODES) : null,
  };
}
