"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type NovelPreview = {
  id: string;
  title: string;
  coverImageUrl: string | null;
  description: string | null;
  tagsJson?: string[] | null;
  viewCount?: number;
  favoriteCount?: number;
  dislikeCount?: number;
  myReaction?: "LIKE" | "DISLIKE" | null;
  room?: { id: string; title: string; _count: { memberships: number } } | null;
  chapters: Array<{
    id: string;
    title: string;
    content: string;
    orderIndex: number;
    isFree: boolean;
    isPublished: boolean;
    isLocked?: boolean;
  }>;
};

const resolveMediaUrl = (value?: string | null) => {
  if (!value) return null;
  if (value.startsWith("/uploads/")) {
    return `${API_BASE}${value}`;
  }
  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    return value;
  }
  try {
    const parsed = new URL(value);
    if (parsed.pathname.startsWith("/uploads/")) {
      return `${API_BASE}${parsed.pathname}`;
    }
  } catch {
    return value;
  }
  return value;
};

export default function NovelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const novelId = typeof params?.id === "string" ? params.id : "";
  const [token, setToken] = useState<string | null>(null);
  const [novel, setNovel] = useState<NovelPreview | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [reactionLoading, setReactionLoading] = useState(false);

  const authHeader = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : null),
    [token]
  );

  useEffect(() => {
    setToken(localStorage.getItem("accessToken"));
  }, []);

  useEffect(() => {
    if (!novelId) return;
    const load = async () => {
      setStatus(null);
      const res = await fetch(`${API_BASE}/novels/${novelId}/full`, {
        headers: authHeader ? { ...authHeader } : undefined
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(body?.message ?? "Failed to load novel.");
        return;
      }
      setNovel(body as NovelPreview);
    };
    load().catch(() => setStatus("Failed to load novel."));
  }, [novelId, authHeader]);

  const handleReaction = async (type: "LIKE" | "DISLIKE") => {
    if (!authHeader) {
      setStatus("Please sign in to react.");
      return;
    }
    if (!novelId) return;
    setReactionLoading(true);
    try {
      const endpoint = type === "LIKE" ? "like" : "dislike";
      const res = await fetch(`${API_BASE}/novels/${novelId}/${endpoint}`, {
        method: "POST",
        headers: { ...authHeader }
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to react.");
      }
      setNovel((prev) =>
        prev
          ? {
              ...prev,
              favoriteCount: body.favoriteCount ?? prev.favoriteCount,
              dislikeCount: body.dislikeCount ?? prev.dislikeCount,
              myReaction: body.myReaction ?? prev.myReaction
            }
          : prev
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to react.";
      setStatus(message);
    } finally {
      setReactionLoading(false);
    }
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: novel?.title ?? "Story", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setStatus("Link copied.");
    } catch {
      setStatus("Failed to share.");
    }
  };

  const readingText = novel?.chapters
    ? novel.chapters.map((chapter) => chapter.content).join("\n\n")
    : "";

  return (
    <main className="ui-page relative mx-auto w-full max-w-4xl px-4 py-10 text-text-primary">
      <button
        type="button"
        className="btn-secondary px-3 py-1 text-xs"
        onClick={() => router.push("/hall")}
      >
        Back
      </button>
      {status && <p className="mt-4 text-sm text-text-secondary">{status}</p>}
      {novel && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-6">
            <header className="space-y-2">
              <h1 className="text-3xl font-semibold">{novel.title}</h1>
              {novel.description && (
                <p className="text-base text-text-secondary">
                  {novel.description}
                </p>
              )}
            </header>
            <div className="mx-auto w-full max-w-2xl space-y-6">
              {readingText ? (
                <div className="text-base leading-8 text-text-primary whitespace-pre-wrap">
                  {readingText}
                </div>
              ) : (
                <p className="text-sm text-text-muted">No story content yet.</p>
              )}
            </div>
            <div className="mx-auto w-full max-w-2xl ui-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-text-secondary">
                <span>{novel.viewCount ?? 0} reads</span>
                <span>{novel.room?._count?.memberships ?? 0} discussing</span>
              </div>
              <button
                type="button"
                className="btn-primary mt-4 w-full px-4 py-2 text-xs"
                onClick={() =>
                  novel.room?.id
                    ? router.push(`/rooms/${novel.room.id}`)
                    : setStatus("Discussion room is not ready yet.")
                }
              >
                Join the discussion
              </button>
            </div>
          </div>

          <aside className="hidden lg:flex flex-col gap-3 lg:sticky lg:top-24">
            <button
              type="button"
              className={`w-full rounded-full border border-border-default px-3 py-2 text-xs font-semibold transition ${
                novel.myReaction === "LIKE"
                  ? "bg-brand-primary text-card"
                  : "bg-card text-text-secondary"
              }`}
              onClick={() => handleReaction("LIKE")}
              disabled={reactionLoading}
            >
              Like
            </button>
            <button
              type="button"
              className={`w-full rounded-full border border-border-default px-3 py-2 text-xs font-semibold transition ${
                novel.myReaction === "DISLIKE"
                  ? "bg-brand-secondary text-card"
                  : "bg-card text-text-secondary"
              }`}
              onClick={() => handleReaction("DISLIKE")}
              disabled={reactionLoading}
            >
              Dislike
            </button>
            <button
              type="button"
              className="btn-secondary px-3 py-2 text-xs"
              onClick={handleShare}
            >
              Share
            </button>
          </aside>
        </div>
      )}
    </main>
  );
}
