"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
  const readingParagraphs = readingText
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  return (
    <main className="ui-page">
      <div className="ui-container pb-20 pt-10 text-text-primary lg:pb-10">
        <Link
          href="/novels"
          className="text-sm text-text-secondary transition hover:text-text-primary"
        >
          ← Back
        </Link>
        {status && <p className="mt-4 text-sm text-text-secondary">{status}</p>}
        {novel && (
          <div className="mt-6 space-y-10">
            <section className="space-y-2">
              <h1 className="text-3xl font-semibold text-text-primary">
                {novel.title}
              </h1>
              <p className="text-sm text-text-secondary">
                Chapter 1 · Free / Grown-up
              </p>
            </section>

            <div className="relative">
              <div className="mx-auto flex max-w-5xl items-start gap-6">
                <div className="hidden shrink-0 lg:block">
                  <div className="sticky top-[140px] flex flex-col gap-3">
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-full border border-border-default bg-card px-3 py-2 text-xs text-text-secondary transition hover:text-text-primary"
                      onClick={() => handleReaction("LIKE")}
                      disabled={reactionLoading}
                      title="More like this"
                    >
                      <span aria-hidden="true">♥</span>
                      <span>Like</span>
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-full border border-border-default bg-card px-3 py-2 text-xs text-text-secondary transition hover:text-text-primary"
                      onClick={() => handleReaction("DISLIKE")}
                      disabled={reactionLoading}
                      title="Show me less"
                    >
                      <span aria-hidden="true">×</span>
                      <span>Not for me</span>
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-full border border-border-default bg-card px-3 py-2 text-xs text-text-secondary transition hover:text-text-primary"
                      onClick={handleShare}
                      title="Send a taste"
                    >
                      <span aria-hidden="true">↗</span>
                      <span>Share</span>
                    </button>
                  </div>
                </div>

                <section className="mx-auto w-full max-w-[720px]">
                  <p className="text-xs text-text-muted">
                    Take your time. This isn't a race.
                  </p>
                  <div className="mt-6 space-y-6 text-base leading-8 text-text-primary">
                    {readingParagraphs.length > 0 ? (
                      readingParagraphs.map((paragraph, index) => (
                        <p key={`${novel.id}-paragraph-${index}`}>
                          {paragraph}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-text-muted">
                        No story content yet.
                      </p>
                    )}
                  </div>

                  <section className="ui-surface mt-10 p-6 text-sm text-text-secondary">
                    <h2 className="text-lg font-semibold text-text-primary">
                      Keep going?
                    </h2>
                    <div className="mt-3 space-y-1 text-xs text-text-muted">
                      <p>Read by 1,284 people</p>
                      <p>23 are talking about it right now</p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        className="btn-primary px-4 py-2 text-xs"
                        onClick={() => router.push("/novels")}
                      >
                        See other stories
                      </button>
                      <button
                        type="button"
                        className="btn-secondary px-4 py-2 text-xs"
                        onClick={() =>
                          router.push(
                            novel.room?.id ? `/rooms/${novel.room.id}` : "/rooms"
                          )
                        }
                      >
                        Join the room
                      </button>
                    </div>
                    <p className="mt-4 text-xs text-text-muted">
                      Bold is welcome. Coercion isn't.
                    </p>
                  </section>
                </section>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-default bg-card/95 backdrop-blur lg:hidden">
        <div className="ui-container flex items-center justify-around py-2 text-xs text-text-secondary">
          <button
            type="button"
            className="flex items-center gap-1 px-3 py-2"
            onClick={() => handleReaction("LIKE")}
            disabled={reactionLoading}
            title="More like this"
          >
            <span aria-hidden="true">♥</span>
            <span>Like</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1 px-3 py-2"
            onClick={() => handleReaction("DISLIKE")}
            disabled={reactionLoading}
            title="Show me less"
          >
            <span aria-hidden="true">×</span>
            <span>Not for me</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1 px-3 py-2"
            onClick={handleShare}
            title="Send a taste"
          >
            <span aria-hidden="true">↗</span>
            <span>Share</span>
          </button>
        </div>
      </div>
    </main>
  );
}
