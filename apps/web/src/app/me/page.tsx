"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type MeResponse = {
  id: string;
  email: string;
  maskName: string | null;
  maskAvatarUrl: string | null;
  bio: string | null;
  language: string | null;
  city: string | null;
  gender: string | null;
  profileCompleted?: boolean;
  preference?: {
    vibeTags?: string[] | null;
    interests?: string[] | null;
  } | null;
};

const parseTags = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

export default function MePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [maskName, setMaskName] = useState("");
  const [bio, setBio] = useState("");
  const [language, setLanguage] = useState("");
  const [city, setCity] = useState("");
  const [vibeTags, setVibeTags] = useState("");
  const [interests, setInterests] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const authHeader = useMemo(() => {
    if (!token) {
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  useEffect(() => {
    const stored = localStorage.getItem("accessToken");
    if (!stored) {
      router.push("/login?redirect=/me");
      return;
    }
    setToken(stored);
  }, [router]);

  useEffect(() => {
    if (!authHeader) {
      return;
    }
    const fetchMe = async () => {
      const res = await fetch(`${API_BASE}/me`, { headers: { ...authHeader } });
      if (!res.ok) {
        setStatus("Failed to load profile.");
        return;
      }
      const data = (await res.json()) as MeResponse;
      setMe(data);
      setMaskName(data.maskName ?? "");
      setBio(data.bio ?? "");
      setLanguage(data.language ?? "");
      setCity(data.city ?? "");
      setVibeTags((data.preference?.vibeTags ?? []).join(", "));
      setInterests((data.preference?.interests ?? []).join(", "));
      setAvatarPreview(data.maskAvatarUrl ?? null);
    };
    fetchMe().catch(() => setStatus("Failed to load profile."));
  }, [authHeader]);

  useEffect(() => {
    if (!avatarFile) {
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const handleSave = async () => {
    if (!authHeader) {
      setStatus("Please sign in again.");
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      let avatarUrl = me?.maskAvatarUrl ?? null;
      if (avatarFile) {
        const formData = new FormData();
        formData.append("file", avatarFile);
        const uploadRes = await fetch(`${API_BASE}/uploads/avatar`, {
          method: "POST",
          headers: { ...authHeader },
          body: formData
        });
        if (!uploadRes.ok) {
          const body = await uploadRes.json().catch(() => ({}));
          throw new Error(body?.message ?? "Avatar upload failed.");
        }
        const data = (await uploadRes.json()) as { avatarUrl?: string };
        avatarUrl = data.avatarUrl ?? null;
      }

      const profileRes = await fetch(`${API_BASE}/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({
          maskName: maskName.trim(),
          bio: bio.trim(),
          language: language.trim(),
          city: city.trim(),
          ...(avatarUrl ? { maskAvatarUrl: avatarUrl } : {})
        })
      });
      if (!profileRes.ok) {
        const body = await profileRes.json().catch(() => ({}));
        throw new Error(body?.message ?? "Profile update failed.");
      }

      const prefRes = await fetch(`${API_BASE}/me/preferences`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({
          vibeTagsJson: parseTags(vibeTags),
          interestsJson: parseTags(interests)
        })
      });
      if (!prefRes.ok) {
        const body = await prefRes.json().catch(() => ({}));
        throw new Error(body?.message ?? "Preference update failed.");
      }

      const refreshRes = await fetch(`${API_BASE}/me`, {
        headers: { ...authHeader }
      });
      if (refreshRes.ok) {
        const updated = (await refreshRes.json()) as MeResponse;
        setMe(updated);
      }
      setStatus("Profile saved.");
      setAvatarFile(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed.";
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
      <h1 className="text-2xl font-semibold">My profile</h1>
      <p className="mt-2 text-sm text-slate-400">
        Update your profile card and preferences.
      </p>

      <div className="mt-6 space-y-6 rounded-2xl border border-white/10 bg-slate-950/80 p-6">
        <div className="flex items-center gap-4">
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt="Avatar preview"
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg">
              {(maskName || "U").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="space-x-3">
            <button
              type="button"
              className="rounded-full border border-white/20 px-4 py-2 text-xs"
              onClick={() => avatarInputRef.current?.click()}
            >
              Upload avatar
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <label className="text-xs text-slate-300">
          Display name
          <input
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
            value={maskName}
            onChange={(event) => setMaskName(event.target.value)}
            maxLength={64}
          />
        </label>

        <label className="text-xs text-slate-300">
          Bio
          <textarea
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
            rows={3}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            maxLength={280}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs text-slate-300">
            Language
            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              maxLength={32}
            />
          </label>
          <label className="text-xs text-slate-300">
            City
            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              maxLength={64}
            />
          </label>
        </div>

        <label className="text-xs text-slate-300">
          Vibe tags (comma separated)
          <input
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
            value={vibeTags}
            onChange={(event) => setVibeTags(event.target.value)}
          />
        </label>

        <label className="text-xs text-slate-300">
          Interests (comma separated)
          <input
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
            value={interests}
            onChange={(event) => setInterests(event.target.value)}
          />
        </label>

        {status && <p className="text-xs text-slate-300">{status}</p>}

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
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
