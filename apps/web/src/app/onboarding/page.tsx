"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { getSupabaseClient } from "../lib/supabaseClient";
import { useSupabaseSession } from "../lib/useSupabaseSession";
import { toSafeFileName } from "../lib/fileName";

export const dynamic = "force-dynamic";

const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "uploads";

const profileSchema = z.object({
  maskName: z.string().max(64).optional(),
  gender: z.string().max(32).optional()
});

type ProfileForm = z.infer<typeof profileSchema>;

const preferenceSchema = z.object({
  lookingForGender: z.string().max(64).optional(),
  smPreference: z.string().max(128).optional(),
  tags: z.string().optional()
});

type PreferenceForm = z.infer<typeof preferenceSchema>;

function parseTags(input?: string) {
  if (!input) {
    return [];
  }

  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, ready } = useSupabaseSession();
  const [step, setStep] = useState(1);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      maskName: "",
      gender: ""
    }
  });

  const preferenceForm = useForm<PreferenceForm>({
    resolver: zodResolver(preferenceSchema),
    defaultValues: {
      lookingForGender: "",
      smPreference: "",
      tags: ""
    }
  });

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (!user) {
      router.push("/login");
    }
  }, [ready, router, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const fetchProfile = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }
      const { data: me } = await supabase
        .from("User")
        .select("id,email,maskName,maskAvatarUrl,gender")
        .eq("id", user.id)
        .maybeSingle();
      if (me) {
        profileForm.reset({
          maskName: me.maskName ?? "",
          gender: me.gender ?? ""
        });
        setAvatarPreview(me.maskAvatarUrl ?? null);
      }

      const { data: prefs } = await supabase
        .from("Preference")
        .select("gender,lookingForGender,smPreference,tagsJson")
        .eq("userId", user.id)
        .maybeSingle();

      preferenceForm.reset({
        lookingForGender: prefs?.lookingForGender ?? "",
        smPreference: prefs?.smPreference ?? "",
        tags: prefs?.tagsJson?.join(", ") ?? ""
      });
    };

    fetchProfile().catch(() => {
      setSubmitStatus("Failed to load profile.");
    });
  }, [user, profileForm, preferenceForm]);

  useEffect(() => {
    if (!avatarFile) {
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const triggerAvatarSelect = () => {
    avatarInputRef.current?.click();
  };

  const handleSubmitAll = async () => {
    if (!user) {
      setSubmitStatus("Please log in again.");
      return;
    }

    setSubmitStatus(null);
    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }
      let avatarUrl: string | null = null;
      if (avatarFile) {
        const path = `avatars/${user.id}-${Date.now()}-${toSafeFileName(
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

      const profileValues = profileForm.getValues();
      const preferenceValues = preferenceForm.getValues();
      const { error: profileError } = await supabase
        .from("User")
        .update({
          maskName: profileValues.maskName ?? null,
          gender: profileValues.gender ?? null,
          ...(avatarUrl ? { maskAvatarUrl: avatarUrl } : {})
        })
        .eq("id", user.id);
      if (profileError) {
        throw new Error("Failed to update profile.");
      }

      const { error: preferenceError } = await supabase
        .from("Preference")
        .upsert(
          {
            userId: user.id,
            gender: profileValues.gender || null,
            lookingForGender: preferenceValues.lookingForGender || null,
            smPreference: preferenceValues.smPreference || null,
            tagsJson: parseTags(preferenceValues.tags)
          },
          { onConflict: "userId" }
        );
      if (preferenceError) {
        throw new Error("Failed to update preferences.");
      }

      setSubmitStatus("That's enough for now. The rest happens naturally.");
      setTimeout(() => router.push("/forum"), 800);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submission failed.";
      setSubmitStatus(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="ui-page mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-6">
      <section className="ui-card p-6">
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
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-muted">
          <span className={step === 1 ? "font-semibold text-text-primary" : ""}>
            1. Your profile
          </span>
          <span>-</span>
          <span className={step === 2 ? "font-semibold text-text-primary" : ""}>
            2. Preferences
          </span>
        </div>
      </section>

      {step === 1 && (
        <section className="ui-card p-6">
          <h2 className="text-lg font-semibold text-text-primary">Your profile</h2>
          <p className="mt-2 text-sm text-text-secondary">
            A few things we can call you.
          </p>
          <div className="mt-4 flex flex-col gap-6">
            <div>
              <label className="text-xs font-semibold text-text-secondary">
                Avatar
              </label>
              <div className="mt-2 flex items-center gap-4">
                <button
                  type="button"
                  className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border-default bg-surface text-xs text-text-muted"
                  onClick={triggerAvatarSelect}
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="avatar preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    "Pick something that feels like you."
                  )}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(event) =>
                    setAvatarFile(event.target.files?.[0] ?? null)
                  }
                />
                <p className="text-xs text-text-muted">
                  Pick something that feels like you.
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-text-secondary">
                Nickname
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-border-default bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
                placeholder="What do people call you here?"
                {...profileForm.register("maskName")}
              />
              {profileForm.formState.errors.maskName && (
                <p className="mt-1 text-xs text-brand-secondary">
                  {profileForm.formState.errors.maskName.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-text-secondary">
                Gender
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-border-default bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
                placeholder="e.g. woman / man / other"
                {...profileForm.register("gender")}
              />
              {profileForm.formState.errors.gender && (
                <p className="mt-1 text-xs text-brand-secondary">
                  {profileForm.formState.errors.gender.message}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="ui-card p-6">
          <h2 className="text-lg font-semibold text-text-primary">Preferences</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Share a little about who you are.
          </p>
          <div className="mt-4 grid gap-4">
            <div>
              <label className="text-xs font-semibold text-text-secondary">
                Conversation preference
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-border-default bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
                placeholder="e.g. woman"
                {...preferenceForm.register("lookingForGender")}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-secondary">
                Interests
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-border-default bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
                placeholder="What are you usually into?"
                {...preferenceForm.register("smPreference")}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-secondary">
                Personal tags
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-border-default bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
                placeholder="e.g. travel, photography"
                {...preferenceForm.register("tags")}
              />
            </div>
          </div>
        </section>
      )}

      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary px-5 py-2 text-sm"
            onClick={() => setStep((prev) => Math.max(1, prev - 1))}
            disabled={step === 1}
          >
            Back
          </button>
          {step < 2 && (
            <button
              type="button"
              className="btn-secondary px-5 py-2 text-sm"
              onClick={() => setStep((prev) => Math.min(2, prev + 1))}
            >
              Next
            </button>
          )}
        </div>

        {step === 2 && (
          <button
            type="button"
            className="btn-primary px-6 py-2 text-sm"
            onClick={handleSubmitAll}
            disabled={submitting}
          >
            {submitting ? "Entering..." : "Enter the space"}
          </button>
        )}
      </section>

      {submitStatus && (
        <p className="text-sm text-text-secondary">{submitStatus}</p>
      )}
    </main>
  );
}
