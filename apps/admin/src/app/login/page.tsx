"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      router.replace("/");
    }
  }, [router]);

  const handleLogin = async () => {
    setStatus(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      if (!body?.accessToken) {
        throw new Error("Login failed.");
      }
      localStorage.setItem("accessToken", body.accessToken);
      router.replace("/");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Login failed.";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-[100svh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-[0_25px_60px_rgba(2,6,23,0.65)]">
        <h1 className="text-2xl font-semibold text-white">Admin login</h1>
        <p className="mt-2 text-sm text-slate-400">
          Sign in to manage novels and moderation queues.
        </p>
        <div className="mt-6 space-y-4">
          <label className="text-xs text-slate-300">
            Email
            <input
              type="email"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="text-xs text-slate-300">
            Password
            <input
              type="password"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {status && <p className="text-xs text-rose-300">{status}</p>}
          <button
            type="button"
            className="w-full rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>
      </div>
    </main>
  );
}
