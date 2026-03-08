export type ProjectType =
  | "Creative Direction"
  | "Film"
  | "Still"
  | "Live Show";

/** Per-row layout: 1 = single column, 2 = two columns. Length = number of rows. */
export type RowLayout = 1 | 2;

export interface Project {
  id: string;
  Client: string;
  "Cover Image": string;
  "Credit Names": Array<{ name: string; role: string }>;
  Images: string[];
  "Project Description": string;
  "Project Title": string;
  Type: ProjectType;
  Videos: string[];
  /** Optional. Each entry is columns for that row (1 or 2). Default row is 2. */
  "Row Layouts"?: RowLayout[];
}
