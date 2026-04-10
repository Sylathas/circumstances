"use client";

/**
 * Full projects carousel route: 3D carousel, category filters in the header,
 * and admin overlays for editing the active project.
 */

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { Header } from "@/app/components/Header";
import AddProjectModal from "@/app/components/AddProjectModal";
import { useProjectsCarousel } from "./useProjectsCarousel";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { emitRouteReady } from "@/app/utils/routeReady";

const CarouselScene = dynamic(
  () => import("@/app/components/carousel/CarouselScene"),
  { ssr: false }
);

export default function ProjectsCarouselPage() {
  const c = useProjectsCarousel();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (c.authLoading || c.loading) return;
    const a = requestAnimationFrame(() => {
      requestAnimationFrame(() => emitRouteReady("/projects"));
    });
    return () => cancelAnimationFrame(a);
  }, [c.authLoading, c.loading]);

  if (c.authLoading || c.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pt-[var(--header-height)]">
      <Header
        activeFilters={c.activeFilters}
        onFilterToggle={c.toggleFilter}
        backHref="/home"
        showCategoryFilters
      />
      <div className={`w-full relative cursor-default ${isMobile ? "h-[calc(90vh_-_var(--header-height))]" : "h-[calc(100vh_-_var(--header-height))]"}`}>
        <CarouselScene
          projects={c.filteredProjects}
          isAdmin={!!c.isAdmin}
          activeIndex={c.clampedIndex}
          onActiveIndexChange={c.setActiveIndex}
          onAddClick={() => c.setAddModalOpen(true)}
          onProjectClick={c.onProjectClick}
        />

        <div className={`absolute left-1/2 -translate-x-1/2 text-center text-[#171717] text-sm font-normal ${isMobile ? "top-6" : "top-25"}`}>
          {c.activeProject && (
            <>
              {c.isAdmin && (
                <div className="mb-2 flex gap-4 justify-center flex-wrap">
                  <input
                    ref={c.coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => c.handleEditCover(e, c.activeProject!)}
                  />
                  <button
                    type="button"
                    onClick={() => c.coverInputRef.current?.click()}
                    className="font-inherit text-xs font-normal text-[#0a0] bg-transparent border-none cursor-pointer"
                  >
                    Edit Cover
                  </button>
                  <button
                    type="button"
                    onClick={() => c.handleDelete(c.activeProject!)}
                    className="font-inherit text-xs font-normal text-red-600 bg-transparent border-none cursor-pointer"
                  >
                    Delete Project
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className={`absolute left-1/2 -translate-x-1/2 text-center text-[#171717] text-xs font-normal ${isMobile ? "bottom-8" : "bottom-12"}`}>
          {c.activeProject ? (
            <>
              {c.editingField === "client" ? (
                <input
                  autoFocus
                  value={c.editValue}
                  onChange={(e) => c.setEditValue(e.target.value)}
                  onBlur={() =>
                    c.handleSaveField(c.activeProject!.id, "Client", c.editValue)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      c.handleSaveField(
                        c.activeProject!.id,
                        "Client",
                        c.editValue
                      );
                    if (e.key === "Escape") c.setEditingField(null);
                  }}
                  className="mb-1 w-[200px] text-center font-inherit border border-[#171717] p-1 bg-transparent border-none outline-none"
                />
              ) : (
                <p
                  className={`mb-1 ${c.isAdmin ? "cursor-pointer" : "cursor-default"}`}
                  onClick={() => {
                    if (c.isAdmin) {
                      c.setEditValue(c.activeProject!.Client);
                      c.setEditingField("client");
                    }
                  }}
                >
                  {c.activeProject.Client}
                </p>
              )}
              {c.editingField === "title" ? (
                <input
                  autoFocus
                  value={c.editValue}
                  onChange={(e) => c.setEditValue(e.target.value)}
                  onBlur={() =>
                    c.handleSaveField(
                      c.activeProject!.id,
                      "Project Title",
                      c.editValue
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      c.handleSaveField(
                        c.activeProject!.id,
                        "Project Title",
                        c.editValue
                      );
                    if (e.key === "Escape") c.setEditingField(null);
                  }}
                  className="text-md font-normal mb-2 w-60 text-center font-inherit border border-[#171717] p-1 bg-transparent border-none outline-none"
                />
              ) : (
                <p
                  className={`text-md font-normal mb-2 ${c.isAdmin ? "cursor-pointer" : "cursor-default"}`}
                  onClick={() => {
                    if (c.isAdmin) {
                      c.setEditValue(c.activeProject!["Project Title"]);
                      c.setEditingField("title");
                    }
                  }}
                >
                  {c.activeProject["Project Title"]}
                </p>
              )}
            </>
          ) : c.isAdmin &&
            c.clampedIndex === c.filteredProjects.length ? (
            <p className="text-sm font-normal">Add a new project</p>
          ) : null}
        </div>
      </div>

      {c.addModalOpen && (
        <AddProjectModal onClose={() => c.setAddModalOpen(false)} />
      )}
    </div>
  );
}
