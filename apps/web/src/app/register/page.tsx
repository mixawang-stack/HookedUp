"use client";

export const dynamic = "force-dynamic";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  dob: z.string().min(1),
  agreeTerms: z.boolean().refine((value) => value, {
    message: "You must accept the rules."
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
      const message = err instanceof Error ? err.message : "Registration failed";
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
    <main className="ui-page flex w-full items-center justify-center px-4 py-12">
      <div className="grid w-full max-w-5xl gap-8 md:grid-cols-2">
        <section className="ui-card flex flex-col gap-6 p-8">
          <header>
            <h1 className="text-2xl font-semibold text-text-primary">
              Before we start --
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Pick a name.
              <br />
              Say a little about yourself.
              <br />
              You can always change it later.
            </p>
          </header>

          <form className="space-y-4" onSubmit={handleRegister}>
            <div>
              <label className="text-xs font-semibold text-text-secondary">
                Email
              </label>
              <input
                type="email"
                className="mt-1 w-full rounded-2xl border border-border-default bg-card px-3 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                {...registerForm.register("email")}
              />
              {registerForm.formState.errors.email && (
                <p className="mt-1 text-xs text-brand-secondary">
                  {registerForm.formState.errors.email.message}
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
                {...registerForm.register("password")}
              />
              {registerForm.formState.errors.password && (
                <p className="mt-1 text-xs text-brand-secondary">
                  {registerForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-text-secondary">
                Date of birth
              </label>
              <input
                type="date"
                className="mt-1 w-full rounded-2xl border border-border-default bg-card px-3 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                {...registerForm.register("dob")}
              />
              {registerForm.formState.errors.dob && (
                <p className="mt-1 text-xs text-brand-secondary">
                  {registerForm.formState.errors.dob.message}
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-border-default bg-card focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                {...registerForm.register("agreeTerms")}
              />
              I agree to the rules
            </label>
            {registerForm.formState.errors.agreeTerms && (
              <p className="text-xs text-brand-secondary">
                {registerForm.formState.errors.agreeTerms.message}
              </p>
            )}

            {error && <p className="text-sm text-brand-secondary">{error}</p>}
            {status && <p className="text-sm text-text-secondary">{status}</p>}

            <button
              type="submit"
              className="btn-primary w-full py-3 text-sm"
              disabled={loading}
            >
              {loading ? "Sending..." : "Continue"}
            </button>
          </form>

          {pendingEmail && (
            <form className="space-y-3" onSubmit={handleVerify}>
              <label className="text-xs font-semibold text-text-secondary">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                className="w-full rounded-2xl border border-border-default bg-card px-3 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                {...verifyForm.register("code")}
              />
              <button
                type="submit"
                className="btn-primary w-full py-3 text-sm"
                disabled={verifyLoading}
              >
                {verifyLoading ? "Verifying..." : "Finish"}
              </button>
              {verifyStatus && (
                <p className="text-sm text-text-secondary">{verifyStatus}</p>
              )}
            </form>
          )}

          <p className="text-sm text-text-secondary">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-text-primary hover:text-brand-primary"
            >
              Come back in.
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
              HookedUp?
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-text-secondary">
            A late room where people stay a while.
          </p>
          <ul className="space-y-3 text-sm leading-relaxed text-text-secondary">
            <li>Leave a trace. See who answers.</li>
            <li>Drift into rooms. Linger if it feels right.</li>
            <li>Keep it light. Keep it human.</li>
          </ul>
          <p className="text-xs leading-relaxed text-text-muted">
            Do what feels right. Stop when it does not.
          </p>
          <div className="ui-card p-4 text-sm text-text-secondary">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
              TONIGHT, YOU MIGHT RUN INTO:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-text-secondary">
              <li>Whispered confessions</li>
              <li>Truths and dares</li>
              <li>Soft talk, sharp edges</li>
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
