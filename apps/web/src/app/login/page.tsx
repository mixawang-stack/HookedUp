"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(values)
      });

      const raw = await res.text();
      const body = raw ? JSON.parse(raw) : null;

      if (!res.ok) {
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }

      if (!body?.accessToken) {
        throw new Error("EMPTY_LOGIN_RESPONSE");
      }

      const data = body as { accessToken: string };
      localStorage.setItem("accessToken", data.accessToken);

      const redirect = searchParams?.get("redirect");
      const nextPath = redirect && redirect.startsWith("/") ? redirect : "/hall";
      router.push(nextPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      const friendly =
        message === "INVALID_CREDENTIALS"
          ? "Email or password is incorrect."
          : message === "EMAIL_NOT_VERIFIED"
          ? "Email is not verified yet. Please verify first."
          : message === "USER_BANNED"
          ? "This account is disabled."
          : message === "USER_DELETED"
          ? "This account has been deleted."
          : message === "USER_NOT_ACTIVE"
          ? "Account status is inactive. Please contact support."
          : message === "EMPTY_LOGIN_RESPONSE"
          ? "Login failed. Please try again."
          : message;
      setError(friendly);
    } finally {
      setLoading(false);
    }
  });

  return (
    <main className="flex min-h-[100svh] w-full items-center justify-center px-4 py-12">
      <div className="grid w-full max-w-[min(1100px,92vw)] gap-10 md:grid-cols-[minmax(0,420px)_minmax(0,480px)]">
        <section className="flex flex-col gap-6 rounded-3xl border border-white/15 bg-black/40 p-8 shadow-[0_25px_60px_rgba(2,6,23,0.65)] backdrop-blur-sm">
          <h1 className="text-2xl font-semibold text-white">Login</h1>
          <p className="mt-2 text-sm text-slate-300">
            Use your verified email to continue.
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="text-xs font-semibold text-slate-400">Email</label>
            <input
              type="email"
              className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50"
              {...register("email")}
            />
              {errors.email && (
                <p className="mt-1 text-xs text-rose-400">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400">
                Password
              </label>
              <input
                type="password"
                className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50"
                {...register("password")}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-rose-400">
                  {errors.password.message}
                </p>
              )}
            </div>

            {error && <p className="text-sm text-rose-400">{error}</p>}

            <button
              type="submit"
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_20px_40px_rgba(0,0,0,0.4)] ring-1 ring-amber-200/40 transition hover:-translate-y-0.5 hover:ring-amber-200/70"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <p className="text-sm text-slate-400">
            New here?{" "}
            <Link
              href="/register"
              className="font-semibold text-white hover:text-sky-200"
            >
              Create an account →
            </Link>
          </p>
        </section>

        <section className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/70 to-slate-950/95 p-8 text-slate-100 shadow-[0_25px_60px_rgba(2,6,23,0.65)] backdrop-blur-lg">
          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/50 bg-amber-100/10 text-amber-200">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-5 w-5"
                >
                  <path d="M5 11c.5-2 2-3 2-3s1 1 2 1c1.25 0 1.5-1 2-2 .5 1 1 2 2 2s1-.5 2-1c1 0 2 1 2 3s-1 6-6 6-6-4-6-6z" />
                  <path d="M7 12c1 1 4 1 6 0" />
                </svg>
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-200">
                WELCOME TO
              </p>
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-white">HookedUp?</h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-200">
            A party you can actually talk in.
          </p>
          <ul className="space-y-3 text-sm leading-relaxed text-slate-200">
            <li>Leave a trace. Start the vibe.</li>
            <li>Join a room. Talk taboo. Play nice.</li>
            <li>Go private (optional). If it clicks, continue.</li>
          </ul>
            <p className="text-xs leading-relaxed text-slate-300">
              Bold is welcome. Coercion isn’t.
            </p>
            <div className="rounded-2xl border border-white/20 bg-black/30 p-4 text-sm text-slate-200">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              TONIGHT’S ROOMS MIGHT INCLUDE:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-200">
              <li>Masked confessions</li>
              <li>Truth & dare (grown-up)</li>
              <li>Power & boundaries talk</li>
            </ul>
          </div>
          <Link
            href="/register"
            className="mt-auto inline-flex items-center justify-center rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_20px_40px_rgba(14,165,233,0.45)] transition hover:brightness-110"
          >
            Create an account
          </Link>
        </section>
      </div>
    </main>
  );
}
