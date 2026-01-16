"use client";

import Link from "next/link";
import { io, Socket } from "socket.io-client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const DEFAULT_REASON = "safety";

type MatchItem = {
  id: string;
  matchedAt: string;
  user1: { id: string; maskName: string | null };
  user2: { id: string; maskName: string | null };
};

type MessageItem = {
  id: string;
  matchId: string;
  senderId: string;
  ciphertext: string;
  createdAt: string;
};

type PagedResponse<T> = {
  items: T[];
  nextCursor: string | null;
};

async function readPagedResponse<T>(res: Response): Promise<PagedResponse<T>> {
  const data = await res.json();
  if (Array.isArray(data)) {
    return { items: data as T[], nextCursor: null };
  }
  return data as PagedResponse<T>;
}

function ChatPageContent() {
  const searchParams = useSearchParams();
  const matchIdParam = searchParams.get("matchId");
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [activeMatch, setActiveMatch] = useState<MatchItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const authHeader = useMemo(() => {
    if (!token) {
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  useEffect(() => {
    const stored = localStorage.getItem("accessToken");
    if (stored) {
      setToken(stored);
    }
  }, []);

  useEffect(() => {
    if (!authHeader) {
      return;
    }

    fetch(`${API_BASE}/me`, { headers: { ...authHeader } })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Failed to load profile");
        }
        return res.json();
      })
      .then((data: { id: string }) => setUserId(data.id))
      .catch(() => setStatus("Failed to load profile."));
  }, [authHeader]);

  useEffect(() => {
    if (!authHeader) {
      return;
    }

    fetch(`${API_BASE}/match/list`, { headers: { ...authHeader } })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Failed to load links");
        }
        return readPagedResponse<MatchItem>(res);
      })
      .then((data) => setMatches(data.items))
      .catch(() => setStatus("Failed to load links."));
  }, [authHeader]);

  useEffect(() => {
    if (!matchIdParam || matches.length === 0) {
      return;
    }
    const match = matches.find((item) => item.id === matchIdParam);
    if (match) {
      joinMatch(match).catch(() => setStatus("Failed to load messages."));
    }
  }, [matchIdParam, matches]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = io(API_BASE, {
      auth: { token }
    });

    socket.on("connect_error", () => {
      setStatus("WebSocket connection failed.");
    });

    socket.on("message:new", (message: MessageItem) => {
      if (activeMatch && message.matchId === activeMatch.id) {
        setMessages((prev) => [...prev, message]);
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, activeMatch]);

  const joinMatch = async (match: MatchItem) => {
    setActiveMatch(match);
    setMessages([]);
    setCursor(null);

    if (!authHeader) {
      return;
    }

    const res = await fetch(`${API_BASE}/chat/${match.id}/messages`, {
      headers: { ...authHeader }
    });

    if (res.ok) {
      const data = await readPagedResponse<MessageItem>(res);
      setMessages(data.items.reverse());
      setCursor(data.nextCursor ?? null);
    }

    socketRef.current?.emit("match:join", { matchId: match.id });
  };

  const loadMore = async () => {
    if (!authHeader || !activeMatch || !cursor) {
      return;
    }

    const params = new URLSearchParams();
    params.set("cursor", cursor);
    const res = await fetch(
      `${API_BASE}/chat/${activeMatch.id}/messages?${params}`,
      { headers: { ...authHeader } }
    );

    if (!res.ok) {
      setStatus("Failed to load history.");
      return;
    }

    const data = await readPagedResponse<MessageItem>(res);
    setMessages((prev) => [...data.items.reverse(), ...prev]);
    setCursor(data.nextCursor ?? null);
  };

  const sendMessage = () => {
    if (!socketRef.current || !activeMatch || !input.trim()) {
      return;
    }

    socketRef.current.emit("message:send", {
      matchId: activeMatch.id,
      ciphertext: input.trim()
    });
    setInput("");
  };

  const report = async (targetType: "user" | "message", targetId: string) => {
    if (!authHeader) {
      return;
    }

    const detail = window.prompt("Report details?") ?? "";
    const res = await fetch(`${API_BASE}/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader
      },
      body: JSON.stringify({
        targetType,
        targetId,
        reasonType: DEFAULT_REASON,
        detail
      })
    });

    if (!res.ok) {
      setStatus("Failed to submit report.");
    } else {
      setStatus("Report submitted.");
    }
  };

  const activeOther = activeMatch
    ? activeMatch.user1.id === userId
      ? activeMatch.user2
      : activeMatch.user1
    : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl gap-6 p-6">
      <section className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Private</h1>
        <p className="mt-1 text-xs text-slate-500">
          Choose a private thread to start talking.
        </p>
        <div className="mt-4 space-y-2">
          {matches.map((match) => {
            const other = match.user1.id === userId ? match.user2 : match.user1;
            return (
              <button
                key={match.id}
                type="button"
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  activeMatch?.id === match.id
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-700"
                }`}
                onClick={() => joinMatch(match)}
              >
                {other.maskName ?? "Anonymous"}
              </button>
            );
          })}
          {matches.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">
              <p>No traces to start a private conversation yet.</p>
              <Link
                href="/hall"
                className="mt-2 inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
              >
                Hall
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="flex w-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {activeMatch ? "Conversation" : "Select a thread"}
            </h2>
            {status && <p className="text-xs text-slate-500">{status}</p>}
          </div>
          <div className="flex items-center gap-2">
            {cursor && (
              <button
                type="button"
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                onClick={loadMore}
              >
                Load history
              </button>
            )}
            {activeOther && (
              <button
                type="button"
                className="rounded-full border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600"
                onClick={() => report("user", activeOther.id)}
              >
                Report user
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto py-4">
          {messages.length === 0 && (
            <p className="text-sm text-slate-500">No messages yet.</p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col gap-1 ${
                msg.senderId === userId ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-xs rounded-2xl px-3 py-2 text-sm ${
                  msg.senderId === userId
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                {msg.ciphertext}
              </div>
              {msg.senderId !== userId && (
                <button
                  type="button"
                  className="text-xs text-rose-500"
                  onClick={() => report("message", msg.id)}
                >
                  Report
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-auto flex gap-2 border-t border-slate-100 pt-3">
          <input
            className="flex-1 rounded-full border border-slate-200 px-3 py-2 text-sm"
            placeholder="Type a message"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                sendMessage();
              }
            }}
            disabled={!activeMatch}
          />
          <button
            type="button"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            onClick={sendMessage}
            disabled={!activeMatch}
          >
            Send
          </button>
        </div>
      </section>
    </main>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageContent />
    </Suspense>
  );
}
