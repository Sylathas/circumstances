import { readFileSync } from "fs";
import { join } from "path";
import ProjectPageClient from "./ProjectPageClient";

/**
 * Legacy /project/[id] route kept as an alias for old bookmarks.
 * For static export, it pre-renders the same ids as /projects/[id].
 */
export async function generateStaticParams() {
  try {
    const path = join(process.cwd(), "project-ids.json");
    const raw = readFileSync(path, "utf8");
    const ids = JSON.parse(raw);
    if (Array.isArray(ids) && ids.length > 0) {
      return ids.map((id: string) => ({ id }));
    }
  } catch {
    // No file or invalid: pre-render only placeholder
  }
  return [{ id: "_" }];
}

export default function LegacyProjectPage() {
  return <ProjectPageClient />;
}
