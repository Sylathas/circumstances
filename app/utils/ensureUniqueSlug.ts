import {
  collection,
  getDocs,
  limit,
  query,
  where,
  type Firestore,
} from "firebase/firestore";
import { slugify } from "@/app/utils/slug";

/**
 * Returns a `slug` value unique within `collectionName`, excluding `excludeDocId` if set.
 */
export async function ensureUniqueSlug(
  db: Firestore,
  collectionName: "projects" | "diary",
  baseRaw: string,
  excludeDocId?: string
): Promise<string> {
  const base = slugify(baseRaw);
  let candidate = base || "untitled";
  let n = 0;
  while (true) {
    const snap = await getDocs(
      query(
        collection(db, collectionName),
        where("slug", "==", candidate),
        limit(2)
      )
    );
    const conflicting = snap.docs.filter((d) => d.id !== excludeDocId);
    if (conflicting.length === 0) return candidate;
    n += 1;
    candidate = `${base || "untitled"}-${n}`;
  }
}
