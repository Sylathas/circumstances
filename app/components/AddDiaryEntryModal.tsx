"use client";

/**
 * AddDiaryEntryModal is the diary counterpart to AddProjectModal.
 * It lets an admin create a new diary entry with a cover image and description.
 */

import { useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "./firebase/firebaseConfig";
import { uploadFile } from "@/app/utils/storage";

type AddDiaryEntryModalProps = {
  onClose: () => void;
};

export default function AddDiaryEntryModal({
  onClose,
}: AddDiaryEntryModalProps) {
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverUrl(null);
    const reader = new FileReader();
    reader.onload = () => setCoverPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadCover = async () => {
    if (!coverFile) return null;
    setUploading(true);
    setError("");
    try {
      const path = `diary/${Date.now()}_${coverFile.name}`;
      const url = await uploadFile(coverFile, path);
      setCoverUrl(url);
      return url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    if (!description.trim()) return;
    let url = coverUrl;
    if (coverFile && !url) {
      url = await uploadCover();
      if (!url) return;
    }
    if (!url) {
      setError("Please select and upload a cover image");
      return;
    }

    // Put new entries at the end of the current grid order.
    // If `order` doesn't exist yet (older entries), we fall back to appending.
    let nextOrder = 0;
    try {
      const q = query(
        collection(db, "diary"),
        orderBy("order", "desc"),
        limit(1)
      );
      const snap = await getDocs(q);
      const max = snap.docs[0]?.data();
      const maxOrder = typeof max?.order === "number" ? max.order : null;
      nextOrder = maxOrder != null ? Math.max(0, maxOrder + 1) : snap.size;
    } catch {
      // ignore and use fallback: append after current count
      const allSnap = await getDocs(collection(db, "diary"));
      nextOrder = allSnap.size;
    }

    setSubmitting(true);
    setError("");
    try {
      const docRef = await addDoc(collection(db, "diary"), {
        cover: url,
        description: description.trim(),
        order: nextOrder,
      });
      onClose();
      router.push(`/diary/${docRef.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create diary entry"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    !!coverFile &&
    !!description.trim() &&
    (coverUrl || (coverFile && !uploading)) &&
    !submitting;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 text-black"
      onClick={onClose}
    >
      <div
        className="w-[90%] max-w-[400px] bg-white p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-6 text-lg font-semibold">New diary entry</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-normal">
              Cover Image
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border border-[#171717] bg-transparent p-3 font-inherit font-normal cursor-pointer"
            >
              {coverFile ? coverFile.name : "Choose file"}
            </button>
            {coverPreview && (
              <div className="relative mt-2 h-[120px] w-full">
                <Image
                  src={coverPreview}
                  alt="Preview"
                  fill
                  unoptimized
                  sizes="400px"
                  className="object-contain"
                />
              </div>
            )}
            {uploading && <p className="mt-1 text-xs">Uploading…</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-normal">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-[#171717] p-3 text-sm font-inherit font-normal resize-vertical min-h-[120px]"
              placeholder="Write the diary entry text"
            />
          </div>
          {error && <p className="text-sm text-[#FF0000]">{error}</p>}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleCreate}
            className="mt-2 border border-[#171717] bg-[#171717] p-3 font-inherit font-semibold text-white cursor-pointer disabled:cursor-not-allowed"
          >
            {submitting ? "Creating…" : "CREATE"}
          </button>
        </div>
      </div>
    </div>
  );
}

