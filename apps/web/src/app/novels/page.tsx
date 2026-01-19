"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type NovelItem = {
  id: string;
  title: string;
  coverImageUrl: string | null;
  description: string | null;
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

export default function StoriesPage() {
  const router = useRouter();
  const [novels, setNovels] = useState<NovelItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${API_BASE}/novels?limit=30`);
      if (!res.ok) {
        setStatus("Failed to load stories.");
        return;
      }
      const data = (await res.json()) as NovelItem[];
      setNovels(data);
    };
    load().catch(() => setStatus("Failed to load stories."));
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 text-slate-100">
      <button
        type="button"
        className="text-xs text-slate-400 hover:text-white"
        onClick={() => router.push("/hall")}
      >
        ← Back
      </button>
      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Stories</h1>
      </div>
      {status && <p className="mt-3 text-sm text-rose-400">{status}</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {novels.map((novel) => {
          const teaser = (novel.description ?? novel.title).split("\n")[0] ?? "";
          return (
            <div
              key={novel.id}
              className="rounded-2xl border border-amber-200/60 bg-amber-50/90 p-4 text-slate-900 shadow-[0_18px_40px_rgba(251,191,36,0.2)]"
            >
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => router.push(`/novels/${novel.id}`)}
              >
                <div className="overflow-hidden rounded-xl border border-amber-200/80 bg-slate-200">
                  {novel.coverImageUrl ? (
                    <img
                      src={resolveMediaUrl(novel.coverImageUrl) ?? ""}
                      alt={novel.title}
                      className="w-full aspect-[3/4] object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center text-xs text-slate-500">
                      No cover
                    </div>
                  )}
                </div>
                <p className="mt-3 text-sm font-semibold line-clamp-1">
                  {novel.title}
                </p>
                <p className="mt-1 text-xs text-slate-600 line-clamp-1">
                  {teaser}
                </p>
              </button>
              <button
                type="button"
                className="mt-3 w-full rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                onClick={() => router.push(`/novels/${novel.id}`)}
              >
                Read story
              </button>
            </div>
          );
        })}
        {novels.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-xs text-slate-400">
            No stories yet.
          </div>
        )}
      </div>
    </main>
  );
}
