import { readFileSync } from "fs";
import { join } from "path";
import ProjectPageClient from "../../project/[id]/ProjectPageClient";

/**
 * Route wrapper so individual projects live under `/projects/[id]`.
 * This allows HEADER BACK to return to the `/projects` carousel route.
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

export default function ProjectsProjectPage() {
  return <ProjectPageClient />;
}

