"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { emitHostStatus } from "../../lib/hostStatus";
import ChatBubble from "../../components/ChatBubble";
import PageShell from "../../components/PageShell";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const FF_INTENT_12 =
  (process.env.NEXT_PUBLIC_FF_INTENT_12 ?? "false") === "true";

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

type SafetyPack = {
  termsVersion: string;
  country: string;
  legalReminder: string[];
  safetyTips: string[];
  notice: string;
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
  safetyPack: SafetyPack | null;
};

export default function PrivateConversationPage() {
  const router = useRouter();
  const params = useParams();
  const conversationId = typeof params?.id === "string" ? params.id : "";

  const [token, setToken] = useState<string | null>(null);
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

  const authHeader = useMemo(() => {
    if (!token) {
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const redirectToLogin = (message?: string) => {
    localStorage.removeItem("accessToken");
    setStatus(message ?? "Please sign in to continue.");
    router.push(`/login?redirect=/private/${conversationId}`);
  };

  useEffect(() => {
    setToken(localStorage.getItem("accessToken"));
  }, []);

  useEffect(() => {
    if (!authHeader) {
      setMe(null);
      return;
    }
    let isActive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/me`, {
          headers: { ...authHeader }
        });
        if (!res.ok) {
          throw new Error("Failed to load profile");
        }
        const data = await res.json();
        if (isActive) {
          setMe(data);
        }
      } catch {
        if (isActive) {
          setMe(null);
        }
      }
    })();
    return () => {
      isActive = false;
    };
  }, [authHeader]);

  const loadMessages = async (nextCursor?: string | null) => {
    if (!authHeader || !conversationId) {
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextCursor) {
        params.set("cursor", nextCursor);
      }
      const res = await fetch(
        `${API_BASE}/private/conversations/${conversationId}/messages?${params}`,
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
        throw new Error(errorMessage);
      }
      const data = (await res.json()) as MessagesResponse;
      setMessages((prev) =>
        nextCursor ? [...data.items.reverse(), ...prev] : data.items.reverse()
      );
      setCursor(data.nextCursor);
      setIsMuted(Boolean(data.isMuted));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load.";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  const sortedMessages = useMemo(
    () =>
      [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [messages]
  );

  useEffect(() => {
    emitHostStatus({ page: "private", cold: sortedMessages.length === 0 });
  }, [sortedMessages]);


  useEffect(() => {
    loadMessages(null).catch(() => setStatus("Failed to load."));
  }, [authHeader, conversationId]);

  const requestIntent = async () => {
    if (!authHeader || !conversationId) {
      setIntentError("Please sign in to continue.");
      return;
    }
    setIntentLoading(true);
    setIntentError(null);
    try {
      const res = await fetch(`${API_BASE}/intent/offline/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({ conversationId })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as IntentData;
      setIntentData(data);
      setShowIntentPanel(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed.";
      setIntentError(message);
    } finally {
      setIntentLoading(false);
    }
  };

  const confirmIntent = async () => {
    if (!authHeader || !intentData) {
      return;
    }
    setIntentLoading(true);
    setIntentError(null);
    try {
      const res = await fetch(`${API_BASE}/intent/offline/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({ intentId: intentData.intent.id })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as IntentData;
      setIntentData(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Confirmation failed.";
      setIntentError(message);
    } finally {
      setIntentLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!authHeader || !conversationId) {
      setStatus("Please sign in to send messages.");
      return;
    }
    if (!input.trim()) {
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch(
        `${API_BASE}/private/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader
          },
          body: JSON.stringify({ content: input })
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
            <h1 className="text-2xl font-semibold text-white">Private</h1>
            <p className="text-xs text-slate-300">
              <span className="block">This conversation is yours.</span>
              <span className="block">Take it at your own pace.</span>
            </p>
          </div>
          <button
            type="button"
            className="self-start rounded-full border border-slate-500 px-3 py-1 text-xs font-semibold text-white"
            onClick={() => loadMessages(null)}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {isMuted && (
          <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            This conversation is muted. New messages won’t notify.
          </p>
        )}
        {FF_INTENT_12 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">Take this offline</p>
                <p className="mt-1 text-xs text-amber-700">
                  Safety Pack shows only after both confirm. No auto-push.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-amber-300 bg-white px-4 py-1 text-xs font-semibold text-amber-900"
                onClick={() => setShowIntentPanel(true)}
                disabled={intentLoading}
              >
                Request
              </button>
            </div>
            {showIntentPanel && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-white p-3 text-xs text-amber-800">
                <p>Confirming sends a request. The other person must confirm.</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-amber-200 px-3 py-1"
                    onClick={() => setShowIntentPanel(false)}
                    disabled={intentLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-amber-600 px-3 py-1 font-semibold text-white"
                    onClick={requestIntent}
                    disabled={intentLoading}
                  >
                    {intentLoading ? "Submitting..." : "Confirm request"}
                  </button>
                </div>
              </div>
            )}
            {intentData && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-white p-3 text-xs text-amber-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    Status:
                    {intentData.intent.status === "CONFIRMED"
                      ? "Confirmed"
                      : "Pending confirmation"}
                  </p>
                  <button
                    type="button"
                    className="rounded-full border border-amber-200 px-3 py-1"
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
                      className="mt-2 rounded-full bg-amber-600 px-3 py-1 font-semibold text-white"
                      onClick={confirmIntent}
                      disabled={intentLoading}
                    >
                      {intentLoading ? "Confirming..." : "Confirm offline intent"}
                    </button>
                  )}
                {intentData.intent.status === "CONFIRMED" &&
                  intentData.safetyPack && (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <p className="font-semibold">Safety Pack</p>
                      <p className="mt-1 text-xs text-amber-700">
                        Country: {intentData.safetyPack.country}
                      </p>
                      <div className="mt-2">
                        <p className="font-semibold">Legal reminder</p>
                        <ul className="mt-1 list-disc pl-4">
                          {intentData.safetyPack.legalReminder.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="mt-2">
                        <p className="font-semibold">Safety tips</p>
                        <ul className="mt-1 list-disc pl-4">
                          {intentData.safetyPack.safetyTips.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <p className="mt-2">{intentData.safetyPack.notice}</p>
                    </div>
                  )}
              </div>
            )}
            {intentError && (
              <p className="mt-2 text-xs text-rose-600">{intentError}</p>
            )}
          </div>
        )}
        {status && <p className="text-sm text-rose-400">{status}</p>}
      </div>
      <div className="space-y-4">
        {cursor && (
          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-full border border-slate-500/70 px-3 py-1 text-xs font-semibold text-white"
              onClick={() => loadMessages(cursor)}
              disabled={loading}
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
        {sortedMessages.length === 0 ? (
          <p className="text-sm text-slate-400">No messages yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
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
        )}
      </div>
    </>
  );

  const panelContent = (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200 shadow-sm backdrop-blur">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Say something
        </label>
        <textarea
          className="mt-2 w-full rounded-2xl border border-slate-600/80 bg-slate-950/30 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
          rows={3}
          placeholder="Say something when it feels right…"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              sendMessage();
            }
          }}
        />
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span>{input.length} chars</span>
          <button
            type="button"
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
            onClick={sendMessage}
            disabled={sending}
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200 shadow-sm backdrop-blur">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Controls
        </h3>
        <div className="mt-3 space-y-2">
          <button
            type="button"
            className="w-full rounded-full border border-slate-500/70 px-3 py-2 text-xs font-semibold text-white"
          >
            Pause conversation
          </button>
          <button
            type="button"
            className="w-full rounded-full border border-slate-500/70 px-3 py-2 text-xs font-semibold text-white"
          >
            Mute conversation
          </button>
        </div>
      </div>
    </div>
  );

  return <PageShell stage={stageContent} panel={panelContent} />;
}
