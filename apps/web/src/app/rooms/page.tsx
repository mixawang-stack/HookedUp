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
        <h1 className="text-2xl font-semibold text-white">Ongoing Gatherings</h1>
        <p className="text-sm text-slate-300">
          <span className="block">Each room carries its own tone.</span>
          <span className="block">Read the theme before stepping in.</span>
        </p>
        {status && <p className="text-sm text-rose-400">{status}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {rooms.map((room) => {
          if (room.novel) {
            return (
              <Link
                key={room.id}
                href={`/rooms/${room.id}`}
                className="group relative flex flex-col rounded-2xl border border-amber-200/70 bg-amber-50/90 p-4 shadow-[0_18px_40px_rgba(251,191,36,0.2)] transition hover:border-amber-300/80"
              >
                <span className="absolute left-3 top-3 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-900">
                  Story room
                </span>
                <div className="mt-5 flex items-start gap-3">
                  <div className="h-20 w-14 overflow-hidden rounded-lg border border-amber-200/80 bg-slate-200">
                    {room.novel.coverImageUrl ? (
                      <img
                        src={resolveMediaUrl(room.novel.coverImageUrl) ?? ""}
                        alt={room.novel.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-500">
                        No cover
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-sm font-semibold text-amber-900 line-clamp-1">
                      {room.novel.title}
                    </h2>
                    <p className="mt-1 text-xs text-amber-800/80 line-clamp-2">
                      {room.description ?? "Join the official story discussion."}
                    </p>
                    <p className="mt-2 text-[10px] text-amber-700/70">
                      {room.memberCount} discussing
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
              className="group relative flex flex-col rounded-lg border border-amber-200/40 bg-gradient-to-br from-amber-50 via-amber-50/95 to-amber-100/80 p-5 shadow-[0_2px_8px_rgba(180,83,9,0.15),0_0_0_1px_rgba(251,191,36,0.1)] transition-all duration-200 hover:border-amber-300/60 hover:shadow-[0_4px_16px_rgba(180,83,9,0.25),0_0_0_1px_rgba(251,191,36,0.2)] hover:scale-[1.02]"
            >
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-amber-100/20 via-transparent to-amber-50/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              <div className="relative z-10">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-bold text-amber-900 leading-tight flex-1">
                    {room.title}
                  </h2>
                  {room.status === "LIVE" && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-amber-400/40 blur-sm animate-pulse" />
                        <div className="relative w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                      </div>
                      <span className="rounded-full border border-amber-300/50 bg-amber-100/80 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-800 shadow-sm">
                        LIVE
                      </span>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-sm text-amber-800/90 leading-snug line-clamp-1">
                  {room.description ?? "-"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-amber-700/80">
                  <span className="font-medium">
                    {room.memberCount}
                    {room.capacity ? `/${room.capacity}` : ""} guests
                  </span>
                  {room.capacity !== null && room.memberCount >= room.capacity ? (
                    <span className="rounded-full border border-amber-300/60 bg-amber-50 px-2 py-0.5 text-[9px] font-medium text-amber-800">
                      Full
                    </span>
                  ) : room.status === "LIVE" ? (
                    <span className="rounded-full border border-amber-300/60 bg-amber-50 px-2 py-0.5 text-[9px] font-medium text-amber-800">
                      Open
                    </span>
                  ) : (
                    <span className="rounded-full border border-amber-300/60 bg-amber-50 px-2 py-0.5 text-[9px] font-medium text-amber-800">
                      Waiting
                    </span>
                  )}
                </div>
                <div className="mt-4 flex items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                  <span className="rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1.5 text-[10px] font-semibold text-amber-900 shadow-sm">
                    Enter
                  </span>
                  {room.status === "LIVE" && (
                    <span className="rounded-full border border-amber-300/40 bg-amber-50/60 px-3 py-1.5 text-[10px] font-medium text-amber-800/80">
                      Peek
                    </span>
                  )}
                </div>
                {(room.status === "LIVE" && room.endsAt) ||
                (room.startsAt && room.status !== "LIVE") ? (
                  <p className="mt-2 text-[9px] text-amber-700/60">
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
        <p className="text-sm text-slate-500">No rooms yet.</p>
      )}

      {cursor && (
        <button
          type="button"
          className="rounded-full border border-white/30 px-4 py-2 text-xs font-semibold text-white transition hover:border-white"
          onClick={() => loadRooms(cursor)}
          disabled={loading}
        >
          {loading ? "Loading..." : "Load more"}
        </button>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-6">
          <section className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-[0_35px_45px_rgba(15,23,42,0.8)] backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Create Room</h2>
              <button
                type="button"
                className="text-xs text-slate-300"
                onClick={() => setShowCreate(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Got a topic people should not talk about? Open a room and let us
              talk about it.
            </p>
            <div className="mt-4 grid gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Room title
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Room description
                </label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white"
                  rows={3}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Capacity (min 3)
                </label>
                <input
                  type="number"
                  min={3}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white"
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                />
              </div>
            </div>
            {formStatus && (
              <p className="mt-3 text-sm text-rose-400">{formStatus}</p>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-900"
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
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
          Filters
        </h3>
        <div className="space-y-3">
          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
            className="w-full rounded-full border border-white/20 bg-slate-950/60 px-4 py-2 text-xs text-slate-200"
          >
            <option value="all">All statuses</option>
            <option value="live">Live</option>
            <option value="scheduled">Scheduled</option>
            <option value="ended">Ended</option>
          </select>
          <input
            className="w-full rounded-full border border-white/20 bg-slate-950/60 px-4 py-2 text-xs text-slate-200"
            placeholder="Search title or description"
            value={filterQuery}
            onChange={(event) => setFilterQuery(event.target.value)}
          />
          <input
            className="w-full rounded-full border border-white/20 bg-slate-950/60 px-4 py-2 text-xs text-slate-200"
            placeholder="Tags (comma-separated)"
            value={filterTags}
            onChange={(event) => setFilterTags(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
            onClick={handleApplyFilters}
            disabled={loading}
          >
            {loading ? "Loading..." : "Apply filters"}
          </button>
          <button
            type="button"
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-slate-200"
            onClick={handleClearFilters}
            disabled={loading}
          >
            Clear
          </button>
        </div>
      </div>
      {novels.length > 0 && (
        <div className="border-t border-white/10 pt-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Featured novels
          </p>
          <div className="mt-3 space-y-3">
            {novels.map((novel) => (
              <div
                key={novel.id}
                className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-xs text-slate-200"
              >
                <p className="font-semibold">{novel.title}</p>
                {novel.description && (
                  <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                    {novel.description}
                  </p>
                )}
                <Link
                  href="/hall"
                  className="mt-2 inline-flex text-[11px] font-semibold text-sky-200"
                >
                  View in Hall →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="border-t border-white/10 pt-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Actions
        </p>
        <button
          type="button"
          className="mt-3 w-full rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-900"
          onClick={() => setShowCreate(true)}
        >
          Create Room
        </button>
      </div>
    </div>
  );

  return <PageShell stage={stageContent} panel={panelContent} />;
}
