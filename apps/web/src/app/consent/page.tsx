"use client";

import { useEffect, useState } from "react";

import { useSupabaseSession } from "../lib/useSupabaseSession";

export const dynamic = "force-dynamic";

type MatchItem = {
  id: string;
  matchedAt: string;
  user1: { id: string; maskName: string | null };
  user2: { id: string; maskName: string | null };
};

type ConsentRecord = {
  id: string;
  matchId: string;
  userAId: string;
  userBId: string;
  termsVersion: string;
  hash: string;
  confirmedAtA: string | null;
  confirmedAtB: string | null;
};

export default function ConsentPage() {
  const { user, ready, session } = useSupabaseSession();
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [activeMatch, setActiveMatch] = useState<MatchItem | null>(null);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [status, setStatus] = useState<string | null>(null);

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
        setStatus("Failed to load threads.");
        return;
      }
      setMatches((data ?? []) as MatchItem[]);
    };
    loadMatches().catch(() => setStatus("Failed to load threads."));
  }, [ready, user]);

  const loadConsent = async (matchId: string) => {
    if (!session?.access_token) {
      setStatus("Please sign in again.");
      return;
    }
    const res = await fetch(`/api/consent/${matchId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    if (!res.ok) {
      setStatus("Failed to load agreement.");
      return;
    }
    const data = (await res.json()) as ConsentRecord | null;
    setConsent(data);
  };

  const initConsent = async () => {
    if (!activeMatch) {
      return;
    }
    if (!session?.access_token) {
      setStatus("Please sign in again.");
      return;
    }
    const res = await fetch(`/api/consent/${activeMatch.id}/init`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    if (!res.ok) {
      setStatus("Failed to initialize agreement.");
      return;
    }
    const data = (await res.json()) as ConsentRecord;
    setConsent(data);
  };

  const confirmConsent = async () => {
    if (!activeMatch || !consent) {
      return;
    }
    if (!session?.access_token) {
      setStatus("Please sign in again.");
      return;
    }
    const res = await fetch(`/api/consent/${activeMatch.id}/confirm`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    if (!res.ok) {
      setStatus("Failed to confirm agreement.");
      return;
    }
    const data = (await res.json()) as ConsentRecord;
    setConsent(data);
  };

  const handleSelect = async (match: MatchItem) => {
    setActiveMatch(match);
    setConsent(null);
    setStatus(null);
    await loadConsent(match.id);
  };

  const getConsentStatus = () => {
    if (!consent) {
      return "Pending";
    }
    return consent.confirmedAtA && consent.confirmedAtB ? "Completed" : "Pending";
  };

  const canConfirm = () => {
    if (!consent || !user) {
      return false;
    }
    if (user.id === consent.userAId) {
      return !consent.confirmedAtA;
    }
    if (user.id === consent.userBId) {
      return !consent.confirmedAtB;
    }
    return false;
  };

  return (
    <main className="ui-page mx-auto grid min-h-screen w-full max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[260px_1fr]">
      <section className="ui-card p-4">
        <h1 className="text-lg font-semibold text-text-primary">Agreements</h1>
        <p className="mt-1 text-xs text-text-secondary">
          Select a private thread to record an agreement.
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
                onClick={() => handleSelect(match)}
              >
                {other.maskName ?? "Anonymous"}
              </button>
            );
          })}
          {matches.length === 0 && (
            <p className="text-xs text-text-secondary">No threads yet.</p>
          )}
        </div>
      </section>

      <section className="ui-card flex flex-col p-4">
        <div className="flex items-center justify-between border-b border-border-default pb-3">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {activeMatch ? "Agreement" : "Select a thread"}
            </h2>
            {status && <p className="text-xs text-text-secondary">{status}</p>}
          </div>
          {activeMatch && (
            <button
              type="button"
              className="btn-secondary"
              onClick={loadConsent.bind(null, activeMatch.id)}
            >
              Refresh
            </button>
          )}
        </div>

        {activeMatch ? (
          <div className="mt-4 space-y-3">
            {consent ? (
              <div className="ui-surface p-4">
                <p className="text-sm font-semibold text-text-primary">
                  Agreement status: {getConsentStatus()}
                </p>
                <p className="mt-2 text-xs text-text-secondary">
                  Both parties confirm before proceeding further.
                </p>
                {consent?.hash && (
                  <p className="mt-3 text-xs text-text-secondary">
                    Hash: {consent.hash}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  {canConfirm() && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={confirmConsent}
                    >
                      Confirm
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border-default bg-surface p-4">
                <p className="text-sm text-text-secondary">
                  Start a new agreement for this thread.
                </p>
                <button
                  type="button"
                  className="btn-primary mt-3"
                  onClick={initConsent}
                >
                  Start agreement
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-secondary">
            Select a thread to continue.
          </p>
        )}
      </section>
    </main>
  );
}
