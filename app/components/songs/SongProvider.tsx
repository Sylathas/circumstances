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

type SongPlayerState = {
  songs: Song[];
  songsLoading: boolean;
  songsError: string | null;
  activeSong: Song | null;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  hasUserStarted: boolean;
  startPlayback: () => void;
  togglePlayPause: () => void;
  seekTo: (timeSeconds: number) => void;
  skipSeconds: (deltaSeconds: number) => void;
  playNext: () => void;
  refetchSongs: () => Promise<void>;
  reorderSongs: (orderedIds: string[]) => Promise<void>;
  removeSong: (songId: string) => Promise<void>;
  // Admin upload
  canUpload: boolean;
};

const SongContext = createContext<SongPlayerState | null>(null);

export function useSong(): SongPlayerState {
  const v = useContext(SongContext);
  if (!v) throw new Error("useSong must be used within SongProvider");
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

  const value = useMemo<SongPlayerState>(
    () => ({
      songs,
      songsLoading,
      songsError,
      activeSong,
      isPlaying,
      duration,
      currentTime,
      hasUserStarted,
      startPlayback,
      togglePlayPause,
      seekTo,
      skipSeconds,
      playNext,
      refetchSongs,
      reorderSongs,
      removeSong,
      canUpload,
    }),
    [
      songs,
      songsLoading,
      songsError,
      activeSong,
      isPlaying,
      duration,
      currentTime,
      hasUserStarted,
      startPlayback,
      togglePlayPause,
      seekTo,
      skipSeconds,
      playNext,
      refetchSongs,
      reorderSongs,
      removeSong,
      canUpload,
    ]
  );

  return (
    <SongContext.Provider value={value}>
      {/* Hidden audio element shared across pages */}
      <audio ref={audioRef} preload="metadata" style={{ display: "none" }} />
      {children}
    </SongContext.Provider>
  );
}

