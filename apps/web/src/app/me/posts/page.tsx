"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseClient } from "../../lib/supabaseClient";
import { useSupabaseSession } from "../../lib/useSupabaseSession";

export const dynamic = "force-dynamic";

type MyTraceItem = {
  id: string;
  content: string;
  createdAt: string;
  imageUrl?: string | null;
  replyCount: number;
};

const PAGE_SIZE = 20;

export default function MyPostsPage() {
  const router = useRouter();
  const { user, ready } = useSupabaseSession();
  const [traces, setTraces] = useState<MyTraceItem[]>([]);
  const [traceCursor, setTraceCursor] = useState<string | null>(null);
  const [loadingTraces, setLoadingTraces] = useState(false);
  const [traceStatus, setTraceStatus] = useState<string | null>(null);
  const [deletingTraceId, setDeletingTraceId] = useState<string | null>(null);
  const [editingTraceId, setEditingTraceId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [savingTraceId, setSavingTraceId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (!user) {
      router.push("/login?redirect=/me/posts");
    }
  }, [ready, router, user]);

  const loadMyTraces = async (nextCursor?: string | null) => {
    if (!user) {
      return;
    }
    setLoadingTraces(true);
    setTraceStatus(null);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }
      let query = supabase
        .from("Trace")
        .select("id,content,createdAt,imageUrl")
        .eq("authorId", user.id)
        .order("createdAt", { ascending: false })
        .limit(PAGE_SIZE);

      if (nextCursor) {
        query = query.lt("createdAt", nextCursor);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error("Failed to load posts.");
      }

      const traceIds = (data ?? []).map((trace) => trace.id);
      const { data: replies } = await supabase
        .from("TraceReply")
        .select("traceId")
        .in("traceId", traceIds.length > 0 ? traceIds : ["__none__"]);

      const replyCounts = new Map<string, number>();
      (replies ?? []).forEach((reply) => {
        replyCounts.set(reply.traceId, (replyCounts.get(reply.traceId) ?? 0) + 1);
      });

      const items: MyTraceItem[] =
        data?.map((trace) => ({
          id: trace.id,
          content: trace.content,
          createdAt: trace.createdAt,
          imageUrl: trace.imageUrl ?? null,
          replyCount: replyCounts.get(trace.id) ?? 0
        })) ?? [];

      setTraces((prev) => (nextCursor ? [...prev, ...items] : items));
      setTraceCursor(items.length === PAGE_SIZE ? items[items.length - 1].createdAt : null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load posts.";
      setTraceStatus(message);
    } finally {
      setLoadingTraces(false);
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    loadMyTraces(null).catch(() => undefined);
  }, [user]);

  const handleDeleteTrace = async (traceId: string) => {
    if (!user) {
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
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }
      const { error } = await supabase
        .from("Trace")
        .delete()
        .eq("id", traceId)
        .eq("authorId", user.id);
      if (error) {
        throw new Error("Failed to delete post.");
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
    if (!user) {
      setTraceStatus("Please sign in again.");
      return;
    }
    const nextContent = editingContent.trim();
    if (!nextContent) {
      setTraceStatus("Content cannot be empty.");
      return;
    }
    setTraceStatus(null);
    setSavingTraceId(traceId);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }
      const { data, error } = await supabase
        .from("Trace")
        .update({ content: nextContent })
        .eq("id", traceId)
        .eq("authorId", user.id)
        .select("id,content")
        .maybeSingle();
      if (error || !data) {
        throw new Error("Failed to update post.");
      }
      setTraces((prev) =>
        prev.map((item) =>
          item.id === data.id ? { ...item, content: data.content } : item
        )
      );
      setEditingTraceId(null);
      setEditingContent("");
      setTraceStatus("Post updated.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update post.";
      setTraceStatus(message);
    } finally {
      setSavingTraceId(null);
    }
  };

  return (
    <div className="ui-page mx-auto w-full max-w-4xl px-4 py-10 text-text-primary">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-secondary px-3 py-1 text-xs"
          onClick={() => router.back()}
        >
          Back
        </button>
        <div>
          <h1 className="text-2xl font-semibold">Posts management</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Review, edit, and remove your Forum posts.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4 ui-card p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.3em] text-text-muted">
            Your posts
          </p>
          <button
            type="button"
            className="btn-secondary px-3 py-1 text-xs"
            onClick={() => loadMyTraces(null)}
            disabled={loadingTraces}
          >
            {loadingTraces ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {traceStatus && (
          <p className="text-xs text-brand-secondary">{traceStatus}</p>
        )}

        {traces.length === 0 && !loadingTraces ? (
          <p className="text-sm text-text-secondary">
            You have not posted in the Forum yet.
          </p>
        ) : (
          <div className="space-y-3">
            {traces.map((trace) => (
              <div key={trace.id} className="ui-card p-4">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>{new Date(trace.createdAt).toLocaleString()}</span>
                  <span>{trace.replyCount} replies</span>
                </div>
                {trace.imageUrl && (
                  <div className="mt-3 overflow-hidden rounded-xl bg-surface">
                    <img
                      src={trace.imageUrl}
                      alt={trace.content.slice(0, 40)}
                      className="h-40 w-full object-cover"
                    />
                  </div>
                )}

                {editingTraceId === trace.id ? (
                  <div className="mt-3 space-y-3">
                    <textarea
                      className="w-full rounded-xl border border-border-default bg-card px-3 py-2 text-sm text-text-primary"
                      rows={3}
                      value={editingContent}
                      onChange={(event) => setEditingContent(event.target.value)}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="btn-secondary px-3 py-1 text-xs"
                        onClick={() => {
                          setEditingTraceId(null);
                          setEditingContent("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-primary px-4 py-1 text-xs"
                        onClick={() => handleUpdateTrace(trace.id)}
                        disabled={savingTraceId === trace.id}
                      >
                        {savingTraceId === trace.id ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-text-primary">
                    {trace.content}
                  </p>
                )}

                {editingTraceId !== trace.id && (
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="btn-secondary px-3 py-1 text-xs"
                      onClick={() => startEdit(trace)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-secondary px-3 py-1 text-xs text-brand-secondary"
                      onClick={() => handleDeleteTrace(trace.id)}
                      disabled={deletingTraceId === trace.id}
                    >
                      {deletingTraceId === trace.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {traceCursor && (
          <button
            type="button"
            className="btn-secondary px-4 py-2 text-xs"
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
