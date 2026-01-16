"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  dob: z.string().min(1),
  agreeTerms: z.boolean().refine((value) => value, {
    message: "You must accept the terms."
  })
});

type RegisterForm = z.infer<typeof registerSchema>;

type VerifyForm = {
  code: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      agreeTerms: false
    }
  });

  const verifyForm = useForm<VerifyForm>({
    defaultValues: {
      code: ""
    }
  });

  const handleRegister = registerForm.handleSubmit(async (values) => {
    setError(null);
    setStatus(null);
    setPendingEmail(null);
    setVerifyStatus(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(values)
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const rawMessage = Array.isArray(body?.message)
          ? body.message.join("; ")
          : body?.message;
        throw new Error(rawMessage ?? `HTTP ${res.status}`);
      }

      const payload = (await res.json().catch(() => ({}))) as {
        verificationToken?: string;
      };
      setPendingEmail(values.email.trim().toLowerCase());
      setStatus("A verification code has been sent. Enter it to finish.");
      if (payload?.verificationToken) {
        setVerifyStatus(`Verification code: ${payload.verificationToken}`);
      }
      registerForm.reset({
        email: "",
        password: "",
        dob: "",
        agreeTerms: false
      });
      verifyForm.reset({ code: "" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Registration failed";
      const friendly =
        message === "REGION_NOT_SUPPORTED"
          ? "This region is not supported."
          : message === "TERMS_NOT_ACCEPTED"
          ? "Please accept the terms first."
          : message === "INVALID_DOB"
          ? "Date of birth format is invalid."
          : message === "EMAIL_ALREADY_REGISTERED"
          ? "This email is already registered."
          : message === "EMAIL_SEND_FAILED"
          ? "Failed to send verification email. Please try again."
          : message === "SMTP_NOT_CONFIGURED"
          ? "Email service is not configured."
          : message;
      setError(friendly);
    } finally {
      setLoading(false);
    }
  });

  const handleVerify = verifyForm.handleSubmit(async (values) => {
    if (!pendingEmail) {
      return;
    }
    setVerifyStatus(null);
    setVerifyLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: pendingEmail,
          code: values.code.trim()
        })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const rawMessage = Array.isArray(body?.message)
          ? body.message.join("; ")
          : body?.message;
        throw new Error(rawMessage ?? `HTTP ${res.status}`);
      }

      setVerifyStatus("Email verified. Redirecting to login.");
      router.push("/login");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Verification failed";
      const friendly =
        message === "INVALID_VERIFY_TOKEN"
          ? "Invalid or expired verification code."
          : message === "EMAIL_ALREADY_REGISTERED"
          ? "This email is already registered."
          : message;
      setVerifyStatus(friendly);
    } finally {
      setVerifyLoading(false);
    }
  });

  return (
    <main className="flex min-h-[100svh] w-full items-center justify-center px-4 py-12">
      <div className="grid w-full max-w-[min(1100px,92vw)] gap-10 md:grid-cols-[minmax(0,420px)_minmax(0,500px)]">
        <section className="flex flex-col gap-6 rounded-3xl border border-white/15 bg-black/40 p-8 shadow-[0_25px_60px_rgba(2,6,23,0.65)] backdrop-blur-sm">
          <header>
            <h1 className="text-2xl font-semibold text-white">Register</h1>
            <p className="mt-2 text-sm text-slate-300">
              Email verification is required to finish registration.
            </p>
          </header>

          <form className="space-y-4" onSubmit={handleRegister}>
            <div>
              <label className="text-xs font-semibold text-slate-400">Email</label>
              <input
                type="email"
                className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50"
                {...registerForm.register("email")}
              />
              {registerForm.formState.errors.email && (
                <p className="mt-1 text-xs text-rose-400">
                  {registerForm.formState.errors.email.message}
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
                {...registerForm.register("password")}
              />
              {registerForm.formState.errors.password && (
                <p className="mt-1 text-xs text-rose-400">
                  {registerForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400">
                Date of birth
              </label>
              <input
                type="date"
                className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50"
                {...registerForm.register("dob")}
              />
              {registerForm.formState.errors.dob && (
                <p className="mt-1 text-xs text-rose-400">
                  {registerForm.formState.errors.dob.message}
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-slate-600 bg-slate-900 focus-visible:ring-2 focus-visible:ring-amber-300"
                {...registerForm.register("agreeTerms")}
              />
              I agree to the terms
            </label>
            {registerForm.formState.errors.agreeTerms && (
              <p className="text-xs text-rose-400">
                {registerForm.formState.errors.agreeTerms.message}
              </p>
            )}

            {error && <p className="text-sm text-rose-400">{error}</p>}
            {status && <p className="text-sm text-slate-300">{status}</p>}

            <button
              type="submit"
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_20px_40px_rgba(0,0,0,0.35)] ring-1 ring-amber-200/40 transition hover:-translate-y-0.5 hover:ring-amber-200/80"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send verification code"}
            </button>
          </form>

          {pendingEmail && (
            <form className="space-y-3" onSubmit={handleVerify}>
              <label className="text-xs font-semibold text-slate-400">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                className="w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50"
                {...verifyForm.register("code")}
              />
              <button
                type="submit"
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5"
                disabled={verifyLoading}
              >
                {verifyLoading ? "Verifying..." : "Complete registration"}
              </button>
              {verifyStatus && (
                <p className="text-sm text-slate-300">{verifyStatus}</p>
              )}
            </form>
          )}

          <p className="text-sm text-slate-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-white hover:text-amber-200"
            >
              Sign in →
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
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">
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
            className="mt-auto inline-flex items-center justify-center rounded-2xl bg-amber-500/80 px-4 py-3 text-sm font-semibold text-white shadow-[0_20px_40px_rgba(16,8,0,0.45)] transition hover:brightness-110"
          >
            Create an account
          </Link>
        </section>
      </div>
    </main>
  );
}
