"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/app/components/firebase/firebaseConfig";
import { useAuth } from "@/app/components/auth/AuthContext";
import Header, { type SaveState } from "@/app/components/Header";
import PageTransition from "@/app/components/PageTransition";
import { uploadFile } from "@/app/utils/storage";
import type { Project } from "@/app/types/project";
import {
  asCreditNamesArray,
  buildMediaItems,
  type MediaItem,
} from "./utils/projectData";
import ProjectInfoSection from "./components/ProjectInfoSection";
import MediaGallery from "./components/MediaGallery";
import CreditsSection from "./components/CreditsSection";
import ProjectPageFooter from "./components/ProjectPageFooter";

export default function ProjectPageClient() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { isAdmin } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [client, setClient] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [creditNames, setCreditNames] = useState<
    Array<{ name: string; role: string }>
  >([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [allProjectIds, setAllProjectIds] = useState<string[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const FETCH_TIMEOUT_MS = 12000;

  const fetchProject = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    setFetchError(null);
    try {
      const snap = await Promise.race([
        getDoc(doc(db, "projects", id)),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Request timed out")),
            FETCH_TIMEOUT_MS
          )
        ),
      ]);
      if (!snap.exists()) {
        setNotFound(true);
        setProject(null);
        return;
      }
      const data = { id: snap.id, ...snap.data() } as Project;
      setProject(data);
      setClient(data.Client ?? "");
      setProjectTitle(data["Project Title"] ?? "");
      setProjectDescription(data["Project Description"] ?? "");
      setCreditNames(asCreditNamesArray(data["Credit Names"]));
      setMediaItems(buildMediaItems(data));
    } catch (err) {
      console.error(err);
      setFetchError(
        "Couldn’t load project. If you use an ad blocker or privacy extension, try disabling it for this site or open in a private window."
      );
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  useEffect(() => {
    if (!id) return;
    getDocs(collection(db, "projects")).then((snap) => {
      setAllProjectIds(snap.docs.map((d) => d.id).sort());
    });
  }, [id]);

  const nextId =
    allProjectIds.length > 0
      ? allProjectIds[(allProjectIds.indexOf(id) + 1) % allProjectIds.length]
      : null;

  const handleSave = useCallback(async () => {
    if (!project) return;
    setSaveState("loading");
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    try {
      await updateDoc(doc(db, "projects", project.id), {
        Client: client,
        "Project Title": projectTitle,
        "Project Description": projectDescription,
        "Credit Names": creditNames,
        Images: mediaItems
          .filter((m) => m.type === "image")
          .map((m) => m.url),
        Videos: mediaItems
          .filter((m) => m.type === "video")
          .map((m) => m.url),
      });
      setSaveState("success");
      successTimeoutRef.current = setTimeout(() => {
        setSaveState("idle");
        successTimeoutRef.current = null;
      }, 2000);
    } catch (err) {
      console.error(err);
      setSaveState("idle");
    }
  }, [
    project,
    client,
    projectTitle,
    projectDescription,
    creditNames,
    mediaItems,
  ]);

  const handleMediaReorder = useCallback((reordered: MediaItem[]) => {
    setMediaItems(reordered);
  }, []);

  const handleAddMedia = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length || !id) return;
      const toUpload = Array.from(files).filter(
        (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
      );
      if (toUpload.length === 0) {
        e.target.value = "";
        return;
      }
      const ts = Date.now();
      Promise.all(
        toUpload.map((file, i) => {
          const path = `projects/${id}/media/${ts}_${i}_${file.name}`;
          return uploadFile(file, path).then((url): MediaItem => {
            const isImage = file.type.startsWith("image/");
            return isImage ? { type: "image", url } : { type: "video", url };
          });
        })
      ).then((newItems) => {
        setMediaItems((prev) => [...prev, ...newItems]);
      });
      e.target.value = "";
    },
    [id]
  );

  const addCredit = useCallback(() => {
    setCreditNames((prev) => [...prev, { name: "", role: "" }]);
  }, []);

  const removeCredit = useCallback((index: number) => {
    setCreditNames((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateCredit = useCallback(
    (index: number, field: "name" | "role", value: string) => {
      setCreditNames((prev) =>
        prev.map((row, i) =>
          i === index ? { ...row, [field]: value } : row
        )
      );
    },
    []
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white pt-[var(--header-height)] flex items-center justify-center">
        <p className="text-sm font-normal text-[#171717]">Loading…</p>
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="min-h-screen bg-white pt-[var(--header-height)] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm font-normal text-[#171717]">
          {fetchError ?? "Project not found."}
        </p>
        <Link href="/" className="text-sm font-normal text-[#171717] underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <PageTransition type="fade" className="min-h-screen bg-white">
      <div className="bg-white pt-[var(--header-height)]">
        <Header
          activeFilters={new Set()}
          onFilterToggle={() => {}}
          backHref="/"
          onSave={isAdmin ? handleSave : undefined}
          saveState={saveState}
        />
        <main className="w-full h-full bg-white pt-50 pb-2">
          <ProjectInfoSection
            client={client}
            projectTitle={projectTitle}
            projectDescription={projectDescription}
            isAdmin={!!isAdmin}
            onClientChange={setClient}
            onTitleChange={setProjectTitle}
            onDescriptionChange={setProjectDescription}
          />
          <MediaGallery
            mediaItems={mediaItems}
            isAdmin={!!isAdmin}
            projectId={id}
            onReorder={handleMediaReorder}
            onAddMedia={handleAddMedia}
          />
          <CreditsSection
            creditNames={creditNames}
            isAdmin={!!isAdmin}
            onAdd={addCredit}
            onRemove={removeCredit}
            onUpdate={updateCredit}
          />
          <ProjectPageFooter nextProjectId={nextId} />
        </main>
      </div>
    </PageTransition>
  );
}
