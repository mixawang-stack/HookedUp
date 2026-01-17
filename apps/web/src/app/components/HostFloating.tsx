"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import {
  HOST_STATUS_EVENT,
  HostPageType,
  HostStatusDetail
} from "../lib/hostStatus";

const STORAGE_KEY = "host_pos";
const HOST_MARGIN = 16;
// Keep the floating host below the top nav/header.
const HOST_TOP_GUARD = 140;

type Position = { x: number; y: number };

const DEFAULT_POS: Position = { x: 32, y: 32 };

const menuItems = [
  {
    label: "Mute 10min",
    action: () => localStorage.setItem("host_menu", "mute")
  },
  {
    label: "Hide 1h",
    action: () => localStorage.setItem("host_menu", "hide")
  },
  {
    label: "Reset position",
    action: () => {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
];

const PAGE_PROMPTS: Record<HostPageType, string[]> = {
  hall: [
    "The hall feels wide — maybe drop a trace?",
    "I hear footsteps echoing somewhere in the hall.",
    "A question in the hall might wake a new face."
  ],
  rooms: [
    "Rooms are ready; one of them might need a spark.",
    "Let the rooms know you're curious.",
    "The rooms hum quietly, waiting for a story."
  ],
  room: [
    "This room is still collecting energy.",
    "A single message can shift the mood inside.",
    "Your voice could make this room feel alive."
  ],
  private: [
    "Private corners stay calm until you lean in.",
    "A quiet private thread could use a hello.",
    "These private waves are waiting for you."
  ],
  other: [
    "I'm floating if you ever need a reminder.",
    "The castle keeps shining, even when it feels quiet.",
    "Let me know when the tone switches."
  ]
};

const COLD_PROMPTS: Partial<Record<HostPageType, string[]>> = {
  hall: [
    "No traces yet — maybe add a thought for others.",
    "The hall is empty right now. Drop a surprise anyway?"
  ],
  private: [
    "Nothing private yet; the next hello could change that.",
    "It is calm here — perhaps start a new thread?"
  ],
  room: [
    "No messages inside yet. You could be first.",
    "The room is waiting for someone to stir the vibe."
  ]
};

const determinePageType = (pathname: string): HostPageType => {
  if (pathname.startsWith("/hall")) {
    return "hall";
  }
  if (pathname.startsWith("/rooms/") && pathname.split("/").length >= 3) {
    return "room";
  }
  if (pathname.startsWith("/rooms")) {
    return "rooms";
  }
  if (pathname.startsWith("/private")) {
    return "private";
  }
  return "other";
};

const pickRandom = (items: string[]) =>
  items[Math.floor(Math.random() * items.length)];

const isTypingElement = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    target.isContentEditable
  );
};

export default function HostFloating() {
  const pathname = usePathname() ?? "";
  const [position, setPosition] = useState<Position>(DEFAULT_POS);
  const [isDragging, setIsDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPageRef = useRef<HostPageType>("other");
  const lastUserMoveRef = useRef<number>(0);

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

  const clearBubbleTimer = useCallback(() => {
    if (bubbleTimerRef.current) {
      clearTimeout(bubbleTimerRef.current);
      bubbleTimerRef.current = null;
    }
  }, []);

  const showBubble = useCallback((text: string) => {
    if (!text) {
      return;
    }
    setBubble(text);
    clearBubbleTimer();
    const duration = 4000 + Math.random() * 2000;
    bubbleTimerRef.current = setTimeout(() => {
      setBubble(null);
      bubbleTimerRef.current = null;
    }, duration);
  }, [clearBubbleTimer]);

  useEffect(() => {
    return () => {
      clearBubbleTimer();
    };
  }, [clearBubbleTimer]);

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
    setMenuOpen(false);
    lastUserMoveRef.current = Date.now();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { ...position };

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
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

  const handleMenuToggle = () => setMenuOpen((prev) => !prev);

  const handleMenuSelect = () => setMenuOpen(false);

  useEffect(() => {
    const pageType = determinePageType(pathname);
    if (lastPageRef.current === pageType) {
      return;
    }
    lastPageRef.current = pageType;
    if (inputFocused) {
      return;
    }
    if (Math.random() < 0.3) {
      const pool = PAGE_PROMPTS[pageType] ?? PAGE_PROMPTS.other;
      showBubble(pickRandom(pool));
    }
  }, [pathname, inputFocused, showBubble]);

  useEffect(() => {
    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<HostStatusDetail>).detail;
      if (!detail?.cold) {
        return;
      }
      if (inputFocused) {
        return;
      }
      if (Math.random() >= 0.6) {
        return;
      }
      const pool =
        COLD_PROMPTS[detail.page]?.length
          ? COLD_PROMPTS[detail.page]!
          : PAGE_PROMPTS[detail.page] ?? PAGE_PROMPTS.other;
      showBubble(pickRandom(pool));
    };
    window.addEventListener(HOST_STATUS_EVENT, handleStatus as EventListener);
    return () => {
      window.removeEventListener(
        HOST_STATUS_EVENT,
        handleStatus as EventListener
      );
    };
  }, [inputFocused, showBubble]);

  useEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      if (isTypingElement(event.target)) {
        setInputFocused(true);
      }
    };
    const handleFocusOut = (event: FocusEvent) => {
      if (isTypingElement(event.relatedTarget)) {
        return;
      }
      setInputFocused(false);
    };
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

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
      if (isDragging || menuOpen) {
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
  }, [isDragging, menuOpen, position, updatePosition]);

  return (
    <div
      ref={hostRef}
      className={`fixed z-40 flex flex-col items-end gap-2 rounded-full ${
        isDragging ? "" : "transition-[right,bottom] duration-700 ease-out"
      }`}
      style={{ right: position.x, bottom: position.y, touchAction: "none" }}
    >
      {bubble && (
        <div
          className="pointer-events-none max-w-xs rounded-2xl border border-white/20 bg-slate-900/90 px-3 py-2 text-xs text-white shadow-lg backdrop-blur"
          aria-live="polite"
        >
          {bubble}
        </div>
      )}
      <div
        className="flex cursor-grab items-center justify-center rounded-full border border-white/30 bg-white/5 p-2 shadow-[0_0_25px_rgba(244,114,182,0.35)] transition hover:bg-white/10"
        onPointerDown={onPointerDown}
        onClick={handleMenuToggle}
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
      </div>
      {menuOpen && (
        <div className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white shadow-lg backdrop-blur">
          {menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className="block w-full px-2 py-1 text-left text-xs hover:text-sky-300"
              onClick={() => {
                item.action();
                handleMenuSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
