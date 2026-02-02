"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

import { getSupabaseClient } from "../../lib/supabaseClient";
import { useSupabaseSession } from "../../lib/useSupabaseSession";

export default function AccountSettingsPage() {
  const router = useRouter();
  const { user, ready } = useSupabaseSession();
  const [email, setEmail] = useState<string | null>(null);
  const [dob, setDob] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (!user) {
      router.push("/login?redirect=/me/account");
    }
  }, [ready, router, user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const loadMe = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return;
      }
      setEmail(user.email ?? null);
      const { data } = await supabase
        .from("User")
        .select("dob")
        .eq("id", user.id)
        .maybeSingle();
      setDob(data?.dob ?? null);
    };
    loadMe().catch(() => undefined);
  }, [user]);

  const handleChangePassword = async () => {
    if (!user) {
      setStatus("Please sign in again.");
      return;
    }
    if (newPassword.trim().length < 8) {
      setStatus("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus("Passwords do not match.");
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }
      if (!currentPassword.trim()) {
        throw new Error("Please enter your current password.");
      }
      if (!user.email) {
        throw new Error("Email is missing.");
      }
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });
      if (verifyError) {
        throw new Error("Current password is incorrect.");
      }
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) {
        throw new Error(error.message);
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setStatus("Password updated.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update password.";
      setStatus(message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    const supabase = getSupabaseClient();
    supabase?.auth.signOut().catch(() => undefined);
    router.push("/login");
  };

  return (
    <div className="ui-page mx-auto w-full max-w-3xl px-4 py-10 text-text-primary">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-secondary px-3 py-1 text-xs"
          onClick={() => router.back()}
        >
          Back
        </button>
        <div>
          <h1 className="text-2xl font-semibold">Account settings</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Update your password or sign out of your account.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4 ui-card p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
            Account overview
          </p>
          <div className="mt-3 space-y-2 text-sm text-text-secondary">
            <p>
              <span className="text-text-muted">Email:</span> {email ?? "-"}
            </p>
            <p>
              <span className="text-text-muted">Birthday:</span>{" "}
              {dob ? new Date(dob).toLocaleDateString() : "-"}
            </p>
            <p>
              <span className="text-text-muted">Password:</span> ********
            </p>
          </div>
          <button
            type="button"
            className="mt-4 btn-secondary px-3 py-1 text-xs"
            onClick={() => setShowEdit((prev) => !prev)}
          >
            {showEdit ? "Hide edit" : "Edit"}
          </button>
        </div>

        {showEdit && (
          <>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
            Change password
          </p>
        </div>

        <label className="text-xs text-text-secondary">
          Current password
          <input
            type="password"
            className="mt-2 w-full rounded-xl border border-border-default bg-card px-3 py-2 text-sm text-text-primary"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </label>

        <label className="text-xs text-text-secondary">
          New password
          <input
            type="password"
            className="mt-2 w-full rounded-xl border border-border-default bg-card px-3 py-2 text-sm text-text-primary"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>

        <label className="text-xs text-text-secondary">
          Confirm new password
          <input
            type="password"
            className="mt-2 w-full rounded-xl border border-border-default bg-card px-3 py-2 text-sm text-text-primary"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>

        {status && <p className="text-xs text-brand-secondary">{status}</p>}

        <div className="flex items-center justify-between">
          <button
            type="button"
            className="btn-secondary px-4 py-2 text-xs text-brand-secondary"
            onClick={handleLogout}
          >
            Sign out
          </button>
          <button
            type="button"
            className="btn-primary px-4 py-2 text-xs"
            onClick={handleChangePassword}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  );
}


