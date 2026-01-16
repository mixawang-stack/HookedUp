"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type ActiveRoom = {
  id: string;
  title: string;
  memberCount: number;
};

export default function ActiveRoomPanel() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [room, setRoom] = useState<ActiveRoom | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const authHeader = useMemo(() => {
    if (!token) {
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const fetchActiveRoom = async () => {
    if (!authHeader) {
      setRoom(null);
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/rooms/my-active`, {
        headers: { ...authHeader }
      });
      if (!res.ok) {
        if (res.status === 401) {
          setRoom(null);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { room: ActiveRoom | null };
      setRoom(data.room ?? null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load room.";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setToken(localStorage.getItem("accessToken"));
  }, []);

  useEffect(() => {
    if (!authHeader) {
      return;
    }
    fetchActiveRoom().catch(() => undefined);
  }, [authHeader]);

  useEffect(() => {
    if (!authHeader) {
      return;
    }
    const interval = setInterval(() => {
      fetchActiveRoom().catch(() => undefined);
    }, 15000);
    return () => clearInterval(interval);
  }, [authHeader]);

  useEffect(() => {
    if (!authHeader) {
      return;
    }
    const handler = () => {
      fetchActiveRoom().catch(() => undefined);
    };
    window.addEventListener("active-room-changed", handler);
    return () => window.removeEventListener("active-room-changed", handler);
  }, [authHeader]);

  useEffect(() => {
    if (!token || !room?.id) {
      return;
    }

    const socket = io(API_BASE, { auth: { token } });
    socketRef.current = socket;
    socket.on("connect", () => {
      socket.emit("room:join", { roomId: room.id });
    });

    return () => {
      socket.emit("room:leave", { roomId: room.id });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [room?.id, token]);

  const handleLeave = async () => {
    if (!authHeader || !room || loading) {
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/rooms/${room.id}/leave`, {
        method: "POST",
        headers: { ...authHeader }
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      if (socketRef.current) {
        socketRef.current.emit("room:leave", { roomId: room.id });
        socketRef.current.disconnect();
        socketRef.current = null;
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
    <aside className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            In room
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {room.title}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Members: {room.memberCount}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
          onClick={handleOpen}
        >
          Open
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
          onClick={handleLeave}
          aria-label="Close room overlay"
        >
          Close
        </button>
      </div>
      {status && <p className="mt-2 text-xs text-rose-600">{status}</p>}
    </aside>
  );
}
