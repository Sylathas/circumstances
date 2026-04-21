import * as THREE from "three";

export const ROOT_POS: THREE.Vector3Tuple = [0, 0, 0];
export const ROOT_ROT: THREE.EulerTuple = [0, 0, 0];
export const BLEND_SECONDS = 0.28;
export const BLEND_BACK_SECONDS = 1;
export const MAILTO_URL = "mailto:by@thecircumstances.info";

export const ACTION_NAMES = ["Diary", "Projects", "Studio", "Tag"] as const;
export type ActionName = (typeof ACTION_NAMES)[number];
export type ManagedClipName = "IdleState" | "IdleChain" | "HoveredBase" | ActionName;

export const STATE_NODES = [
  "Key Ring - Big",
  "Diary Key",
  "Key Ring - Keychain",
  "Tag",
  "Key Ring - Tag",
  "Projects",
  "Studio",
] as const;
export type StateNodeName = (typeof STATE_NODES)[number];

export const IDLE_ONLY_NODES = ["Chain Links", "Keychain"] as const;
export const IDLE_ONLY_PREFIXES = ["Bone"] as const;

export const INTERACTIVE_NODE_TO_ACTION: Record<string, ActionName> = {
  diarykey: "Diary",
  diarytext: "Diary",
  diary: "Diary",
  projects: "Projects",
  projectstext: "Projects",
  project: "Projects",
  studio: "Studio",
  studiotext: "Studio",
  tag: "Tag",
  keyringtag: "Tag",
};

const ACTION_TO_STATE_NODE: Record<ActionName, StateNodeName> = {
  Diary: "Diary Key",
  Projects: "Projects",
  Studio: "Studio",
  Tag: "Tag",
};

export const ACTION_ROUTE: Partial<Record<ActionName, string>> = {
  Diary: "/diary",
  Projects: "/projects",
  Studio: "/studio",
};

const STATE_NODE_BY_TOKEN = Object.fromEntries(
  STATE_NODES.map((name) => [normalizeToken(name), name])
) as Record<string, StateNodeName>;

export function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function findInteractiveClip(obj: THREE.Object3D | null): ActionName | null {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    const key = normalizeToken(cur.name);
    if (key in INTERACTIVE_NODE_TO_ACTION) return INTERACTIVE_NODE_TO_ACTION[key];
    cur = cur.parent;
  }
  return null;
}

export function findInteractiveNodeName(obj: THREE.Object3D | null): StateNodeName | null {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    const key = normalizeToken(cur.name);
    if (!(key in INTERACTIVE_NODE_TO_ACTION)) {
      cur = cur.parent;
      continue;
    }
    if (key in STATE_NODE_BY_TOKEN) return STATE_NODE_BY_TOKEN[key];
    return ACTION_TO_STATE_NODE[INTERACTIVE_NODE_TO_ACTION[key]];
  }
  return null;
}
