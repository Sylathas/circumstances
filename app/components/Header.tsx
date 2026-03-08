"use client";

import Link from "next/link"; // used for logo
import { useAuth } from "./auth/AuthContext";
import type { ProjectType } from "@/app/types/project";

const CATEGORIES = [
  "CREATIVE DIRECTION",
  "FILM",
  "STILL",
  "LIVE SHOW",
] as const;

const TYPE_MAP: Record<string, ProjectType> = {
  "CREATIVE DIRECTION": "Creative Direction",
  FILM: "Film",
  STILL: "Still",
  "LIVE SHOW": "Live Show",
};

export type ActiveFilters = Set<ProjectType>;

export type SaveState = "idle" | "loading" | "success";

type HeaderProps = {
  activeFilters?: ActiveFilters;
  onFilterToggle?: (type: ProjectType) => void;
  /** When set, show a BACK link (e.g. "/") on the right side. */
  backHref?: string;
  /** When set and isAdmin, show SAVE button; called on click. */
  onSave?: () => void | Promise<void>;
  saveState?: SaveState;
};

export default function Header({
  activeFilters = new Set(),
  onFilterToggle = () => { },
  backHref,
  onSave,
  saveState = "idle",
}: HeaderProps) {
  const { isAdmin, signOut } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-transparent px-2 py-2 text-black">
      <div
        className="flex gap-20"
      >
        <Link
          href="/"
          className="block h-7 w-7 shrink-0 bg-[url('/textures/logo.png')] bg-contain bg-center bg-no-repeat"
          aria-label="Home"
        />
        <nav className="flex items-center gap-15 my-3" style={{ fontWeight: 600 }}>
          {CATEGORIES.map((label) => {
            const type = TYPE_MAP[label];
            const isActive = activeFilters.has(type);
            return (
              <button
                key={label}
                type="button"
                onClick={() => onFilterToggle(type)}
                className="font-inherit text-xs border-none bg-transparent p-0 cursor-pointer"
                style={isActive ? { fontWeight: 800 } : { fontWeight: 500 }}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-6">
        {backHref != null && (
          <Link
            href={backHref}
            className="font-inherit text-xs font-normal no-underline text-[#171717]"
            style={{ fontWeight: 500 }}
          >
            BACK
          </Link>
        )}
        {isAdmin && onSave != null && (
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saveState === "loading"}
            className="font-inherit text-xs font-normal border-none bg-transparent text-[#32CD32] cursor-pointer disabled:cursor-wait"
            style={{ fontWeight: 500 }}
          >
            {saveState === "loading"
              ? "Saving…"
              : saveState === "success"
                ? "Saved"
                : "SAVE"}
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={() => void signOut()}
            className="font-inherit text-xs font-normal border-none bg-transparent cursor-pointer text-[#171717]"
            style={{ fontWeight: 500 }}
          >
            LOG OUT
          </button>
        )}
      </div>
    </header>
  );
}
