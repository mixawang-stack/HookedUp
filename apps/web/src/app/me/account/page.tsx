"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export default function AccountSettingsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [dob, setDob] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const authHeader = useMemo(() => {
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  useEffect(() => {
    const stored = localStorage.getItem("accessToken");
    if (!stored) {
      router.push("/login?redirect=/me/account");
      return;
    }
    setToken(stored);
  }, [router]);

  useEffect(() => {
    if (!authHeader) {
      return;
    }
    const loadMe = async () => {
      const res = await fetch(`${API_BASE}/me`, { headers: { ...authHeader } });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { email?: string; dob?: string | null };
      setEmail(data.email ?? null);
      setDob(data.dob ?? null);
    };
    loadMe().catch(() => undefined);
  }, [authHeader]);

  const handleChangePassword = async () => {
    if (!authHeader) {
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
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
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
    localStorage.removeItem("accessToken");
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
              <span className="text-text-muted">Email:</span> {email ?? "鈥?}
            </p>
            <p>
              <span className="text-text-muted">Birthday:</span>{" "}
              {dob ? new Date(dob).toLocaleDateString() : "鈥?}
            </p>
            <p>
              <span className="text-text-muted">Password:</span> 鈥⑩€⑩€⑩€⑩€⑩€⑩€⑩€?            </p>
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


