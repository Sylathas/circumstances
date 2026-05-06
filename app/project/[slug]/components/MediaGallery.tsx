"use client";

/**
 * MediaGallery lays out project media (images and videos) into responsive rows and wires up drag-and-drop reordering.
 * It accepts the media list, admin flag, project id, and callbacks for reorder and add-media events.
 * Used inside ProjectPageClient between the info and credits sections.
 */

import { useRef, useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import type { MediaItem } from "../utils/projectData";
import SortableMediaItem from "./SortableMediaItem";

const DEFAULT_ASPECT_SINGLE = 16 / 9;   // landscape fallback before dimensions load
const DEFAULT_ASPECT_ROW_TWO = 2 / (3 / 2); // two portrait: width/height until dimensions load

/** Build rows: landscape = single column, portrait = two per row. Unknown aspect = landscape. */
function buildRows(
  items: MediaItem[],
  dimensions: Record<string, { w: number; h: number }>
): MediaItem[][] {
  const rows: MediaItem[][] = [];
  let portraitPair: MediaItem[] = [];
  for (const item of items) {
    const d = dimensions[item.url];
    const isLandscape = d ? d.w > d.h : true;
    if (isLandscape) {
      if (portraitPair.length > 0) {
        rows.push(portraitPair);
        portraitPair = [];
      }
      rows.push([item]);
    } else {
      portraitPair.push(item);
      if (portraitPair.length === 2) {
        rows.push(portraitPair);
        portraitPair = [];
      }
    }
  }
  if (portraitPair.length > 0) rows.push(portraitPair);
  return rows;
}

/**
 * Aspect ratio (width/height) for a row so its height scales with container width.
 * Single image: use image aspect; two portrait: height = max of the two cell heights.
 */
function getRowAspectRatio(
  rowItems: MediaItem[],
  dimensions: Record<string, { w: number; h: number }>
): number {
  if (rowItems.length === 1) {
    const d = dimensions[rowItems[0].url];
    return d ? d.w / d.h : DEFAULT_ASPECT_SINGLE;
  }
  if (rowItems.length === 2) {
    const d1 = dimensions[rowItems[0].url];
    const d2 = dimensions[rowItems[1].url];
    if (d1 && d2) {
      const hOverW1 = d1.h / d1.w;
      const hOverW2 = d2.h / d2.w;
      return 2 / Math.max(hOverW1, hOverW2);
    }
    return DEFAULT_ASPECT_ROW_TWO;
  }
  return DEFAULT_ASPECT_SINGLE;
}

type MediaGalleryProps = {
  mediaItems: MediaItem[];
  isAdmin: boolean;
  projectId: string;
  onReorder: (items: MediaItem[]) => void;
  onAddMedia: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isMobile: boolean;
};

export default function MediaGallery({
  mediaItems,
  isAdmin,
  projectId,
  onReorder,
  onAddMedia,
  isMobile,
}: MediaGalleryProps) {
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [dimensions, setDimensions] = useState<Record<string, { w: number; h: number }>>({});

  const onDimensions = useCallback((url: string, w: number, h: number) => {
    setDimensions((prev) => {
      if (prev[url]?.w === w && prev[url]?.h === h) return prev;
      return { ...prev, [url]: { w, h } };
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const urls = mediaItems.map((m) => m.url);
      const oldIndex = urls.indexOf(active.id as string);
      const newIndex = urls.indexOf(over.id as string);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(arrayMove(mediaItems, oldIndex, newIndex));
      }
    }
  };

  const rows = buildRows(mediaItems, dimensions);

  return (
    <section className="mb-16 bg-white">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={mediaItems.map((m) => m.url)}
          strategy={rectSortingStrategy}
        >
          <div className="flex flex-col">
            {rows.map((rowItems, rowIndex) => {
              const aspectRatio = getRowAspectRatio(rowItems, dimensions);
              return (
                <div
                  key={rowIndex}
                  className={
                    rowItems.length === 1
                      ? "w-full overflow-hidden"
                      : "grid grid-cols-2 gap-0 overflow-hidden"
                  }
                  style={{ aspectRatio }}
                >
                  {rowItems.map((item) => (
                    <SortableMediaItem
                      key={item.url}
                      item={item}
                      isAdmin={isAdmin}
                      layout={rowItems.length === 1 ? "landscape" : "portrait"}
                      onDimensions={onDimensions}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {isAdmin && (
        <>
          <input
            ref={mediaInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={onAddMedia}
          />
          <button
            type="button"
            onClick={() => mediaInputRef.current?.click()}
            className="m-0 flex w-full items-center justify-center text-white border-none bg-black font-inherit text-2xl text-neutral-500 cursor-pointer"
            style={{ minHeight: 80 }}
          >
            +
          </button>
        </>
      )}
    </section>
  );
}
