"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "../lib/supabaseClient";

const ADMIN_EMAIL = "admin@hookedup.me";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (data.user?.email === ADMIN_EMAIL) {
        router.replace("/");
        return;
      }
      if (data.user?.email) {
        await supabase.auth.signOut();
      }
    };
    checkSession().catch(() => undefined);
  }, [router]);

  const handleLogin = async () => {
    setStatus(null);
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setStatus("Supabase is not configured.");
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) {
        throw new Error(error.message);
      }
      if (data.user?.email !== ADMIN_EMAIL) {
        await supabase.auth.signOut();
        throw new Error("Admin access only.");
      }
      if (data.session?.access_token) {
        document.cookie = `admin_token=${encodeURIComponent(
          data.session.access_token
        )}; path=/; secure; samesite=lax`;
      }
      router.replace("/novels");
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
          Sign in to manage novels.
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
