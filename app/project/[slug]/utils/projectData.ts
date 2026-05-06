import type { Project, RowLayout } from "@/app/types/project";
export type { RowLayout };

export type MediaItem =
  | { type: "image"; url: string }
  | { type: "video"; url: string };

/** Firestore can return objects instead of arrays; ensure we always have string[]. */
export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.values(value).filter(
      (v): v is string => typeof v === "string"
    );
  }
  return [];
}

export function asCreditNamesArray(
  value: unknown
): Array<{ name: string; role: string }> {
  if (!Array.isArray(value)) {
    if (value && typeof value === "object") {
      return Object.values(value).filter(
        (v): v is { name: string; role: string } =>
          v != null &&
          typeof v === "object" &&
          "name" in v &&
          "role" in v
      );
    }
    return [];
  }
  return value.filter(
    (v): v is { name: string; role: string } =>
      v != null &&
      typeof v === "object" &&
      "name" in v &&
      "role" in v
  );
}

export function asRowLayoutsArray(value: unknown): RowLayout[] {
  if (!Array.isArray(value)) {
    if (value && typeof value === "object") {
      return Object.values(value).filter(
        (v): v is RowLayout => v === 1 || v === 2
      );
    }
    return [];
  }
  return value.filter((v): v is RowLayout => v === 1 || v === 2);
}

export function buildMediaItems(project: Project): MediaItem[] {
  const images = asStringArray(project.Images).map((url) => ({
    type: "image" as const,
    url,
  }));
  const videos = asStringArray(project.Videos).map((url) => ({
    type: "video" as const,
    url,
  }));
  return [...images, ...videos];
}

export function defaultRowLayouts(itemCount: number): RowLayout[] {
  const layouts: RowLayout[] = [];
  let i = 0;
  while (i < itemCount) {
    layouts.push(i + 2 <= itemCount ? 2 : 1);
    i += layouts[layouts.length - 1];
  }
  return layouts;
}

export function chunkByLayouts<T>(
  items: T[],
  layouts: RowLayout[]
): T[][] {
  const rows: T[][] = [];
  let idx = 0;
  for (const cols of layouts) {
    rows.push(items.slice(idx, idx + cols));
    idx += cols;
  }
  return rows;
}
