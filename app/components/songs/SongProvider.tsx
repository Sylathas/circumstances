"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/app/components/firebase/firebaseConfig";
import { useAuth } from "@/app/components/auth/AuthContext";
import type { Song } from "@/app/types/song";
import { deleteFileByUrl } from "@/app/utils/storage";

/**
 * Stable state — everything except high-frequency playback position.
 * Changes only when the song list, active track, or auth state changes.
 * Components that don't need a live progress bar should consume this context
 * (via useSongStable) to avoid the ~4 Hz re-renders driven by currentTime.
 */
type SongStableState = {
  songs: Song[];
  songsLoading: boolean;
  songsError: string | null;
  activeSong: Song | null;
  hasUserStarted: boolean;
  canUpload: boolean;
  startPlayback: () => void;
  togglePlayPause: () => void;
  seekTo: (timeSeconds: number) => void;
  skipSeconds: (deltaSeconds: number) => void;
  playNext: () => void;
  refetchSongs: () => Promise<void>;
  reorderSongs: (orderedIds: string[]) => Promise<void>;
  removeSong: (songId: string) => Promise<void>;
};

/**
 * High-frequency playback state — updates ~4× per second while audio is playing.
 * Only components that render a progress bar / time display should consume this.
 */
type SongPlaybackState = {
  isPlaying: boolean;
  duration: number;
  currentTime: number;
};

/** Combined shape kept for backward compatibility with useSong(). */
type SongPlayerState = SongStableState & SongPlaybackState;

const SongStableContext = createContext<SongStableState | null>(null);
const SongPlaybackContext = createContext<SongPlaybackState | null>(null);

/** Full song state — use in components that need the progress bar (SongBar). */
export function useSong(): SongPlayerState {
  const stable = useContext(SongStableContext);
  const playback = useContext(SongPlaybackContext);
  if (!stable || !playback) throw new Error("useSong must be used within SongProvider");
  return { ...stable, ...playback };
}

/**
 * Stable song state only — use in components that don't render audio progress.
 * These components won't re-render on every currentTime tick.
 */
export function useSongStable(): SongStableState {
  const v = useContext(SongStableContext);
  if (!v) throw new Error("useSongStable must be used within SongProvider");
  return v;
}

