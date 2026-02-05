"use client";

export const dynamic = "force-dynamic";
// BUILD_MARKER_PRIVATE_PAGE_TSX__2026_01_16

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useMemo, useState } from "react";

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
  lastMessageSnippet?: string | null;
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

const formatListTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })
    : "";

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
  const requestedUserId = searchParams?.get("user") ?? searchParams?.get("userId");
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
            lastMessageAt: null,
            lastMessageSnippet: null
          };
        }) ?? [];

      if (items.length > 0) {
        const matchIds = items.map((item) => item.matchId).filter(Boolean);
        if (matchIds.length > 0) {
          const { data: latestMessages } = await supabase
            .from("Message")
            .select("matchId,createdAt,ciphertext")
            .in("matchId", matchIds)
            .order("createdAt", { ascending: false });
          const latestMap = new Map<string, { createdAt: string; ciphertext: string }>();
          (latestMessages ?? []).forEach((msg) => {
            if (!latestMap.has(msg.matchId)) {
              latestMap.set(msg.matchId, {
                createdAt: msg.createdAt,
                ciphertext: msg.ciphertext ?? ""
              });
            }
          });
          items.forEach((item) => {
            const latest = latestMap.get(item.matchId);
            item.lastMessageAt = latest?.createdAt ?? null;
            item.lastMessageSnippet = latest?.ciphertext ?? null;
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
      lastMessageAt: null,
      lastMessageSnippet: null
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
        .select("createdAt,ciphertext")
        .eq("matchId", item.matchId)
        .order("createdAt", { ascending: false })
        .limit(1)
        .maybeSingle();
      item.lastMessageAt = lastMessage?.createdAt ?? null;
      item.lastMessageSnippet = lastMessage?.ciphertext ?? null;
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
    if (requestedConversationId || requestedUserId || activeConversation) {
      return;
    }
    if (conversations.length === 0) {
      return;
    }
    const sorted = [...conversations].sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });
    setActiveConversation(sorted[0]);
  }, [conversations, requestedConversationId, requestedUserId, activeConversation]);

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
    <div className="min-h-screen bg-[#FBF4EE]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-5xl font-extrabold tracking-tight text-[#3A2E2A]">
            Private Messages
          </h1>
          <p className="mt-2 text-lg text-[#6B5A52]">
            Connect one-on-one with other community members
          </p>
          {status && <p className="mt-2 text-sm text-brand-secondary">{status}</p>}
        </div>

        <div className="rounded-[28px] border border-[#E7D7CC] bg-[#FFFDFB] shadow-[0_6px_24px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="flex h-[720px]">
            <aside className="w-[360px] bg-[#FFFDFB]">
              <div className="p-4">
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9B877D]">
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
                  </div>
                  <input
                    placeholder="Search conversations..."
                    className="w-full rounded-full border border-[#E7D7CC] bg-[#FBF4EE] py-3 pl-12 pr-4 text-[#3A2E2A] placeholder:text-[#9B877D] outline-none focus:ring-2 focus:ring-[#E7D7CC]"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </div>
              </div>

              <div className="h-[calc(720px-84px)] overflow-y-auto px-2 pb-3">
                {filteredConversations.map((item) => {
                  const displayName = item.otherUser?.maskName ?? "Anonymous";
                  const snippet =
                    item.lastMessageSnippet?.trim() || "No messages yet";
                  const lastTime = formatListTime(item.lastMessageAt);
                  const active = activeConversation?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => openConversation(item)}
                      className={[
                        "w-full rounded-2xl px-3 py-3 text-left transition",
                        active
                          ? "bg-[#F3E7DE] border border-[#E7D7CC]"
                          : "hover:bg-[#FBF4EE]"
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[#E7D7CC]">
                          {item.otherUser?.maskAvatarUrl ? (
                            <img
                              src={item.otherUser.maskAvatarUrl}
                              alt={displayName}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#FFFDFB] bg-[#3BCB6B]" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate font-semibold text-[#3A2E2A]">
                              {displayName}
                            </div>
                            <div className="shrink-0 text-xs text-[#8A766C]">
                              {lastTime}
                            </div>
                          </div>

                          <div className="mt-1 flex items-center justify-between gap-2">
                            <div className="min-w-0 truncate text-sm text-[#8A766C]">
                              {snippet}
                            </div>
                            {item.unreadCount ? (
                              <span className="shrink-0 rounded-full bg-[#E3AFA0] px-2 py-0.5 text-xs font-semibold text-white">
                                {item.unreadCount}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {conversations.length === 0 && (
                  <div className="rounded-2xl border border-[#E7D7CC] bg-[#FBF4EE] p-4 text-sm text-[#6B5A52]">
                    <p>No conversations yet.</p>
                    <p className="mt-2 text-xs">
                      Start from the Forum or Rooms to begin.
                    </p>
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
            </aside>

            <div className="w-px bg-[#E7D7CC]" />

            <section className="flex min-w-0 flex-1 flex-col bg-[#FFFDFB]">
              {activeConversation ? (
                <PrivateConversationDrawer
                  conversation={activeConversation}
                  onClose={closeConversation}
                />
              ) : (
                <div className="flex h-full flex-1 items-center justify-center text-sm text-[#6B5A52]">
                  Select a conversation to start chatting.
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
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
      <div className="flex items-center justify-between border-b border-[#E7D7CC] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 overflow-hidden rounded-full bg-[#E7D7CC]">
            {conversation.otherUser?.maskAvatarUrl ? (
              <img
                src={conversation.otherUser.maskAvatarUrl}
                alt={conversation.otherUser?.maskName ?? "User"}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-[#6B5A52]">
                {(conversation.otherUser?.maskName ?? "A")
                  .charAt(0)
                  .toUpperCase()}
              </span>
            )}
          </div>

          <div>
            <div className="font-semibold text-[#3A2E2A]">
              {conversation.otherUser?.maskName ?? "Anonymous"}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-sm text-[#8A766C]">
              <span className="h-2 w-2 rounded-full bg-[#3BCB6B]" />
              <span>Online</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="rounded-full border border-[#E7D7CC] bg-[#FBF4EE] px-4 py-2 text-[#6B5A52] hover:bg-[#F3E7DE]"
          aria-label="More"
        >
          ⋯
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-4">
            {status && (
              <div className="rounded-2xl border border-[#E7D7CC] bg-[#FBF4EE] p-3 text-xs text-[#6B5A52]">
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
                No messages yet.
              </p>
            )}

            {sortedMessages.map((msg) => {
              const isOwnMessage = Boolean(me && msg.senderId === me.id);
              const timeLabel = new Date(msg.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
              });
              const otherAvatar =
                msg.sender?.maskAvatarUrl ??
                conversation.otherUser?.maskAvatarUrl ??
                null;
              const otherName =
                msg.sender?.maskName ??
                conversation.otherUser?.maskName ??
                "Anonymous";
              return (
                <div
                  key={msg.id}
                  className={isOwnMessage ? "flex justify-end" : "flex justify-start"}
                >
                  {!isOwnMessage ? (
                    <div className="mr-2 mt-1 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E7D7CC] text-[11px] font-semibold text-[#6B5A52]">
                      {otherAvatar ? (
                        <img
                          src={otherAvatar}
                          alt={otherName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{otherName.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                  ) : null}

                  <div className="max-w-[60%] min-w-[64px]">
                    <div
                      className={[
                        "px-4 py-3 rounded-2xl text-[15px] leading-relaxed",
                        "whitespace-pre-wrap break-words",
                        isOwnMessage
                          ? "bg-[#E3AFA0] text-white"
                          : "bg-[#F3EDE8] text-[#3A2E2A]"
                      ].join(" ")}
                    >
                      {msg.ciphertext}
                    </div>

                    <div
                      className={[
                        "mt-1 text-xs text-[#8A766C]",
                        isOwnMessage ? "text-right" : "text-left"
                      ].join(" ")}
                    >
                      {timeLabel}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[#E7D7CC] px-6 py-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
            className="flex items-center gap-3"
          >
            <input
              className="h-12 flex-1 rounded-full border border-[#E7D7CC] bg-[#FBF4EE] px-5 text-[#3A2E2A] placeholder:text-[#9B877D] outline-none focus:ring-2 focus:ring-[#E7D7CC]"
              placeholder="Type a message..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type="submit"
              className="h-12 w-12 rounded-full bg-[#B58B6D] text-white shadow hover:opacity-90"
              aria-label="Send"
              title="Send"
            >
              ➤
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
