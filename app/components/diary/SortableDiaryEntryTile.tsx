"use client";

import { useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DiaryEntry } from "@/app/types/project";
import ProgressiveImage from "@/app/components/common/ProgressiveImage";

type SortableDiaryEntryTileProps = {
  entry: DiaryEntry;
  onOpen: (id: string) => void;
  isDraggingGlobal: boolean;
  disabled?: boolean;
};

export default function SortableDiaryEntryTile({
  entry,
  onOpen,
  isDraggingGlobal,
  disabled = false,
}: SortableDiaryEntryTileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id, disabled });

  const style = useMemo(() => {
    return {
      transform: CSS.Transform.toString(transform),
      transition,
    };
  }, [transform, transition]);

  return (
    <button
      ref={setNodeRef}
      style={style}
      type="button"
      className="relative aspect-[1/1] w-full overflow-hidden cursor-pointer group hover:-translate-y-[3px] transition-transform duration-200"
      onClick={(e) => {
        e.stopPropagation();
        // Prevent open right after a drag (click can fire on the tile underneath).
        if (isDraggingGlobal || isDragging) return;
        onOpen(entry.id);
      }}
      {...attributes}
      {...listeners}
    >
      <div className="relative z-10 h-full w-full">
        {entry.cover ? (
          <ProgressiveImage
            src={entry.cover}
            alt=""
            fill
            sizes="(max-width: 768px) 50vw, 300px"
            className="object-contain object-center"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-[#999]">
            No cover
          </div>
        )}
      </div>
    </button>
  );
}

