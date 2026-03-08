"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase/firebaseConfig";
import { uploadFile } from "@/app/utils/storage";
import type { ProjectType } from "@/app/types/project";

const PROJECT_TYPES: ProjectType[] = [
  "Creative Direction",
  "Film",
  "Still",
  "Live Show",
];

type AddProjectModalProps = {
  onClose: () => void;
};

export default function AddProjectModal({ onClose }: AddProjectModalProps) {
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [type, setType] = useState<ProjectType>("Creative Direction");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
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
      const path = `covers/${Date.now()}_${coverFile.name}`;
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
    if (!title.trim() || !client.trim()) return;
    let url = coverUrl;
    if (coverFile && !url) {
      url = await uploadCover();
      if (!url) return;
    }
    if (!url) {
      setError("Please select and upload a cover image");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const docRef = await addDoc(collection(db, "projects"), {
        "Project Title": title.trim(),
        Client: client.trim(),
        "Cover Image": url,
        Type: type,
        "Project Description":
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
        "Credit Names": [],
        Images: [],
        Videos: [],
      });
      onClose();
      router.push(`/project/${docRef.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    title.trim() &&
    client.trim() &&
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
        <h2 className="mb-6 text-lg font-semibold">New project</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-normal">
              Project Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-[#171717] p-3 font-inherit font-normal"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-normal">Client</label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="w-full border border-[#171717] p-3 font-inherit font-normal"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-normal">Type</label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`border px-3 py-2 text-sm font-inherit font-normal cursor-pointer ${
                    type === t
                      ? "border-[#171717] bg-[#171717] text-white"
                      : "border-[#171717] bg-transparent text-[#171717]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
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
              <img
                src={coverPreview}
                alt="Preview"
                className="mt-2 max-h-[120px] max-w-full object-contain"
              />
            )}
            {uploading && <p className="mt-1 text-xs">Uploading…</p>}
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
