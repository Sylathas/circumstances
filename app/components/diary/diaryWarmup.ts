"use client";

import { collection, getDocs } from "firebase/firestore";
import { db } from "@/app/components/firebase/firebaseConfig";
import type { DiaryEntry } from "@/app/types/project";

export type DiaryEntryWithOrder = DiaryEntry & { order: number };

let cachedDiary: DiaryEntryWithOrder[] | null = null;
let diaryInFlight: Promise<DiaryEntryWithOrder[]> | null = null;

function toDiaryList(snap: Awaited<ReturnType<typeof getDocs>>): DiaryEntryWithOrder[] {
  const list: DiaryEntryWithOrder[] = snap.docs.map((d, idx) => {
    const data = d.data() as Record<string, unknown>;
    const rawOrder = data?.order;
    const order =
      typeof rawOrder === "number" && Number.isFinite(rawOrder)
        ? rawOrder
        : 1_000_000_000 + idx;
    return {
      id: d.id,
      slug: typeof data?.slug === "string" ? data.slug : undefined,
      cover: data?.cover ?? "",
      description: data?.description ?? "",
      name: data?.name ?? "",
      subtitle: data?.subtitle ?? "",
      order,
    };
  });
  list.sort((a, b) => a.order - b.order);
  return list;
}

function preloadDiaryCovers(entries: DiaryEntryWithOrder[], maxCovers: number) {
  if (typeof window === "undefined") return;
  let n = 0;
  for (const e of entries) {
    if (!e.cover) continue;
    const img = new Image();
    img.decoding = "async";
    img.src = e.cover;
    n += 1;
    if (n >= maxCovers) break;
  }
}

export function getWarmDiarySnapshot(): DiaryEntryWithOrder[] | null {
  return cachedDiary;
}

/** Call after creating or deleting diary entries so the next list fetch is fresh. */
export function invalidateDiaryCache(): void {
  cachedDiary = null;
  diaryInFlight = null;
}

export async function warmupDiaryGrid(options?: {
  preloadCovers?: boolean;
  maxCovers?: number;
}): Promise<DiaryEntryWithOrder[]> {
  const preloadCovers = options?.preloadCovers ?? true;
  const maxCovers = options?.maxCovers ?? 24;

  if (cachedDiary) {
    if (preloadCovers) preloadDiaryCovers(cachedDiary, maxCovers);
    return cachedDiary;
  }
  if (diaryInFlight) return diaryInFlight;

  diaryInFlight = getDocs(collection(db, "diary"))
    .then((snap) => {
      const list = toDiaryList(snap);
      cachedDiary = list;
      if (preloadCovers) preloadDiaryCovers(list, maxCovers);
      return list;
    })
    .finally(() => {
      diaryInFlight = null;
    });

  return diaryInFlight;
}
