"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

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
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const authHeader = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : null),
    [token]
  );

  useEffect(() => {
    setToken(localStorage.getItem("accessToken"));
  }, []);

  useEffect(() => {
    if (!userId || !authHeader) {
      return;
    }
    const load = async () => {
      setStatus(null);
      const res = await fetch(`${API_BASE}/users/${userId}`, {
        headers: { ...authHeader }
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(body?.message ?? "Failed to load profile.");
        return;
      }
      setProfile(body as PublicProfile);
    };
    load().catch(() => setStatus("Failed to load profile."));
  }, [userId, authHeader]);

  const tags = [
    ...(profile?.preference?.vibeTags ?? []),
    ...(profile?.preference?.interests ?? [])
  ].filter(Boolean);
  const locationLine = [profile?.city, profile?.country]
    .filter((item) => item && item.trim().length > 0)
    .join(" · ");

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 text-slate-100">
      <button
        type="button"
        className="text-xs text-slate-400 hover:text-white"
        onClick={() => router.back()}
      >
        ← Back
      </button>
      {status && <p className="mt-4 text-sm text-rose-300">{status}</p>}
      {profile && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-4">
            {profile.maskAvatarUrl ? (
              <img
                src={profile.maskAvatarUrl}
                alt={profile.maskName ?? "Profile"}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-lg font-semibold">
                {(profile.maskName ?? "A").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-lg font-semibold text-white">
                {profile.maskName ?? "Anonymous"}
              </p>
              {locationLine && (
                <p className="text-xs text-slate-400">{locationLine}</p>
              )}
            </div>
          </div>
          {profile.bio && (
            <p className="mt-4 text-sm text-slate-200">{profile.bio}</p>
          )}
          {tags.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Tags
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {!token && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          Sign in to view full profiles.
        </div>
      )}
    </main>
  );
}
