import * as THREE from "three";
import { useEffect, useState } from "react";

/** Packed Metallic–Roughness map (Unreal/Fab): R=Metallic, G=Roughness, B=AO. */
export const ROUGHNESS_MR_TEXTURE_URL = "/textures/T_uh4qbflc_2K_MR.png";

/**
 * Zoom factor for the roughness texture.
 * 1 = one tile across the card, >1 = more tiles (finer detail).
 */
export const ROUGHNESS_ZOOM = 0.1;

const mrCanvasCache: Record<string, HTMLCanvasElement> = {};
const mrTextureCache: Record<string, THREE.Texture> = {};

function getMRCacheKey(url: string, repeatW: number, repeatH: number) {
  return `${url}-${repeatW}-${repeatH}`;
}

/**
 * Loads the MR image and builds a canvas whose RGB is the green (roughness) channel.
 * Shared by the React hook and `loadRoughnessTextureFromMR`.
 */
function ensureMRCanvas(url: string): Promise<HTMLCanvasElement> {
  if (mrCanvasCache[url]) return Promise.resolve(mrCanvasCache[url]);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("2d context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const g = d[i + 1]; // take green as roughness
        d[i] = g;
        d[i + 1] = g;
        d[i + 2] = g;
      }
      ctx.putImageData(id, 0, 0);
      mrCanvasCache[url] = canvas;
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function buildRoughnessTextureFromCanvas(
  canvas: HTMLCanvasElement,
  repeatW: number,
  repeatH: number
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.repeat.set(repeatW, repeatH);
  return texture;
}

/**
 * Same output as `useRoughnessFromMRMap`, for use outside React (or async preload).
 * Reuses the same caches as the hook.
 */
export function loadRoughnessTextureFromMR(
  url: string,
  repeatW: number,
  repeatH: number
): Promise<THREE.Texture> {
  const key = getMRCacheKey(url, repeatW, repeatH);
  const cached = mrTextureCache[key];
  if (cached) return Promise.resolve(cached);

  return ensureMRCanvas(url).then((canvas) => {
    if (mrTextureCache[key]) return mrTextureCache[key];
    const texture = buildRoughnessTextureFromCanvas(canvas, repeatW, repeatH);
    mrTextureCache[key] = texture;
    return texture;
  });
}

/**
 * useRoughnessFromMRMap
 *
 * Loads a packed metallic–roughness (MR) texture and extracts the GREEN channel
 * as a grayscale roughness map. The returned texture is set up for use as a
 * roughnessMap / clearcoatRoughnessMap.
 *
 * Pass `enabled: false` to skip loading entirely (e.g. on mobile/battery-saver tiers).
 */
export function useRoughnessFromMRMap(
  url: string,
  repeatWidth: number,
  repeatHeight: number,
  enabled = true
): THREE.Texture | null {
  const key = getMRCacheKey(url, repeatWidth, repeatHeight);
  const [tex, setTex] = useState<THREE.Texture | null>(
    () => (mrTextureCache[key]) ? mrTextureCache[key] : null
  );

  useEffect(() => {
    if (mrTextureCache[key]) {
      setTex(mrTextureCache[key]);
      return;
    }

    let cancelled = false;
    loadRoughnessTextureFromMR(url, repeatWidth, repeatHeight).then((texture) => {
      if (cancelled) return;
      setTex(texture);
    });

    return () => {
      cancelled = true;
    };
  }, [url, key, repeatWidth, repeatHeight]);

  return tex;
}
