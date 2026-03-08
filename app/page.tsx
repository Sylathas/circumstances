"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./components/firebase/firebaseConfig";
import { useAuth } from "./components/auth/AuthContext";
import Header, { type ActiveFilters } from "./components/Header";
import type { ProjectType } from "./types/project";
import dynamic from "next/dynamic";
import type { Project } from "./types/project";
import AddProjectModal from "./components/AddProjectModal";
import { uploadFile, deleteFileByUrl } from "./utils/storage";

const CarouselScene = dynamic(
  () => import("./components/carousel/CarouselScene"),
  { ssr: false }
);

export default function Home() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>(new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<"client" | "title" | null>(
    null
  );
  const [editValue, setEditValue] = useState("");
  const coverInputRef = useRef<HTMLInputElement>(null);

  const fetchProjects = useCallback(async () => {
    const snap = await getDocs(collection(db, "projects"));
    const list: Project[] = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Project[];
    setProjects(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const toggleFilter = useCallback((type: ProjectType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
    setActiveIndex(0);
  }, []);

  const filteredProjects = activeFilters.size
    ? projects.filter((p) => activeFilters.has(p.Type))
    : projects;

  const N = filteredProjects.length + (isAdmin ? 1 : 0);
  const numSlots = Math.max(1, N);
  const clampedIndex = Math.max(0, Math.min(activeIndex, numSlots - 1));
  const activeProject =
    clampedIndex < filteredProjects.length
      ? filteredProjects[clampedIndex]
      : null;

  const handleDelete = useCallback(async (project: Project) => {
    if (!confirm("Delete this project and all its images?")) return;
    try {
      const urlsToDelete: string[] = [
        ...(project["Cover Image"] ? [project["Cover Image"]] : []),
        ...(project.Images || []),
      ];
      for (const url of urlsToDelete) {
        try {
          await deleteFileByUrl(url);
        } catch {
          // continue if one fails (e.g. invalid URL)
        }
      }
      await deleteDoc(doc(db, "projects", project.id));
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      setActiveIndex((i) => Math.max(0, i - 1));
    } catch (err) {
      console.error(err);
      alert("Failed to delete project");
    }
  }, []);

  const handleEditCover = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>, project: Project) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      try {
        const path = `covers/${Date.now()}_${file.name}`;
        const url = await uploadFile(file, path);
        await updateDoc(doc(db, "projects", project.id), {
          "Cover Image": url,
        });
        setProjects((prev) =>
          prev.map((p) =>
            p.id === project.id ? { ...p, "Cover Image": url } : p
          )
        );
      } catch (err) {
        console.error(err);
        alert("Failed to upload cover");
      }
    },
    []
  );

  const handleSaveField = useCallback(
    async (
      projectId: string,
      field: "Client" | "Project Title",
      value: string
    ) => {
      setEditingField(null);
      const trimmed = value.trim();
      if (!trimmed) return;
      try {
        const key = field === "Project Title" ? "Project Title" : "Client";
        await updateDoc(doc(db, "projects", projectId), { [key]: trimmed });
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId ? { ...p, [key]: trimmed } : p
          )
        );
      } catch (err) {
        console.error(err);
        alert("Failed to save");
      }
    },
    []
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-[var(--header-height)]">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pt-[var(--header-height)]">
      <Header activeFilters={activeFilters} onFilterToggle={toggleFilter} />
      <div className="w-full h-[calc(100vh-var(--header-height))] relative cursor-default">
        <CarouselScene
          projects={filteredProjects}
          isAdmin={!!isAdmin}
          activeIndex={clampedIndex}
          onActiveIndexChange={setActiveIndex}
          onAddClick={() => setAddModalOpen(true)}
          onProjectClick={(index) => {
            if (index >= 0 && index < filteredProjects.length) {
              router.push(`/project/${filteredProjects[index].id}`);
            }
          }}
        />
        <div className="absolute top-25 left-1/2 -translate-x-1/2 text-center text-[#171717] text-sm font-normal">
          {activeProject && (
            <>
              {isAdmin && (
                <div className="mb-2 flex gap-4 justify-center flex-wrap">
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleEditCover(e, activeProject)}
                  />
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="font-inherit text-xs font-normal text-[#0a0] bg-transparent border-none cursor-pointer"
                  >
                    Edit Cover
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(activeProject)}
                    className="font-inherit text-xs font-normal text-red-600 bg-transparent border-none cursor-pointer"
                  >
                    Delete Project
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-center text-[#171717] text-xs font-normal">
          {activeProject ? (
            <>
              {editingField === "client" ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() =>
                    handleSaveField(activeProject.id, "Client", editValue)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      handleSaveField(activeProject.id, "Client", editValue);
                    if (e.key === "Escape") setEditingField(null);
                  }}
                  className="mb-1 w-[200px] text-center font-inherit border border-[#171717] p-1 bg-transparent border-none outline-none"
                />
              ) : (
                <p
                  className={`mb-1 ${isAdmin ? "cursor-pointer" : "cursor-default"}`}
                  onClick={() => {
                    if (isAdmin) {
                      setEditValue(activeProject.Client);
                      setEditingField("client");
                    }
                  }}
                >
                  {activeProject.Client}
                </p>
              )}
              {editingField === "title" ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() =>
                    handleSaveField(activeProject.id, "Project Title", editValue)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      handleSaveField(
                        activeProject.id,
                        "Project Title",
                        editValue
                      );
                    if (e.key === "Escape") setEditingField(null);
                  }}
                  className="text-md font-normal mb-2 w-60 text-center font-inherit border border-[#171717] p-1 bg-transparent border-none outline-none"
                />
              ) : (
                <p
                  className={`text-md font-normal mb-2 ${isAdmin ? "cursor-pointer" : "cursor-default"}`}
                  onClick={() => {
                    if (isAdmin) {
                      setEditValue(activeProject["Project Title"]);
                      setEditingField("title");
                    }
                  }}
                >
                  {activeProject["Project Title"]}
                </p>
              )}
            </>
          ) : isAdmin && clampedIndex === filteredProjects.length ? (
            <p className="text-sm font-normal">Add a new project</p>
          ) : null}
        </div>
      </div>
      {addModalOpen && (
        <AddProjectModal onClose={() => setAddModalOpen(false)} />
      )}
    </div>
  );
}
