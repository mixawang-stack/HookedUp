"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "../lib/supabaseClient";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus("Auth service is not configured. Please contact support.");
      setReady(true);
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!data.session) {
          setStatus("Reset link is invalid or expired.");
        }
        setReady(true);
      })
      .catch(() => {
        setStatus("Reset link is invalid or expired.");
        setReady(true);
      });
  }, []);

  const handleUpdate = async () => {
    if (password.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setStatus("Passwords do not match.");
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("SUPABASE_NOT_CONFIGURED");
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        throw new Error(error.message);
      }
      await supabase.auth.signOut();
      setStatus("Password updated. Redirecting to login.");
      setTimeout(() => router.push("/login"), 1200);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update password.";
      if (message === "SUPABASE_NOT_CONFIGURED") {
        setStatus("Auth service is not configured. Please contact support.");
        return;
      }
      setStatus(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="ui-page flex w-full items-center justify-center px-4 py-12">
      <div className="ui-card w-full max-w-lg p-8">
        <h1 className="text-2xl font-semibold text-text-primary">
          Set a new password
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Choose a new password to finish the reset.
        </p>

        {!ready ? (
          <p className="mt-6 text-sm text-text-secondary">Checking link...</p>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-text-secondary">
                New password
              </label>
              <input
                type="password"
                className="mt-1 w-full rounded-2xl border border-border-default bg-card px-3 py-3 text-sm text-text-primary placeholder:text-text-muted"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-secondary">
                Confirm password
              </label>
              <input
                type="password"
                className="mt-1 w-full rounded-2xl border border-border-default bg-card px-3 py-3 text-sm text-text-primary placeholder:text-text-muted"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="Repeat password"
              />
            </div>

            {status && <p className="text-xs text-brand-secondary">{status}</p>}

            <button
              type="button"
              className="btn-primary w-full py-3 text-sm disabled:opacity-60"
              onClick={handleUpdate}
              disabled={saving || !ready}
            >
              {saving ? "Saving..." : "Update password"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
