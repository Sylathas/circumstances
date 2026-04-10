"use client";

import { useMemo, useRef, useState, type PointerEventHandler } from "react";
import { useSong } from "./SongProvider";
import SongUploadModal from "./SongUploadModal";
import type { Song } from "@/app/types/song";
import { useIsMobile } from "@/app/hooks/useIsMobile";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function pickThumb(song: Song | null) {
  return song?.thumbUrl ?? "/textures/logo.png";
}

export default function SongBar() {
  const {
    songsLoading,
    songsError,
    activeSong,
    isPlaying,
    currentTime,
    duration,
    hasUserStarted,
    togglePlayPause,
    playNext,
    seekTo,
    startPlayback,
    canUpload,
  } = useSong();

  const isMobileTier = useIsMobile();

  const [showUpload, setShowUpload] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const percent = duration ? currentTime / duration : 0;
  const thumbLeft = `${Math.max(0, Math.min(1, percent)) * 100}%`;
  const thumbImg = useMemo(() => pickThumb(activeSong), [activeSong]);

  const disabled = !activeSong;

  const handleSeekAtClientX = (clientX: number) => {
    const el = timelineRef.current;
    if (!el || !duration) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const p = Math.max(0, Math.min(1, x / rect.width));
    seekTo(p * duration);
  };

  const onPointerDown: PointerEventHandler<HTMLDivElement> = (e) => {
    if (!duration) return;
    handleSeekAtClientX(e.clientX);
    const onMove = (ev: PointerEvent) => handleSeekAtClientX(ev.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onPlayPause = () => {
    if (!activeSong) return;
    if (!hasUserStarted) startPlayback();
    else togglePlayPause();
  };

  return (
    <>
      <div className={`flex min-w-0 items-center gap-3 ${isMobileTier ? "justify-left" : "justify-center"}`}>
        {/* Timeline */}
        <div
          className={`relative flex-1 ${isMobileTier ? "min-w-[100px] max-w-[150px]" : "min-w-[200px] max-w-[200px]"
            }`}
        >
          <div
            ref={timelineRef}
            onPointerDown={onPointerDown}
            className="relative h-[6px] w-full cursor-pointer"
          >
            <div className="absolute left-0 top-[2px] h-[2px] w-full bg-white/25 rounded" />
            <div
              className="absolute left-0 top-[2px] h-[2px] bg-white/70 rounded"
              style={{ width: thumbLeft }}
            />
            <img
              src={thumbImg}
              alt=""
              width={12}
              height={12}
              className="absolute top-[-6px] rounded-full"
              style={{ left: thumbLeft, transform: "translateX(-50%)" }}
              draggable={false}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-white/70">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={disabled}
            onClick={onPlayPause}
            className="font-inherit text-[15px] bg-transparent text-white px-2 py-1 cursor-pointer disabled:opacity-40"
          >
            {isPlaying ? "⏸︎" : "⏵︎"}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => playNext()}
            className="font-inherit text-[15px] bg-transparent text-white px-2 py-1 cursor-pointer disabled:opacity-40"
          >
            ⏭︎
          </button>
        </div>

        {/* Name + Upload */}
        <div className={`flex flex-col justify-center ${isMobileTier ? "max-w-[130px]" : "max-w-[220px]"} shrink-0`}>
          <div className="flex items-center gap-2">
            <div className="min-w-0">
              <div className="text-[11px] text-white font-normal truncate">
                {activeSong ? activeSong.title : songsLoading ? "Loading…" : songsError ? "Error" : "No song selected"}
              </div>
              <div className="text-[10px] text-white/70 font-normal truncate">
                {activeSong ? activeSong.artist : songsError ? songsError : "Upload a song to start"}
              </div>
            </div>
            {canUpload && (
              <button
                type="button"
                onClick={() => setShowUpload(true)}
                className="w-6 h-6 flex items-center justify-center rounded-full border border-white/50 text-white bg-transparent cursor-pointer"
                aria-label="Upload songs"
              >
                +
              </button>
            )}
          </div>
        </div>
      </div>

      {showUpload && <SongUploadModal onClose={() => setShowUpload(false)} />}
    </>
  );
}

