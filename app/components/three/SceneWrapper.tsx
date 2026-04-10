"use client";

/**
 * SceneWrapper dynamically loads the unified home Scene canvas.
 * Used on the home page for both intro and menu-only modes.
 */

import dynamic from "next/dynamic";
import type { RefObject } from "react";

const IntroScene = dynamic(() => import("./Scene"), { ssr: false });

type SceneWrapperProps = {
  mode: "intro" | "menu-only";
  onIntroComplete: () => void;
  onKeyholeInserted?: () => void;
  onSceneReady?: () => void;
  onIntroReady?: () => void;
  videoRef: RefObject<HTMLVideoElement | null>;
};

export default function SceneWrapper({
  mode,
  onIntroComplete,
  onKeyholeInserted,
  onSceneReady,
  onIntroReady,
  videoRef,
}: SceneWrapperProps) {
  return (
    <div className="z-10">
      <IntroScene
        mode={mode}
        onIntroComplete={onIntroComplete}
        onKeyholeInserted={onKeyholeInserted}
        onSceneReady={onSceneReady}
        onIntroReady={onIntroReady}
        videoRef={videoRef}
      />
    </div>
  );
}

