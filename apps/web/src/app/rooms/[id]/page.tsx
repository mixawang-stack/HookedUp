"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";

import { emitHostStatus } from "../../lib/hostStatus";
import ProfileCard from "../../components/ProfileCard";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const GAME_OPTIONS = [
  { value: "NONE", label: "None" },
  { value: "DICE", label: "Dice" },
  { value: "ONE_THING", label: "One Thing" }
];

type RoomDetail = {
  id: string;
  title: string;
  description: string | null;
  capacity: number | null;
  memberCount: number;
  createdById: string;
  currentUserRole: "OWNER" | "MEMBER" | "OBSERVER" | null;
  selectedGame?: {
    type: string | null;
    selectedAt: string | null;
    selectedById: string | null;
  };
};

type RoomMessage = {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender?: {
    id: string;
    maskName: string | null;
    maskAvatarUrl: string | null;
  } | null;
};

type MessagesResponse = {
  items: RoomMessage[];
  nextCursor: string | null;
};

type InviteCandidate = {
  userId: string;
  maskName: string | null;
  maskAvatarUrl: string | null;
};

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = typeof params.id === "string" ? params.id : params.id?.[0];

  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const chatListRef =  useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteCandidates, setInviteCandidates] = useState<InviteCandidate[]>([]);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  const [profileCard, setProfileCard] = useState<{
    id: string;
    maskName: string | null;
    maskAvatarUrl: string | null;
    bio: string | null;
    preference?: {
      vibeTags?: string[] | null;
      interests?: string[] | null;
    } | null;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  const authHeader = useMemo(() => {
    if (!token) {
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const openProfileCard = async (targetUserId: string) => {
    if (!authHeader) {
      setStatus("Please sign in to view profiles.");
      return;
    }
    setProfileLoading(true);
    try {
      const res = await fetch(`${API_BASE}/users/${targetUserId}`, {
        headers: { ...authHeader }
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setProfileCard(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load profile.";
      setStatus(message);
    } finally {
      setProfileLoading(false);
    }
  };

  const startConversation = async (targetUserId: string) => {
    if (!authHeader) {
      setStatus("Please sign in to start a private conversation.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/private/conversations/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ userId: targetUserId })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { conversationId: string };
      router.push(`/private?conversationId=${data.conversationId}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start conversation.";
      setStatus(message);
    }
  };

  useEffect(() => {
    setToken(localStorage.getItem("accessToken"));
  }, []);

  useEffect(() => {
    if (!authHeader) {
      return;
    }
    fetch(`${API_BASE}/me`, { headers: { ...authHeader } })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data: { id: string } | null) => {
        setUserId(data?.id ?? null);
      })
      .catch(() => setUserId(null));
  }, [authHeader]);

  useEffect(() => {
    if (!authHeader || !roomId) {
      return;
    }

    let active = true;
    const loadRoom = async () => {
      setLoading(true);
      setStatus(null);
      try {
        const joinRes = await fetch(`${API_BASE}/rooms/${roomId}/join`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader
          },
          body: JSON.stringify({})
        });
        if (!joinRes.ok) {
          const body = await joinRes.json().catch(() => ({}));
          const errorMessage = body?.message ?? `HTTP ${joinRes.status}`;
          if (joinRes.status === 401 || errorMessage.includes("INVALID_ACCESS_TOKEN") || errorMessage.includes("token")) {
            // Clear invalid token and redirect to login
            localStorage.removeItem("accessToken");
            router.push(`/login?redirect=${encodeURIComponent(`/rooms/${roomId}`)}`);
            return;
          }
          throw new Error(errorMessage);
        }
        window.dispatchEvent(new Event("active-room-changed"));

        const [roomRes, messagesRes] = await Promise.all([
          fetch(`${API_BASE}/rooms/${roomId}`, { headers: { ...authHeader } }),
          fetch(`${API_BASE}/rooms/${roomId}/messages`, {
            headers: { ...authHeader }
          })
        ]);

        if (!roomRes.ok) {
          const body = await roomRes.json().catch(() => ({}));
          throw new Error(body?.message ?? `HTTP ${roomRes.status}`);
        }
        if (!messagesRes.ok) {
          const body = await messagesRes.json().catch(() => ({}));
          throw new Error(body?.message ?? `HTTP ${messagesRes.status}`);
        }

        const roomData = (await roomRes.json()) as RoomDetail;
        const messagesData = (await messagesRes.json()) as MessagesResponse;

        if (!active) {
          return;
        }
        setRoom(roomData);
        setMessages((messagesData.items ?? []).slice().reverse());
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load room.";
        setStatus(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

      loadRoom();

      return () => {
        active = false;
      };
    }, [authHeader, roomId]);

  useEffect(() => {
    if (!room) {
      return;
    }
    emitHostStatus({ page: "room", cold: messages.length === 0 });
  }, [room, messages]);

  useEffect(() => {
    if (!chatListRef.current) {
      return;
    }
    chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!token || !roomId) {
      return;
    }
    const socket = io(API_BASE, {
      auth: { token }
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("room:join", { roomId });
    });

    socket.on("room:message", (payload: { roomId: string; message: RoomMessage }) => {
      if (payload?.roomId !== roomId || !payload?.message) {
        return;
      }
      setMessages((prev) => {
        // Remove temp message if exists and add real message
        const filtered = prev.filter((msg) => !msg.id.startsWith("temp-"));
        // Check if message already exists to avoid duplicates
        const exists = filtered.some((msg) => msg.id === payload.message.id);
        if (exists) {
          return filtered;
        }
        return [...filtered, payload.message];
      });
    });

    socket.on("room:memberCount", (payload: { roomId: string; memberCount: number }) => {
      if (payload?.roomId !== roomId) {
        return;
      }
      setRoom((prev) => (prev ? { ...prev, memberCount: payload.memberCount } : prev));
    });

    const handleGame = (payload: {
      roomId: string;
      selectedGame?: { type: string; selectedAt: string | null; selectedById: string | null };
    }) => {
      if (payload?.roomId !== roomId || !payload?.selectedGame) {
        return;
      }
      setRoom((prev) => (prev ? { ...prev, selectedGame: payload.selectedGame } : prev));
    };

    socket.on("room:gameSelected", handleGame);
    socket.on("room:game", handleGame);

    return () => {
      socket.emit("room:leave", { roomId });
      socket.disconnect();
    };
  }, [roomId, token]);

  const ensureJoined = async () => {
    if (!authHeader || !roomId) {
      throw new Error("Please sign in to continue.");
    }
    const res = await fetch(`${API_BASE}/rooms/${roomId}/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader
      },
      body: JSON.stringify({})
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.message ?? `HTTP ${res.status}`);
    }
  };

  const handleSendMessage = async () => {
    if (!roomId) {
      return;
    }
    const content = messageInput.trim();
    if (!content) {
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      await ensureJoined();
      if (socketRef.current?.connected) {
        // Optimistically add message immediately
        const tempMessage: RoomMessage = {
          id: `temp-${Date.now()}`,
          roomId,
          senderId: userId ?? "",
          content,
          createdAt: new Date().toISOString()
        };
        setMessages((prev) => [...prev, tempMessage]);
        setMessageInput("");
        // Send via socket - the server will broadcast back the real message
        socketRef.current.emit("room:message:send", { roomId, content });
        setSending(false);
        return;
      }
      if (!authHeader) {
        setStatus("Please sign in to send a message.");
        return;
      }
      const res = await fetch(`${API_BASE}/rooms/${roomId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({ content })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      const message = (await res.json()) as RoomMessage;
      setMessages((prev) => [...prev, message]);
      setMessageInput("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send.";
      setStatus(message);
    } finally {
      setSending(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!authHeader || !roomId) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/rooms/${roomId}/leave`, {
        method: "POST",
        headers: { ...authHeader }
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      window.dispatchEvent(new Event("active-room-changed"));
      router.push("/rooms");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to leave room.";
      setStatus(message);
    }
  };

  const handleSelectGame = async (gameType: string) => {
    if (!authHeader || !roomId) {
      setStatus("Please sign in to select a game.");
      return;
    }
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/rooms/${roomId}/game`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({ selectedGame: gameType })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      const payload = (await res.json()) as RoomDetail["selectedGame"];
      setRoom((prev) => (prev ? { ...prev, selectedGame: payload ?? prev.selectedGame } : prev));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to select game.";
      setStatus(message);
    }
  };

  const loadInviteCandidates = async () => {
    if (!authHeader || !roomId) {
      return;
    }
    setInviteLoading(true);
    setInviteStatus(null);
    try {
      const res = await fetch(`${API_BASE}/rooms/${roomId}/invite-candidates`, {
        headers: { ...authHeader }
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { items: InviteCandidate[] };
      setInviteCandidates(data.items ?? []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load candidates.";
      setInviteStatus(message);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleOpenInvite = async () => {
    setShowInvite(true);
    await loadInviteCandidates();
  };

  const handleSendInvite = async (inviteeId: string) => {
    if (!authHeader || !roomId) {
      return;
    }
    setInvitingId(inviteeId);
    setInviteStatus(null);
    try {
      const res = await fetch(`${API_BASE}/rooms/${roomId}/invites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({ inviteeId })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      setInviteCandidates((prev) => prev.filter((item) => item.userId !== inviteeId));
      setInviteStatus("Invite sent.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send invite.";
      setInviteStatus(message);
    } finally {
      setInvitingId(null);
    }
  };

  const handleGenerateShareLink = async () => {
    if (!authHeader || !roomId) {
      return;
    }
    setShareLoading(true);
    setShareStatus(null);
    try {
      const res = await fetch(`${API_BASE}/rooms/${roomId}/share-links`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { shareUrlPath: string };
      if (data?.shareUrlPath) {
        setShareLink(`${window.location.origin}${data.shareUrlPath}`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate link.";
      setShareStatus(message);
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareLink) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareStatus("Copied to clipboard.");
    } catch {
      setShareStatus("Copy failed.");
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-slate-600">Loading room...</p>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm text-rose-600">{status ?? "Room unavailable."}</p>
        <button
          type="button"
          className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
          onClick={() => router.push("/rooms")}
        >
          Back to Rooms
        </button>
      </main>
    );
  }

  const selectedGameType = room.selectedGame?.type ?? "NONE";
  const selectedGameLabel =
    GAME_OPTIONS.find((option) => option.value === selectedGameType)?.label ??
    selectedGameType;
  const isOwner = room.currentUserRole === "OWNER";

  return (
    <>
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
      <section className="rounded-2xl border border-white/10 bg-slate-950/80 px-6 py-5 shadow-[0_30px_60px_rgba(2,6,23,0.6)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">{room.title}</h1>
            {room.description && (
              <p className="mt-2 text-sm text-slate-300">{room.description}</p>
            )}
            <p className="mt-2 text-xs text-slate-400">
              Members: {room.memberCount}
              {room.capacity ? ` / ${room.capacity}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {isOwner && (
              <button
                type="button"
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white"
                onClick={handleOpenInvite}
              >
                Invite
              </button>
            )}
            <button
              type="button"
              className="rounded-full border border-white/30 px-3 py-1 text-xs font-semibold text-white"
              onClick={handleLeaveRoom}
            >
              Leave Room
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 px-3 py-1">
            Selected: {selectedGameLabel}
          </span>
          {isOwner && (
            <label className="flex items-center gap-2">
              <span className="text-slate-300">Select game</span>
              <select
                className="rounded-full border border-white/20 bg-slate-950/50 px-3 py-1 text-xs text-white"
                value={selectedGameType}
                onChange={(event) => handleSelectGame(event.target.value)}
              >
                {GAME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {status && <p className="mt-3 text-sm text-rose-400">{status}</p>}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <section className="flex min-h-[60vh] flex-1 flex-col rounded-2xl border border-white/10 bg-slate-950/90 p-4 shadow-[0_20px_45px_rgba(2,6,23,0.7)]">
          <div
            ref={chatListRef}
            className="flex-1 space-y-3 overflow-y-auto pr-2"
          >
            {messages.map((message) => {
              const isSelf = message.senderId === userId;
              const senderName = message.sender?.maskName ?? "Member";
              return (
                <div
                  key={message.id}
                  className={`flex items-end gap-3 ${
                    isSelf ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isSelf && (
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white/10"
                      onClick={() => {
                        if (message.sender?.id) {
                          openProfileCard(message.sender.id);
                        }
                      }}
                      aria-label="Open profile"
                    >
                      {message.sender?.maskAvatarUrl ? (
                        <img
                          src={message.sender.maskAvatarUrl}
                          alt={senderName}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-slate-300">
                          {senderName.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </button>
                  )}
                  <div
                    className={`w-fit max-w-[min(640px,85%)] rounded-2xl border px-3 py-2 text-sm ${
                      isSelf
                        ? "border-white/40 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white shadow-[0_10px_30px_rgba(2,6,23,0.6)]"
                        : "border-white/10 bg-slate-950/40 text-slate-100 shadow-[0_10px_20px_rgba(2,6,23,0.6)]"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wide opacity-70">
                      <span>{isSelf ? "You" : senderName}</span>
                      <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && (
              <p className="text-sm text-slate-500">No messages yet.</p>
            )}
          </div>
        </section>

        <aside className="sticky top-6">
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-5 shadow-[0_25px_70px_rgba(2,6,23,0.7)] space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Say something
              </p>
              <textarea
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                placeholder="Drop a message to the room..."
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-amber-300"
                  onClick={handleSendMessage}
                  disabled={sending}
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>

            <div className="space-y-3 border-t border-white/10 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Games
              </h3>
              <p className="text-xs text-slate-300">
                Selected: {selectedGameLabel}
              </p>
              {isOwner && (
                <select
                  className="w-full rounded-full border border-white/15 bg-slate-950/50 px-3 py-1 text-xs text-white"
                  value={selectedGameType}
                  onChange={(event) => handleSelectGame(event.target.value)}
                >
                  {GAME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-3 border-t border-white/10 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Invite
              </h3>
              {isOwner && (
                <div className="space-y-2">
                  <button
                    type="button"
                    className="w-full rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white"
                    onClick={handleOpenInvite}
                  >
                    Invite someone
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white"
                    onClick={handleGenerateShareLink}
                    disabled={shareLoading}
                  >
                    {shareLoading ? "Generating..." : "Generate share link"}
                  </button>
                </div>
              )}
              {shareStatus && !shareLink && (
                <p className="text-xs text-slate-400">{shareStatus}</p>
              )}
              {shareLink && (
                <div className="space-y-2 rounded-xl border border-white/15 bg-slate-900/40 p-3 text-xs text-slate-200">
                  <p className="font-semibold text-white">Share link</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      readOnly
                      value={shareLink}
                      className="flex-1 rounded-lg border border-white/20 bg-slate-950/60 px-3 py-1 text-xs text-white placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white"
                      onClick={handleCopyShareLink}
                    >
                      Copy
                    </button>
                  </div>
                  {shareStatus && (
                    <p className="text-xs text-slate-400">{shareStatus}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
          <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Invite to room
              </h2>
              <button
                type="button"
                className="text-xs text-slate-500"
                onClick={() => setShowInvite(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Invite someone you have a mutual chat with.
            </p>
            <div className="mt-4 space-y-3">
              {inviteLoading && (
                <p className="text-sm text-slate-500">Loading candidates...</p>
              )}
              {!inviteLoading && inviteCandidates.length === 0 && (
                <p className="text-sm text-slate-500">No eligible candidates.</p>
              )}
              {!inviteLoading &&
                inviteCandidates.map((candidate) => (
                  <div
                    key={candidate.userId}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      {candidate.maskAvatarUrl ? (
                        <img
                          src={candidate.maskAvatarUrl}
                          alt={candidate.maskName ?? "Member"}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <span className="h-8 w-8 rounded-full bg-slate-200" />
                      )}
                      <span className="text-sm text-slate-700">
                        {candidate.maskName ?? "Anonymous"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                      onClick={() => handleSendInvite(candidate.userId)}
                      disabled={invitingId === candidate.userId}
                    >
                      {invitingId === candidate.userId ? "Inviting..." : "Invite"}
                    </button>
                  </div>
                ))}
            </div>
            {inviteStatus && (
              <p className="mt-3 text-sm text-slate-500">{inviteStatus}</p>
            )}
          </section>
        </div>
      )}
      </main>
      {profileCard && (
        <ProfileCard
          profile={profileCard}
          onClose={() => setProfileCard(null)}
          onStartPrivate={async (userId) => {
            await startConversation(userId);
            setProfileCard(null);
          }}
        />
      )}
      {profileLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center text-xs text-slate-200">
          Loading profile...
        </div>
      )}
    </>
  );
}
