/** Matches `next.config` basePath for GitHub Pages deploys */
export const ASSET_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const KEYCHAIN_MODELS = {
  whole: `${ASSET_BASE}/models/Homepage/Circumstances_Website_Whole.glb`,
  /**
   * LOD1 variant for mobile/battery-saver — lower poly + halved textures.
   * Points to the same file until a Blender-exported LOD1 is committed.
   */
  wholeLod1: `${ASSET_BASE}/models/Homepage/Circumstances_Website_Whole.glb`,
} as const;

/** All keychain GLB URLs — use for preloading, iteration, etc. */
export const KEYCHAIN_MODEL_URLS = Object.values(KEYCHAIN_MODELS);
