"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

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

type MeResponse = {
  id: string;
  email: string;
  maskName: string | null;
  maskAvatarUrl: string | null;
  gender: string | null;
};

type PreferenceResponse = {
  gender: string | null;
  lookingForGender: string | null;
  smPreference: string | null;
  tagsJson: string[] | null;
} | null;

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
  const [token, setToken] = useState<string | null>(null);
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

  const authHeader = useMemo(() => {
    if (!token) {
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  useEffect(() => {
    const stored = localStorage.getItem("accessToken");
    if (!stored) {
      router.push("/login");
      return;
    }
    setToken(stored);
  }, [router]);

  useEffect(() => {
    if (!authHeader) {
      return;
    }

    const fetchProfile = async () => {
      const meRes = await fetch(`${API_BASE}/me`, {
        headers: {
          ...authHeader
        }
      });

      if (meRes.ok) {
        const me = (await meRes.json()) as MeResponse;
        profileForm.reset({
          maskName: me.maskName ?? "",
          gender: me.gender ?? ""
        });
        setAvatarPreview(me.maskAvatarUrl ?? null);
      }

      const prefRes = await fetch(`${API_BASE}/me/preferences`, {
        headers: {
          ...authHeader
        }
      });

      if (prefRes.ok) {
        const prefs = (await prefRes.json()) as PreferenceResponse;
        preferenceForm.reset({
          lookingForGender: prefs?.lookingForGender ?? "",
          smPreference: prefs?.smPreference ?? "",
          tags: prefs?.tagsJson?.join(", ") ?? ""
        });
      }
    };

    fetchProfile().catch(() => {
      setSubmitStatus("Failed to load profile.");
    });
  }, [authHeader, profileForm, preferenceForm]);

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
    if (!authHeader) {
      setSubmitStatus("Please log in again.");
      return;
    }

    setSubmitStatus(null);
    setSubmitting(true);
    try {
      let avatarUrl: string | null = null;
      if (avatarFile) {
        const formData = new FormData();
        formData.append("file", avatarFile);
        const res = await fetch(`${API_BASE}/uploads/avatar`, {
          method: "POST",
          headers: {
            ...authHeader
          },
          body: formData
        });
        if (res.status === 401) {
          throw new Error("INVALID_ACCESS_TOKEN");
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const rawMessage = Array.isArray(body?.message)
            ? body.message.join("; ")
            : body?.message;
          throw new Error(rawMessage ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { avatarUrl?: string };
        avatarUrl = data.avatarUrl ?? null;
      }

      const profileValues = profileForm.getValues();
      const preferenceValues = preferenceForm.getValues();
      const profileRes = await fetch(`${API_BASE}/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({
          maskName: profileValues.maskName ?? "",
          gender: profileValues.gender ?? "",
          ...(avatarUrl ? { maskAvatarUrl: avatarUrl } : {})
        })
      });
      if (profileRes.status === 401) {
        throw new Error("INVALID_ACCESS_TOKEN");
      }
      if (!profileRes.ok) {
        const body = await profileRes.json().catch(() => ({}));
        const rawMessage = Array.isArray(body?.message)
          ? body.message.join("; ")
          : body?.message;
        throw new Error(rawMessage ?? `HTTP ${profileRes.status}`);
      }

      const preferenceRes = await fetch(`${API_BASE}/me/preferences`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({
          gender: profileValues.gender || null,
          lookingForGender: preferenceValues.lookingForGender || null,
          smPreference: preferenceValues.smPreference || null,
          tagsJson: parseTags(preferenceValues.tags)
        })
      });
      if (preferenceRes.status === 401) {
        throw new Error("INVALID_ACCESS_TOKEN");
      }
      if (!preferenceRes.ok) {
        const body = await preferenceRes.json().catch(() => ({}));
        const rawMessage = Array.isArray(body?.message)
          ? body.message.join("; ")
          : body?.message;
        throw new Error(rawMessage ?? `HTTP ${preferenceRes.status}`);
      }

      setSubmitStatus("That's enough for now. The rest happens naturally.");
      setTimeout(() => router.push("/hall"), 800);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submission failed.";
      if (message === "INVALID_ACCESS_TOKEN") {
        localStorage.removeItem("accessToken");
        setSubmitStatus("Session expired. Please sign in again.");
        router.push("/login");
        return;
      }
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
