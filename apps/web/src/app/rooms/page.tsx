"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import PageShell from "../components/PageShell";
import { emitHostStatus } from "../lib/hostStatus";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

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

type NovelItem = {
  id: string;
  title: string;
  coverImageUrl: string | null;
  description: string | null;
};

export default function RoomsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("");
  const [novels, setNovels] = useState<NovelItem[]>([]);

  const authHeader = useMemo(() => {
    if (!token) {
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const loadRooms = async (
    nextCursor?: string | null,
    overrides?: { status?: string; tags?: string; search?: string }
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextCursor) {
        params.set("cursor", nextCursor);
      }
      const statusValue = overrides?.status ?? filterStatus;
      const tagsValue = overrides?.tags ?? filterTags;
      const searchValue = overrides?.search ?? filterQuery;
      if (statusValue !== "all") {
        params.set("status", statusValue.toUpperCase());
      }
      if (tagsValue.trim()) {
        params.set("tags", tagsValue);
      }
      if (searchValue?.trim()) {
        params.set("search", searchValue.trim());
      }
      const query = params.toString();
      const res = await fetch(
        `${API_BASE}/rooms${query ? `?${query}` : ""}`
      );
      if (!res.ok) {
        throw new Error("Rooms unavailable.");
      }
      const data = (await res.json()) as RoomsResponse;
      setRooms((prev) => (nextCursor ? [...prev, ...data.items] : data.items));
      setCursor(data.nextCursor);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load.";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setToken(localStorage.getItem("accessToken"));
    loadRooms(null).catch(() => setStatus("Failed to load."));
  }, []);

  useEffect(() => {
    const loadNovels = async () => {
      const res = await fetch(`${API_BASE}/novels?featured=true&limit=3`);
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as NovelItem[];
      setNovels(data);
    };
    loadNovels().catch(() => undefined);
  }, []);

  useEffect(() => {
    emitHostStatus({ page: "rooms", cold: rooms.length === 0 });
  }, [rooms]);

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
    if (!authHeader) {
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
        capacity: capacityValue
      };
      const res = await fetch(`${API_BASE}/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      const created = (await res.json()) as { id?: string };
      resetForm();
      setShowCreate(false);
      if (created?.id) {
        await fetch(`${API_BASE}/rooms/${created.id}/join`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader
          },
          body: JSON.stringify({})
        }).catch(() => undefined);
        window.dispatchEvent(new Event("active-room-changed"));
        router.push(`/rooms/${created.id}`);
        return;
      }
      window.dispatchEvent(new Event("active-room-changed"));
      await loadRooms(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create.";
      setFormStatus(message);
    } finally {
      setCreating(false);
    }
  };

  const stageContent = (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-text-primary">Ongoing Gatherings</h1>
        <p className="text-sm text-text-secondary">
          <span className="block">Each room carries its own tone.</span>
          <span className="block">Read the theme before stepping in.</span>
        </p>
        {status && <p className="text-sm text-text-secondary">{status}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {rooms.map((room) => {
          if (room.novel) {
            return (
              <Link
                key={room.id}
                href={`/rooms/${room.id}`}
                className="group ui-surface flex flex-col gap-3 p-4 transition hover:border-brand-primary/40"
              >
                <div className="flex items-center justify-between">
                  <span className="badge-premium text-[9px] uppercase tracking-[0.2em]">
                    Story room
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {room.memberCount} discussing
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-20 w-14 overflow-hidden rounded-lg border border-border-default bg-card">
                    {room.novel.coverImageUrl ? (
                      <img
                        src={resolveMediaUrl(room.novel.coverImageUrl) ?? ""}
                        alt={room.novel.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[9px] text-text-muted">
                        No cover
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-sm font-semibold text-text-primary line-clamp-1">
                      {room.novel.title}
                    </h2>
                    <p className="mt-1 text-xs text-text-secondary line-clamp-2">
                      {room.description ?? "Join the official story discussion."}
                    </p>
                  </div>
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={room.id}
              href={`/rooms/${room.id}`}
              className="group ui-card flex flex-col gap-3 p-5 transition hover:border-brand-primary/40"
            >
              <div className="relative z-10">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-bold text-text-primary leading-tight flex-1">
                    {room.title}
                  </h2>
                  {room.status === "LIVE" && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-brand-primary/40 blur-sm animate-pulse" />
                        <div className="relative w-2 h-2 rounded-full bg-brand-primary" />
                      </div>
                      <span className="rounded-full border border-border-default bg-surface px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-text-secondary shadow-sm">
                        LIVE
                      </span>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-sm text-text-secondary leading-snug line-clamp-1">
                  {room.description ?? "-"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-text-muted">
                  <span className="font-medium">
                    {room.memberCount}
                    {room.capacity ? `/${room.capacity}` : ""} guests
                  </span>
                  {room.capacity !== null && room.memberCount >= room.capacity ? (
                    <span className="rounded-full border border-border-default bg-surface px-2 py-0.5 text-[9px] font-medium text-text-secondary">
                      Full
                    </span>
                  ) : room.status === "LIVE" ? (
                    <span className="rounded-full border border-border-default bg-surface px-2 py-0.5 text-[9px] font-medium text-text-secondary">
                      Open
                    </span>
                  ) : (
                    <span className="rounded-full border border-border-default bg-surface px-2 py-0.5 text-[9px] font-medium text-text-secondary">
                      Waiting
                    </span>
                  )}
                </div>
                <div className="mt-4 flex items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                  <span className="rounded-full border border-border-default bg-surface px-3 py-1.5 text-[10px] font-semibold text-text-secondary shadow-sm">
                    Enter
                  </span>
                  {room.status === "LIVE" && (
                    <span className="rounded-full border border-border-default bg-surface px-3 py-1.5 text-[10px] font-medium text-text-muted">
                      Peek
                    </span>
                  )}
                </div>
                {(room.status === "LIVE" && room.endsAt) ||
                (room.startsAt && room.status !== "LIVE") ? (
                  <p className="mt-2 text-[9px] text-text-muted">
                    {room.status === "LIVE" && room.endsAt
                      ? `Until ${new Date(room.endsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : room.startsAt
                      ? `Starts ${new Date(room.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : ""}
                  </p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>

      {rooms.length === 0 && (
        <p className="text-sm text-text-muted">No rooms yet.</p>
      )}

      {cursor && (
        <button
          type="button"
          className="btn-secondary px-4 py-2 text-xs"
          onClick={() => loadRooms(cursor)}
          disabled={loading}
        >
          {loading ? "Loading..." : "Load more"}
        </button>
      )}

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

  const panelContent = (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Filters
        </h3>
        <div className="space-y-3">
          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
            className="w-full rounded-full border border-border-default bg-card px-4 py-2 text-xs text-text-secondary"
          >
            <option value="all">All statuses</option>
            <option value="live">Live</option>
            <option value="scheduled">Scheduled</option>
            <option value="ended">Ended</option>
          </select>
          <input
            className="w-full rounded-full border border-border-default bg-card px-4 py-2 text-xs text-text-secondary"
            placeholder="Search title or description"
            value={filterQuery}
            onChange={(event) => setFilterQuery(event.target.value)}
          />
          <input
            className="w-full rounded-full border border-border-default bg-card px-4 py-2 text-xs text-text-secondary"
            placeholder="Tags (comma-separated)"
            value={filterTags}
            onChange={(event) => setFilterTags(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary px-4 py-2 text-xs"
            onClick={handleApplyFilters}
            disabled={loading}
          >
            {loading ? "Loading..." : "Apply filters"}
          </button>
          <button
            type="button"
            className="btn-secondary px-4 py-2 text-xs"
            onClick={handleClearFilters}
            disabled={loading}
          >
            Clear
          </button>
        </div>
      </div>
      {novels.length > 0 && (
        <div className="border-t border-border-default pt-4">
          <p className="text-xs uppercase tracking-[0.3em] text-text-muted">
            Featured novels
          </p>
          <div className="mt-3 space-y-3">
            {novels.map((novel) => (
              <div
                key={novel.id}
                className="ui-card p-3 text-xs text-text-secondary"
              >
                <p className="font-semibold">{novel.title}</p>
                {novel.description && (
                  <p className="mt-1 text-[11px] text-text-muted line-clamp-2">
                    {novel.description}
                  </p>
                )}
                <Link
                  href="/hall"
                  className="mt-2 inline-flex text-[11px] font-semibold text-brand-primary"
                >
                  View in Hall 鈫?                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="border-t border-border-default pt-4">
        <p className="text-xs uppercase tracking-[0.3em] text-text-muted">
          Actions
        </p>
        <button
          type="button"
          className="btn-primary mt-3 w-full px-4 py-2 text-xs"
          onClick={() => setShowCreate(true)}
        >
          Create Room
        </button>
      </div>
    </div>
  );

  return <PageShell stage={stageContent} panel={panelContent} />;
}


