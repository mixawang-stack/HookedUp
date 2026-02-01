"use client";

export const dynamic = "force-dynamic";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { getSupabaseClient } from "../lib/supabaseClient";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  dob: z.string().min(1),
  agreeTerms: z.boolean().refine((value) => value, {
    message: "You must accept the rules."
  })
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      agreeTerms: false
    }
  });

  const handleRegister = registerForm.handleSubmit(async (values) => {
    setError(null);
    setStatus(null);
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("SUPABASE_NOT_CONFIGURED");
      }
      const { error: signUpError } = await supabase.auth.signUp({
        email: values.email.trim().toLowerCase(),
        password: values.password,
        options: {
          data: {
            dob: values.dob,
            agreeTerms: values.agreeTerms
          }
        }
      });
      if (signUpError) {
        throw new Error(signUpError.message);
      }

      setPendingEmail(values.email.trim().toLowerCase());
      setStatus(
        "Check your email to confirm your account. You can sign in after verification."
      );
      registerForm.reset({
        email: "",
        password: "",
        dob: "",
        agreeTerms: false
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      const friendly =
        message.toLowerCase().includes("already registered") ||
        message.toLowerCase().includes("user already registered")
          ? "This email is already registered."
          : message === "SUPABASE_NOT_CONFIGURED"
            ? "Auth service is not configured. Please contact support."
          : message;
      setError(friendly);
    } finally {
      setLoading(false);
    }
  });

  const handleResend = async () => {
    if (!pendingEmail) return;
    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus("Auth service is not configured. Please contact support.");
      return;
    }
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingEmail
      });
      if (error) {
        throw new Error(error.message);
      }
      setStatus("Verification email resent.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to resend email.";
      setStatus(message);
    } finally {
      setResendLoading(false);
    }
  };

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

            {pendingEmail && (
              <div className="rounded-2xl border border-border-default bg-surface px-4 py-3 text-sm text-text-secondary">
                <p className="text-xs font-semibold text-text-primary">
                  Verification required
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  We sent a confirmation email to{" "}
                  <span className="font-semibold">{pendingEmail}</span>.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary px-3 py-1 text-xs"
                    onClick={handleResend}
                    disabled={resendLoading}
                  >
                    {resendLoading ? "Sending..." : "Resend email"}
                  </button>
                  <button
                    type="button"
                    className="btn-primary px-3 py-1 text-xs"
                    onClick={() => router.push("/login")}
                  >
                    Go to login
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full py-3 text-sm"
              disabled={loading}
            >
              {loading ? "Sending..." : "Continue"}
            </button>
          </form>

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
            &{" "}
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
                HookedUp
              </p>
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-text-primary">
              The next room feels better.
            </h2>
            <p className="mt-3 text-sm text-text-secondary">
              You will need to confirm your email to complete your registration.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
