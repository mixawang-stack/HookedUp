"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type MyTraceItem = {
  id: string;
  content: string;
  createdAt: string;
  imageUrl?: string | null;
  replyCount: number;
};

export default function MyPostsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [traces, setTraces] = useState<MyTraceItem[]>([]);
  const [traceCursor, setTraceCursor] = useState<string | null>(null);
  const [loadingTraces, setLoadingTraces] = useState(false);
  const [traceStatus, setTraceStatus] = useState<string | null>(null);
  const [deletingTraceId, setDeletingTraceId] = useState<string | null>(null);
  const [editingTraceId, setEditingTraceId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  const authHeader = useMemo(() => {
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  useEffect(() => {
    const stored = localStorage.getItem("accessToken");
    if (!stored) {
      router.push("/login?redirect=/me/posts");
      return;
    }
    setToken(stored);
  }, [router]);

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

  const handleDeleteTrace = async (traceId: string) => {
    if (!authHeader) {
      setTraceStatus("Please sign in again.");
      return;
    }
    const confirmed = window.confirm("Delete this post? This cannot be undone.");
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
        error instanceof Error ? error.message : "Failed to delete post.";
      setTraceStatus(message);
    } finally {
      setDeletingTraceId(null);
    }
  };

  const startEdit = (trace: MyTraceItem) => {
    setEditingTraceId(trace.id);
    setEditingContent(trace.content);
  };

  const handleUpdateTrace = async (traceId: string) => {
    if (!authHeader) {
      setTraceStatus("Please sign in again.");
      return;
    }
    const nextContent = editingContent.trim();
    if (!nextContent) {
      setTraceStatus("Content cannot be empty.");
      return;
    }
    setTraceStatus(null);
    try {
      const res = await fetch(`${API_BASE}/traces/${traceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({ content: nextContent })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      const updated = (await res.json()) as { id: string; content: string };
      setTraces((prev) =>
        prev.map((item) =>
          item.id === updated.id ? { ...item, content: updated.content } : item
        )
      );
      setEditingTraceId(null);
      setEditingContent("");
      setTraceStatus("Post updated.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update post.";
      setTraceStatus(message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 text-slate-100">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200"
          onClick={() => router.back()}
        >
          Back
        </button>
        <div>
          <h1 className="text-2xl font-semibold">Posts management</h1>
          <p className="mt-1 text-sm text-slate-400">
            Review, edit, and remove your Hall posts.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-slate-950/80 p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Your posts
          </p>
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

                {editingTraceId === trace.id ? (
                  <div className="mt-3 space-y-3">
                    <textarea
                      className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                      rows={3}
                      value={editingContent}
                      onChange={(event) => setEditingContent(event.target.value)}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200"
                        onClick={() => {
                          setEditingTraceId(null);
                          setEditingContent("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="rounded-full bg-white px-4 py-1 text-xs font-semibold text-slate-900"
                        onClick={() => handleUpdateTrace(trace.id)}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-100">{trace.content}</p>
                )}

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200"
                    onClick={() => startEdit(trace)}
                  >
                    Edit
                  </button>
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
