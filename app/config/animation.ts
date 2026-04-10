// Central configuration for animation, interaction, and material tuning.
// All values are wired so designers can tweak them from a single place (and via the DebugPanel).

export const ANIMATION_CONFIG = {
  carousel: {
    arcRadiusDesktop: 3, // desktop/tablet distance from center to cards; typical range 2–6
    arcRadiusMobile: 1.8, // mobile distance from center to cards; typical range 1.6–3.5
    cameraOffset: 10, // camera Z for carousel; 6–14
    dragSensitivity: 0.008, // px → slot rotation; 0.003–0.02
    scrollSpeed: 2, // indices/sec easing; 1–5
    scrollEasing: "easeOut" as "linear" | "easeOut",
    frontTurnNear: 0.3, // when cards start facing camera; 0.1–0.4
    frontTurnFar: 0.7, // when they fully stop turning; 0.5–1.0
  },
  introDoor: {
    doorWidth: 30, // width of the door plane; 20–40
    rotateLerp: 0.01, // door rotation lerp factor; 0.005–0.03
  },
  introScene: {
    cameraFov: 30, // intro FOV; 25–45
    cameraZ: 22, // intro camera distance; 18–30
    keychainLights: {
      // Fallback lights used when the keychain GLB has no embedded punctual lights.
      frontIntensity: 0,
      accentIntensity: 0,
      frontColor: "#ffffff",
      accentColor: "#9ec8ff",
    },
  },
  scenePostFx: {
    // Shared intro + home cinematic grading.
    // Toggle off quickly for debugging GPU/visual issues.
    enabled: true,
    // Tone mapping
    toneMiddleGrey: 0.6,
    toneMaxLuminance: 16.0,
    toneAverageLuminance: 1.0,
    // Bloom
    bloomIntensity: 0.2, // 0–1.5
    bloomLuminanceThreshold: 0.35, // 0–1
    bloomLuminanceSmoothing: 0.6, // 0–1
    bloomRadius: 0.55, // 0–1
    // Color grading
    saturation: 0.2, // subtle saturation boost; -0.2–0.3
    brightness: 0.0, // -1..1
    contrast: 0, // -1..1
    // Film grain + vignette
    noiseOpacity: 0.1, // 0–0.1
    vignetteOffset: 0.3, // 0.2–0.5
    vignetteDarkness: 0.8, // 0.3–1.0
  },
  pageTransition: {
    fadeDuration: 0.25, // seconds for page fade; 0.15–0.5
    fadeEase: "easeInOut" as "easeInOut" | "linear",
  },
  routeBlurTransition: {
    durationMs: 1000, // shared route blur crossfade duration; 400–1500
    maxBlurPx: 10, // max blur for old/new snapshots; 4–24
    ease: "cubic-bezier(0.22, 0.8, 0.2, 1)", // smooth, cinematic ease
    phaseInMs: 500, // step 1 -> step 2
    phaseOutMs: 500, // step 2 -> step 4 when destination is not yet ready
    phaseOutFastMs: 500, // step 2 -> step 4 when destination is ready "on time"
    pushDelayMs: 120, // delay before router.push so blur is already visible
    maxWaitMs: 3500, // hard cap while waiting for destination ready signal
    homeMaxWaitMs: 12000, // home can take longer due intro/canvas initialization
    holdOpacity: 1, // overlay opacity while waiting at step 2
    holdBackgroundAlpha: 1, // keep tint subtle to avoid a white flash feel
  },
  gallery: {
    dragThreshold: 5, // px before a drag is recognized; 3–15 (for future use)
  },
  glassMaterial: {
    // Reserved for future glass/TSL materials.
    // TODO: WebGPU — when adding custom glass materials, prefer TSL/NodeMaterial over raw ShaderMaterial.
    transmission: 0.95,
    ior: 1.45,
    thickness: 0.6,
    roughness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.5,
  },
};

