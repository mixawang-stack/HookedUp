"use client";

export const dynamic = "force-dynamic";
// BUILD_MARKER_PRIVATE_PAGE_TSX__2026_01_16

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useMemo, useState } from "react";

import { emitHostStatus } from "../lib/hostStatus";

import ChatBubble from "../components/ChatBubble";
import PageShell from "../components/PageShell";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type ConversationItem = {
  id: string;
  matchId: string;
  otherUser: {
    id: string;
    maskName: string | null;
    maskAvatarUrl: string | null;
        allowStrangerPrivate?: boolean | null;
  };
  isMuted: boolean;
  mutedAt: string | null;
  unreadCount: number;
};

type ConversationResponse = {
  items: ConversationItem[];
  nextCursor: string | null;
};

type SenderProfile = {
  id: string;
  maskName: string | null;
  maskAvatarUrl: string | null;
} | null;

type MessageItem = {
  id: string;
  matchId: string;
  senderId: string;
  ciphertext: string;
  createdAt: string;
  sender: SenderProfile;
};

type MessagesResponse = {
  items: MessageItem[];
  nextCursor: string | null;
  isMuted?: boolean;
};

function PrivateListPageInner() {
  const [token, setToken] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
    const [activeConversation, setActiveConversation] =
        useState<ConversationItem | null>(null);
    const searchParams = useSearchParams();
    const requestedConversationId = searchParams?.get("conversationId");

  const authHeader = useMemo(() => {
        if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  useEffect(() => {
    setToken(localStorage.getItem("accessToken"));
    setAuthReady(true);
  }, []);

  const loadConversations = async (nextCursor?: string | null) => {
    if (!authHeader) {
            if (authReady) setStatus("Please sign in to view private conversations.");
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
            if (nextCursor) params.set("cursor", nextCursor);

      const res = await fetch(`${API_BASE}/private/conversations?${params}`, {
                headers: { ...authHeader }
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const errorMessage = body?.message ?? `HTTP ${res.status}`;
        if (res.status === 401) {
          setStatus("Please sign in to view private conversations.");
                    return;
                }
          throw new Error(errorMessage);
        }

      const data = (await res.json()) as ConversationResponse;
      setConversations((prev) =>
        nextCursor ? [...prev, ...data.items] : data.items
      );
      setCursor(data.nextCursor);
      setStatus(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load.";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
        if (!authReady) return;
    loadConversations(null).catch(() => setStatus("Failed to load."));
        // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHeader, authReady]);

    useEffect(() => {
        if (!requestedConversationId || activeConversation) {
            return;
        }
        const match = conversations.find(
            (item) => item.id === requestedConversationId
        );
        if (match) {
            setActiveConversation(match);
        }
    }, [requestedConversationId, conversations, activeConversation]);

  useEffect(() => {
    emitHostStatus({ page: "private", cold: conversations.length === 0 });
  }, [conversations]);

  const toggleMute = async (item: ConversationItem) => {
    if (!authHeader) {
      setStatus("Please sign in to continue.");
      return;
    }

    setStatus(null);
    try {
      const endpoint = item.isMuted ? "unmute" : "mute";
      const res = await fetch(
        `${API_BASE}/private/conversations/${item.id}/${endpoint}`,
                { method: "POST", headers: { ...authHeader } }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === item.id
            ? {
                ...conv,
                isMuted: !item.isMuted,
                mutedAt: item.isMuted ? null : new Date().toISOString()
              }
            : conv
        )
      );

            setActiveConversation((prev) =>
                prev?.id === item.id
                    ? {
                        ...prev,
                        isMuted: !item.isMuted,
                        mutedAt: item.isMuted ? null : new Date().toISOString()
                    }
                    : prev
            );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed.";
      setStatus(message);
    }
  };

  const openConversation = (item: ConversationItem) => {
        setActiveConversation((prev) => (prev?.id === item.id ? null : item));
  };

  const closeConversation = () => {
    setActiveConversation(null);
  };

  const stageContent = (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
          Private Conversations
        </h1>
        <p className="text-sm text-text-secondary">
          <span className="block">Private is what happens after things click.</span>
          <span className="block">Not planned. Not forced. Just continued.</span>
        </p>
        {status && <p className="text-sm text-brand-secondary">{status}</p>}
      </div>

      <div className="space-y-3">
        {conversations.map((item) => (
          <div
            key={item.id}
                        className={`ui-card flex items-center justify-between px-4 py-3 text-sm transition ${item.unreadCount > 0
                ? "border-brand-primary/40 bg-surface"
                : "bg-card"
            }`}
                        role="button"
                        tabIndex={0}
                        onClick={() => openConversation(item)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openConversation(item);
                            }
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border-default bg-surface text-xs font-semibold text-text-secondary">
                                {item.otherUser?.maskAvatarUrl ? (
                                    <img
                                        src={item.otherUser.maskAvatarUrl}
                                        alt={item.otherUser?.maskName ?? "Avatar"}
                                        className="h-10 w-10 rounded-full object-cover"
                                    />
                                ) : (
                                    <span>
                                        {(item.otherUser?.maskName ?? "A")
                                            .slice(0, 1)
                                            .toUpperCase()}
                                    </span>
                                )}
                            </div>
            <div>
              <div className="flex items-center gap-2">
                {item.unreadCount > 0 && (
                  <span className="h-2 w-2 rounded-full bg-brand-primary" />
                )}
                <p className="font-semibold text-text-primary">
                  {item.otherUser?.maskName ?? "Anonymous"}
                </p>
              </div>
              <p className="mt-1 text-xs text-text-secondary">
                                    Private room {item.isMuted ? "路 Muted" : ""}
              </p>
            </div>
                        </div>

            <div className="flex items-center gap-2">
              {item.unreadCount > 0 && (
                <span className="rounded-full bg-brand-primary px-2 py-0.5 text-[10px] font-semibold text-card">
                  {item.unreadCount}
                </span>
              )}

              <button
                type="button"
                className="btn-primary px-4 py-2 text-xs"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    openConversation(item);
                                }}
              >
                                {activeConversation?.id === item.id ? "Close" : "Open"}
              </button>

              <button
                type="button"
                className="btn-secondary px-4 py-2 text-xs"
                onClick={() => toggleMute(item)}
              >
                {item.isMuted ? "Unmute" : "Mute"}
              </button>
            </div>
          </div>
        ))}

        {conversations.length === 0 && (
          <div className="ui-surface border-dashed p-4 text-sm text-text-secondary">
            <p>Nothing private yet.</p>
            <p>Most conversations start in the Hall</p>
                        <p>or inside a room. Go stir things up.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/hall"
                className="btn-primary px-4 py-2 text-xs"
              >
                Hall
              </Link>
              <Link
                href="/rooms"
                className="btn-secondary px-4 py-2 text-xs"
              >
                Rooms
              </Link>
            </div>
          </div>
        )}
      </div>

      {cursor && (
        <div className="flex justify-center">
          <button
            type="button"
            className="btn-secondary px-4 py-2 text-xs"
            onClick={() => loadConversations(cursor)}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );

  const panelContent = (
    <div className="space-y-4">
      <div className="ui-card p-5 text-sm text-text-secondary">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Keep it private
        </h3>
        <p className="mt-3 text-xs text-text-secondary">
          Conversations stay between the two of you unless you invite someone
          else. Pause or mute whenever you need. No one else sees your words.
        </p>
      </div>

      <div className="ui-card p-5 text-sm text-text-secondary">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Need ideas?
        </h3>
        <p className="mt-2 text-xs text-text-secondary">
          Suggest a topic, re-share a memory, or share how the day went.
        </p>
      </div>
    </div>
  );

  return (
    <>
            <PageShell stage={stageContent} panel={panelContent} />

      {activeConversation && (
        <PrivateConversationDrawer
          conversation={activeConversation}
          token={token}
          onClose={closeConversation}
        />
      )}
    </>
  );
}

export default function PrivateListPage() {
    return (
        <Suspense fallback={null}>
            <PrivateListPageInner />
        </Suspense>
    );
}

type DrawerProps = {
  conversation: ConversationItem;
  token: string | null;
  onClose: () => void;
};

function PrivateConversationDrawer({
  conversation,
  token,
  onClose
}: DrawerProps): JSX.Element {
  const router = useRouter();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
    const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(
        null
    );
  const [me, setMe] = useState<SenderProfile | null>(null);
  const [isMuted, setIsMuted] = useState(false);
    const otherUserId = conversation.otherUser?.id ?? null;
    const isRequestOnly = conversation.otherUser?.allowStrangerPrivate === false;

    const otherReplied = useMemo(() => {
        if (!otherUserId) return false;
        return messages.some((message) => message.senderId === otherUserId);
    }, [messages, otherUserId]);

    const hasSentRequest = useMemo(() => {
        if (!me?.id) return false;
        return messages.some((message) => message.senderId === me.id);
    }, [messages, me?.id]);

    const requestPending = isRequestOnly && hasSentRequest && !otherReplied;

  const authHeader = useMemo(() => {
        if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const redirectToLogin = (message?: string) => {
    localStorage.removeItem("accessToken");
    setStatus(message ?? "Please sign in to continue.");
    onClose();
    router.push("/login?redirect=/private");
  };

  useEffect(() => {
    if (!authHeader) {
      setMe(null);
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/me`, {
          headers: { ...authHeader }
        });
                if (!res.ok) throw new Error("Failed to load profile");
        const data = await res.json();
                if (isMounted) setMe(data);
      } catch {
                if (isMounted) setMe(null);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [authHeader]);

  const loadMessages = async (nextCursor?: string | null) => {
        if (!authHeader) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
            if (nextCursor) params.set("cursor", nextCursor);

      const res = await fetch(
        `${API_BASE}/private/conversations/${conversation.id}/messages?${params}`,
        { headers: { ...authHeader } }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const errorMessage = body?.message ?? `HTTP ${res.status}`;
        if (
          res.status === 401 ||
          String(errorMessage).includes("INVALID_ACCESS_TOKEN")
        ) {
          redirectToLogin("Session expired. Please sign in again.");
          return;
        }
                if (String(errorMessage).includes("PRIVATE_REPLY_REQUIRED")) {
                    throw new Error(
                        isRequestOnly
                            ? "This user only accepts a single request until they reply."
                            : "You can send up to 3 messages until they reply."
                    );
                }
                if (String(errorMessage).includes("USER_BLOCKED")) {
                    throw new Error("You can't message this user.");
                }
        throw new Error(errorMessage);
      }

      const data = (await res.json()) as MessagesResponse;
            const incoming = data.items.slice().reverse();

      setMessages((prev) =>
                nextCursor ? [...incoming, ...prev] : incoming
      );
      setCursor(data.nextCursor);
      setIsMuted(Boolean(data.isMuted));
            setStatus(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load.";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

    const sortedMessages = useMemo(() => {
        return [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }, [messages]);

  useEffect(() => {
    emitHostStatus({ page: "private", cold: sortedMessages.length === 0 });
  }, [sortedMessages]);

  useEffect(() => {
    loadMessages(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHeader, conversation.id]);

    const sendMessage = async (overrideContent?: string) => {
    if (!authHeader) {
      setStatus("Please sign in to send messages.");
      return;
    }
        const content = (overrideContent ?? input).trim();
        if (!content) return;

    setSending(true);
    setStatus(null);

    try {
      const res = await fetch(
        `${API_BASE}/private/conversations/${conversation.id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader
          },
                    body: JSON.stringify({ content })
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const errorMessage = body?.message ?? `HTTP ${res.status}`;
        if (
          res.status === 401 ||
          String(errorMessage).includes("INVALID_ACCESS_TOKEN")
        ) {
          redirectToLogin("Session expired. Please sign in again.");
          return;
        }
        throw new Error(errorMessage);
      }

      const message = (await res.json()) as MessageItem;
      setMessages((prev) => [...prev, message]);
            if (!overrideContent || content === input.trim()) {
      setInput("");
            }
            setLastFailedMessage(null);
    } catch (error) {
            const rawMessage = error instanceof Error ? error.message : "Failed to send.";
            const normalized = rawMessage.toLowerCase();
            if (normalized.includes("private_reply_required")) {
                setStatus(
                    isRequestOnly
                        ? "This user only accepts a single request until they reply."
                        : "You can send up to 3 messages until they reply."
                );
                setLastFailedMessage(null);
                return;
            }
            const isNetwork =
                error instanceof TypeError ||
                normalized.includes("network") ||
                normalized.includes("fetch");
            setStatus(
                isNetwork
                    ? "Network issue. Check your connection and retry."
                    : rawMessage
            );
            setLastFailedMessage(content);
    } finally {
      setSending(false);
    }
  };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

    useEffect(() => {
        const handleEscape = (e: any) => {
            if (e.key === "Escape") onClose();
        };

        window.addEventListener("keydown", handleEscape);
        return () => {
            window.removeEventListener("keydown", handleEscape);
        };
    }, [onClose]);

    const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) {
            onClose();
        }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-text-primary/40"
        onClick={handleBackdropClick}
      />

      <div className="relative ml-auto flex h-full w-full max-w-[720px] flex-col overflow-hidden border-l border-border-default bg-card text-text-primary shadow-sm">
        <div className="pointer-events-none absolute inset-0 -z-10 rounded-none shadow-[0_0_45px_rgba(56,189,248,0.35),0_0_120px_rgba(14,165,233,0.25)]" />

        <header className="flex items-center justify-between border-b border-border-default px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border-default bg-surface text-xs font-semibold uppercase text-text-secondary">
              {conversation.otherUser?.maskName
                ? conversation.otherUser.maskName.charAt(0).toUpperCase()
                : "A"}
            </div>

            <div>
              <p className="text-base font-semibold text-text-primary">
                {conversation.otherUser?.maskName ?? "Anonymous"}
              </p>
              <p className="text-xs uppercase tracking-[0.3em] text-text-muted">
                Private chat
              </p>
                            {isRequestOnly && (
                                <p className="mt-1 text-[10px] text-brand-secondary">
                                    This user has closed stranger DMs
                                </p>
                            )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {isMuted && (
              <span className="rounded-full border border-border-default bg-surface px-3 py-1 text-text-muted">
                Muted
              </span>
            )}
            <button
              type="button"
              className="btn-secondary px-3 py-1 text-xs"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto flex max-w-[640px] flex-col gap-4">
                            {requestPending && (
                                <div className="ui-surface p-3 text-xs text-text-secondary">
                                    Request sent. Waiting for their reply.
                                </div>
                            )}

              {status && (
                <div className="ui-surface p-3 text-xs text-brand-secondary">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span>{status}</span>
                                        {lastFailedMessage && (
                                            <button
                                                type="button"
                                                className="btn-secondary px-3 py-1 text-[11px]"
                                                onClick={() => sendMessage(lastFailedMessage)}
                                                disabled={sending}
                                            >
                                                Retry send
                                            </button>
                                        )}
                                    </div>
                </div>
              )}

              {loading && (
                <p className="text-center text-xs text-text-muted">Loading...</p>
              )}

              {!loading && sortedMessages.length === 0 && (
                <p className="text-center text-xs text-text-muted">
                  No messages yet. Say something to start.
                </p>
              )}

              {sortedMessages.map((msg, index) => {
                const isOwnMessage = Boolean(me && msg.sender?.id === me.id);
                const prev = sortedMessages[index - 1];
                const showMeta =
                  index === 0 || prev?.sender?.id !== msg.sender?.id;

                return (
                  <ChatBubble
                    key={msg.id}
                    message={msg}
                    isMine={isOwnMessage}
                    showMeta={showMeta}
                  />
                );
              })}
            </div>
          </div>

          <div className="border-t border-border-default bg-card px-6 py-5">
            <div className="space-y-3">
              <textarea
                className="h-24 w-full rounded-2xl border border-border-default bg-card px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                placeholder="Say something when it feels right."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
              />

              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{input.length} chars</span>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary px-3 py-1 text-xs"
                                        onClick={() => loadMessages(null)}
                    disabled={loading}
                  >
                    Refresh
                  </button>

                                    {cursor && (
                                        <button
                                            type="button"
                                            className="btn-secondary px-3 py-1 text-xs"
                                            onClick={() => loadMessages(cursor)}
                                            disabled={loading}
                                        >
                                            Load earlier
                                        </button>
                                    )}

                  <button
                    type="button"
                    className="btn-primary px-4 py-2 text-xs"
                                        onClick={() => sendMessage()}
                    disabled={sending}
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}






