import { readFileSync } from "fs";
import { join } from "path";
import ProjectPageClient from "./ProjectPageClient";

/**
 * Reads project IDs from project-ids.json at build time (no Firestore in Node,
 * which can throw ERR_BUFFER_OUT_OF_BOUNDS). Generate that file by running
 * `npm run update-project-ids` before deploy, or it will only pre-render /project/_.
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

export default function ProjectPage() {
  return <ProjectPageClient />;
}
