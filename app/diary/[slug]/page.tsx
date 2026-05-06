import { readFileSync } from "fs";
import { join } from "path";
import DiaryEntryPageClient from "./DiaryEntryPageClient";

/**
 * Static-export wrapper for /diary/[slug].
 * Prefers diary-slugs.json; falls back to diary-ids.json for legacy exports.
 */
export async function generateStaticParams() {
  try {
    const path = join(process.cwd(), "diary-slugs.json");
    const raw = readFileSync(path, "utf8");
    const slugs = JSON.parse(raw);
    if (Array.isArray(slugs) && slugs.length > 0) {
      return slugs.map((slug: string) => ({ slug }));
    }
  } catch {
    // ignore
  }
  try {
    const path = join(process.cwd(), "diary-ids.json");
    const raw = readFileSync(path, "utf8");
    const ids = JSON.parse(raw);
    if (Array.isArray(ids) && ids.length > 0) {
      return ids.map((id: string) => ({ slug: id }));
    }
  } catch {
    // Build must remain resilient if file is missing/invalid.
  }

  return [{ slug: "_" }];
}

export default function DiaryEntryPage() {
  return <DiaryEntryPageClient />;
}
