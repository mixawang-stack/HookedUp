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
  const [activeTab, setActiveTab] = useState<"about" | "chapters" | "reviews">(
    "about"
  );
  const [showPremiumPrompt, setShowPremiumPrompt] = useState(false);

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
    <main className="ui-page">
      <div className="ui-container py-10 text-text-primary">
        <button
          type="button"
          className="btn-secondary px-3 py-1 text-xs"
          onClick={() => router.push("/hall")}
        >
          Back
        </button>
        {status && <p className="mt-4 text-sm text-text-secondary">{status}</p>}
        {novel && (
          <div className="mt-6 space-y-6">
            <section className="ui-card grid gap-6 p-6 md:grid-cols-[160px_1fr]">
              <div className="overflow-hidden rounded-2xl border border-border-default bg-surface">
                {novel.coverImageUrl ? (
                  <img
                    src={resolveMediaUrl(novel.coverImageUrl) ?? ""}
                    alt={novel.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-[200px] items-center justify-center text-xs text-text-muted">
                    No cover
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <p className="text-sm text-text-secondary">
                  Take your time.
                  <br />
                  This one is better when you don't rush.
                </p>
                <h1 className="text-3xl font-semibold text-text-primary">
                  {novel.title}
                </h1>
                <p className="text-sm text-text-secondary">Left here by someone.</p>
                <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
                  <span>Rating -</span>
                  <span>{novel.viewCount ?? 0} reads</span>
                  <span>{novel.favoriteCount ?? 0} likes</span>
                </div>
              </div>
            </section>

            <div className="ui-tab-list">
              <button
                type="button"
                className={`ui-tab ${activeTab === "about" ? "ui-tab-active" : ""}`}
                onClick={() => setActiveTab("about")}
              >
                About
              </button>
              <button
                type="button"
                className={`ui-tab ${activeTab === "chapters" ? "ui-tab-active" : ""}`}
                onClick={() => setActiveTab("chapters")}
              >
                Chapters
              </button>
              <button
                type="button"
                className={`ui-tab ${activeTab === "reviews" ? "ui-tab-active" : ""}`}
                onClick={() => setActiveTab("reviews")}
              >
                Reviews
              </button>
            </div>

            {activeTab === "about" && (
              <div className="space-y-4">
                <div className="ui-card p-5 text-sm text-text-secondary">
                  {novel.description ?? "-"}
                </div>
                <section className="ui-card max-h-[60vh] overflow-y-auto p-5">
                  {readingText ? (
                    <div className="text-base leading-8 text-text-primary whitespace-pre-wrap">
                      {readingText}
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted">
                      No story content yet.
                    </p>
                  )}
                </section>
                <div className="ui-surface p-4 text-sm text-text-secondary">
                  <p>Curious how others felt about it?</p>
                  <p>There's a room where this story is being talked about.</p>
                  <button
                    type="button"
                    className="btn-primary mt-3 px-4 py-2 text-xs"
                    onClick={() =>
                      router.push(novel.room?.id ? `/rooms/${novel.room.id}` : "/rooms")
                    }
                  >
                    Go to discussion room
                  </button>
                </div>
              </div>
            )}

            {activeTab === "chapters" && (
              <section className="ui-card p-5">
                <div className="space-y-3">
                  {(novel.chapters ?? []).map((chapter, index) => {
                    const freeCount =
                      novel.chapters.filter((item) => item.isFree).length ||
                      Math.min(5, novel.chapters.length);
                    const isFree = chapter.isFree || index < freeCount;
                    return (
                      <div
                        key={chapter.id}
                        className="flex items-center justify-between rounded-2xl border border-border-default bg-card px-4 py-3 text-sm"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (!isFree) {
                            setShowPremiumPrompt(true);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (!isFree) {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setShowPremiumPrompt(true);
                            }
                          }
                        }}
                      >
                        <div className="space-y-1">
                          <p className="font-semibold text-text-primary">
                            {chapter.title || `Chapter ${index + 1}`}
                          </p>
                        </div>
                        {isFree ? (
                          <span className="ui-badge ui-badge-story">Free</span>
                        ) : (
                          <span className="ui-badge ui-badge-premium">
                            Premium
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {(novel.chapters ?? []).some((chapter, index) => {
                  const freeCount =
                    novel.chapters.filter((item) => item.isFree).length ||
                    Math.min(5, novel.chapters.length);
                  return !(chapter.isFree || index < freeCount);
                }) && (
                  <div className="ui-surface mt-4 p-4 text-sm text-text-secondary">
                    Premium required to unlock locked chapters.
                  </div>
                )}
              </section>
            )}

            {activeTab === "reviews" && (
              <section className="ui-card p-5 text-sm text-text-secondary">-</section>
            )}
          </div>
        )}
        {showPremiumPrompt && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 p-6"
            role="dialog"
            aria-modal="true"
          >
            <div className="ui-surface w-full max-w-md p-6 text-text-primary">
              <h3 className="text-lg font-semibold">Premium chapter</h3>
              <p className="mt-2 text-sm text-text-secondary">
                Premium required to unlock locked chapters.
              </p>
              <button
                type="button"
                className="btn-secondary mt-4 px-4 py-2 text-xs"
                onClick={() => setShowPremiumPrompt(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
