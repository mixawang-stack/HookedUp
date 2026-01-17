"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type MeProfile = {
  id: string;
  maskName: string | null;
  maskAvatarUrl: string | null;
  bio: string | null;
  preference?: {
    vibeTags?: string[] | null;
    interests?: string[] | null;
  } | null;
};

type ProfileOnboardingModalProps = {
  token: string;
  me: MeProfile;
  onClose: () => void;
  onSaved: (nextMe: MeProfile) => void;
};

const parseTags = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

export default function ProfileOnboardingModal({
  token,
  me,
  onClose,
  onSaved
}: ProfileOnboardingModalProps) {
  const [maskName, setMaskName] = useState(me.maskName ?? "");
  const [bio, setBio] = useState(me.bio ?? "");
  const [vibeTags, setVibeTags] = useState(
    (me.preference?.vibeTags ?? []).join(", ")
  );
  const [interests, setInterests] = useState(
    (me.preference?.interests ?? []).join(", ")
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    me.maskAvatarUrl ?? null
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const authHeader = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  useEffect(() => {
    if (!avatarFile) {
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      let avatarUrl = me.maskAvatarUrl ?? null;
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

      const meRes = await fetch(`${API_BASE}/me`, { headers: { ...authHeader } });
      if (!meRes.ok) {
        throw new Error("Failed to refresh profile.");
      }
      const updated = (await meRes.json()) as MeProfile;
      onSaved(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed.";
      setStatus(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/95 p-6 text-slate-100 shadow-[0_30px_80px_rgba(2,6,23,0.8)]">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Complete your profile</h2>
            <p className="mt-1 text-xs text-slate-400">
              Add a name, vibe tags, and a short bio so people know who you are.
            </p>
          </div>
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-white"
            onClick={onClose}
          >
            Skip
          </button>
        </div>

        <div className="mt-4 grid gap-4">
          <div className="flex items-center gap-4">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar preview"
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm">
                {(maskName || "U").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <button
                type="button"
                className="rounded-full border border-white/20 px-3 py-1 text-xs text-white"
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
              placeholder="Mask name"
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
              placeholder="A short intro"
            />
          </label>

          <label className="text-xs text-slate-300">
            Vibe tags (comma separated)
            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
              value={vibeTags}
              onChange={(event) => setVibeTags(event.target.value)}
              placeholder="Curious, soft, playful"
            />
          </label>

          <label className="text-xs text-slate-300">
            Interests (comma separated)
            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
              value={interests}
              onChange={(event) => setInterests(event.target.value)}
              placeholder="Art, travel, late-night chats"
            />
          </label>
        </div>

        {status && <p className="mt-4 text-xs text-rose-300">{status}</p>}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            className="rounded-full border border-white/20 px-4 py-2 text-xs text-white"
            onClick={onClose}
          >
            Later
          </button>
          <button
            type="button"
            className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-900"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
