"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
  contentSourceType?: "DOCX" | "TXT" | "MD" | "PDF";
  attachmentUrl?: string | null;
  wordCount?: number | null;
  chapterCount?: number | null;
  pricingMode?: "BOOK" | "CHAPTER";
  bookPrice?: string | number | null;
  bookPromoPrice?: string | number | null;
  currency?: string | null;
  creemProductId?: string | null;
  paymentLink?: string | null;
  room?: { id: string; title: string; _count: { memberships: number } } | null;
  chapters: Array<{
    id: string;
    title: string;
    orderIndex: number;
    isFree: boolean;
    isPublished: boolean;
    content: string;
  }>;
  lockedChapters?: Array<{
    id: string;
    title: string;
    orderIndex: number;
    price?: string | number | null;
  }>;
};

export default function NovelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const novelId = typeof params?.id === "string" ? params.id : "";
  const [token, setToken] = useState<string | null>(null);
  const [novel, setNovel] = useState<NovelPreview | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [reactionLoading, setReactionLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

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
      const res = await fetch(`${API_BASE}/novels/${novelId}/reading`, {
        headers: authHeader ? { ...authHeader } : undefined
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(body?.message ?? "Failed to load novel.");
        return;
      }
      console.debug("Novel payload", {
        id: body?.id,
        contentSourceType: body?.contentSourceType,
        chapterCount: body?.chapterCount,
        attachmentUrl: body?.attachmentUrl,
        apiBase: API_BASE
      });
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

  const chapters = novel?.chapters ?? [];
  const likeCount = novel?.favoriteCount ?? 0;
  const shouldShowAttachment = novel?.contentSourceType === "PDF" && novel.attachmentUrl;
  const lockedChapters = novel?.lockedChapters ?? [];

  const refreshReading = async () => {
    const res = await fetch(`${API_BASE}/novels/${novelId}/reading`, {
      headers: authHeader ? { ...authHeader } : undefined
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setNovel(body as NovelPreview);
    }
  };

  useEffect(() => {
    if (!authHeader || !novelId || !searchParams) return;
    const paymentSuccess = searchParams.get("payment") === "success";
    if (!paymentSuccess || unlocking) {
      return;
    }
    setUnlocking(true);
    refreshReading()
      .catch(() => undefined)
      .finally(() => setUnlocking(false));
  }, [authHeader, novelId, searchParams, unlocking]);

  const startCheckout = async () => {
    if (!authHeader) {
      setStatus("Please sign in to unlock.");
      return;
    }
    if (!novel) return;
    if (!novel.creemProductId && !novel.paymentLink) {
      setStatus("Payment is not configured yet.");
      return;
    }
    setUnlocking(true);
    try {
      if (novel.creemProductId) {
        const res = await fetch(`${API_BASE}/billing/creem/checkout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader
          },
          body: JSON.stringify({ novelId })
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus(body?.message ?? "Failed to start checkout.");
          return;
        }
        if (body?.checkoutUrl) {
          window.location.href = body.checkoutUrl;
          return;
        }
        setStatus("Checkout link unavailable.");
        return;
      }

      if (novel.paymentLink) {
        window.location.href = novel.paymentLink;
      }
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <main className="ui-page">
      <div className="ui-container pb-20 pt-10 text-text-primary lg:pb-10">
        <Link
          href="/novels"
          className="text-sm text-text-secondary transition hover:text-text-primary"
        >
          &larr; Back
        </Link>
        {status && <p className="mt-4 text-sm text-text-secondary">{status}</p>}
        {novel && (
          <div className="mt-6 space-y-10">
            <section className="space-y-2">
              <h1 className="text-3xl font-semibold text-text-primary">
                {novel.title}
              </h1>
              <p className="text-sm text-text-secondary">
                Chapter 1 - Free / Grown-up
              </p>
            </section>

            <div className="relative">
              <div className="mx-auto flex max-w-5xl items-start gap-6">
                <div className="hidden shrink-0 lg:block">
                  <div className="sticky top-[140px] flex flex-col gap-3">
                    <button
                      type="button"
                      className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm transition hover:bg-surface ${
                        novel?.myReaction === "LIKE"
                          ? "text-brand-primary"
                          : "text-text-muted hover:text-text-primary"
                      }`}
                      onClick={() => handleReaction("LIKE")}
                      disabled={reactionLoading}
                      title="More like this"
                    >
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M12 20.5c-5.05-3.62-8.5-6.7-8.5-10.6 0-2.3 1.74-4.1 4.06-4.1 1.62 0 3.18.9 4.44 2.38 1.26-1.48 2.82-2.38 4.44-2.38 2.32 0 4.06 1.8 4.06 4.1 0 3.9-3.45 6.98-8.5 10.6z"
                          fill={
                            novel?.myReaction === "LIKE" ? "currentColor" : "none"
                          }
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                      </svg>
                      <span>Like</span>
                    </button>
                    <button
                      type="button"
                      className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm transition hover:bg-surface ${
                        novel?.myReaction === "DISLIKE"
                          ? "text-text-primary"
                          : "text-text-muted hover:text-text-primary"
                      }`}
                      onClick={() => handleReaction("DISLIKE")}
                      disabled={reactionLoading}
                      title="Show me less"
                    >
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M14 10V4a2 2 0 0 0-2-2l-1 5-4 4v7h7a2 2 0 0 0 2-2v-4.5l2.5-.5c.8-.2 1.5-.9 1.5-1.8V9h-6Z"
                          fill={
                            novel?.myReaction === "DISLIKE"
                              ? "currentColor"
                              : "none"
                          }
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M3 10h3v8H3z"
                          fill={
                            novel?.myReaction === "DISLIKE"
                              ? "currentColor"
                              : "none"
                          }
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                      </svg>
                      <span>Not for me</span>
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-text-muted transition hover:bg-surface hover:text-text-primary"
                      onClick={handleShare}
                      title="Send a taste"
                    >
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M14 4h6v6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M10 14L20 4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M20 13v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>Share</span>
                    </button>
                  </div>
                </div>

                <section className="mx-auto w-full max-w-[720px]">
                  {chapters.length > 0 ? (
                    <div className="mt-6 space-y-10 text-base leading-8 text-text-primary">
                      {chapters.map((chapter) => (
                        <section key={chapter.id} className="space-y-4">
                          <h2 className="text-xl font-semibold text-text-primary">
                            {chapter.title || `Chapter ${chapter.orderIndex}`}
                          </h2>
                          {chapter.content
                            .split("\n\n")
                            .map((paragraph, index) => (
                              <p
                                key={`${chapter.id}-p-${index}`}
                                className="whitespace-pre-wrap"
                              >
                                {paragraph}
                              </p>
                            ))}
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-6 space-y-3">
                      <p className="text-sm text-text-muted">
                        This story isn't ready yet.
                      </p>
                      <p className="text-sm text-text-muted">
                        Ask the host to upload the content.
                      </p>
                      {shouldShowAttachment && (
                        <button
                          type="button"
                          className="btn-secondary px-3 py-2 text-xs"
                          onClick={() =>
                            window.open(novel.attachmentUrl ?? "", "_blank")
                          }
                        >
                          Open attachment
                        </button>
                      )}
                    </div>
                  )}
                  {lockedChapters.length > 0 && (
                    <div className="mt-10 rounded-2xl border border-border-default bg-surface p-5 text-sm text-text-secondary">
                      <p className="whitespace-pre-line text-sm text-text-primary">
                        This is only the beginning.
                        {"\n"}Unlock the rest of the story to find out what happens next.
                      </p>
                      {novel.pricingMode === "BOOK" ? (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs text-text-muted">
                            {novel.bookPromoPrice ?? novel.bookPrice}{" "}
                            {novel.currency ?? "USD"}
                          </p>
                          <p className="text-[11px] text-text-muted">
                            Taxes will be calculated at checkout.
                          </p>
                          <button
                            type="button"
                            className="btn-primary mt-2 px-4 py-2 text-xs"
                            onClick={startCheckout}
                          >
                            Unlock more
                          </button>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-2 text-xs">
                          {lockedChapters.map((chapter) => (
                            <div
                              key={chapter.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-default bg-card px-3 py-2"
                            >
                              <span>
                                Chapter {chapter.orderIndex} · {chapter.title}
                              </span>
                              <button
                                type="button"
                                className="rounded-full border border-border-default px-3 py-1 text-[11px]"
                                onClick={startCheckout}
                              >
                                Unlock more
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

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
            className={`flex flex-col items-center gap-1 px-3 py-2 transition ${
              novel?.myReaction === "LIKE"
                ? "text-brand-primary"
                : "text-text-muted"
            }`}
            onClick={() => handleReaction("LIKE")}
            disabled={reactionLoading}
            title="More like this"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M12 20.5c-5.05-3.62-8.5-6.7-8.5-10.6 0-2.3 1.74-4.1 4.06-4.1 1.62 0 3.18.9 4.44 2.38 1.26-1.48 2.82-2.38 4.44-2.38 2.32 0 4.06 1.8 4.06 4.1 0 3.9-3.45 6.98-8.5 10.6z"
                fill={novel?.myReaction === "LIKE" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.4"
              />
            </svg>
            <span className="text-[10px] font-semibold text-text-secondary">
              {likeCount}
            </span>
          </button>
          <button
            type="button"
            className={`flex flex-col items-center gap-1 px-3 py-2 transition ${
              novel?.myReaction === "DISLIKE"
                ? "text-text-primary"
                : "text-text-muted"
            }`}
            onClick={() => handleReaction("DISLIKE")}
            disabled={reactionLoading}
            title="Show me less"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M14 10V4a2 2 0 0 0-2-2l-1 5-4 4v7h7a2 2 0 0 0 2-2v-4.5l2.5-.5c.8-.2 1.5-.9 1.5-1.8V9h-6Z"
                fill={novel?.myReaction === "DISLIKE" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M3 10h3v8H3z"
                fill={novel?.myReaction === "DISLIKE" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.4"
              />
            </svg>
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-1 px-3 py-2 text-text-muted transition hover:text-text-primary"
            onClick={handleShare}
            title="Send a taste"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M14 4h6v6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10 14L20 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M20 13v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </main>
  );
}
