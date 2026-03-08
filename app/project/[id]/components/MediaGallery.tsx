"use client";

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

const MAX_ROW_HEIGHT = 800;
const MIN_ROW_HEIGHT = 100;

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

type MediaGalleryProps = {
  mediaItems: MediaItem[];
  isAdmin: boolean;
  projectId: string;
  onReorder: (items: MediaItem[]) => void;
  onAddMedia: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function MediaGallery({
  mediaItems,
  isAdmin,
  projectId,
  onReorder,
  onAddMedia,
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
            {rows.map((rowItems, rowIndex) => (
              <div
                key={rowIndex}
                className={
                  rowItems.length === 1
                    ? "w-full overflow-hidden"
                    : "grid grid-cols-2 gap-0 overflow-hidden"
                }
                style={{
                  height: MAX_ROW_HEIGHT,
                  minHeight: MAX_ROW_HEIGHT,
                }}
              >
                {rowItems.map((item) => (
                  <SortableMediaItem
                    key={item.url}
                    item={item}
                    isAdmin={isAdmin}
                    layout={rowItems.length === 1 ? "landscape" : "portrait"}
                    maxHeight={MAX_ROW_HEIGHT}
                    onDimensions={onDimensions}
                  />
                ))}
              </div>
            ))}
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
            style={{ height: MIN_ROW_HEIGHT }}
          >
            +
          </button>
        </>
      )}
    </section>
  );
}
