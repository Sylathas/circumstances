"use client";

/**
 * CarouselCard exports 3D card primitives used by the project carousel.
 * ProjectCard: plane cover loads low-res (Next image proxy) then full-res; glass shell mounts after idle once a cover is shown.
 * PlaceholderCard / AddCard: glass mounts after idle so the first frame is lighter.
 */

import { forwardRef, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { nextImageOptimizedUrl } from "@/app/utils/nextImageProxyUrl";

const CARD_WIDTH = 2.5;
const CARD_HEIGHT = 4;
const CARD_DEPTH = 0.08;

const CARD_WIDTH_MOBILE = 3.5;
const CARD_HEIGHT_MOBILE = 2.5;

const HOVER_SCALE = 1.1;
const SCALE_LERP = 0.05;

/** Thumbnail width passed to Next image optimizer (matches ProgressiveImage low tier ~22 quality). */
const COVER_THUMB_WIDTH = 384;
const COVER_THUMB_QUALITY = 22;

/** Shared 1×1 white map for covers until Firebase image loads. */
const WHITE_COVER_TEXTURE = (() => {
  const data = new Uint8Array([255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();

function scheduleGlassMount(onReady: () => void) {
  if (typeof window === "undefined") return;
  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof win.requestIdleCallback === "function") {
    win.requestIdleCallback(() => onReady(), { timeout: 500 });
  } else {
    window.setTimeout(onReady, 150);
  }
}

/** CARD COVER FIT LOGIC (non-stretch, contain) is implemented in fitCoverTextureToPlane below. */

function fitCoverTextureToPlane(
  coverTex: THREE.Texture,
  planeWidth: number,
  planeHeight: number
) {
  const image: { width?: number; height?: number } = coverTex.image as {
    width?: number;
    height?: number;
  };
  if (!image?.width || !image?.height || planeWidth <= 0 || planeHeight <= 0) {
    coverTex.center.set(0.5, 0.5);
    coverTex.repeat.set(1, 1);
    coverTex.offset.set(0, 0);
    coverTex.needsUpdate = true;
    return;
  }

  const imgAspect = image.width / image.height;
  const planeAspect = planeWidth / planeHeight;
  const k = imgAspect / planeAspect;

  let repeatX = 1;
  let repeatY = 1;
  if (k >= 1) {
    repeatX = 1;
    repeatY = 1 / k;
  } else {
    repeatX = 1 / k;
    repeatY = 1;
  }

  coverTex.center.set(0.5, 0.5);
  coverTex.repeat.set(repeatX, repeatY);
  coverTex.offset.set(0, 0);
  coverTex.needsUpdate = true;
}

type ProjectCardProps = {
  coverUrl: string;
  position: [number, number, number];
  onClick?: () => void;
  isMobile: boolean;
};

const PLANE_MARGIN = 0.1;

export const ProjectCard = forwardRef<THREE.Group, ProjectCardProps>(
  function ProjectCard({ coverUrl, position, onClick, isMobile }, ref) {
    const planeWidth = isMobile
      ? CARD_WIDTH_MOBILE - PLANE_MARGIN
      : CARD_WIDTH - PLANE_MARGIN;
    const planeHeight = isMobile
      ? CARD_HEIGHT_MOBILE - PLANE_MARGIN
      : CARD_HEIGHT - PLANE_MARGIN;
    const [coverMap, setCoverMap] = useState<THREE.Texture>(() => WHITE_COVER_TEXTURE);
    const [showGlass, setShowGlass] = useState(false);
    const coverMapRef = useRef(coverMap);
    coverMapRef.current = coverMap;
    useEffect(
      () => () => {
        const t = coverMapRef.current;
        if (t !== WHITE_COVER_TEXTURE) t.dispose();
      },
      []
    );

    useEffect(() => {
      let cancelled = false;
      setShowGlass(false);
      setCoverMap((prev) => {
        if (prev !== WHITE_COVER_TEXTURE) prev.dispose();
        return WHITE_COVER_TEXTURE;
      });

      const loader = new THREE.TextureLoader();
      loader.crossOrigin = "anonymous";

      const applyAndFit = (tex: THREE.Texture) => {
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        fitCoverTextureToPlane(tex, planeWidth, planeHeight);
      };

      const mountGlassAfterCover = () => {
        scheduleGlassMount(() => {
          if (!cancelled) setShowGlass(true);
        });
      };

      const startFullRes = () => {
        loader.load(
          coverUrl,
          (tex) => {
            if (cancelled) {
              tex.dispose();
              return;
            }
            applyAndFit(tex);
            setCoverMap((prev) => {
              if (prev !== WHITE_COVER_TEXTURE) prev.dispose();
              return tex;
            });
          },
          undefined,
          () => {
            /* keep last successful map */
          }
        );
      };

      const thumbUrl = nextImageOptimizedUrl(
        coverUrl,
        COVER_THUMB_WIDTH,
        COVER_THUMB_QUALITY
      );

      loader.load(
        thumbUrl,
        (tex) => {
          if (cancelled) {
            tex.dispose();
            return;
          }
          applyAndFit(tex);
          setCoverMap((prev) => {
            if (prev !== WHITE_COVER_TEXTURE) prev.dispose();
            return tex;
          });
          mountGlassAfterCover();
          startFullRes();
        },
        undefined,
        () => {
          loader.load(
            coverUrl,
            (tex) => {
              if (cancelled) {
                tex.dispose();
                return;
              }
              applyAndFit(tex);
              setCoverMap((prev) => {
                if (prev !== WHITE_COVER_TEXTURE) prev.dispose();
                return tex;
              });
              mountGlassAfterCover();
            },
            undefined,
            () => {
              /* keep white */
            }
          );
        }
      );

      return () => {
        cancelled = true;
      };
    }, [coverUrl, planeWidth, planeHeight]);

    const scaleGroupRef = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);
    const scaleRef = useRef(1);

    useFrame(() => {
      const target = hovered ? HOVER_SCALE : 1;
      const diff = target - scaleRef.current;
      if (Math.abs(diff) < 0.001) return;
      scaleRef.current += diff * SCALE_LERP;
      const g = scaleGroupRef.current;
      if (g) g.scale.setScalar(scaleRef.current);
    });

    const pointerProps = {
      onPointerOver: (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      },
      onPointerOut: () => {
        setHovered(false);
        document.body.style.cursor = "default";
      },
      onClick: (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        onClick?.();
      },
    };

    return (
      <group ref={ref} position={position}>
        <group ref={scaleGroupRef}>
          {showGlass ? (
            <mesh renderOrder={0} {...pointerProps}>
              <boxGeometry
                args={[
                  isMobile ? CARD_WIDTH_MOBILE - 0.01 : CARD_WIDTH - 0.01,
                  isMobile ? CARD_HEIGHT_MOBILE - 0.01 : CARD_HEIGHT - 0.01,
                  CARD_DEPTH,
                ]}
              />
              <meshPhysicalMaterial
                transmission={0.99}
                roughness={0.12}
                metalness={0}
                ior={1.2}
                clearcoat={1}
                clearcoatRoughness={.1}
                envMapIntensity={1.5}
                transparent
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          ) : null}
          <mesh
            position={[0, 0, CARD_DEPTH / 2 - 0.01]}
            renderOrder={1}
            {...pointerProps}
          >
            <planeGeometry args={[planeWidth, planeHeight]} />
            <meshBasicMaterial
              map={coverMap}
              side={THREE.DoubleSide}
              toneMapped={false}
              depthWrite
              depthTest
            />
          </mesh>
        </group>
      </group>
    );
  }
);

type PlaceholderCardProps = {
  position: [number, number, number];
  isMobile: boolean;
};

export const PlaceholderCard = forwardRef<THREE.Mesh, PlaceholderCardProps>(
  function PlaceholderCard({ position, isMobile }, ref) {
    const [showGlass, setShowGlass] = useState(false);
    useEffect(() => {
      scheduleGlassMount(() => setShowGlass(true));
    }, []);
    return (
      <mesh ref={ref} position={position}>
        {showGlass ? (
          <boxGeometry
            args={[
              isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH,
              isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT,
              CARD_DEPTH,
            ]}
          />
        ) : (
          <planeGeometry
            args={[
              isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH,
              isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT,
            ]}
          />
        )}
        {showGlass ? (
          <meshPhysicalMaterial
            transmission={0}
            roughness={0.1}
            metalness={0}
            ior={1.45}
            clearcoat={1}
            clearcoatRoughness={0.12}
            envMapIntensity={1.5}
            transparent
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        ) : (
          <meshBasicMaterial
            color="#e8e8e8"
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        )}
      </mesh>
    );
  }
);

type AddCardProps = {
  position: [number, number, number];
  onClick: () => void;
  isMobile: boolean;
};

export const AddCard = forwardRef<THREE.Group, AddCardProps>(
  function AddCard({ position, onClick, isMobile }, ref) {
    const [showGlass, setShowGlass] = useState(false);
    useEffect(() => {
      scheduleGlassMount(() => setShowGlass(true));
    }, []);
    return (
      <group ref={ref} position={position}>
        {showGlass ? (
          <mesh
            renderOrder={0}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            <boxGeometry
              args={[
                isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH,
                isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT,
                CARD_DEPTH,
              ]}
            />
            <meshPhysicalMaterial
              transmission={0.98}
              roughness={0.15}
              metalness={0}
              ior={1.5}
              clearcoat={1}
              clearcoatRoughness={0.1}
              envMapIntensity={1.5}
              transparent
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ) : (
          <mesh
            renderOrder={0}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            <planeGeometry
              args={[
                isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH,
                isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT,
              ]}
            />
            <meshBasicMaterial
              color="#f0f0f0"
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        )}
        {showGlass ? (
          <>
            <mesh renderOrder={1} position={[0, 0, CARD_DEPTH / 2 + 0.005]}>
              <boxGeometry args={[1, 0.2, 0.01]} />
              <meshStandardMaterial
                color="#808080"
                metalness={0.3}
                roughness={0.5}
                depthWrite={false}
              />
            </mesh>
            <mesh renderOrder={1} position={[0, 0, CARD_DEPTH / 2 + 0.005]}>
              <boxGeometry args={[0.2, 1, 0.01]} />
              <meshStandardMaterial
                color="#808080"
                metalness={0.3}
                roughness={0.5}
                depthWrite={false}
              />
            </mesh>
          </>
        ) : null}
      </group>
    );
  }
);
