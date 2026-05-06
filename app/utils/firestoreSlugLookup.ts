/**
 * Resolve Firestore documents from URL path segments (slug or legacy id).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  type DocumentSnapshot,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { slugify } from "@/app/utils/slug";

function normalizeSegment(segment: string): string {
  return slugify(decodeURIComponent(segment.trim()));
}

export async function fetchProjectDocByRouteSegment(
  db: Firestore,
  segment: string
): Promise<DocumentSnapshot | null> {
  const raw = typeof segment === "string" ? segment.trim() : "";
  if (!raw) return null;
  const normalized = normalizeSegment(raw);

  const bySlug = await getDocs(
    query(
      collection(db, "projects"),
      where("slug", "==", normalized),
      limit(1)
    )
  );
  if (!bySlug.empty) return bySlug.docs[0];

  const byId = await getDoc(doc(db, "projects", raw));
  if (byId.exists()) return byId;

  const all = await getDocs(collection(db, "projects"));
  for (const d of all.docs) {
    const data = d.data();
    const title = (data["Project Title"] as string) ?? "";
    if (slugify(title) === normalized) return d;
  }
  return null;
}

export async function fetchDiaryDocByRouteSegment(
  db: Firestore,
  segment: string
): Promise<DocumentSnapshot | null> {
  const raw = typeof segment === "string" ? segment.trim() : "";
  if (!raw) return null;
  const normalized = normalizeSegment(raw);

  const bySlug = await getDocs(
    query(collection(db, "diary"), where("slug", "==", normalized), limit(1))
  );
  if (!bySlug.empty) return bySlug.docs[0];

  const byId = await getDoc(doc(db, "diary", raw));
  if (byId.exists()) return byId;

  const all = await getDocs(collection(db, "diary"));
  for (const d of all.docs) {
    const data = d.data();
    const name = (data.name as string) ?? "";
    if (slugify(name) === normalized) return d;
  }
  return null;
}
