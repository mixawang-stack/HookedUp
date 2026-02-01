"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

export const dynamic = "force-dynamic";

import { getSupabaseClient } from "../lib/supabaseClient";

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
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [resetSending, setResetSending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("SUPABASE_NOT_CONFIGURED");
      }
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: values.email.trim().toLowerCase(),
        password: values.password
      });
      if (authError) {
        throw new Error(authError.message);
      }

      const redirect = searchParams?.get("redirect");
      const nextPath = redirect && redirect.startsWith("/") ? redirect : "/hall";
      router.push(nextPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not get you in.";
      const friendly =
        message.toLowerCase().includes("invalid login")
          ? "Email or password is incorrect."
        : message.toLowerCase().includes("email not confirmed")
          ? "Email is not verified yet. Please verify first."
        : message === "SUPABASE_NOT_CONFIGURED"
          ? "Auth service is not configured. Please contact support."
        : message;
      setError(friendly);
    } finally {
      setLoading(false);
    }
  });

  const handleOpenReset = () => {
    setResetOpen((prev) => !prev);
    setResetStatus(null);
    const emailValue = getValues("email");
    if (emailValue) {
      setResetEmail(emailValue);
    }
  };

  const handleRequestReset = async () => {
    if (!resetEmail.trim()) {
      setResetStatus("Please enter your email.");
      return;
    }
    setResetStatus(null);
    setResetSending(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("SUPABASE_NOT_CONFIGURED");
      }
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        resetEmail.trim().toLowerCase(),
        {
          redirectTo: origin ? `${origin}/reset-password` : undefined
        }
      );
      if (resetError) {
        throw new Error(resetError.message);
      }
      setResetStatus("Reset email sent. Check your inbox.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to send reset email.";
      if (message === "SUPABASE_NOT_CONFIGURED") {
        setResetStatus("Auth service is not configured. Please contact support.");
        return;
      }
      setResetStatus(message);
    } finally {
      setResetSending(false);
    }
  };

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

          <button
            type="button"
            className="text-left text-xs font-semibold text-text-secondary hover:text-text-primary"
            onClick={handleOpenReset}
          >
            {resetOpen ? "Hide password reset" : "Forgot password?"}
          </button>

          {resetOpen && (
            <div className="rounded-2xl border border-border-default bg-surface px-4 py-4 text-sm text-text-secondary">
              <p className="text-xs font-semibold text-text-primary">
                Reset your password
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                We will email you a reset link.
              </p>

              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-text-secondary">
                    Email
                  </label>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-2xl border border-border-default bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
                    value={resetEmail}
                    onChange={(event) => setResetEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="button"
                  className="btn-primary w-full py-2 text-xs disabled:opacity-60"
                  onClick={handleRequestReset}
                  disabled={resetSending}
                >
                  {resetSending ? "Sending..." : "Send reset email"}
                </button>

                {resetStatus && (
                  <p className="text-xs text-brand-secondary">{resetStatus}</p>
                )}
              </div>
            </div>
          )}
          <p className="text-sm text-text-secondary">
            First time here? It only takes a moment.{" "}
            <Link
              href="/register"
              className="font-semibold text-text-primary hover:text-brand-primary"
            >
              Create an account
            </Link>
          </p>
          <p className="text-[11px] text-text-muted">
            By continuing, you agree to our{" "}
            <Link
              href="/terms"
              className="font-semibold text-text-secondary hover:text-text-primary"
            >
              Terms
            </Link>{" "}
            and acknowledge our{" "}
            <Link
              href="/privacy"
              className="font-semibold text-text-secondary hover:text-text-primary"
            >
              Privacy Policy
            </Link>
            .{" "}
            <Link
              href="/refunds"
              className="font-semibold text-text-secondary hover:text-text-primary"
            >
              Refunds
            </Link>{" "}
            ·{" "}
            <Link
              href="/support"
              className="font-semibold text-text-secondary hover:text-text-primary"
            >
              Support
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
