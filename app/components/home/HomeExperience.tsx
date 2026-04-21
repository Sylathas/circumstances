"use client";

import { useEffect, useRef, useState } from "react";
import SceneWrapper from "@/app/components/three/SceneWrapper";
import { useSongStable } from "@/app/components/songs/SongProvider";
import SongBar from "@/app/components/songs/SongBar";
import { useLoading } from "@/app/context/LoadingContext";

export type HomeExperienceMode = "intro" | "menu-only";

export type HomeExperienceProps = {
  /** `intro`: keyhole animation first, then menu. `menu-only`: video + nav immediately. */
  mode: HomeExperienceMode;
};

export function HomeExperience({ mode }: HomeExperienceProps) {
  const { startPlayback } = useSongStable();
  const { markSceneReady, markVideoReady, markIntroReady } = useLoading();
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);
  const [videoHighSrc, setVideoHighSrc] = useState<string | undefined>(undefined);
  const [upgradedVideo, setUpgradedVideo] = useState(false);
  const [menuVisible, setMenuVisible] = useState(mode === "menu-only");
  const [sceneReady, setSceneReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const mobile = window.innerWidth < 768;
    const low = mobile ? "/textures/BG-fx_mobile_lowres.mp4" : "/textures/BG-fx_lowres.mp4";
    const high = mobile ? "/textures/BG-fx_mobile.mp4" : "/textures/BG-fx.mp4";
    setVideoSrc(low);
    setVideoHighSrc(high);
    setUpgradedVideo(false);
  }, []);

  useEffect(() => {
    if (!videoSrc || !videoHighSrc || upgradedVideo) return;
    if (videoSrc === videoHighSrc) {
      setUpgradedVideo(true);
      return;
    }
    let cancelled = false;
    const preload = document.createElement("video");
    preload.preload = "auto";
    preload.muted = true;
    preload.playsInline = true;
    preload.src = videoHighSrc;
    const onReady = () => {
      if (cancelled) return;
      setVideoSrc(videoHighSrc);
      setUpgradedVideo(true);
    };
    preload.addEventListener("canplaythrough", onReady, { once: true });
    preload.addEventListener("loadeddata", onReady, { once: true });
    preload.load();
    const fallback = window.setTimeout(onReady, 3500);
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      preload.removeEventListener("canplaythrough", onReady);
      preload.removeEventListener("loadeddata", onReady);
      preload.removeAttribute("src");
      preload.load();
    };
  }, [videoSrc, videoHighSrc, upgradedVideo]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoSrc) return;
    void el.play().catch(() => {
      // Best effort only; autoplay policies can still block in some contexts.
    });
  }, [videoSrc]);

  useEffect(() => {
    return () => {
      const el = videoRef.current;
      if (!el) return;
      // Release decode buffers when leaving home to reduce iOS WebKit crash risk.
      el.pause();
      el.removeAttribute("src");
      el.load();
    };
  }, []);

  const videoVisible = Boolean(videoSrc);
  const isMobileVideo =
    videoSrc === "/textures/BG-fx_mobile.mp4" ||
    videoSrc === "/textures/BG-fx_mobile_lowres.mp4";
  const showHeader = mode === "menu-only" || menuVisible;
  const sceneLayerClass =
    mode === "intro" && !menuVisible ? "z-[51]" : "z-10";

  const emitHomeSceneReady = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("home:scene-ready"));
  };

  const handleVideoReady = () => {
    markVideoReady();
    const el = videoRef.current;
    if (!el) return;
    void el.play().catch(() => {
      // Best effort only; autoplay policies can still block in some contexts.
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-0 bg-black" />
      {/* Background video — lowest z-index so transparent WebGL (keychain + intro) shows it through */}
      {videoVisible && (
        <video
          ref={videoRef}
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
          preload={isMobileVideo ? "metadata" : "auto"}
          id="myVideo"
          onCanPlay={handleVideoReady}
          onLoadedData={handleVideoReady}
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

      <main className="relative bg-transparent">
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
