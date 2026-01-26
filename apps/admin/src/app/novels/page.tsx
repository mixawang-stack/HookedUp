"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type NovelItem = {
  id: string;
  title: string;
  coverImageUrl: string | null;
  description: string | null;
  tagsJson?: string[] | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "SCHEDULED";
  audience: "ALL" | "MATURE";
  category: "DRAMA" | "AFTER_DARK";
  contentSourceType?: "DOC" | "DOCX" | "TXT" | "MD" | "PDF";
  chapterCount?: number;
  isFeatured: boolean;
  authorName: string | null;
  language: string | null;
  viewCount?: number;
  favoriteCount?: number;
  dislikeCount?: number;
  _count?: { chapters: number };
  room?: { id: string; _count: { memberships: number } } | null;
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

export default function AdminNovelsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [novels, setNovels] = useState<NovelItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const authHeader = useMemo(() => {
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  useEffect(() => {
    const stored = localStorage.getItem("accessToken");
    if (stored) setToken(stored);
  }, []);

  const loadNovels = async () => {
    if (!authHeader) return;
    setStatus(null);
    const res = await fetch(`${API_BASE}/admin/novels`, {
      headers: { ...authHeader }
    });
    if (!res.ok) {
      setStatus("Failed to load novels.");
      return;
    }
    const data = (await res.json()) as NovelItem[];
    setNovels(data);
  };

  const updateNovelStatus = async (id: string, nextStatus: "PUBLISHED" | "ARCHIVED") => {
    if (!authHeader) return;
    const res = await fetch(`${API_BASE}/admin/novels/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeader
      },
      body: JSON.stringify({ status: nextStatus })
    });
    if (!res.ok) {
      setStatus("Failed to update novel status.");
      return;
    }
    await loadNovels();
  };

  useEffect(() => {
    if (!authHeader) return;
    loadNovels().catch(() => undefined);
  }, [authHeader]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Novel library</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage operational status, visibility, and content flow.
          </p>
          <p className="mt-2 text-[11px] text-slate-500">API: {API_BASE}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200"
            onClick={() => loadNovels()}
          >
            Refresh
          </button>
          <Link
            href="/novels/new"
            className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
          >
            + Create Novel
          </Link>
        </div>
      </div>

      {status && <p className="mt-3 text-sm text-rose-400">{status}</p>}

      <div className="mt-8 grid gap-4">
        {novels.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-slate-500">
            No novels in the library yet. Start by creating one.
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {novels.map((novel) => (
            <div
              key={novel.id}
              className="group relative flex gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4 transition hover:bg-slate-900/60"
            >
              <div className="h-32 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-white/5 bg-slate-900">
                {novel.coverImageUrl ? (
                  <img
                    src={resolveMediaUrl(novel.coverImageUrl) ?? ""}
                    alt={novel.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-600 uppercase">
                    No Cover
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col justify-between py-1">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-100 line-clamp-1">
                        {novel.title}
                      </h3>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            novel.status === "PUBLISHED"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : novel.status === "DRAFT"
                              ? "bg-slate-500/20 text-slate-400"
                              : novel.status === "ARCHIVED"
                              ? "bg-rose-500/20 text-rose-400"
                              : "bg-amber-500/20 text-amber-400"
                          }`}
                        >
                          {novel.status === "ARCHIVED" ? "UNPUBLISHED" : novel.status}
                        </span>
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                          {novel.audience}
                        </span>
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                          {novel.category === "AFTER_DARK" ? "After Dark" : "Drama"}
                        </span>
                        {novel.isFeatured && (
                          <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-300">
                            Featured
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-400 line-clamp-2">
                    {novel.description || "No description provided."}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                    <span>
                      {novel.chapterCount ?? novel._count?.chapters ?? 0} Chapters
                    </span>
                    <span>-</span>
                    <span>Source {novel.contentSourceType ?? "Unknown"}</span>
                    <span>-</span>
                    <span>{novel.viewCount ?? 0} Reads</span>
                    <span>-</span>
                    <span>{novel.favoriteCount ?? 0} Likes</span>
                    <span>-</span>
                    <span>{novel.dislikeCount ?? 0} Dislikes</span>
                  </div>
                  <Link
                    href={`/novels/${novel.id}`}
                    className="rounded-full border border-white/20 px-3 py-1 text-[10px] text-slate-200 hover:bg-white/10"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    className="rounded-full border border-white/20 px-3 py-1 text-[10px] text-slate-200 hover:bg-white/10"
                    onClick={() =>
                      updateNovelStatus(
                        novel.id,
                        novel.status === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED"
                      )
                    }
                  >
                    {novel.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
