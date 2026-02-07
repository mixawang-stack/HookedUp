"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { emitHostStatus } from "../lib/hostStatus";
import { getSupabaseClient } from "../lib/supabaseClient";

const resolveMediaUrl = (value?: string | null) => {
  if (!value) return null;
  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    return value;
  }
  try {
    const parsed = new URL(value);
    return parsed.toString();
  } catch {
    return value;
  }
  return value;
};

type RoomItem = {
  id: string;
  title: string;
  description: string | null;
  tagsJson: string[] | null;
  status: "SCHEDULED" | "LIVE" | "ENDED";
  startsAt: string | null;
  endsAt: string | null;
  isOfficial: boolean;
  allowSpectators: boolean;
  capacity: number | null;
  memberCount: number;
  createdAt: string;
  createdBy?: {
    id: string;
    maskName: string | null;
    maskAvatarUrl: string | null;
  } | null;
  novel?: {
    id: string;
    title: string;
    coverImageUrl: string | null;
  } | null;
};

type RoomsResponse = {
  items: RoomItem[];
  nextCursor: string | null;
};


export default function RoomsPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [formStatus, setFormStatus] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTags, setFilterTags] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("");

  const loadRooms = async (
    nextCursor?: string | null,
    overrides?: { status?: string; tags?: string; search?: string }
  ) => {
    setLoading(true);
    try {
      const statusValue = overrides?.status ?? filterStatus;
      const tagsValue = overrides?.tags ?? filterTags;
      const searchValue = overrides?.search ?? filterQuery;
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Rooms unavailable.");
      }
      const { data, error } = await supabase
        .from("Room")
        .select(
          `
          id,
          title,
          description,
          tagsJson,
          status,
          startsAt,
          endsAt,
          isOfficial,
          allowSpectators,
          capacity,
          createdAt,
          novel:Novel(id,title,coverImageUrl),
          createdBy:User(id,maskName,maskAvatarUrl),
          memberships:RoomMembership(count)
        `
        )
        .order("createdAt", { ascending: false })
        .limit(50);
      if (error) {
        throw new Error("Rooms unavailable.");
      }

      let items =
        data?.map((room) => ({
          ...room,
          memberCount: room.memberships?.[0]?.count ?? 0,
          createdBy: room.createdBy?.[0] ?? null,
          novel: room.novel?.[0] ?? null
        })) ?? [];

      if (blockedIds.length > 0) {
        items = items.filter((room) => {
          const hostId = room.createdBy?.id ?? null;
          return hostId ? !blockedIds.includes(hostId) : true;
        });
      }

      if (items.length > 0) {
        const seenOfficialTitles = new Set<string>();
        items = items.filter((room) => {
          if (!room.isOfficial) return true;
          const key = room.title?.trim() ?? "";
          if (!key) return true;
          if (seenOfficialTitles.has(key)) return false;
          seenOfficialTitles.add(key);
          return true;
        });
      }

      if (statusValue !== "all") {
        items = items.filter(
          (room) => room.status === statusValue.toUpperCase()
        );
      }
      if (tagsValue.trim()) {
        const tag = tagsValue.trim().toLowerCase();
        items = items.filter((room) =>
          (room.tagsJson ?? []).some(
            (roomTag: string) => roomTag.toLowerCase() === tag
          )
        );
      }
      if (searchValue?.trim()) {
        const term = searchValue.trim().toLowerCase();
        items = items.filter(
          (room) =>
            room.title.toLowerCase().includes(term) ||
            (room.description ?? "").toLowerCase().includes(term)
        );
      }

      setRooms(items as RoomItem[]);
      setCursor(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load.";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data.user?.id ?? null);
    };
    loadUser().catch(() => undefined);
    loadRooms(null).catch(() => setStatus("Failed to load."));
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setBlockedIds([]);
      return;
    }
    const loadBlocks = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token ?? null;
      if (!accessToken) return;
      const res = await fetch("/api/blocks", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) return;
      const payload = (await res.json().catch(() => ({}))) as {
        blockedIds?: string[];
      };
      setBlockedIds(payload.blockedIds ?? []);
    };
    loadBlocks().catch(() => undefined);
  }, [currentUserId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleRefresh = () => {
      if (document.visibilityState && document.visibilityState !== "visible") {
        return;
      }
      loadRooms(null).catch(() => setStatus("Failed to load."));
    };
    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleRefresh);
    return () => {
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleRefresh);
    };
  }, [filterStatus, filterTags, filterQuery]);

  useEffect(() => {
    if (blockedIds.length === 0 && !currentUserId) {
      return;
    }
    loadRooms(null).catch(() => setStatus("Failed to load."));
  }, [blockedIds.join(","), currentUserId]);

  useEffect(() => {
    emitHostStatus({ page: "rooms", cold: rooms.length === 0 });
  }, [rooms]);

  useEffect(() => {
    if (!filterQuery.trim()) {
      return;
    }
    const debounce = setTimeout(() => {
      loadRooms(null, { search: filterQuery }).catch(() =>
        setStatus("Failed to load.")
      );
    }, 300);
    return () => clearTimeout(debounce);
  }, [filterQuery]);

  const handleApplyFilters = async () => {
    setStatus(null);
    await loadRooms(null);
  };

  const handleClearFilters = async () => {
    setFilterStatus("all");
    setFilterTags("");
    setFilterQuery("");
    setStatus(null);
    await loadRooms(null, { status: "all", tags: "", search: "" });
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCapacity("");
  };

  const handleCreateRoom = async () => {
    if (!currentUserId) {
      setFormStatus("Please sign in to create a room.");
      return;
    }
    if (!title.trim()) {
      setFormStatus("Please enter a room name.");
      return;
    }
    if (!capacity.trim()) {
      setFormStatus("Please set a room capacity (min 3).");
      return;
    }
    const capacityValue = Number(capacity);
    if (!Number.isFinite(capacityValue) || capacityValue < 3) {
      setFormStatus("Capacity must be at least 3.");
      return;
    }
    setCreating(true);
    setFormStatus(null);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        capacity: capacityValue,
        createdById: currentUserId,
        status: "LIVE",
        allowSpectators: true
      };
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase not configured.");
      }
      const { data, error } = await supabase
        .from("Room")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) {
        throw new Error("Failed to create.");
      }
      await supabase.from("RoomMembership").insert({
        roomId: data.id,
        userId: currentUserId,
        role: "OWNER",
        mode: "PARTICIPANT"
      });
      resetForm();
      setShowCreate(false);
      window.dispatchEvent(new Event("active-room-changed"));
      router.push(`/rooms/${data.id}`);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create.";
      setFormStatus(message);
    } finally {
      setCreating(false);
    }
  };

    return (
    <>
      <main className="ui-page">
        <div className="ui-container py-8">
          <section className="space-y-2">
            <h1 className="text-2xl font-semibold text-text-primary">
              Something is always happening somewhere.
            </h1>
            <p className="text-sm text-text-secondary">
              Jump in. Lurk. Leave anytime.
            </p>
            {status && <p className="text-sm text-text-secondary">{status}</p>}
          </section>

          <section className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  className="h-4 w-4"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
              </span>
              <input
                className="w-full rounded-full border border-border-default bg-card py-2.5 pl-11 pr-4 text-sm text-text-primary placeholder:text-text-muted"
                placeholder="Search rooms"
                value={filterQuery}
                onChange={(event) => setFilterQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleApplyFilters();
                  }
                }}
              />
            </div>
            <button
              type="button"
              className="btn-primary px-5 py-2.5 text-sm"
              onClick={() => setShowCreate(true)}
            >
              + Create Room
            </button>
          </section>

          <div className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
            <span className="h-2 w-2 rounded-full bg-brand-primary" />
            Live Now
          </div>

          <section className="mt-4 grid gap-4 md:grid-cols-2">
            {rooms.map((room) => {
              const createdBy = (room as { createdBy?: { name?: string; avatarUrl?: string; avatar?: string | null } }).createdBy;
              const hostName = createdBy?.name ?? "Unknown";
              const hostAvatar = createdBy?.avatarUrl ?? createdBy?.avatar ?? null;
              const rawMessageCount = (room as { messageCount?: number | string; messagesCount?: number | string; message_count?: number | string }).messageCount ?? (room as { messagesCount?: number | string }).messagesCount ?? (room as { message_count?: number | string }).message_count;
              const messageCount = Number.isFinite(Number(rawMessageCount)) ? Number(rawMessageCount) : null;
              const messageLabel = messageCount === null ? "-" : String(messageCount);
              const topicTag = room.tagsJson?.[0] ?? "Topic";
              const showTopicTag = !room.novel;
              const coverUrl = room.novel?.coverImageUrl;
              const timeText = room.status === "LIVE" && room.endsAt
                ? `Ends ${new Date(room.endsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : room.startsAt
                ? `Starts ${new Date(room.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "-";

              return (
                <Link
                  key={room.id}
                  href={`/rooms/${room.id}`}
                  className={`ui-card p-5 transition hover:border-brand-primary/40 ${
                    coverUrl ? "grid gap-4 md:grid-cols-[160px_1fr]" : "flex flex-col gap-3"
                  }`}
                >
                  {coverUrl && (
                    <div className="overflow-hidden rounded-2xl border border-border-default bg-surface">
                      <img
                        src={resolveMediaUrl(coverUrl) ?? ""}
                        alt={room.novel?.title ?? room.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {room.status === "LIVE" && (
                        <span className="ui-badge ui-badge-live">
                          <span className="mr-1 inline-flex h-1.5 w-1.5 rounded-full bg-brand-primary" />
                          Live
                        </span>
                      )}
                      {showTopicTag && (
                        <span className="ui-badge ui-badge-story">{topicTag}</span>
                      )}
                    </div>

                    <div>
                      <h2 className="text-lg font-semibold text-text-primary">
                        {room.title}
                      </h2>
                      <p className="mt-2 text-sm text-text-secondary line-clamp-2">
                        {room.description ?? "-"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-text-secondary">
                      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border-default bg-surface text-xs font-semibold">
                        {hostAvatar ? (
                          <img
                            src={resolveMediaUrl(hostAvatar) ?? hostAvatar}
                            alt={hostName}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <span>{hostName.slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <span>{hostName}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-text-muted">
                      <div className="flex items-center gap-4">
                        <span>{room.memberCount ?? 0} Members</span>
                        <span>{messageLabel} Messages</span>
                      </div>
                      <span>{timeText}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>

          {rooms.length === 0 && (
            <p className="mt-4 text-sm text-text-muted">
              <span>No active rooms right now.</span>
              <br />
              <span>That never lasts long.</span>
            </p>
          )}

          {cursor && (
            <button
              type="button"
              className="btn-secondary mt-4 px-4 py-2 text-xs"
              onClick={() => loadRooms(cursor)}
              disabled={loading}
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      </main>

      {showCreate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-text-primary/40 p-6">
          <section className="ui-surface w-full max-w-xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">Create Room</h2>
              <button
                type="button"
                className="text-xs text-text-muted"
                onClick={() => setShowCreate(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-2 text-sm text-text-secondary">
              Got a topic people should not talk about? Open a room and let us
              talk about it.
            </p>
            <div className="mt-4 grid gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary">
                  Room title
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-border-default bg-card px-3 py-2 text-sm text-text-primary"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary">
                  Room description
                </label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-border-default bg-card px-3 py-2 text-sm text-text-primary"
                  rows={3}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary">
                  Capacity (min 3)
                </label>
                <input
                  type="number"
                  min={3}
                  className="mt-1 w-full rounded-xl border border-border-default bg-card px-3 py-2 text-sm text-text-primary"
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                />
              </div>
            </div>
            {formStatus && (
              <p className="mt-3 text-sm text-text-secondary">{formStatus}</p>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn-secondary px-4 py-2 text-xs"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary px-4 py-2 text-xs"
                onClick={handleCreateRoom}
                disabled={creating}
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
