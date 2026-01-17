"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export default function AccountSettingsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
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
    <div className="mx-auto w-full max-w-3xl px-4 py-10 text-slate-100">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200"
          onClick={() => router.back()}
        >
          Back
        </button>
        <div>
          <h1 className="text-2xl font-semibold">Account settings</h1>
          <p className="mt-1 text-sm text-slate-400">
            Update your password or sign out of your account.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-slate-950/80 p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Change password
          </p>
        </div>

        <label className="text-xs text-slate-300">
          Current password
          <input
            type="password"
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </label>

        <label className="text-xs text-slate-300">
          New password
          <input
            type="password"
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>

        <label className="text-xs text-slate-300">
          Confirm new password
          <input
            type="password"
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>

        {status && <p className="text-xs text-rose-300">{status}</p>}

        <div className="flex items-center justify-between">
          <button
            type="button"
            className="rounded-full border border-rose-400 px-4 py-2 text-xs text-rose-200"
            onClick={handleLogout}
          >
            Sign out
          </button>
          <button
            type="button"
            className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900"
            onClick={handleChangePassword}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
