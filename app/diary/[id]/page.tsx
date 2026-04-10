import { readFileSync } from "fs";
import { join } from "path";
import DiaryEntryPageClient from "./DiaryEntryPageClient";

/**
 * Static-export wrapper for /diary/[id].
 * Uses local id manifest; fallback keeps static export builds alive.
 */
export async function generateStaticParams() {
  try {
    const path = join(process.cwd(), "diary-ids.json");
    const raw = readFileSync(path, "utf8");
    const ids = JSON.parse(raw);
    if (Array.isArray(ids) && ids.length > 0) {
      return ids.map((id: string) => ({ id }));
    }
  } catch {
    // Build must remain resilient if file is missing/invalid.
  }

  return [{ id: "_" }];
}

export default function DiaryEntryPage() {
  return <DiaryEntryPageClient />;
}

