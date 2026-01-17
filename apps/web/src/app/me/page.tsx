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
    allowStrangerPrivate?: boolean | null;
  } | null;
};

type MyTraceItem = {
  id: string;
  content: string;
  createdAt: string;
  imageUrl?: string | null;
  replyCount: number;
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
  const [allowStrangerPrivate, setAllowStrangerPrivate] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [traces, setTraces] = useState<MyTraceItem[]>([]);
  const [traceCursor, setTraceCursor] = useState<string | null>(null);
  const [loadingTraces, setLoadingTraces] = useState(false);
  const [traceStatus, setTraceStatus] = useState<string | null>(null);
  const [deletingTraceId, setDeletingTraceId] = useState<string | null>(null);
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
      setAllowStrangerPrivate(data.preference?.allowStrangerPrivate ?? true);
      setAvatarPreview(data.maskAvatarUrl ?? null);
    };
    fetchMe().catch(() => setStatus("Failed to load profile."));
  }, [authHeader]);

  const loadMyTraces = async (nextCursor?: string | null) => {
    if (!authHeader) {
      return;
    }
    setLoadingTraces(true);
    setTraceStatus(null);
    try {
      const params = new URLSearchParams();
      if (nextCursor) {
        params.set("cursor", nextCursor);
      }
      const res = await fetch(`${API_BASE}/traces/me?${params.toString()}`, {
        headers: { ...authHeader }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        items: MyTraceItem[];
        nextCursor: string | null;
      };
      setTraces((prev) => (nextCursor ? [...prev, ...data.items] : data.items));
      setTraceCursor(data.nextCursor);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load posts.";
      setTraceStatus(message);
    } finally {
      setLoadingTraces(false);
    }
  };

  useEffect(() => {
    if (!authHeader) {
      return;
    }
    loadMyTraces(null).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          interestsJson: parseTags(interests),
          allowStrangerPrivate
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

  const handleDeleteTrace = async (traceId: string) => {
    if (!authHeader) {
      setTraceStatus("Please sign in again.");
      return;
    }
    const confirmed = window.confirm("Delete this trace? This cannot be undone.");
    if (!confirmed) {
      return;
    }
    setDeletingTraceId(traceId);
    setTraceStatus(null);
    try {
      const res = await fetch(`${API_BASE}/traces/${traceId}`, {
        method: "DELETE",
        headers: { ...authHeader }
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      setTraces((prev) => prev.filter((item) => item.id !== traceId));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete trace.";
      setTraceStatus(message);
    } finally {
      setDeletingTraceId(null);
    }
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

        <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-xs text-slate-300">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
            Privacy
          </p>
          <label className="mt-3 flex items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={allowStrangerPrivate}
              onChange={(event) => setAllowStrangerPrivate(event.target.checked)}
            />
            <span>Allow strangers to start private chats with me</span>
          </label>
          <p className="mt-2 text-[11px] text-slate-500">
            Turn this off to only accept private chats after you reply.
          </p>
        </div>

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

      <div className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-slate-950/80 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">My traces</h2>
            <p className="text-xs text-slate-400">
              Your recent posts in the Hall.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200"
            onClick={() => loadMyTraces(null)}
            disabled={loadingTraces}
          >
            {loadingTraces ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {traceStatus && <p className="text-xs text-rose-300">{traceStatus}</p>}

        {traces.length === 0 && !loadingTraces ? (
          <p className="text-sm text-slate-400">
            You have not posted in the Hall yet.
          </p>
        ) : (
          <div className="space-y-3">
            {traces.map((trace) => (
              <div
                key={trace.id}
                className="rounded-xl border border-white/10 bg-slate-950/60 p-4"
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{new Date(trace.createdAt).toLocaleString()}</span>
                  <span>{trace.replyCount} replies</span>
                </div>
                {trace.imageUrl && (
                  <div className="mt-3 overflow-hidden rounded-xl bg-slate-900">
                    <img
                      src={
                        trace.imageUrl.startsWith("http")
                          ? trace.imageUrl
                          : `${API_BASE}${trace.imageUrl}`
                      }
                      alt={trace.content.slice(0, 40)}
                      className="h-40 w-full object-cover"
                    />
                  </div>
                )}
                <p className="mt-3 text-sm text-slate-100">{trace.content}</p>
                <div className="mt-3 flex items-center justify-end">
                  <button
                    type="button"
                    className="rounded-full border border-rose-400/60 px-3 py-1 text-xs text-rose-200"
                    onClick={() => handleDeleteTrace(trace.id)}
                    disabled={deletingTraceId === trace.id}
                  >
                    {deletingTraceId === trace.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {traceCursor && (
          <button
            type="button"
            className="rounded-full border border-white/20 px-4 py-2 text-xs text-slate-200"
            onClick={() => loadMyTraces(traceCursor)}
            disabled={loadingTraces}
          >
            {loadingTraces ? "Loading..." : "Load more"}
          </button>
        )}
      </div>
    </div>
  );
}