function safeNumber(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export function SongProvider({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();

  const [songs, setSongs] = useState<Song[]>([]);
  const [songsLoading, setSongsLoading] = useState(true);
  const [songsError, setSongsError] = useState<string | null>(null);
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasUserStarted, setHasUserStarted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startRequestedRef = useRef(false);
  /** Prevents the deferred-play effect from re-running on pause (same song id) or duplicating playNext/startPlayback. */
  const lastAutoplaySongIdRef = useRef<string | null>(null);

  const activeSong = useMemo(
    () => songs.find((s) => s.id === activeSongId) ?? null,
    [songs, activeSongId]
  );

  // Allow upload tooling in all non-production environments, or for signed-in admins.
  const canUpload = isAdmin || process.env.NODE_ENV !== "production";

  const refetchSongs = useCallback(async () => {
    setSongsLoading(true);
    setSongsError(null);
    try {
      const q = query(collection(db, "songs"), orderBy("order"));
      const snap = await getDocs(q);
      const list: Song[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data?.title ?? "Untitled",
          artist: data?.artist ?? "Unknown",
          audioUrl: data?.audioUrl ?? "",
          thumbUrl: data?.thumbUrl ?? undefined,
          order: safeNumber(data?.order) ?? undefined,
        };
      });
      setSongs(list);
    } catch (err) {
      console.error("[SongProvider] Failed to load songs:", err);
      setSongsError("Failed to load songs.");
    } finally {
      setSongsLoading(false);
    }
  }, []);

  const reorderSongs = useCallback(
    async (orderedIds: string[]) => {
      if (!orderedIds.length) return;
      const batch = writeBatch(db);
      orderedIds.forEach((id, index) => {
        batch.update(doc(db, "songs", id), { order: index + 1 });
      });
      await batch.commit();
      await refetchSongs();
    },
    [refetchSongs]
  );

  const removeSong = useCallback(
    async (songId: string) => {
      const song = songs.find((s) => s.id === songId);
      if (!song) return;
      await deleteDoc(doc(db, "songs", songId));
      await Promise.allSettled([
        deleteFileByUrl(song.audioUrl),
        song.thumbUrl ? deleteFileByUrl(song.thumbUrl) : Promise.resolve(),
      ]);
      await refetchSongs();
    },
    [songs, refetchSongs]
  );

  useEffect(() => {
    void refetchSongs();
  }, [refetchSongs]);

  // Keep a valid active song selected.
  useEffect(() => {
    if (!songs.length) return;
    if (activeSongId && songs.some((s) => s.id === activeSongId)) return;
    setActiveSongId(songs[0].id);
  }, [songs, activeSongId]);

  const ensureAudioAndLoad = useCallback(() => {
    if (!audioRef.current) return;
    if (!activeSong?.audioUrl) return;
    if (audioRef.current.src === activeSong.audioUrl) return;
    audioRef.current.src = activeSong.audioUrl;
    audioRef.current.load();
  }, [activeSong]);

  useEffect(() => {
    // Sync audio src when active song changes.
    ensureAudioAndLoad();
  }, [ensureAudioAndLoad]);

  // If the intro already triggered startPlayback(), but songs were still loading,
  // begin playback once the active song URL is ready. Must NOT depend on isPlaying —
  // pausing would re-run and reset currentTime to 0.
  useEffect(() => {
    if (!hasUserStarted) return;
    if (!startRequestedRef.current) return;
    if (!activeSong?.audioUrl) return;

    const a = audioRef.current;
    if (!a) return;
    if (!a.src) return;

    if (lastAutoplaySongIdRef.current === activeSong.id) return;

    lastAutoplaySongIdRef.current = activeSong.id;
    a.currentTime = 0;
    void a.play().then(
      () => setIsPlaying(true),
      () => setIsPlaying(false)
    );
  }, [activeSong?.id, activeSong?.audioUrl, hasUserStarted]);

  const startPlayback = useCallback(() => {
    if (startRequestedRef.current) return;
    startRequestedRef.current = true;
    setHasUserStarted(true);

    // Load first, then play.
    ensureAudioAndLoad();
    const a = audioRef.current;
    if (!a) return;
    if (activeSong?.id) lastAutoplaySongIdRef.current = activeSong.id;
    a.currentTime = 0;
    void a.play().then(
      () => setIsPlaying(true),
      () => {
        // If autoplay is blocked, user will need to click.
        setIsPlaying(false);
      }
    );
  }, [ensureAudioAndLoad, activeSong?.id]);

  const togglePlayPause = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play().then(
        () => setIsPlaying(true),
        () => setIsPlaying(false)
      );
    } else {
      a.pause();
      setIsPlaying(false);
    }
  }, []);

  const seekTo = useCallback((timeSeconds: number) => {
    const a = audioRef.current;
    if (!a) return;
    const clamped = Math.max(0, Math.min(timeSeconds, a.duration || timeSeconds));
    a.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const skipSeconds = useCallback(
    (deltaSeconds: number) => {
      const a = audioRef.current;
      if (!a) return;
      const next = (a.currentTime || 0) + deltaSeconds;
      if (next >= (a.duration || 0) && a.duration) {
        playNext();
        return;
      }
      if (next < 0) {
        a.currentTime = 0;
        setCurrentTime(0);
        return;
      }
      a.currentTime = next;
      setCurrentTime(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [songs, activeSongId]
  );

  const playNext = useCallback(() => {
    if (!songs.length) return;
    const idx = songs.findIndex((s) => s.id === activeSongId);
    const nextIdx = idx === -1 ? 0 : (idx + 1) % songs.length;
    const nextSong = songs[nextIdx];
    lastAutoplaySongIdRef.current = nextSong.id;
    setActiveSongId(nextSong.id);
    const a = audioRef.current;
    if (!a) return;
    if (nextSong.audioUrl && a.src !== nextSong.audioUrl) {
      a.src = nextSong.audioUrl;
      a.load();
    }
    a.currentTime = 0;
    if (hasUserStarted) {
      void a.play().then(
        () => setIsPlaying(true),
        () => setIsPlaying(false)
      );
    }
  }, [songs, activeSongId, hasUserStarted]);

  // Wire audio events.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onLoaded = () => {
      setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    };
    const onTime = () => setCurrentTime(a.currentTime || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => playNext();

    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("durationchange", onLoaded);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);

    return () => {
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("durationchange", onLoaded);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  }, [playNext]);

  // Stable context — only re-creates when song list / auth / callbacks change.
  // Does NOT include isPlaying / currentTime / duration so that high-frequency
  // playback ticks don't propagate into every consumer.
  const stableValue = useMemo<SongStableState>(
    () => ({
      songs,
      songsLoading,
      songsError,
      activeSong,
      hasUserStarted,
      canUpload,
      startPlayback,
      togglePlayPause,
      seekTo,
      skipSeconds,
      playNext,
      refetchSongs,
      reorderSongs,
      removeSong,
    }),
    [
      songs,
      songsLoading,
      songsError,
      activeSong,
      hasUserStarted,
      canUpload,
      startPlayback,
      togglePlayPause,
      seekTo,
      skipSeconds,
      playNext,
      refetchSongs,
      reorderSongs,
      removeSong,
    ]
  );

  // Playback context — updates ~4× per second while audio is playing.
  // Only SongBar (and similar progress-rendering components) should read this.
  const playbackValue = useMemo<SongPlaybackState>(
    () => ({ isPlaying, duration, currentTime }),
    [isPlaying, duration, currentTime]
  );

  return (
    <SongStableContext.Provider value={stableValue}>
      <SongPlaybackContext.Provider value={playbackValue}>
        {/* Hidden audio element shared across pages */}
        <audio ref={audioRef} preload="metadata" style={{ display: "none" }} />
        {children}
      </SongPlaybackContext.Provider>
    </SongStableContext.Provider>
  );
}

