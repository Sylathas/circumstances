"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/auth/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { signIn, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  if (loading) {
    return (
      <main style={{ padding: 40, fontFamily: "var(--font-feature-mono)" }}>
        Loading...
      </main>
    );
  }

  if (user) {
    return (
      <main style={{ padding: 40 }}>Redirecting...</main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.replace("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: "black",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: "100%",
          maxWidth: 320,
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          Admin login
        </h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            padding: 12,
            border: "1px solid #171717",
            fontFamily: "inherit",
            fontSize: 14,
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            padding: 12,
            border: "1px solid #171717",
            fontFamily: "inherit",
            fontSize: 14,
          }}
        />
        {error && (
          <p style={{ color: "#FF0000", fontSize: 14 }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: 12,
            border: "1px solid #171717",
            background: "#171717",
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 600,
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
