"use client";

/**
 * ProjectPageFooter renders a simple NEXT PROJECT link when a nextProjectId is provided.
 * Used at the bottom of ProjectPageClient to jump sequentially between projects.
 */

import Link from "next/link";

type ProjectPageFooterProps = {
  nextProjectId: string | null;
};

export default function ProjectPageFooter({
  nextProjectId,
}: ProjectPageFooterProps) {
  return (
    <footer className="flex justify-end px-2">
      {nextProjectId ? (
        <Link
          href={`/projects/${nextProjectId}`}
          className="text-[#171717] text-sm uppercase"
          style={{ fontWeight: 400 }}
        >
          NEXT PROJECT
        </Link>
      ) : null}
    </footer>
  );
}
