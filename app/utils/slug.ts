/**
 * URL-safe slugs for /projects/[slug] and /diary/[slug] routes.
 */

import type { DiaryEntry, Project } from "@/app/types/project";

export function slugify(text: string): string {
  const s = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "untitled";
}

export function projectPathSegment(
  p: Pick<Project, "slug" | "Project Title">
): string {
  const s = p.slug?.trim();
  if (s) return s;
  return slugify(p["Project Title"] || "untitled");
}

export function diaryPathSegment(
  e: Pick<DiaryEntry, "slug" | "name">
): string {
  const s = e.slug?.trim();
  if (s) return s;
  return slugify(e.name || "untitled");
}
