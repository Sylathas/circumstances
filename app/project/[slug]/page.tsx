import { readFileSync } from "fs";
import { join } from "path";
import ProjectPageClient from "./ProjectPageClient";

/**
 * Legacy /project/[slug] route kept as an alias for old bookmarks.
 * For static export, it pre-renders the same slugs as /projects/[slug].
 */
export async function generateStaticParams() {
  try {
    const path = join(process.cwd(), "project-slugs.json");
    const raw = readFileSync(path, "utf8");
    const slugs = JSON.parse(raw);
    if (Array.isArray(slugs) && slugs.length > 0) {
      return slugs.map((slug: string) => ({ slug }));
    }
  } catch {
    // ignore
  }
  try {
    const path = join(process.cwd(), "project-ids.json");
    const raw = readFileSync(path, "utf8");
    const ids = JSON.parse(raw);
    if (Array.isArray(ids) && ids.length > 0) {
      return ids.map((id: string) => ({ slug: id }));
    }
  } catch {
    // No file or invalid: pre-render only placeholder
  }
  return [{ slug: "_" }];
}

export default function LegacyProjectPage() {
  return <ProjectPageClient />;
}
