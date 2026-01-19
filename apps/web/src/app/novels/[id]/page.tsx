"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type NovelPreview = {
  id: string;
  title: string;
  coverImageUrl: string | null;
  description: string | null;
  tagsJson?: string[] | null;
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
  const [novel, setNovel] = useState<NovelPreview | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!novelId) return;
    const load = async () => {
      setStatus(null);
      const res = await fetch(`${API_BASE}/novels/${novelId}/full`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(body?.message ?? "Failed to load novel.");
        return;
      }
      setNovel(body as NovelPreview);
    };
    load().catch(() => setStatus("Failed to load novel."));
  }, [novelId]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 text-slate-100">
      <button
        type="button"
        className="text-xs text-slate-400 hover:text-white"
        onClick={() => router.push("/hall")}
      >
        ← Back to Hall
      </button>
      {status && <p className="mt-4 text-sm text-rose-400">{status}</p>}
      {novel && (
        <div className="mt-6 space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold">{novel.title}</h1>
            {novel.description && (
              <p className="text-sm text-slate-400">{novel.description}</p>
            )}
          </header>
          {novel.coverImageUrl && (
            <img
              src={resolveMediaUrl(novel.coverImageUrl) ?? ""}
              alt={novel.title}
              className="w-full rounded-2xl object-cover"
            />
          )}
          <div className="space-y-4">
            {novel.chapters.length === 0 && (
              <p className="text-sm text-slate-400">
                No chapters are available yet. Ask the admin to import the PDF.
              </p>
            )}
            {novel.chapters.map((chapter) => (
              <section
                key={chapter.id}
                className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Chapter {chapter.orderIndex}: {chapter.title}
                  </span>
                  <span>{chapter.isFree ? "Free" : "Locked"}</span>
                </div>
                <p className="mt-3 text-sm text-slate-100 whitespace-pre-wrap">
                  {chapter.content}
                </p>
                {chapter.isLocked && (
                  <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                    Continue reading by purchasing or inviting a friend.
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
