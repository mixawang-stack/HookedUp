"use client";

export const dynamic = "force-dynamic";
// BUILD_MARKER_PRIVATE_PAGE_TSX__2026_01_16

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useMemo, useState } from "react";

import ChatBubble from "../components/ChatBubble";
import { emitHostStatus } from "../lib/hostStatus";
import { getSupabaseClient } from "../lib/supabaseClient";

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
  lastMessageAt: string | null;
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

function PrivateListPageInner() {
  const [userId, setUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [activeConversation, setActiveConversation] =
    useState<ConversationItem | null>(null);
  const searchParams = useSearchParams();
  const requestedConversationId = searchParams?.get("conversationId");
  const requestedUserId = searchParams?.get("userId");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
      setAuthReady(true);
    };
    loadUser().catch(() => setAuthReady(true));
  }, []);

  const loadConversations = async (nextCursor?: string | null) => {
    if (!userId) {
      if (authReady) {
        setStatus("Please sign in to view private conversations.");
      }
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase not configured.");
      }
      const { data, error } = await supabase
        .from("ConversationParticipant")
        .select(
          `
          conversationId,
          isMuted,
          mutedAt,
          conversation:Conversation(
            id,
            matchId,
            match:Match(
              user1Id,
              user2Id,
              user1:User!Match_user1Id_fkey(id,maskName,maskAvatarUrl),
              user2:User!Match_user2Id_fkey(id,maskName,maskAvatarUrl)
            )
          )
        `
        )
        .eq("userId", userId);
      if (error) {
        throw new Error("Failed to load.");
      }

      const normalizeOne = <T,>(value?: T | T[] | null) =>
        Array.isArray(value) ? value[0] ?? null : value ?? null;
      const items: ConversationItem[] =
        data?.map((row) => {
          const conversation = normalizeOne(row.conversation);
          const match = normalizeOne(conversation?.match);
          const user1 = normalizeOne(match?.user1);
          const user2 = normalizeOne(match?.user2);
          const otherId =
            match?.user1Id === userId ? match?.user2Id : match?.user1Id;
          const other =
            match?.user1Id === userId ? user2 ?? null : user1 ?? null;
          return {
            id: conversation?.id ?? row.conversationId,
            matchId: conversation?.matchId ?? "",
            otherUser: {
              id: other?.id ?? otherId ?? "",
              maskName: other?.maskName ?? null,
              maskAvatarUrl: other?.maskAvatarUrl ?? null,
              allowStrangerPrivate: null
            },
            isMuted: row.isMuted ?? false,
            mutedAt: row.mutedAt ?? null,
            unreadCount: 0,
            lastMessageAt: null
          };
        }) ?? [];

      if (items.length > 0) {
        const matchIds = items.map((item) => item.matchId).filter(Boolean);
        if (matchIds.length > 0) {
          const { data: latestMessages } = await supabase
            .from("Message")
            .select("matchId,createdAt")
            .in("matchId", matchIds)
            .order("createdAt", { ascending: false });
          const latestMap = new Map<string, string>();
          (latestMessages ?? []).forEach((msg) => {
            if (!latestMap.has(msg.matchId)) {
              latestMap.set(msg.matchId, msg.createdAt);
            }
          });
          items.forEach((item) => {
            item.lastMessageAt = latestMap.get(item.matchId) ?? null;
          });
        }
      }

      const missingIds = items
        .filter((item) => item.otherUser.id && !item.otherUser.maskName)
        .map((item) => item.otherUser.id);
      if (missingIds.length > 0) {
        const { data: usersData } = await supabase
          .from("User")
          .select("id,maskName,maskAvatarUrl")
          .in("id", missingIds);
        const userMap = new Map(
          (usersData ?? []).map((user) => [user.id, user])
        );
        items.forEach((item) => {
          if (!item.otherUser.maskName) {
            const filled = userMap.get(item.otherUser.id);
            if (filled) {
              item.otherUser.maskName = filled.maskName ?? null;
              item.otherUser.maskAvatarUrl = filled.maskAvatarUrl ?? null;
            }
          }
        });
      }

      setConversations(items as ConversationItem[]);
      setCursor(null);
      setStatus(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load.";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  const loadConversationById = async (conversationId: string) => {
    if (!userId) {
      throw new Error("Please sign in to view private conversations.");
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error("Supabase not configured.");
    }
    const { data, error } = await supabase
      .from("ConversationParticipant")
      .select(
        `
          conversationId,
          isMuted,
          mutedAt,
          conversation:Conversation(
            id,
            matchId,
            match:Match(
              user1Id,
              user2Id,
              user1:User!Match_user1Id_fkey(id,maskName,maskAvatarUrl),
              user2:User!Match_user2Id_fkey(id,maskName,maskAvatarUrl)
            )
          )
        `
      )
      .eq("userId", userId)
      .eq("conversationId", conversationId)
      .maybeSingle();
    if (error || !data) {
      throw new Error("Conversation not available.");
    }
    const normalizeOne = <T,>(value?: T | T[] | null) =>
      Array.isArray(value) ? value[0] ?? null : value ?? null;
    const conversation = normalizeOne(data.conversation);
    const match = normalizeOne(conversation?.match);
    const user1 = normalizeOne(match?.user1);
    const user2 = normalizeOne(match?.user2);
    const otherId =
      match?.user1Id === userId ? match?.user2Id : match?.user1Id;
    const other = match?.user1Id === userId ? user2 ?? null : user1 ?? null;
    const item: ConversationItem = {
      id: conversation?.id ?? data.conversationId,
      matchId: conversation?.matchId ?? "",
      otherUser: {
        id: other?.id ?? otherId ?? "",
        maskName: other?.maskName ?? null,
        maskAvatarUrl: other?.maskAvatarUrl ?? null,
        allowStrangerPrivate: null
      },
      isMuted: data.isMuted ?? false,
      mutedAt: data.mutedAt ?? null,
      unreadCount: 0,
      lastMessageAt: null
    };
    if (item.otherUser.id && !item.otherUser.maskName) {
      const { data: otherProfile } = await supabase
        .from("User")
        .select("id,maskName,maskAvatarUrl")
        .eq("id", item.otherUser.id)
        .maybeSingle();
      if (otherProfile) {
        item.otherUser.maskName = otherProfile.maskName ?? null;
        item.otherUser.maskAvatarUrl = otherProfile.maskAvatarUrl ?? null;
      }
    }

    if (item.matchId) {
      const { data: lastMessage } = await supabase
        .from("Message")
        .select("createdAt")
        .eq("matchId", item.matchId)
        .order("createdAt", { ascending: false })
        .limit(1)
        .maybeSingle();
      item.lastMessageAt = lastMessage?.createdAt ?? null;
    }

    setConversations((prev) => {
      if (prev.find((conv) => conv.id === item.id)) {
        return prev;
      }
      return [item, ...prev];
    });
    setActiveConversation(item);
  };

  useEffect(() => {
    if (!authReady) return;
    loadConversations(null).catch(() => setStatus("Failed to load."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, authReady]);

  useEffect(() => {
    if (!requestedConversationId || activeConversation) {
      return;
    }
    const match = conversations.find(
      (item) => item.id === requestedConversationId
    );
    if (match) {
      setActiveConversation(match);
      return;
    }
    if (!userId) {
      return;
    }
    const loadRequested = async () => {
      try {
        await loadConversationById(requestedConversationId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load.";
        setStatus(message);
      }
    };
    loadRequested().catch(() => setStatus("Failed to load."));
  }, [requestedConversationId, conversations, activeConversation, userId]);

  useEffect(() => {
    if (!requestedUserId || requestedConversationId || activeConversation) {
      return;
    }
    if (!userId) {
      return;
    }
    const ensureConversation = async () => {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          throw new Error("Supabase not configured.");
        }
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token ?? null;
        if (!accessToken) {
          setStatus("Please sign in to view private conversations.");
          return;
        }
        const res = await fetch("/api/private/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({ targetUserId: requestedUserId })
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload?.conversationId) {
          throw new Error(payload?.error ?? "Conversation not available.");
        }
        const url = new URL(window.location.href);
        url.searchParams.set("conversationId", payload.conversationId);
        url.searchParams.delete("userId");
        window.history.replaceState({}, "", url.toString());
        await loadConversationById(payload.conversationId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load.";
        setStatus(message);
      }
    };
    ensureConversation().catch(() => setStatus("Failed to load."));
  }, [requestedUserId, requestedConversationId, activeConversation, userId]);

  useEffect(() => {
    emitHostStatus({ page: "private", cold: conversations.length === 0 });
  }, [conversations]);

  const toggleMute = async (item: ConversationItem) => {
    if (!userId) {
      setStatus("Please sign in to continue.");
      return;
    }

    setStatus(null);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase not configured.");
      }
      const nextMuted = !item.isMuted;
      await supabase
        .from("ConversationParticipant")
        .update({
          isMuted: nextMuted,
          mutedAt: nextMuted ? new Date().toISOString() : null
        })
        .eq("conversationId", item.id)
        .eq("userId", userId);

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

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return conversations;
    }
    return conversations.filter((item) =>
      (item.otherUser?.maskName ?? "").toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  return (
    <main className="ui-page">
      <div className="ui-container py-8">
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="ui-card flex flex-col gap-4 p-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
                Private Conversations
              </h1>
              <p className="text-sm text-text-secondary">
                <span className="block">
                  Private is what happens after things click.
                </span>
                <span className="block">
                  Not planned. Not forced. Just continued.
                </span>
              </p>
              {status && <p className="text-sm text-brand-secondary">{status}</p>}
            </div>

            <div className="relative">
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
                placeholder="Search conversations"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>

            <div className="space-y-3">
              {filteredConversations.map((item) => {
                const displayName = item.otherUser?.maskName ?? "Anonymous";
                const snippet = item.isMuted
                  ? "Private room - Muted"
                  : "Private room";
                const lastTime = item.lastMessageAt
                  ? new Date(item.lastMessageAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit"
                    })
                  : "-";
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      activeConversation?.id === item.id
                        ? "border-brand-primary/40 bg-surface"
                        : "border-border-default bg-card"
                    }`}
                    onClick={() => openConversation(item)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border-default bg-surface text-xs font-semibold text-text-secondary">
                        {item.otherUser?.maskAvatarUrl ? (
                          <img
                            src={item.otherUser.maskAvatarUrl}
                            alt={displayName}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <span>{displayName.slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-text-primary">
                            {displayName}
                          </p>
                          <span className="text-[11px] text-text-muted">
                            {lastTime}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-text-secondary">
                          {snippet}
                        </p>
                      </div>
                      {item.unreadCount > 0 && (
                        <span className="rounded-full bg-brand-primary px-2 py-0.5 text-[10px] font-semibold text-card">
                          {item.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {conversations.length === 0 && (
                <div className="ui-surface border-dashed p-4 text-sm text-text-secondary">
                  <p>Nothing private yet.</p>
                  <p>Most conversations start in the Forum</p>
                  <p>or inside a room. Go stir things up.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href="/forum" className="btn-primary px-4 py-2 text-xs">
                      Forum
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
          </aside>

          <section className="ui-card flex min-h-[70vh] flex-col overflow-hidden">
            {activeConversation ? (
              <PrivateConversationDrawer
                conversation={activeConversation}
                onClose={closeConversation}
              />
            ) : (
              <div className="flex h-full flex-1" />
            )}
          </section>
        </div>
      </div>
    </main>
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
  onClose: () => void;
};

function PrivateConversationDrawer({
  conversation,
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

  const redirectToLogin = (message?: string) => {
    setStatus(message ?? "Please sign in to continue.");
    onClose();
    router.push("/login?redirect=/private");
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) return;
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          if (isMounted) setMe(null);
          return;
        }
        const { data: profile } = await supabase
          .from("User")
          .select("id,maskName,maskAvatarUrl")
          .eq("id", data.user.id)
          .maybeSingle();
        if (isMounted) setMe((profile as SenderProfile) ?? null);
      } catch {
        if (isMounted) setMe(null);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadMessages = async (nextCursor?: string | null) => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase not configured.");
      }
      const { data, error } = await supabase
        .from("Message")
        .select(
          "id,matchId,senderId,ciphertext,createdAt,sender:User!Message_senderId_fkey(id,maskName,maskAvatarUrl)"
        )
        .eq("matchId", conversation.matchId)
        .order("createdAt", { ascending: true })
        .limit(200);
      if (error) {
        throw new Error("Failed to load.");
      }

      const rawMessages = data ?? [];
      const senderIds = rawMessages
        .filter((item) => !item.sender && item.senderId)
        .map((item) => item.senderId);
      let senderMap = new Map<string, { id: string; maskName: string | null; maskAvatarUrl: string | null }>();
      if (senderIds.length > 0) {
        const { data: senderData } = await supabase
          .from("User")
          .select("id,maskName,maskAvatarUrl")
          .in("id", senderIds);
        senderMap = new Map((senderData ?? []).map((user) => [user.id, user]));
      }
      const incoming =
        rawMessages.map((item) => ({
          ...item,
          sender: item.sender?.[0] ?? senderMap.get(item.senderId) ?? null
        })) ?? [];
      setMessages((prev) => (nextCursor ? [...incoming, ...prev] : incoming));
      setCursor(null);
      setIsMuted(Boolean(conversation.isMuted));
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
  }, [conversation.id]);

  const sendMessage = async (overrideContent?: string) => {
    if (!me?.id) {
      setStatus("Please sign in to send messages.");
      return;
    }
    const content = (overrideContent ?? input).trim();
    if (!content) return;

    setSending(true);
    setStatus(null);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase not configured.");
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token ?? null;
      if (!accessToken) {
        throw new Error("Please sign in to send messages.");
      }
      const res = await fetch("/api/private/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          matchId: conversation.matchId,
          conversationId: conversation.id,
          ciphertext: content
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to send.");
      }
      const normalizedMessage = {
        ...payload,
        sender: payload.sender?.[0] ?? null
      } as MessageItem;
      setMessages((prev) => [...prev, normalizedMessage]);
      if (!overrideContent || content === input.trim()) {
        setInput("");
      }
      setLastFailedMessage(null);
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : "Failed to send.";
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
        isNetwork ? "Network issue. Check your connection and retry." : rawMessage
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
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div className="flex h-full flex-col" role="region" aria-label="Private chat">
      <header className="flex items-center justify-between border-b border-border-default px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border-default bg-surface text-xs font-semibold uppercase text-text-secondary">
            {conversation.otherUser?.maskAvatarUrl ? (
              <img
                src={conversation.otherUser.maskAvatarUrl}
                alt={conversation.otherUser?.maskName ?? "User"}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span>
                {(conversation.otherUser?.maskName ?? "A")
                  .charAt(0)
                  .toUpperCase()}
              </span>
            )}
          </div>

          <div>
            <p className="text-base font-semibold text-text-primary">
              {conversation.otherUser?.maskName ?? "Anonymous"}
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs text-text-secondary">
              <span className="ui-status-online inline-flex h-2 w-2 rounded-full" />
              <span>Online</span>
            </div>
            {isRequestOnly && (
              <p className="mt-1 text-[10px] text-brand-secondary">
                This user has closed stranger DMs
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border-default bg-card text-text-secondary"
          aria-label="More"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <circle cx="12" cy="5" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="12" cy="19" r="1.8" />
          </svg>
        </button>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-6">
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

        <div className="border-t border-border-default bg-card px-6 py-4">
          <div className="flex items-center gap-3">
            <textarea
              className="flex-1 rounded-full border border-border-default bg-card px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
              placeholder="Say something when it feels right."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              type="button"
              className="btn-primary px-5 py-2.5 text-sm"
              onClick={() => sendMessage()}
              disabled={sending}
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
