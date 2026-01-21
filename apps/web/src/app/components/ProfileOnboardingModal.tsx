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
    allowStrangerPrivate?: boolean | null;
    smPreference?: string | null;
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
  const [personality, setPersonality] = useState(
    me.preference?.smPreference ?? ""
  );
  const [allowStrangerPrivate, setAllowStrangerPrivate] = useState(
    me.preference?.allowStrangerPrivate ?? true
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
          interestsJson: parseTags(interests),
          allowStrangerPrivate,
          smPreference: personality.trim()
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
    <div className="fixed inset-0 z-50 flex min-h-[100svh] items-center justify-center overflow-y-auto px-4 py-10">
      <div className="absolute inset-0 bg-text-primary/40 backdrop-blur" onClick={onClose} />
      <div className="relative ui-surface w-full max-w-[520px] max-h-[80vh] overflow-y-auto p-6 text-text-primary">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Complete your profile</h2>
            <p className="mt-1 text-xs text-text-muted">
              Add a name, vibe tags, and a short bio so people know who you are.
            </p>
          </div>
          <button
            type="button"
            className="text-xs text-text-muted hover:text-text-primary"
            onClick={onClose}
          >
            Skip for now
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
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border-default bg-card text-sm">
                {(maskName || "U").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <button
                type="button"
                className="btn-secondary px-3 py-1 text-xs"
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

          <label className="text-xs text-text-secondary">
            Display name
            <input
              className="mt-2 w-full rounded-xl border border-border-default bg-card px-3 py-2 text-sm text-text-primary"
              value={maskName}
              onChange={(event) => setMaskName(event.target.value)}
              maxLength={64}
              placeholder="Mask name"
            />
          </label>

          <label className="text-xs text-text-secondary">
            Bio
            <textarea
              className="mt-2 w-full rounded-xl border border-border-default bg-card px-3 py-2 text-sm text-text-primary"
              rows={3}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={280}
              placeholder="A short intro"
            />
          </label>

          <label className="text-xs text-text-secondary">
            Vibe tags (comma separated)
            <input
              className="mt-2 w-full rounded-xl border border-border-default bg-card px-3 py-2 text-sm text-text-primary"
              value={vibeTags}
              onChange={(event) => setVibeTags(event.target.value)}
              placeholder="Curious, soft, playful"
            />
          </label>

          <label className="text-xs text-text-secondary">
            Interests (comma separated)
            <input
              className="mt-2 w-full rounded-xl border border-border-default bg-card px-3 py-2 text-sm text-text-primary"
              value={interests}
              onChange={(event) => setInterests(event.target.value)}
              placeholder="Art, travel, late-night chats"
            />
          </label>

          <label className="text-xs text-text-secondary">
            Personality preference
            <input
              className="mt-2 w-full rounded-xl border border-border-default bg-card px-3 py-2 text-sm text-text-primary"
              value={personality}
              onChange={(event) => setPersonality(event.target.value)}
              maxLength={128}
              placeholder="Warm, playful, intense..."
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border-default bg-card"
              checked={allowStrangerPrivate}
              onChange={(event) => setAllowStrangerPrivate(event.target.checked)}
            />
            <span>Allow strangers to request private chats</span>
          </label>
        </div>

        {status && <p className="mt-4 text-xs text-text-secondary">{status}</p>}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            className="btn-secondary px-4 py-2 text-xs"
            onClick={onClose}
          >
            Later
          </button>
          <button
            type="button"
            className="btn-primary px-4 py-2 text-xs"
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
