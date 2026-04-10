"use client";

/**
 * ProjectPageFooter renders a simple NEXT PROJECT link when a nextProjectId is provided.
 * Used at the bottom of ProjectPageClient to jump sequentially between projects.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { navigateWithBlurTransition } from "@/app/utils/blurRouteTransition";

type ProjectPageFooterProps = {
  nextProjectId: string | null;
};

export default function ProjectPageFooter({
  nextProjectId,
}: ProjectPageFooterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();

  return (
    <footer className="flex justify-end px-2">
      {nextProjectId ? (
        <Link
          href={`/projects/${nextProjectId}`}
          onClick={(e) => {
            e.preventDefault();
            navigateWithBlurTransition({
              router,
              fromPath: pathname ?? `/projects/${nextProjectId}`,
              toPath: `/projects/${nextProjectId}`,
              isMobile,
            });
          }}
          className="text-[#171717] text-sm uppercase"
          style={{ fontWeight: 400 }}
        >
          NEXT PROJECT
        </Link>
      ) : null}
    </footer>
  );
}
