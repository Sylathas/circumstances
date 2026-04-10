"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FirebaseError } from "firebase/app";
import { useSongStable } from "./SongProvider";
import { uploadFile } from "@/app/utils/storage";
import { addDoc, collection, getDocs, orderBy, limit, query } from "firebase/firestore";
import { db } from "@/app/components/firebase/firebaseConfig";

type SongUploadItem = {
  file: File;
  title: string;
  artist: string;
  uploading?: boolean;
  error?: string;
};

function stripExt(name: string) {
  const i = name.lastIndexOf(".");
  return i === -1 ? name : name.slice(0, i);
}

export default function SongUploadModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const { songs, refetchSongs, reorderSongs, removeSong } = useSongStable();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<SongUploadItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [queueBusy, setQueueBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = items.length > 0 && !submitting;
  const canEditQueue = !queueBusy && !submitting;

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: SongUploadItem[] = Array.from(files).map((file) => ({
      file,
      title: stripExt(file.name),
      artist: "Unknown",
    }));
    setItems(next);
    setError(null);
  };

  const handleChangeMeta = (idx: number, patch: Partial<SongUploadItem>) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  };

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      // Find current max `order` so new songs append to the end.
      let maxOrder = 0;
      try {
        const q = query(
          collection(db, "songs"),
          orderBy("order", "desc"),
          limit(1)
        );
        const snap = await getDocs(q);
        const doc0 = snap.docs[0]?.data();
        maxOrder = typeof doc0?.order === "number" ? doc0.order : 0;
      } catch {
        maxOrder = 0;
      }

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const storagePath = `songs/${Date.now()}_${item.file.name}`;
        const audioUrl = await uploadFile(item.file, storagePath);
        await addDoc(collection(db, "songs"), {
          title: item.title.trim() || stripExt(item.file.name),
          artist: item.artist.trim() || "Unknown",
          audioUrl,
          order: maxOrder + 1 + i,
        });
      }

      await refetchSongs();
      onClose();
    } catch (e) {
      console.error(e);
      if (e instanceof FirebaseError && e.code === "permission-denied") {
        setError(
          "Permission denied. This flow uses Firestore (collection `songs`) and Storage (`songs/…`). If Storage rules are already open, add Firestore rules that allow reads on `songs` (for the playlist) and create/update for signed-in users."
        );
        return;
      }
      setError(
        e instanceof Error ? e.message : "Failed to upload songs. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const moveSong = async (songId: string, dir: -1 | 1) => {
    if (!canEditQueue) return;
    const idx = songs.findIndex((s) => s.id === songId);
    const nextIdx = idx + dir;
    if (idx < 0 || nextIdx < 0 || nextIdx >= songs.length) return;
    const copy = songs.map((s) => s.id);
    const [picked] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, picked);
    setQueueBusy(true);
    setError(null);
    try {
      await reorderSongs(copy);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to reorder songs.");
    } finally {
      setQueueBusy(false);
    }
  };

  const handleRemoveSong = async (songId: string) => {
    if (!canEditQueue) return;
    setQueueBusy(true);
    setError(null);
    try {
      await removeSong(songId);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to remove song.");
    } finally {
      setQueueBusy(false);
    }
  };

  const subtitle = useMemo(() => {
    if (!items.length) return "Choose one or more audio files to upload.";
    return `${items.length} song${items.length === 1 ? "" : "s"} ready to upload`;
  }, [items.length]);

  useEffect(() => {
    setMounted(true);
    return () => {
      setMounted(false);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] isolate mix-blend-normal flex items-center justify-center bg-black/50 text-black"
      onClick={onClose}
    >
      <div
        className="w-[90%] max-w-[520px] bg-white p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 text-lg font-semibold">Upload songs</h2>
        <p className="mb-6 text-xs font-normal text-[#171717]">{subtitle}</p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-normal">Audio files</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              type="button"
              className="w-full border border-[#171717] bg-transparent p-3 font-inherit font-normal cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {items.length ? "Replace selection" : "Choose files"}
            </button>
          </div>

          {items.length > 0 && (
            <div className="flex flex-col gap-3">
              {items.map((item, idx) => (
                <div key={`${item.file.name}-${idx}`} className="flex flex-col gap-2 border border-[#171717]/20 p-3">
                  <div className="text-xs text-[#171717] break-all">
                    {item.file.name}
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) =>
                        handleChangeMeta(idx, { title: e.target.value })
                      }
                      className="flex-1 border border-[#171717] p-2 text-sm font-inherit font-normal"
                      placeholder="Title"
                    />
                    <input
                      type="text"
                      value={item.artist}
                      onChange={(e) =>
                        handleChangeMeta(idx, { artist: e.target.value })
                      }
                      className="flex-1 border border-[#171717] p-2 text-sm font-inherit font-normal"
                      placeholder="Artist"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2">
            <h3 className="mb-2 text-xs font-semibold">Current playlist</h3>
            <div className="max-h-[220px] overflow-auto border border-[#171717]/20">
              {songs.length === 0 ? (
                <div className="p-3 text-xs text-[#171717]/70">No songs uploaded yet.</div>
              ) : (
                songs.map((song, idx) => (
                  <div
                    key={song.id}
                    className="flex items-center justify-between gap-2 border-b border-[#171717]/10 p-2 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium">{song.title}</div>
                      <div className="truncate text-[11px] text-[#171717]/70">{song.artist}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="border border-[#171717] px-2 py-1 text-[10px] disabled:opacity-40"
                        disabled={!canEditQueue || idx === 0}
                        onClick={() => void moveSong(song.id, -1)}
                      >
                        UP
                      </button>
                      <button
                        type="button"
                        className="border border-[#171717] px-2 py-1 text-[10px] disabled:opacity-40"
                        disabled={!canEditQueue || idx === songs.length - 1}
                        onClick={() => void moveSong(song.id, 1)}
                      >
                        DOWN
                      </button>
                      <button
                        type="button"
                        className="border border-[#FF0000] px-2 py-1 text-[10px] text-[#FF0000] disabled:opacity-40"
                        disabled={!canEditQueue}
                        onClick={() => void handleRemoveSong(song.id)}
                      >
                        REMOVE
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {error && <p className="text-sm text-[#FF0000]">{error}</p>}

          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleCreate}
            className="mt-2 border border-[#171717] bg-[#171717] p-3 font-inherit font-semibold text-white cursor-pointer disabled:cursor-not-allowed"
          >
            {submitting ? "Uploading…" : "UPLOAD"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

