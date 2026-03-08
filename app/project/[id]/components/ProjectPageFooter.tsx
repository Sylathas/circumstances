"use client";

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
          href={`/project/${nextProjectId}`}
          className="text-[#171717] text-sm uppercase"
          style={{ fontWeight: 400 }}
        >
          NEXT PROJECT
        </Link>
      ) : null}
    </footer>
  );
}
