"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { doc, getDoc, updateDoc } from "firebase/firestore";

import { db } from "@/app/components/firebase/firebaseConfig";
import { useAuth } from "@/app/components/auth/AuthContext";
import { Header, type SaveState } from "@/app/components/Header";
import { PageTransition } from "@/app/components/PageTransition";
import type { DiaryEntry } from "@/app/types/project";

export default function DiaryEntryPageClient() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { isAdmin } = useAuth();

  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const fetchEntry = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    try {
      const snap = await getDoc(doc(db, "diary", id));
      if (!snap.exists()) {
        setNotFound(true);
        setEntry(null);
        return;
      }
      const data = snap.data();
      const loaded: DiaryEntry = {
        id: snap.id,
        cover: data.cover ?? "",
        description: data.description ?? "",
      };
      setEntry(loaded);
      setDescription(loaded.description);
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEntry();
  }, [fetchEntry]);

  const handleSave = useCallback(async () => {
    if (!entry) return;
    setSaveState("loading");
    try {
      await updateDoc(doc(db, "diary", entry.id), {
        description,
      });
      setSaveState("success");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (err) {
      console.error(err);
      setSaveState("idle");
    }
  }, [entry, description]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white pt-[var(--header-height)] flex items-center justify-center">
        <p className="text-xs font-normal text-[#171717]">Loading…</p>
      </div>
    );
  }

  if (notFound || !entry) {
    return (
      <div className="min-h-screen bg-white pt-[var(--header-height)] flex items-center justify-center">
        <p className="text-xs font-normal text-[#171717]">
          Diary entry not found.
        </p>
      </div>
    );
  }

  return (
    <PageTransition type="fade" className="min-h-screen bg-white">
      <div className="bg-white pt-[var(--header-height)]">
        <Header
          activeFilters={new Set()}
          onFilterToggle={() => { }}
          backHref="/diary"
          onSave={isAdmin ? handleSave : undefined}
          saveState={saveState}
          showCategoryFilters={false}
        />
        <main className="w-full h-full bg-white pt-50 pb-10">
          <section className="relative bottom-4 w-full mx-auto px-4">
            <div className="mb-8 w-full">
              {entry.cover && (
                <div className="relative w-full max-w-xl max-h-[400px] aspect-[1/1] overflow-hidden">
                  <Image
                    src={entry.cover}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 576px"
                    className="object-contain object-left"
                  />
                </div>
              )}
            </div>
            <div className="text-[#171717] text-xs whitespace-pre-wrap w-5/6 md:w-1/2">
              {isAdmin ? (
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-[200px] bg-transparent outline-none font-inherit resize-vertical"
                  placeholder="Diary entry text"
                />
              ) : (
                description
              )}
            </div>
          </section>
        </main>
      </div>
    </PageTransition>
  );
}
