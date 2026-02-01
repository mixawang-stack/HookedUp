"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "../lib/supabaseClient";

export const dynamic = "force-dynamic";

const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "uploads";

type MeResponse = {
  id: string;
  email: string;
  maskName: string | null;
  maskAvatarUrl: string | null;
  bio: string | null;
  language: string | null;
  city: string | null;
  gender: string | null;
  dob: string | null;
  country: string | null;
  profileCompleted?: boolean;
  preference?: {
    vibeTags?: string[] | null;
    interests?: string[] | null;
    allowStrangerPrivate?: boolean | null;
  } | null;
};

const parseTags = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const toDateInput = (value?: string | null) => {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
};

export default function MePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [maskName, setMaskName] = useState("");
  const [bio, setBio] = useState("");
  const [language, setLanguage] = useState("");
  const [city, setCity] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [vibeTags, setVibeTags] = useState("");
  const [interests, setInterests] = useState("");
  const [allowStrangerPrivate, setAllowStrangerPrivate] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login?redirect=/me");
        return;
      }
      setUserId(data.user.id);
    };
    loadUser().catch(() => undefined);
  }, [router]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const fetchMe = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data, error } = await supabase
        .from("User")
        .select(
          "id,email,maskName,maskAvatarUrl,bio,language,city,gender,dob,country,preference:Preference(vibeTagsJson,interestsJson,allowStrangerPrivate)"
        )
        .eq("id", userId)
        .maybeSingle();
      if (error || !data) {
        setStatus("Failed to load profile.");
        return;
      }
      const response: MeResponse = {
        id: data.id,
        email: data.email,
        maskName: data.maskName ?? null,
        maskAvatarUrl: data.maskAvatarUrl ?? null,
        bio: data.bio ?? null,
        language: data.language ?? null,
        city: data.city ?? null,
        gender: data.gender ?? null,
        dob: data.dob ?? null,
        country: data.country ?? null,
        preference: data.preference?.[0]
          ? {
              vibeTags: data.preference[0].vibeTagsJson ?? null,
              interests: data.preference[0].interestsJson ?? null,
              allowStrangerPrivate:
                data.preference[0].allowStrangerPrivate ?? null
            }
          : null
      };
      setMe(response);
      setMaskName(response.maskName ?? "");
      setBio(response.bio ?? "");
      setLanguage(response.language ?? "");
      setCity(response.city ?? "");
      setGender(response.gender ?? "");
      setDob(toDateInput(response.dob));
      setVibeTags((response.preference?.vibeTags ?? []).join(", "));
      setInterests((response.preference?.interests ?? []).join(", "));
      setAllowStrangerPrivate(response.preference?.allowStrangerPrivate ?? true);
      setAvatarPreview(response.maskAvatarUrl ?? null);
    };
    fetchMe().catch(() => setStatus("Failed to load profile."));
  }, [userId]);

  useEffect(() => {
    if (!avatarFile) {
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const handleSave = async () => {
    if (!userId) {
      setStatus("Please sign in again.");
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setStatus("Supabase is not configured.");
        return;
      }
      let avatarUrl = me?.maskAvatarUrl ?? null;
      if (avatarFile) {
        const path = `avatars/${userId}/${Date.now()}-${avatarFile.name}`;
        const { error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, avatarFile, { upsert: true });
        if (error) {
          throw new Error("Avatar upload failed.");
        }
        const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        avatarUrl = data.publicUrl ?? null;
      }

      const { error: profileError } = await supabase
        .from("User")
        .update({
          maskName: maskName.trim(),
          bio: bio.trim(),
          language: language.trim(),
          city: city.trim(),
          gender: gender.trim(),
          ...(dob.trim() ? { dob: dob.trim() } : {}),
          ...(avatarUrl ? { maskAvatarUrl: avatarUrl } : {})
        })
        .eq("id", userId);
      if (profileError) {
        throw new Error("Profile update failed.");
      }

      const { error: prefError } = await supabase.from("Preference").upsert(
        {
          userId,
          vibeTagsJson: parseTags(vibeTags),
          interestsJson: parseTags(interests),
          allowStrangerPrivate
        },
        { onConflict: "userId" }
      );
      if (prefError) {
        throw new Error("Preference update failed.");
      }

      const { data: updated } = await supabase
        .from("User")
        .select(
          "id,email,maskName,maskAvatarUrl,bio,language,city,gender,dob,country,preference:Preference(vibeTagsJson,interestsJson,allowStrangerPrivate)"
        )
        .eq("id", userId)
        .maybeSingle();
      if (updated) {
        setMe({
          id: updated.id,
          email: updated.email,
          maskName: updated.maskName ?? null,
          maskAvatarUrl: updated.maskAvatarUrl ?? null,
          bio: updated.bio ?? null,
          language: updated.language ?? null,
          city: updated.city ?? null,
          gender: updated.gender ?? null,
          dob: updated.dob ?? null,
          country: updated.country ?? null,
          preference: updated.preference?.[0]
            ? {
                vibeTags: updated.preference[0].vibeTagsJson ?? null,
                interests: updated.preference[0].interestsJson ?? null,
                allowStrangerPrivate:
                  updated.preference[0].allowStrangerPrivate ?? null
              }
            : null
        });
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
          <h1 className="text-2xl font-semibold">My profile</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Update your profile details and preferences.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-6 ui-card p-6">
        <div className="flex items-center gap-4">
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt="Avatar preview"
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border-default bg-surface text-lg text-text-secondary">
              {(maskName || "U").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="space-x-3">
            <button
              type="button"
              className="btn-secondary px-4 py-2 text-xs"
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
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs text-text-secondary">
            Gender
            <input
              className="mt-2 w-full rounded-xl border border-border-default bg-card px-3 py-2 text-sm text-text-primary"
              value={gender}
              onChange={(event) => setGender(event.target.value)}
              maxLength={32}
            />
          </label>
          <label className="text-xs text-text-secondary">
            Date of birth
            <input
              type="date"
              className="mt-2 w-full rounded-xl border border-border-default bg-card px-3 py-2 text-sm text-text-primary"
              value={dob}
              onChange={(event) => setDob(event.target.value)}
            />
          </label>
        </div>

        <label className="text-xs text-text-secondary">
          Vibe tags (comma separated)
          <input
            className="mt-2 w-full rounded-xl border border-border-default bg-card px-3 py-2 text-sm text-text-primary"
            value={vibeTags}
            onChange={(event) => setVibeTags(event.target.value)}
          />
        </label>

        <label className="text-xs text-text-secondary">
          Interests (comma separated)
          <input
            className="mt-2 w-full rounded-xl border border-border-default bg-card px-3 py-2 text-sm text-text-primary"
            value={interests}
            onChange={(event) => setInterests(event.target.value)}
          />
        </label>

        <div className="ui-surface p-4 text-xs text-text-secondary">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-text-muted">
            Privacy
          </p>
          <label className="mt-3 flex items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border-default bg-card"
              checked={allowStrangerPrivate}
              onChange={(event) => setAllowStrangerPrivate(event.target.checked)}
            />
            <span>Allow strangers to start private chats with me</span>
          </label>
          <p className="mt-2 text-[11px] text-text-muted">
            Turn this off to only accept private chats after you reply.
          </p>
        </div>

        {status && <p className="text-xs text-text-secondary">{status}</p>}

        <div className="flex items-center justify-end">
          <button
            type="button"
            className="btn-primary px-4 py-2 text-xs"
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


