"use client";

/**
 * ProjectInfoSection renders the client, title, and description fields for a project.
 * It supports read-only display and admin editing via controlled callbacks.
 * Used within ProjectPageClient near the top of the project detail page.
 */

import { useEffect, useRef } from "react";

type ProjectInfoSectionProps = {
  client: string;
  projectTitle: string;
  projectDescription: string;
  isAdmin: boolean;
  onClientChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  isMobile: boolean;
};

export default function ProjectInfoSection({
  client,
  projectTitle,
  projectDescription,
  isAdmin,
  onClientChange,
  onTitleChange,
  onDescriptionChange,
  isMobile,
}: ProjectInfoSectionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [projectDescription]);

  return (
    <section className="mb-16 px-2 pb-20">
      <div
        className="text-[#171717] uppercase text-xs font-normal"
        style={{ fontWeight: 400 }}
      >
        {isAdmin ? (
          <input
            value={client}
            onChange={(e) => onClientChange(e.target.value)}
            className="w-full bg-transparent border-none outline-none font-inherit"
            placeholder="Client"
          />
        ) : (
          client
        )}
      </div>
      <div
        className="text-[#171717] uppercase text-xs mb-2"
        style={{ fontWeight: 400 }}
      >
        {isAdmin ? (
          <input
            value={projectTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            className="w-full bg-transparent border-none outline-none font-inherit"
            placeholder="Project Title"
          />
        ) : (
          projectTitle
        )}
      </div>
      <div
        className={`text-[#171717] text-xs whitespace-pre-wrap ${isMobile ? "w-5/6" : "w-1/2"}`}
        style={{ fontWeight: 300 }}
      >
        {isAdmin ? (
          <textarea
            ref={textareaRef}
            value={projectDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="w-full min-h-[1.5em] overflow-hidden bg-transparent border-none outline-none font-inherit resize-none"
            placeholder="Project Description"
            rows={1}
          />
        ) : (
          projectDescription
        )}
      </div>
    </section>
  );
}
