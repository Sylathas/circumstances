"use client";

import { HomeExperience } from "../components/home/HomeExperience";
import { PageTransition } from "../components/PageTransition";

export default function HomeMenuPage() {
  return (
    <PageTransition type="fade" className="min-h-screen bg-white">
      <HomeExperience mode="menu-only" />
    </PageTransition>
  );
}
