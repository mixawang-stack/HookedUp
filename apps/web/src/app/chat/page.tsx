"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { getSupabaseClient } from "../lib/supabaseClient";
import { useSupabaseSession } from "../lib/useSupabaseSession";

export const dynamic = "force-dynamic";

const DEFAULT_REASON = "safety";
const PAGE_SIZE = 30;

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

function ChatPageContent() {
  const searchParams = useSearchParams();
  const matchIdParam = searchParams.get("matchId");
  const { user, ready, session } = useSupabaseSession();
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [activeMatch, setActiveMatch] = useState<MatchItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<
    NonNullable<ReturnType<typeof getSupabaseClient>>["channel"]
  > | null>(null);

  useEffect(() => {
    if (!ready || !user) {
      return;
    }
    const loadMatches = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setStatus("Supabase is not configured.");
        return;
      }
      const { data, error } = await supabase
        .from("Match")
        .select(
          "id,matchedAt,user1:User!Match_user1Id_fkey(id,maskName),user2:User!Match_user2Id_fkey(id,maskName)"
        )
        .or(`user1Id.eq.${user.id},user2Id.eq.${user.id}`)
        .order("matchedAt", { ascending: false })
        .limit(50);
      if (error) {
        setStatus("Failed to load links.");
        return;
      }
      setMatches((data ?? []) as MatchItem[]);
    };
    loadMatches().catch(() => setStatus("Failed to load links."));
  }, [ready, user]);

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
    if (!activeMatch) {
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }
    const channel = supabase
      .channel(`match-${activeMatch.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Message",
          filter: `matchId=eq.${activeMatch.id}`
        },
        (payload) => {
          const message = payload.new as MessageItem;
          setMessages((prev) => {
            if (prev.find((item) => item.id === message.id)) {
              return prev;
            }
            return [...prev, message];
          });
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [activeMatch?.id]);

  const joinMatch = async (match: MatchItem) => {
    setActiveMatch(match);
    setMessages([]);
    setCursor(null);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }

    const { data, error } = await supabase
      .from("Message")
      .select("id,matchId,senderId,ciphertext,createdAt")
      .eq("matchId", match.id)
      .order("createdAt", { ascending: false })
      .limit(PAGE_SIZE);

    if (error) {
      setStatus("Failed to load messages.");
      return;
    }

    const items = (data ?? []).reverse();
    setMessages(items);
    setCursor(items.length === PAGE_SIZE ? items[0].createdAt : null);
  };

  const loadMore = async () => {
    if (!activeMatch || !cursor) {
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }
    const { data, error } = await supabase
      .from("Message")
      .select("id,matchId,senderId,ciphertext,createdAt")
      .eq("matchId", activeMatch.id)
      .lt("createdAt", cursor)
      .order("createdAt", { ascending: false })
      .limit(PAGE_SIZE);

    if (error) {
      setStatus("Failed to load history.");
      return;
    }

    const items = (data ?? []).reverse();
    setMessages((prev) => [...items, ...prev]);
    setCursor(items.length === PAGE_SIZE ? items[0].createdAt : null);
  };

  const sendMessage = async () => {
    if (!activeMatch || !input.trim() || !user) {
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }
    const { error } = await supabase.from("Message").insert({
      matchId: activeMatch.id,
      senderId: user.id,
      ciphertext: input.trim()
    });
    if (error) {
      setStatus("Failed to send message.");
      return;
    }
    setInput("");
  };

  const report = async (targetType: "user" | "message", targetId: string) => {
    if (!session?.access_token) {
      return;
    }
    const detail = window.prompt("Report details?") ?? "";
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
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
    ? activeMatch.user1.id === user?.id
      ? activeMatch.user2
      : activeMatch.user1
    : null;

  return (
    <main className="ui-page mx-auto grid min-h-screen w-full max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[260px_1fr]">
      <section className="ui-card p-4">
        <h1 className="text-lg font-semibold text-text-primary">Private</h1>
        <p className="mt-1 text-xs text-text-secondary">
          Choose a private thread to start talking.
        </p>
        <div className="mt-4 space-y-2">
          {matches.map((match) => {
            const other =
              match.user1.id === user?.id ? match.user2 : match.user1;
            return (
              <button
                key={match.id}
                type="button"
                className={`w-full rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition ${
                  activeMatch?.id === match.id
                    ? "border-brand-primary bg-brand-primary text-card"
                    : "border-border-default bg-card text-text-secondary hover:border-brand-primary/40 hover:text-text-primary"
                }`}
                onClick={() => joinMatch(match)}
              >
                {other.maskName ?? "Anonymous"}
              </button>
            );
          })}
          {matches.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border-default bg-surface p-3 text-xs text-text-secondary">
              <p>No traces to start a private conversation yet.</p>
              <Link href="/hall" className="btn-primary mt-2">
                Forum
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="ui-card flex flex-col p-4">
        <div className="flex items-center justify-between border-b border-border-default pb-3">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {activeMatch ? "Conversation" : "Select a thread"}
            </h2>
            {status && <p className="text-xs text-text-secondary">{status}</p>}
          </div>
          <div className="flex items-center gap-2">
            {cursor && (
              <button type="button" className="btn-secondary" onClick={loadMore}>
                Load history
              </button>
            )}
            {activeOther && (
              <button
                type="button"
                className="btn-secondary text-brand-secondary"
                onClick={() => report("user", activeOther.id)}
              >
                Report user
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto py-4">
          {messages.length === 0 && (
            <p className="text-sm text-text-secondary">No messages yet.</p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col gap-1 ${
                msg.senderId === user?.id ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-xs rounded-2xl px-3 py-2 text-sm ${
                  msg.senderId === user?.id
                    ? "bg-brand-primary text-card"
                    : "bg-surface text-text-primary"
                }`}
              >
                {msg.ciphertext}
              </div>
              {msg.senderId !== user?.id && (
                <button
                  type="button"
                  className="text-xs text-brand-secondary"
                  onClick={() => report("message", msg.id)}
                >
                  Report
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-auto flex gap-2 border-t border-border-default pt-3">
          <input
            className="flex-1 rounded-full border border-border-default bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
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
            className="btn-primary text-sm"
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
