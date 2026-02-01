"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../../lib/supabaseClient";

type NovelPreview = {
  id: string;
  title: string;
  coverImageUrl: string | null;
  description: string | null;
  locked?: boolean;
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
  paymentLink?: string | null;
  room?: { id: string; title: string } | null;
  chapters: Array<{
    id: string;
    title: string;
    orderIndex: number;
    isFree: boolean;
    isPublished: boolean;
    content: string;
    price?: string | number | null;
  }>;
};

export default function NovelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const novelId = typeof params?.id === "string" ? params.id : "";
  const [novel, setNovel] = useState<NovelPreview | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [reactionLoading, setReactionLoading] = useState(false);
  const [myReaction, setMyReaction] = useState<"LIKE" | "DISLIKE" | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [dislikeCount, setDislikeCount] = useState(0);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const isSignedIn = Boolean(userId);

  useEffect(() => {
    const loadUser = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    };
    loadUser().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!novelId) return;
    const load = async () => {
      setStatus(null);
      const supabase = getSupabaseClient();
      if (!supabase) {
        setStatus("Supabase is not configured.");
        return;
      }
      const { data, error } = await supabase
        .from("Novel")
        .select(
          `
          id,
          title,
          coverImageUrl,
          description,
          contentSourceType,
          attachmentUrl,
          wordCount,
          chapterCount,
          pricingMode,
          bookPrice,
          bookPromoPrice,
          currency,
          paymentLink,
          room:Room(id,title),
          chapters:NovelChapter(
            id,
            title,
            orderIndex,
            isFree,
            isPublished,
            content,
            price
          )
        `
        )
        .eq("id", novelId)
        .single();
      if (error || !data) {
        setStatus("Failed to load novel.");
        return;
      }
      const normalized = {
        ...data,
        room: data.room?.[0] ?? null
      } as NovelPreview;
      setNovel(normalized);
    };
    load().catch(() => setStatus("Failed to load novel."));
  }, [novelId]);

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

  const chapters = useMemo(() => {
    const all = novel?.chapters ?? [];
    return all.filter((chapter) => chapter.isPublished);
  }, [novel]);
  const freeChapters = useMemo(
    () => chapters.filter((chapter) => chapter.isFree),
    [chapters]
  );
  const lockedChapters = useMemo(
    () => chapters.filter((chapter) => !chapter.isFree),
    [chapters]
  );
  const chaptersToRender =
    lockedChapters.length > 0 && !isUnlocked ? freeChapters : chapters;
  const shouldShowAttachment =
    novel?.contentSourceType === "PDF" && novel.attachmentUrl;
  const isLocked = lockedChapters.length > 0 && !isUnlocked;

  const refreshReactions = async (currentNovelId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const [{ count: likeTotal }, { count: dislikeTotal }] = await Promise.all([
      supabase
        .from("NovelReaction")
        .select("id", { count: "exact", head: true })
        .eq("novelId", currentNovelId)
        .eq("type", "LIKE"),
      supabase
        .from("NovelReaction")
        .select("id", { count: "exact", head: true })
        .eq("novelId", currentNovelId)
        .eq("type", "DISLIKE")
    ]);
    setLikeCount(likeTotal ?? 0);
    setDislikeCount(dislikeTotal ?? 0);
    if (!userId) {
      setMyReaction(null);
      return;
    }
    const { data } = await supabase
      .from("NovelReaction")
      .select("type")
      .eq("novelId", currentNovelId)
      .eq("userId", userId)
      .maybeSingle();
    setMyReaction((data?.type as "LIKE" | "DISLIKE") ?? null);
  };

  const refreshEntitlement = async (currentNovelId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase || !userId) {
      setIsUnlocked(false);
      return;
    }
    if (lockedChapters.length === 0) {
      setIsUnlocked(true);
      return;
    }
    const { data } = await supabase
      .from("Entitlement")
      .select("scope,chapterId")
      .eq("novelId", currentNovelId)
      .eq("userId", userId);
    const entitlements = data ?? [];
    const hasBook =
      entitlements.find((item) => item.scope === "BOOK" || item.scope === "FULL") !=
      null;
    if (hasBook) {
      setIsUnlocked(true);
      return;
    }
    const lockedIds = lockedChapters.map((chapter) => chapter.id);
    const unlockedChapterIds = new Set(
      entitlements
        .filter((item) => item.scope === "CHAPTER" && item.chapterId)
        .map((item) => item.chapterId)
    );
    const unlockedAll =
      lockedIds.length > 0 &&
      lockedIds.every((chapterId) => unlockedChapterIds.has(chapterId));
    setIsUnlocked(unlockedAll);
  };

  useEffect(() => {
    if (!novelId) return;
    refreshReactions(novelId).catch(() => undefined);
  }, [novelId, userId]);

  useEffect(() => {
    if (!novelId) return;
    refreshEntitlement(novelId).catch(() => undefined);
  }, [novelId, userId, lockedChapters.length]);

  const handleReaction = async (type: "LIKE" | "DISLIKE") => {
    if (!novelId) return;
    if (!userId) {
      router.push(
        `/login?redirect=${encodeURIComponent(`/novels/${novelId || ""}`)}`
      );
      return;
    }
    setReactionLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setStatus("Supabase is not configured.");
        return;
      }
      if (myReaction === type) {
        await supabase
          .from("NovelReaction")
          .delete()
          .eq("novelId", novelId)
          .eq("userId", userId);
        setMyReaction(null);
      } else {
        await supabase.from("NovelReaction").upsert(
          {
            novelId,
            userId,
            type
          },
          { onConflict: "novelId,userId" }
        );
        setMyReaction(type);
      }
      await refreshReactions(novelId);
    } catch {
      setStatus("Failed to react.");
    } finally {
      setReactionLoading(false);
    }
  };

  const startCheckout = async () => {
    if (!novelId || !novel) return;
    if (!userId) {
      router.push(
        `/login?redirect=${encodeURIComponent(`/novels/${novelId || ""}`)}`
      );
      return;
    }
    if (novel.paymentLink) {
      window.location.href = novel.paymentLink;
      return;
    }
    setUnlocking(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setStatus("Supabase is not configured.");
        return;
      }
      await supabase.from("Entitlement").upsert(
        {
          userId,
          novelId,
          scope: "BOOK"
        },
        { onConflict: "userId,novelId,scope" }
      );
      await supabase.from("NovelPurchase").insert({
        userId,
        novelId,
        pricingMode: novel.pricingMode ?? "BOOK",
        amount: novel.bookPromoPrice ?? novel.bookPrice ?? 0,
        currency: novel.currency ?? "USD"
      });
      await refreshEntitlement(novelId);
    } catch {
      setStatus("Failed to unlock.");
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
              {isLocked && (
                <div className="rounded-2xl border border-border-default bg-surface px-4 py-3 text-sm text-text-secondary">
                  <p className="text-text-primary">
                    Preview mode: only free samples are visible.
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {isSignedIn
                      ? "Unlock the rest of the story to keep reading."
                      : "Sign in to unlock the rest of the story."}
                  </p>
                </div>
              )}
            </section>

            <div className="relative">
              <div className="mx-auto flex max-w-5xl items-start gap-6">
                <div className="hidden shrink-0 lg:block">
                  <div className="sticky top-[140px] flex flex-col gap-3">
                    <button
                      type="button"
                      className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm transition hover:bg-surface ${
                        myReaction === "LIKE"
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
                          fill={myReaction === "LIKE" ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                      </svg>
                      <span>Like</span>
                      <span className="text-xs">{likeCount}</span>
                    </button>
                    <button
                      type="button"
                      className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm transition hover:bg-surface ${
                        myReaction === "DISLIKE"
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
                          fill={myReaction === "DISLIKE" ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M3 10h3v8H3z"
                          fill={myReaction === "DISLIKE" ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                      </svg>
                      <span>Not for me</span>
                      <span className="text-xs">{dislikeCount}</span>
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
                  {chaptersToRender.length > 0 ? (
                    <div className="mt-6 space-y-10 text-base leading-8 text-text-primary">
                      {chaptersToRender.map((chapter) => (
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
                            You can unlock the full book to keep reading.
                          </p>
                          <button
                            type="button"
                            className="btn-primary mt-2 px-4 py-2 text-xs"
                            onClick={startCheckout}
                            disabled={unlocking}
                          >
                            {unlocking ? "Unlocking..." : "Unlock more"}
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
                                disabled={unlocking}
                              >
                                {unlocking ? "Unlocking..." : "Unlock more"}
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
              myReaction === "LIKE" ? "text-brand-primary" : "text-text-muted"
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
                fill={myReaction === "LIKE" ? "currentColor" : "none"}
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
              myReaction === "DISLIKE" ? "text-text-primary" : "text-text-muted"
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
                fill={myReaction === "DISLIKE" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M3 10h3v8H3z"
                fill={myReaction === "DISLIKE" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.4"
              />
            </svg>
            <span className="text-[10px] font-semibold text-text-secondary">
              {dislikeCount}
            </span>
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
