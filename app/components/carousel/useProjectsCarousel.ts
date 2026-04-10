"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/app/components/firebase/firebaseConfig";
import { useAuth } from "@/app/components/auth/AuthContext";
import type { ActiveFilters } from "@/app/components/Header";
import type { ProjectType, Project } from "@/app/types/project";
import { uploadFile, deleteFileByUrl } from "@/app/utils/storage";
import {
  getWarmProjectsSnapshot,
  warmupProjectsCarousel,
} from "@/app/components/carousel/projectsWarmup";

export function useProjectsCarousel() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  const warmSnapshot = getWarmProjectsSnapshot();

  const [projects, setProjects] = useState<Project[]>(() => warmSnapshot ?? []);
  const [loading, setLoading] = useState(!warmSnapshot);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>(new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<"client" | "title" | null>(
    null
  );
  const [editValue, setEditValue] = useState("");
  const coverInputRef = useRef<HTMLInputElement>(null);

  const fetchProjects = useCallback(async () => {
    const list = await warmupProjectsCarousel({ preloadImages: true, maxImages: 10 });
    setProjects(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchProjects();
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

  const onProjectClick = useCallback(
    (index: number) => {
      if (index >= 0 && index < filteredProjects.length) {
        router.push(`/projects/${filteredProjects[index].id}`);
      }
    },
    [router, filteredProjects]
  );

  return {
    authLoading,
    loading,
    isAdmin,
    activeFilters,
    toggleFilter,
    filteredProjects,
    clampedIndex,
    activeIndex,
    setActiveIndex,
    activeProject,
    addModalOpen,
    setAddModalOpen,
    editingField,
    setEditingField,
    editValue,
    setEditValue,
    coverInputRef,
    handleDelete,
    handleEditCover,
    handleSaveField,
    onProjectClick,
  };
}
