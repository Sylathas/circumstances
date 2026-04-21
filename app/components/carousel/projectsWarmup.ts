"use client";

import { collection, getDocs } from "firebase/firestore";
import { db } from "@/app/components/firebase/firebaseConfig";
import type { Project } from "@/app/types/project";
import { preloadCarouselMrRoughness } from "@/app/components/carousel/carouselRoughness";

let cachedProjects: Project[] | null = null;
let inFlight: Promise<Project[]> | null = null;

function toProjectList(snap: Awaited<ReturnType<typeof getDocs>>) {
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as Project[];
}

function preloadProjectImages(projects: Project[], maxImages: number) {
  if (typeof window === "undefined") return;
  const urls = new Set<string>();
  for (const p of projects) {
    if (p["Cover Image"]) urls.add(p["Cover Image"]);
    if (p.Images?.[0]) urls.add(p.Images[0]);
    if (urls.size >= maxImages) break;
  }
  for (const url of urls) {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }
}

export function getWarmProjectsSnapshot() {
  return cachedProjects;
}

export async function warmupProjectsCarousel(options?: {
  preloadImages?: boolean;
  maxImages?: number;
}) {
  const preloadImages = options?.preloadImages ?? true;
  const maxImages = options?.maxImages ?? 8;

  if (cachedProjects) {
    if (preloadImages) {
      preloadProjectImages(cachedProjects, maxImages);
      preloadCarouselMrRoughness();
    }
    return cachedProjects;
  }
  if (inFlight) return inFlight;

  inFlight = getDocs(collection(db, "projects"))
    .then((snap) => {
      const list = toProjectList(snap);
      cachedProjects = list;
      if (preloadImages) {
        preloadProjectImages(list, maxImages);
        preloadCarouselMrRoughness();
      }
      return list;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
