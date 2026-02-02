"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { getSupabaseClient } from "../../lib/supabaseClient";
import { useSupabaseSession } from "../../lib/useSupabaseSession";

type PublicProfile = {
  id: string;
  maskName: string | null;
  maskAvatarUrl: string | null;
  bio: string | null;
  city?: string | null;
  country?: string | null;
  preference?: {
    vibeTags?: string[] | null;
    interests?: string[] | null;
  } | null;
};

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = typeof params?.id === "string" ? params.id : "";
  const { user, ready } = useSupabaseSession();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !userId || !user) {
      return;
    }
    const load = async () => {
      setStatus(null);
      const supabase = getSupabaseClient();
      if (!supabase) {
        setStatus("Supabase is not configured.");
        return;
      }
      const { data, error } = await supabase
        .from("User")
        .select(
          "id,maskName,maskAvatarUrl,bio,city,country,preference:Preference(vibeTagsJson,interestsJson)"
        )
        .eq("id", userId)
        .maybeSingle();
      if (error || !data) {
        setStatus("Failed to load profile.");
        return;
      }
      setProfile({
        id: data.id,
        maskName: data.maskName ?? null,
        maskAvatarUrl: data.maskAvatarUrl ?? null,
        bio: data.bio ?? null,
        city: data.city ?? null,
        country: data.country ?? null,
        preference: data.preference?.[0]
          ? {
              vibeTags: data.preference[0].vibeTagsJson ?? null,
              interests: data.preference[0].interestsJson ?? null
            }
          : null
      });
    };
    load().catch(() => setStatus("Failed to load profile."));
  }, [ready, userId, user]);

  const tags = [
    ...(profile?.preference?.vibeTags ?? []),
    ...(profile?.preference?.interests ?? [])
  ].filter(Boolean);
  const locationLine = [profile?.city, profile?.country]
    .filter((item) => item && item.trim().length > 0)
    .join(" · ");

  return (
    <main className="ui-page mx-auto w-full max-w-3xl px-4 py-10 text-text-primary">
      <button
        type="button"
        className="btn-secondary px-3 py-1 text-xs"
        onClick={() => router.back()}
      >
        Back
      </button>
      {status && <p className="mt-4 text-sm text-brand-secondary">{status}</p>}
      {profile && (
        <div className="mt-6 ui-card p-6">
          <div className="flex items-center gap-4">
            {profile.maskAvatarUrl ? (
              <img
                src={profile.maskAvatarUrl}
                alt={profile.maskName ?? "Profile"}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-lg font-semibold text-text-secondary">
                {(profile.maskName ?? "A").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-lg font-semibold text-text-primary">
                {profile.maskName ?? "Anonymous"}
              </p>
              {locationLine && (
                <p className="text-xs text-text-muted">{locationLine}</p>
              )}
            </div>
          </div>
          {profile.bio && (
            <p className="mt-4 text-sm text-text-secondary">{profile.bio}</p>
          )}
          {tags.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-wide text-text-muted">
                Tags
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border-default px-2 py-0.5 text-[10px] text-text-secondary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {!user && (
        <div className="mt-6 ui-surface p-6 text-sm text-text-secondary">
          Sign in to view full profiles.
        </div>
      )}
    </main>
  );
}

