"use client";

/**
 * StudioPage loads a single "all" document from the "studio" collection in Firestore
 * and renders editable about + clients sections for admins.
 * Layout mirrors the project page: description on the left, two-column list on the right.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Header, type SaveState } from "@/app/components/Header";
import { PageTransition } from "@/app/components/PageTransition";
import { useAuth } from "@/app/components/auth/AuthContext";
import { db } from "@/app/components/firebase/firebaseConfig";
import type { StudioDocument } from "@/app/types/project";

function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  className,
  style,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      style={style}
      rows={1}
      {...rest}
    />
  );
}

type ClientsSectionProps = {
  items: string[];
  isAdmin: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, value: string) => void;
  isMobile: boolean;
};

type ServicesSectionProps = {
  items: string[];
  isAdmin: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, value: string) => void;
  isMobile: boolean;
};

function ClientsSection({
  items,
  isAdmin,
  onAdd,
  onRemove,
  onUpdate,
  isMobile
}: ClientsSectionProps) {
  return (
    <section className="mb-5 px-2">
      <h2
        className="text-[#171717] uppercase text-xs mb-3"
        style={{ fontWeight: 500 }}
      >
        CLIENTS
      </h2>
      <div className={`grid grid-cols-2 gap-y-1 text-[#171717] w-full ${isMobile ? "max-w-3/4" : "max-w-1/5"}`}>
        {items.map((value, index) => (
          <div
            key={index}
            className="flex items-start justify-between gap-2 group"
          >
            {isAdmin ? (
              <>
                <AutoResizeTextarea
                  value={value}
                  onChange={(v) => onUpdate(index, v)}
                  placeholder="Client"
                  className="flex-1 min-w-0 bg-transparent border-none outline-none font-inherit text-xs resize-none overflow-hidden"
                  style={{ fontWeight: 500 }}
                />
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="w-6 h-6 flex shrink-0 items-center justify-center text-[#171717] opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove client"
                >
                  ×
                </button>
              </>
            ) : (
              <p
                className="text-xs whitespace-pre-wrap break-words min-w-0"
                style={{ fontWeight: 500 }}
              >
                {value}
              </p>
            )}
          </div>
        ))}
      </div>
      {isAdmin && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-3 text-sm font-normal text-[#171717] border-none bg-transparent cursor-pointer"
        >
          +
        </button>
      )}
    </section>
  );
}

function ServicesSection({
  items,
  isAdmin,
  onAdd,
  onRemove,
  onUpdate,
  isMobile
}: ServicesSectionProps) {
  return (
    <section className="mb-40 px-2">
      <h2
        className="text-[#171717] uppercase text-xs mb-3"
        style={{ fontWeight: 500 }}
      >
        SERVICES
      </h2>
      <div className={`grid grid-cols-2 gap-x-2 text-[#171717] w-full ${isMobile ? "max-w-3/4" : "max-w-1/5"}`}>
        {items.map((value, index) => (
          <div
            key={index}
            className="flex items-start justify-between gap-2 group"
          >
            {isAdmin ? (
              <>
                <AutoResizeTextarea
                  value={value}
                  onChange={(v) => onUpdate(index, v)}
                  placeholder="Service"
                  className="flex-1 min-w-0 bg-transparent border-none outline-none font-inherit text-xs resize-none overflow-hidden"
                  style={{ fontWeight: 500 }}
                />
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="w-6 h-6 flex shrink-0 items-center justify-center text-[#171717] opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove service"
                >
                  ×
                </button>
              </>
            ) : (
              <p
                className="text-xs whitespace-pre-wrap break-words min-w-0"
                style={{ fontWeight: 500 }}
              >
                {value}
              </p>
            )}
          </div>
        ))}
      </div>
      {isAdmin && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-3 text-sm font-normal text-[#171717] border-none bg-transparent cursor-pointer"
        >
          +
        </button>
      )}
    </section>
  );
}

function AboutSection({
  about,
  setAbout,
  isAdmin,
  isMobile
}: {
  about: string;
  setAbout: (v: string) => void;
  isAdmin: boolean;
  isMobile: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [about]);

  return (
    <section className="mb-16 px-2 pb-20">
      <div
        className={`text-[#171717] text-xs whitespace-pre-wrap ${isMobile ? "w-5/6" : "w-1/2"}`}
        style={{ fontWeight: 300 }}
      >
        {isAdmin ? (
          <textarea
            ref={textareaRef}
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            className="w-full min-h-[1.5em] overflow-hidden bg-transparent border-none outline-none font-inherit resize-none"
            placeholder="Studio description"
            rows={1}
          />
        ) : (
          about
        )}
      </div>
    </section>
  );
}

export default function StudioPage() {
  const { isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [about, setAbout] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [clients, setClients] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const isMobile = useIsMobile();

  const fetchStudio = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const snap = await getDoc(doc(db, "studio", "all"));
      if (!snap.exists()) {
        setFetchError("Studio document not found.");
        setAbout("");
        setServices([]);
        setClients([]);
      } else {
        const data = snap.data() as StudioDocument;
        setAbout(data.about ?? "");
        setServices(Array.isArray(data.Services) ? data.Services : []);
        setClients(Array.isArray(data.Clients) ? data.Clients : []);
      }
    } catch (err) {
      console.error(err);
      setFetchError("Failed to load studio information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudio();
  }, [fetchStudio]);

  const handleSave = useCallback(async () => {
    setSaveState("loading");
    try {
      await updateDoc(doc(db, "studio", "all"), {
        about,
        Services: services,
        Clients: clients
      });
      setSaveState("success");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      console.error(err);
      setSaveState("idle");
    }
  }, [about, services, clients]);

  const addService = useCallback(() => {
    setServices((prev) => [...prev, ""]);
  }, []);

  const removeService = useCallback((index: number) => {
    setServices((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateService = useCallback((index: number, value: string) => {
    setServices((prev) => prev.map((item, i) => (i === index ? value : item)));
  }, []);

  const addClient = useCallback(() => {
    setClients((prev) => [...prev, ""]);
  }, []);

  const removeClient = useCallback((index: number) => {
    setClients((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateClient = useCallback((index: number, value: string) => {
    setClients((prev) => prev.map((item, i) => (i === index ? value : item)));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white pt-[var(--header-height)] flex items-center justify-center">
        <p className="text-sm font-normal text-[#171717]">Loading…</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-white pt-[var(--header-height)] flex items-center justify-center px-4 text-center">
        <p className="text-sm font-normal text-[#171717]">{fetchError}</p>
      </div>
    );
  }

  return (
    <PageTransition type="fade" className="min-h-screen bg-white">
      <div className="bg-white pt-[var(--header-height)]">
        <Header
          activeFilters={new Set()}
          onFilterToggle={() => { }}
          backHref="/home"
          onSave={isAdmin ? handleSave : undefined}
          saveState={saveState}
          showCategoryFilters={false}
        />
        <main className="w-full h-full bg-white pt-50 pb-2">
          {/* About section: same layout as project description */}
          <AboutSection
            about={about}
            setAbout={setAbout}
            isAdmin={!!isAdmin}
            isMobile={isMobile}
          />
          <ClientsSection
            items={clients}
            isAdmin={!!isAdmin}
            onAdd={addClient}
            onRemove={removeClient}
            onUpdate={updateClient}
            isMobile={isMobile}
          />
          <ServicesSection
            items={services}
            isAdmin={!!isAdmin}
            onAdd={addService}
            onRemove={removeService}
            onUpdate={updateService}
            isMobile={isMobile}
          />
        </main>
      </div>
    </PageTransition>
  );
}

