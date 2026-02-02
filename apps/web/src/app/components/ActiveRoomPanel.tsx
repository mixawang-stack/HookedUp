"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseClient } from "../lib/supabaseClient";
import { useSupabaseSession } from "../lib/useSupabaseSession";

type ActiveRoom = {
  id: string;
  title: string;
  memberCount: number;
};

export default function ActiveRoomPanel() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { user } = useSupabaseSession();
  const [room, setRoom] = useState<ActiveRoom | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchActiveRoom = async () => {
    if (!user) {
      setRoom(null);
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }
      const { data, error } = await supabase
        .from("RoomMembership")
        .select("room:Room(id,title,status,memberships:RoomMembership(count))")
        .eq("userId", user.id)
        .is("leftAt", null)
        .order("joinedAt", { ascending: false })
        .limit(1);
      if (error) {
        throw new Error("Failed to load room.");
      }
      const active = data?.[0]?.room?.[0];
      if (!active || active.status !== "LIVE") {
        setRoom(null);
        return;
      }
      const memberCount = active.memberships?.[0]?.count ?? 0;
      setRoom({ id: active.id, title: active.title, memberCount });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load room.";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    fetchActiveRoom().catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const interval = setInterval(() => {
      fetchActiveRoom().catch(() => undefined);
    }, 15000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const handler = () => {
      fetchActiveRoom().catch(() => undefined);
    };
    window.addEventListener("active-room-changed", handler);
    return () => window.removeEventListener("active-room-changed", handler);
  }, [user]);

  const handleLeave = async () => {
    if (!user || !room || loading) {
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }
      const { error } = await supabase
        .from("RoomMembership")
        .update({ leftAt: new Date().toISOString() })
        .eq("roomId", room.id)
        .eq("userId", user.id);
      if (error) {
        throw new Error("Failed to leave room.");
      }
      setRoom(null);
      window.dispatchEvent(new Event("active-room-changed"));
      if (pathname.startsWith(`/rooms/${room.id}`)) {
        router.push("/rooms");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to leave room.";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    if (!room) {
      return;
    }
    router.push(`/rooms/${room.id}`);
  };

  if (!room || pathname.startsWith("/rooms/")) {
    return null;
  }

  return (
    <aside className="fixed bottom-6 right-6 z-50 w-72 ui-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            In room
          </p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {room.title}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Members: {room.memberCount}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" className="btn-secondary" onClick={handleOpen}>
          Open
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={handleLeave}
          aria-label="Close room overlay"
        >
          Close
        </button>
      </div>
      {status && <p className="mt-2 text-xs text-brand-secondary">{status}</p>}
    </aside>
  );
}
