"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "host_pos";
const HOST_MARGIN = 16;
// Keep the floating host below the top nav/header.
const HOST_TOP_GUARD = 140;

type Position = { x: number; y: number };

const DEFAULT_POS: Position = { x: 32, y: 32 };

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export default function HostFloating() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [position, setPosition] = useState<Position>(DEFAULT_POS);
  const [isDragging, setIsDragging] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const lastUserMoveRef = useRef<number>(0);
  const dragMovedRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPosition(parsed);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    setToken(localStorage.getItem("accessToken"));
  }, []);

  useEffect(() => {
    if (!token) {
      setUnreadTotal(0);
      return;
    }
    const fetchUnread = async () => {
      const res = await fetch(`${API_BASE}/private/unread-total`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = (await res.json()) as { total?: number };
      setUnreadTotal(Number.isFinite(data.total) ? data.total! : 0);
    };
    fetchUnread().catch(() => undefined);
    const interval = window.setInterval(() => {
      fetchUnread().catch(() => undefined);
    }, 20000);
    return () => window.clearInterval(interval);
  }, [token]);

  const clampPosition = useCallback((pos: Position) => {
    if (typeof window === "undefined") {
      return pos;
    }
    const rect = hostRef.current?.getBoundingClientRect();
    const hostWidth = rect?.width ?? 64;
    const hostHeight = rect?.height ?? 64;
    const maxRight = Math.max(
      HOST_MARGIN,
      window.innerWidth - hostWidth - HOST_MARGIN
    );
    const maxBottom = Math.max(
      HOST_MARGIN,
      window.innerHeight - hostHeight - HOST_TOP_GUARD
    );
    return {
      x: Math.min(Math.max(pos.x, HOST_MARGIN), maxRight),
      y: Math.min(Math.max(pos.y, HOST_MARGIN), maxBottom)
    };
  }, []);

  const updatePosition = useCallback(
    (pos: Position) => {
      const clamped = clampPosition(pos);
      setPosition(clamped);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
    },
    [clampPosition]
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!hostRef.current) {
      return;
    }
    setIsDragging(true);
    dragMovedRef.current = false;
    lastUserMoveRef.current = Date.now();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { ...position };

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragMovedRef.current = true;
      }
      updatePosition({ x: origin.x + dx, y: origin.y + dy });
    };

    const onUp = () => {
      setIsDragging(false);
      lastUserMoveRef.current = Date.now();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleHostClick = () => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    router.push("/private");
  };


  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleResize = () => {
      updatePosition(position);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [position, updatePosition]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const interval = window.setInterval(() => {
      if (isDragging) {
        return;
      }
      if (Date.now() - lastUserMoveRef.current < 5000) {
        return;
      }
      const rect = hostRef.current?.getBoundingClientRect();
      const hostWidth = rect?.width ?? 64;
      const hostHeight = rect?.height ?? 64;
      const maxRight = Math.max(
        HOST_MARGIN,
        window.innerWidth - hostWidth - HOST_MARGIN
      );
      const maxBottom = Math.max(
        HOST_MARGIN,
        window.innerHeight - hostHeight - HOST_TOP_GUARD
      );
      const edge = Math.floor(Math.random() * 4);
      let x = position.x;
      let y = position.y;
      if (edge === 0) {
        // top edge
        y = maxBottom;
        x = Math.random() * maxRight;
      } else if (edge === 1) {
        // right edge
        x = HOST_MARGIN;
        y = Math.random() * maxBottom;
      } else if (edge === 2) {
        // bottom edge
        y = HOST_MARGIN;
        x = Math.random() * maxRight;
      } else {
        // left edge
        x = maxRight;
        y = Math.random() * maxBottom;
      }
      updatePosition({ x, y });
    }, 12000);
    return () => window.clearInterval(interval);
  }, [isDragging, position, updatePosition]);

  return (
    <div
      ref={hostRef}
      className={`fixed z-40 flex flex-col items-end gap-2 rounded-full ${
        isDragging ? "" : "transition-[right,bottom] duration-700 ease-out"
      }`}
      style={{ right: position.x, bottom: position.y, touchAction: "none" }}
    >
      <div
        className="flex cursor-grab items-center justify-center rounded-full border border-border-default bg-card p-2 shadow-lg transition hover:bg-surface"
        onPointerDown={onPointerDown}
        onClick={handleHostClick}
        title="Host"
        aria-label="Host"
      >
        <img
          src="/host-girl.svg"
          alt="Host"
          className={`h-16 w-16 rounded-full object-contain ${
            isDragging ? "" : "animate-host-float"
          }`}
          draggable={false}
        />
        {unreadTotal > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-primary px-1 text-[10px] font-semibold text-white">
            {unreadTotal > 99 ? "99+" : unreadTotal}
          </span>
        )}
      </div>
    </div>
  );
}
