"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MediaItem } from "../utils/projectData";

type SortableMediaItemProps = {
  item: MediaItem;
  isAdmin: boolean;
  layout: "landscape" | "portrait";
  maxHeight: number;
  onDimensions?: (url: string, width: number, height: number) => void;
};

export default function SortableMediaItem({
  item,
  isAdmin,
  layout,
  maxHeight,
  onDimensions,
}: SortableMediaItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.url });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const content =
    item.type === "image" ? (
      <img
        src={item.url}
        alt=""
        className="h-full w-full object-cover"
        onLoad={(e) => {
          const el = e.target;
          if (el instanceof HTMLImageElement && el.naturalWidth && onDimensions) {
            onDimensions(item.url, el.naturalWidth, el.naturalHeight);
          }
        }}
      />
    ) : (
      <div className="h-full w-full bg-black">
        <video
          src={item.url}
          controls
          className="h-full w-full object-cover"
          onLoadedMetadata={(e) => {
            const el = e.target;
            if (el instanceof HTMLVideoElement && onDimensions) {
              onDimensions(item.url, el.videoWidth, el.videoHeight);
            }
          }}
        />
      </div>
    );

  const box = (
    <div className="h-full min-h-0 w-full overflow-hidden bg-white">
      {content}
    </div>
  );

  if (!isAdmin) {
    return <div className="h-full w-full">{box}</div>;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative h-full min-h-0 w-full ${isDragging ? "z-10 opacity-80" : ""}`}
    >
      {box}
      <div
        className="absolute top-2 left-2 flex h-8 w-8 items-center justify-center bg-white/80 text-xs cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </div>
    </div>
  );
}
