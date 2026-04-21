/** Matches `next.config` basePath for GitHub Pages deploys */
export const ASSET_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const KEYCHAIN_MODELS = {
  whole: `${ASSET_BASE}/models/Homepage/Circumstances_Website_Whole.glb`,
  wholeLowres: `${ASSET_BASE}/models/Homepage/Circumstances_Website_Whole_lowres.glb`,
  /** Battery-saver / mobile tier LOD; full `whole` is used otherwise (no runtime GLB swap). */
  wholeLod1: `${ASSET_BASE}/models/Homepage/Circumstances_Website_Whole_lowres.glb`,
} as const;

/** All keychain GLB URLs — use for preloading, iteration, etc. */
export const KEYCHAIN_MODEL_URLS = Object.values(KEYCHAIN_MODELS);
