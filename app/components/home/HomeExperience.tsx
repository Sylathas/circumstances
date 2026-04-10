"use client";

import { useRef, useState } from "react";
import SceneWrapper from "@/app/components/three/SceneWrapper";
import { useSongStable } from "@/app/components/songs/SongProvider";
import SongBar from "@/app/components/songs/SongBar";
import { useLoading } from "@/app/context/LoadingContext";
import { useIsMobile } from "@/app/hooks/useIsMobile";

export type HomeExperienceMode = "intro" | "menu-only";

export type HomeExperienceProps = {
  /** `intro`: keyhole animation first, then menu. `menu-only`: video + nav immediately (e.g. `/home`). */
  mode: HomeExperienceMode;
};

export function HomeExperience({ mode }: HomeExperienceProps) {
  const { startPlayback } = useSongStable();
  const { markSceneReady, markVideoReady, markIntroReady } = useLoading();
  const isMobile = useIsMobile();
  const videoSrc = isMobile ? "/textures/BG-fx_mobile.mp4" : "/textures/BG-fx.mp4";
  const [menuVisible, setMenuVisible] = useState(mode === "menu-only");
  const [sceneReady, setSceneReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const videoVisible = true;
  const showHeader = mode === "menu-only" || menuVisible;
  const sceneLayerClass =
    mode === "intro" && !menuVisible ? "z-[51]" : "z-10";

  const emitHomeSceneReady = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("home:scene-ready"));
  };

  return (
    <>
      <div className="fixed inset-0 z-0 bg-black" />
      {/* Background video — lowest z-index so transparent WebGL (keychain + intro) shows it through */}
      {videoVisible && (
        <video
          key={videoSrc}
          ref={videoRef}
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          id="myVideo"
          onCanPlay={markVideoReady}
          onLoadedData={markVideoReady}
          onError={markVideoReady}
          className={`fixed inset-0 z-[1] h-full w-full object-cover transition-opacity duration-300 ${sceneReady ? "opacity-100" : "opacity-0"
            }`}
        />
      )}

      {showHeader && (
        <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-transparent px-4 py-2 text-white mix-blend-difference">
          <div className="flex min-w-0 flex-1 items-center justify-center px-3 text-white mix-blend-difference">
            <SongBar />
          </div>
        </header>
      )}

      <main className="relative min-h-screen bg-transparent">
        <div className={`fixed inset-0 pointer-events-auto ${sceneLayerClass}`}>
          <SceneWrapper
            mode={mode}
            onIntroComplete={() => {
              setMenuVisible(true);
            }}
            onKeyholeInserted={() => {
              setMenuVisible(true);
              startPlayback();
            }}
            onSceneReady={() => {
              markSceneReady();
            }}
            onIntroReady={() => {
              setSceneReady(true);
              markIntroReady();
              emitHomeSceneReady();
            }}
            videoRef={videoRef}
          />
        </div>
      </main>
    </>
  );
}
