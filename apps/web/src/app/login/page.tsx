"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginFormContent() {
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
      const message = err instanceof Error ? err.message : "Could not get you in.";
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
          ? "Could not get you in. Try again."
          : message;
      setError(friendly);
    } finally {
      setLoading(false);
    }
  });

  return (
    <main className="ui-page flex w-full items-center justify-center px-4 py-12">
      <div className="mx-auto grid w-full max-w-5xl gap-8 md:grid-cols-2">
        <section className="ui-card flex flex-col gap-6 p-8">
          <h1 className="text-2xl font-semibold text-text-primary">
            Come in. Stay if you like.
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            No pressure.
            <br />
            Just do not pretend you are not curious.
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="text-xs font-semibold text-text-secondary">
                Email
              </label>
              <input
                type="email"
                className="mt-1 w-full rounded-2xl border border-border-default bg-card px-3 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                {...register("email")}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-brand-secondary">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-text-secondary">
                Password
              </label>
              <input
                type="password"
                className="mt-1 w-full rounded-2xl border border-border-default bg-card px-3 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                {...register("password")}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-brand-secondary">
                  {errors.password.message}
                </p>
              )}
            </div>

            {error && <p className="text-sm text-brand-secondary">{error}</p>}

            <button
              type="submit"
              className="btn-primary w-full py-3 text-sm disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Entering..." : "Enter"}
            </button>
          </form>
          <p className="text-sm text-text-secondary">
            First time here? It only takes a moment.{" "}
            <Link
              href="/register"
              className="font-semibold text-text-primary hover:text-brand-primary"
            >
              Create an account
            </Link>
          </p>
        </section>

        <section className="ui-surface flex flex-col gap-6 p-8">
          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-default bg-card text-brand-primary">
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
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-text-muted">
                WELCOME TO
              </p>
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-text-primary">
              Some stories don't ask permission.
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-text-secondary">
            Neither do conversations.
          </p>
          <ul className="space-y-3 text-sm leading-relaxed text-text-secondary">
            <li>Read a little.</li>
            <li>Say a little.</li>
            <li>Let it go further -- or don't.</li>
          </ul>
          <p className="text-xs leading-relaxed text-text-muted">
            Nothing is required. Curiosity is enough.
          </p>
          <div className="ui-card p-4 text-sm text-text-secondary">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
              TONIGHT, YOU MAY RUN INTO:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-text-secondary">
              <li>Tempting stories</li>
              <li>Unfinished thoughts</li>
              <li>People testing the edge</li>
              <li>Rooms that feel a bit too honest</li>
            </ul>
          </div>
          <Link
            href="/register"
            className="btn-primary mt-auto py-3 text-sm"
          >
            Create an account
          </Link>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginFormContent />
    </Suspense>
  );
}
