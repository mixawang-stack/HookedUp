"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { emitHostStatus } from "../../lib/hostStatus";
import ChatBubble from "../../components/ChatBubble";
import PageShell from "../../components/PageShell";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { useSupabaseSession } from "../../lib/useSupabaseSession";

const FF_INTENT_12 =
  (process.env.NEXT_PUBLIC_FF_INTENT_12 ?? "false") === "true";
const PAGE_SIZE = 30;

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

type IntentData = {
  intent: {
    id: string;
    conversationId: string;
    requesterId: string;
    responderId: string;
    status: "PENDING" | "CONFIRMED";
    termsVersion: string;
    requestedAt: string;
    requesterConfirmedAt: string | null;
    responderConfirmedAt: string | null;
    confirmedAt: string | null;
    viewerId: string;
  };
  safetyPack: null;
};

export default function PrivateConversationPage() {
  const router = useRouter();
  const params = useParams();
  const conversationId = typeof params?.id === "string" ? params.id : "";

  const { user, ready, session } = useSupabaseSession();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [intentData, setIntentData] = useState<IntentData | null>(null);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [showIntentPanel, setShowIntentPanel] = useState(false);
  const [me, setMe] = useState<SenderProfile | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<
    NonNullable<ReturnType<typeof getSupabaseClient>>["channel"]
  > | null>(null);

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (!user) {
      router.push(`/login?redirect=/private/${conversationId}`);
    }
  }, [ready, router, user, conversationId]);

  useEffect(() => {
    if (!user) {
      setMe(null);
      return;
    }
    const loadMe = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return;
      }
      const { data } = await supabase
        .from("User")
        .select("id,maskName,maskAvatarUrl")
        .eq("id", user.id)
        .maybeSingle();
      setMe(data ? (data as SenderProfile) : null);
    };
    loadMe().catch(() => setMe(null));
  }, [user]);

  const loadConversation = async () => {
    if (!user || !conversationId) {
      return null;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return null;
    }
    const { data, error } = await supabase
      .from("Conversation")
      .select(
        "id,matchId,participants:ConversationParticipant(userId,isMuted)"
      )
      .eq("id", conversationId)
      .maybeSingle();
    if (error || !data) {
      setStatus("Failed to load conversation.");
      return null;
    }
    const participant = data.participants?.find(
      (item: { userId: string }) => item.userId === user.id
    );
    setIsMuted(Boolean(participant?.isMuted));
    setMatchId(data.matchId ?? null);
    return data.matchId ?? null;
  };

  const loadMessages = async (nextCursor?: string | null) => {
    if (!user) {
      return;
    }
    setLoading(true);
    try {
      const conversationMatchId = matchId ?? (await loadConversation());
      if (!conversationMatchId) {
        return;
      }
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }
      let query = supabase
        .from("Message")
        .select(
          "id,matchId,senderId,ciphertext,createdAt,sender:User(id,maskName,maskAvatarUrl)"
        )
        .eq("matchId", conversationMatchId)
        .order("createdAt", { ascending: false })
        .limit(PAGE_SIZE);
      if (nextCursor) {
        query = query.lt("createdAt", nextCursor);
      }
      const { data, error } = await query;
      if (error) {
        throw new Error("Failed to load.");
      }
      const items =
        (data ?? []).map((item) => ({
          ...item,
          sender: item.sender?.[0] ?? null
        })) ?? [];
      const ordered = items.reverse();
      setMessages((prev) =>
        nextCursor ? [...ordered, ...prev] : ordered
      );
      setCursor(ordered.length === PAGE_SIZE ? ordered[0].createdAt : null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load.";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [messages]
  );

  useEffect(() => {
    emitHostStatus({ page: "private", cold: sortedMessages.length === 0 });
  }, [sortedMessages]);

  useEffect(() => {
    if (!user || !conversationId) {
      return;
    }
    loadMessages(null).catch(() => setStatus("Failed to load."));
  }, [user, conversationId]);

  useEffect(() => {
    if (!matchId) {
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Message",
          filter: `matchId=eq.${matchId}`
        },
        (payload) => {
          const message = payload.new as MessageItem;
          if (!user) {
            return;
          }
          const attachSender = async () => {
            const supabase = getSupabaseClient();
            if (!supabase) {
              return { ...message, sender: null };
            }
            if (message.senderId === user.id) {
              return { ...message, sender: me };
            }
            const { data } = await supabase
              .from("User")
              .select("id,maskName,maskAvatarUrl")
              .eq("id", message.senderId)
              .maybeSingle();
            return { ...message, sender: (data as SenderProfile) ?? null };
          };

          attachSender()
            .then((withSender) => {
              setMessages((prev) => {
                if (prev.find((item) => item.id === withSender.id)) {
                  return prev;
                }
                return [...prev, withSender];
              });
            })
            .catch(() => {
              setMessages((prev) => {
                if (prev.find((item) => item.id === message.id)) {
                  return prev;
                }
                return [...prev, message];
              });
            });
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [conversationId, matchId, me, user]);

  const requestIntent = async () => {
    if (!conversationId) {
      setIntentError("Please sign in to continue.");
      return;
    }
    if (!session?.access_token) {
      setIntentError("Please sign in to continue.");
      return;
    }
    setIntentLoading(true);
    setIntentError(null);
    try {
      const res = await fetch("/api/intent/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ conversationId })
      });
      if (!res.ok) {
        throw new Error("Action failed.");
      }
      const data = (await res.json()) as IntentData["intent"];
      setIntentData({
        intent: { ...data, viewerId: user?.id ?? "" },
        safetyPack: null
      });
      setShowIntentPanel(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed.";
      setIntentError(message);
    } finally {
      setIntentLoading(false);
    }
  };

  const confirmIntent = async () => {
    if (!intentData) {
      return;
    }
    if (!session?.access_token) {
      setIntentError("Please sign in to continue.");
      return;
    }
    setIntentLoading(true);
    setIntentError(null);
    try {
      const res = await fetch("/api/intent/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ intentId: intentData.intent.id })
      });
      if (!res.ok) {
        throw new Error("Confirmation failed.");
      }
      const data = (await res.json()) as IntentData["intent"];
      setIntentData({
        intent: { ...data, viewerId: user?.id ?? "" },
        safetyPack: null
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Confirmation failed.";
      setIntentError(message);
    } finally {
      setIntentLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!user || !matchId) {
      setStatus("Please sign in to send messages.");
      return;
    }
    if (!input.trim()) {
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }
      const { data, error } = await supabase
        .from("Message")
        .insert({
          matchId,
          senderId: user.id,
          ciphertext: input.trim()
        })
        .select(
          "id,matchId,senderId,ciphertext,createdAt,sender:User(id,maskName,maskAvatarUrl)"
        )
        .maybeSingle();
      if (error || !data) {
        throw new Error("Failed to send.");
      }
      const nextMessage: MessageItem = {
        id: data.id,
        matchId: data.matchId,
        senderId: data.senderId,
        ciphertext: data.ciphertext,
        createdAt: data.createdAt,
        sender: data.sender?.[0] ?? null
      };
      setMessages((prev) => [...prev, nextMessage]);
      setInput("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send.";
      setStatus(message);
    } finally {
      setSending(false);
    }
  };

  const stageContent = (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Private</h1>
            <p className="text-xs text-text-secondary">
              <span className="block">This conversation is yours.</span>
              <span className="block">Take it at your own pace.</span>
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary px-3 py-1 text-xs"
            onClick={() => loadMessages(null)}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {isMuted && (
          <p className="ui-surface px-3 py-2 text-xs text-brand-secondary">
            This conversation is muted. New messages will not notify.
          </p>
        )}
        {FF_INTENT_12 && (
          <div className="ui-surface p-3 text-sm text-text-secondary">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">Take this offline</p>
                <p className="mt-1 text-xs text-text-muted">
                  Safety Pack shows only after both confirm. No auto-push.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary px-4 py-1 text-xs"
                onClick={() => setShowIntentPanel(true)}
                disabled={intentLoading}
              >
                Request
              </button>
            </div>
            {showIntentPanel && (
              <div className="mt-3 ui-card p-3 text-xs text-text-secondary">
                <p>Confirming sends a request. The other person must confirm.</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary px-3 py-1 text-xs"
                    onClick={() => setShowIntentPanel(false)}
                    disabled={intentLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary px-3 py-1 text-xs"
                    onClick={requestIntent}
                    disabled={intentLoading}
                  >
                    {intentLoading ? "Submitting..." : "Confirm request"}
                  </button>
                </div>
              </div>
            )}
            {intentData && (
              <div className="mt-3 ui-card p-3 text-xs text-text-secondary">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    Status:
                    {intentData.intent.status === "CONFIRMED"
                      ? "Confirmed"
                      : "Pending confirmation"}
                  </p>
                  <button
                    type="button"
                    className="btn-secondary px-3 py-1 text-xs"
                    onClick={requestIntent}
                    disabled={intentLoading}
                  >
                    {intentLoading ? "Syncing..." : "Refresh status"}
                  </button>
                </div>
                {intentData.intent.status === "PENDING" &&
                  intentData.intent.responderId === intentData.intent.viewerId && (
                    <button
                      type="button"
                      className="mt-2 btn-primary px-3 py-1 text-xs"
                      onClick={confirmIntent}
                      disabled={intentLoading}
                    >
                      {intentLoading ? "Confirming..." : "Confirm offline intent"}
                    </button>
                  )}
              </div>
            )}
            {intentError && (
              <p className="mt-2 text-xs text-brand-secondary">{intentError}</p>
            )}
          </div>
        )}
        {status && <p className="text-sm text-brand-secondary">{status}</p>}
      </div>
      <div className="space-y-4">
        {cursor && (
          <div className="flex justify-end">
            <button
              type="button"
              className="btn-secondary px-3 py-1 text-xs"
              onClick={() => loadMessages(cursor)}
              disabled={loading}
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
        {sortedMessages.length === 0 ? (
          <p className="text-sm text-text-muted">No messages yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedMessages.map((msg, index) => {
              const isOwnMessage = Boolean(me && msg.senderId === me.id);
              const prev = sortedMessages[index - 1];
              const showMeta = index === 0 || prev?.senderId !== msg.senderId;
              return (
                <ChatBubble
                  key={msg.id}
                  message={{
                    ...msg,
                    sender:
                      msg.sender ??
                      (me && msg.senderId === me.id ? me : null)
                  }}
                  isMine={isOwnMessage}
                  showMeta={showMeta}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  const panelContent = (
    <div className="space-y-5">
      <div className="ui-card p-4 text-sm text-text-secondary">
        <label className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Say something
        </label>
        <textarea
          className="mt-2 w-full rounded-2xl border border-border-default bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
          rows={3}
          placeholder="Say something when it feels right."
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              sendMessage();
            }
          }}
        />
        <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
          <span>{input.length} chars</span>
          <button
            type="button"
            className="btn-primary px-4 py-2 text-xs"
            onClick={sendMessage}
            disabled={sending}
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
      <div className="ui-card p-4 text-sm text-text-secondary">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Controls
        </h3>
        <div className="mt-3 space-y-2">
          <button
            type="button"
            className="btn-secondary w-full px-3 py-2 text-xs"
          >
            Pause conversation
          </button>
          <button
            type="button"
            className="btn-secondary w-full px-3 py-2 text-xs"
          >
            Mute conversation
          </button>
        </div>
      </div>
    </div>
  );

  return <PageShell stage={stageContent} panel={panelContent} />;
}
