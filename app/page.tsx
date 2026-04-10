"use client";

import { useAuth } from "./components/auth/AuthContext";
import { HomeExperience } from "./components/home/HomeExperience";

export default function Home() {
  const { loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return <HomeExperience mode="intro" />;
}
