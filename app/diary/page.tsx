"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragCancelEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
} from "@dnd-kit/sortable";

import { Header } from "@/app/components/Header";
import { PageTransition } from "@/app/components/PageTransition";
import { useAuth } from "@/app/components/auth/AuthContext";
import { db } from "@/app/components/firebase/firebaseConfig";
import type { DiaryEntry } from "@/app/types/project";
import AddDiaryEntryModal from "@/app/components/AddDiaryEntryModal";
import SortableDiaryEntryTile from "@/app/components/diary/SortableDiaryEntryTile";

export default function DiaryPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const [columnNum, setColumnNum] = useState("grid-cols-6");
  const [entries, setEntries] = useState<Array<DiaryEntry & { order: number }>>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
  const sortingEnabled = isAdmin;

  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setColumnNum("grid-cols-2");
      } else if (width < 992) {
        setColumnNum("grid-cols-4");
      } else {
        setColumnNum("grid-cols-6");
      }
    };
    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  useEffect(() => {
    const fetchEntries = async () => {
      setLoading(true);
      setError(null);
      try {
        const snap = await getDocs(collection(db, "diary"));
        const list: Array<DiaryEntry & { order: number }> = snap.docs.map(
          (d, idx) => {
            const data = d.data();
            const rawOrder = data?.order;
            const order =
              typeof rawOrder === "number" && Number.isFinite(rawOrder)
                ? rawOrder
                : 1_000_000_000 + idx;
            return {
              id: d.id,
              cover: data?.cover ?? "",
              description: data?.description ?? "",
              order,
            };
          }
        );
        list.sort((a, b) => a.order - b.order);
        setEntries(list);
      } catch (err) {
        console.error(err);
        setError("Failed to load diary entries.");
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, []);

  const persistOrder = useCallback(
    async (items: Array<DiaryEntry & { order: number }>) => {
      // Persist the displayed order to Firestore (`order` is the sort key).
      try {
        await Promise.all(
          items.map((item, idx) =>
            updateDoc(doc(db, "diary", item.id), { order: idx })
          )
        );
      } catch (err) {
        console.error("Failed to persist diary order", err);
      }
    },
    []
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = useCallback(
    (_: DragStartEvent) => {
      if (!sortingEnabled) return;
      setIsDraggingGlobal(true);
    },
    [sortingEnabled]
  );

  const handleDragCancel = useCallback((_: DragCancelEvent) => {
    setIsDraggingGlobal(false);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setIsDraggingGlobal(false);
      if (!sortingEnabled) return;
      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);
      if (activeId === overId) return;

      setEntries((prev) => {
        const oldIndex = prev.findIndex((e) => e.id === activeId);
        const newIndex = prev.findIndex((e) => e.id === overId);
        if (oldIndex === -1 || newIndex === -1) return prev;

        const next = arrayMove(prev, oldIndex, newIndex).map((e, idx) => ({
          ...e,
          order: idx,
        }));

        if (sortingEnabled) void persistOrder(next);
        return next;
      });
    },
    [sortingEnabled, persistOrder]
  );

  const sortableIds = useMemo(() => entries.map((e) => e.id), [entries]);

  return (
    <PageTransition type="fade" className="min-h-screen bg-white">
      <div className="bg-white pt-[var(--header-height)]">
        <Header
          activeFilters={new Set()}
          onFilterToggle={() => { }}
          backHref="/home"
          showCategoryFilters={false}
        />
        <main className="w-full h-full bg-white pt-10 pb-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragCancel={handleDragCancel}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
              <section
                className={`w-full grid ${columnNum} gap-x-15 gap-y-5 items-stretch ${isMobile ? "px-10" : "px-30"}`}
              >
                {loading && (
                  <p className="col-span-full text-xs font-normal text-[#171717]">
                    Loading diary…
                  </p>
                )}
                {error && !loading && (
                  <p className="col-span-full text-xs font-normal text-[#171717]">
                    {error}
                  </p>
                )}
                {isAdmin && !loading && (
                  <button
                    type="button"
                    className="relative aspect-[1/1] w-full overflow-hidden text-3xl font-normal cursor-pointer text-black group flex items-center justify-center"
                    onClick={() => setShowAddModal(true)}
                  >
                    <span className="relative z-10">+</span>
                  </button>
                )}
                {!loading &&
                  !error &&
                  entries.map((entry) => (
                    <SortableDiaryEntryTile
                      key={entry.id}
                      entry={entry}
                      isDraggingGlobal={isDraggingGlobal}
                      disabled={!sortingEnabled}
                      onOpen={(id) => router.push(`/diary/${id}`)}
                    />
                  ))}
              </section>
            </SortableContext>
          </DndContext>
        </main>
        {showAddModal && (
          <AddDiaryEntryModal onClose={() => setShowAddModal(false)} />
        )}
      </div>
    </PageTransition>
  );
}