"use client";

import { useEffect, useRef, useState } from "react";

import { getSupabaseClient } from "../lib/supabaseClient";
import { toSafeFileName } from "../lib/fileName";

const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "uploads";

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
  userId: string;
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
  userId,
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
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }
      let avatarUrl = me.maskAvatarUrl ?? null;
      if (avatarFile) {
        const path = `avatars/${userId}-${Date.now()}-${toSafeFileName(
          avatarFile.name
        )}`;
        const { error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, avatarFile, { upsert: true });
        if (error) {
          throw new Error("Avatar upload failed.");
        }
        const { data } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(path);
        avatarUrl = data.publicUrl ?? null;
      }

      const { error: profileError } = await supabase
        .from("User")
        .update({
          maskName: maskName.trim() || null,
          bio: bio.trim() || null,
          ...(avatarUrl ? { maskAvatarUrl: avatarUrl } : {})
        })
        .eq("id", userId);
      if (profileError) {
        throw new Error("Profile update failed.");
      }

      const { error: prefError } = await supabase
        .from("Preference")
        .upsert(
          {
            userId,
            vibeTagsJson: parseTags(vibeTags),
            interestsJson: parseTags(interests),
            allowStrangerPrivate,
            smPreference: personality.trim() || null
          },
          { onConflict: "userId" }
        );
      if (prefError) {
        throw new Error("Preference update failed.");
      }

      const { data: updated } = await supabase
        .from("User")
        .select(
          "id,maskName,maskAvatarUrl,bio,preference:Preference(vibeTagsJson,interestsJson,allowStrangerPrivate,smPreference)"
        )
        .eq("id", userId)
        .maybeSingle();

      if (!updated) {
        throw new Error("Failed to refresh profile.");
      }

      onSaved({
        id: updated.id,
        maskName: updated.maskName ?? null,
        maskAvatarUrl: updated.maskAvatarUrl ?? null,
        bio: updated.bio ?? null,
        preference: updated.preference?.[0]
          ? {
              vibeTags: updated.preference[0].vibeTagsJson ?? null,
              interests: updated.preference[0].interestsJson ?? null,
              allowStrangerPrivate:
                updated.preference[0].allowStrangerPrivate ?? null,
              smPreference: updated.preference[0].smPreference ?? null
            }
          : null
      });
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
