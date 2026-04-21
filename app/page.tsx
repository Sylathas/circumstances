"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./components/auth/AuthContext";
import { HomeExperience } from "./components/home/HomeExperience";

const HOME_MENU_ONCE_KEY = "circumstances-home-menu-once";

export default function Home() {
  const { loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"intro" | "menu-only" | null>(null);

  useEffect(() => {
    const shouldSkipIntroOnce = sessionStorage.getItem(HOME_MENU_ONCE_KEY) === "1";
    if (shouldSkipIntroOnce) {
      sessionStorage.removeItem(HOME_MENU_ONCE_KEY);
      setMode("menu-only");
      return;
    }
    setMode("intro");
  }, []);

  if (authLoading || mode === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return <HomeExperience mode={mode} />;
}
