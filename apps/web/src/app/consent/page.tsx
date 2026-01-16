"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

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

export default function ConsentPage() {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [activeMatch, setActiveMatch] = useState<MatchItem | null>(null);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [status, setStatus] = useState<string | null>(null);

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
          throw new Error("Failed to load threads");
        }
        return readPagedResponse<MatchItem>(res);
      })
      .then((data) => setMatches(data.items))
      .catch(() => setStatus("Failed to load threads."));
  }, [authHeader]);

  const loadConsent = async (matchId: string) => {
    if (!authHeader) {
      return;
    }

    const res = await fetch(`${API_BASE}/consent/${matchId}`, {
      headers: { ...authHeader }
    });

    if (!res.ok) {
      setStatus("Failed to load agreement.");
      return;
    }

    const data = (await res.json()) as ConsentRecord | null;
    setConsent(data);
  };

  const initConsent = async () => {
    if (!authHeader || !activeMatch) {
      return;
    }

    const res = await fetch(`${API_BASE}/consent/${activeMatch.id}/init`, {
      method: "POST",
      headers: { ...authHeader }
    });

    if (!res.ok) {
      setStatus("Failed to initialize agreement.");
      return;
    }

    const data = (await res.json()) as ConsentRecord;
    setConsent(data);
  };

  const confirmConsent = async () => {
    if (!authHeader || !activeMatch) {
      return;
    }

    const res = await fetch(`${API_BASE}/consent/${activeMatch.id}/confirm`, {
      method: "POST",
      headers: { ...authHeader }
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
    if (!consent || !userId) {
      return false;
    }
    if (userId === consent.userAId) {
      return !consent.confirmedAtA;
    }
    if (userId === consent.userBId) {
      return !consent.confirmedAtB;
    }
    return false;
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl gap-6 p-6">
      <section className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Agreements</h1>
        <p className="mt-1 text-xs text-slate-500">
          Select a private thread to record an agreement.
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
                onClick={() => handleSelect(match)}
              >
                {other.maskName ?? "Anonymous"}
              </button>
            );
          })}
          {matches.length === 0 && (
            <p className="text-xs text-slate-500">No threads yet.</p>
          )}
        </div>
      </section>

      <section className="flex w-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {activeMatch ? "Agreement" : "Select a thread"}
            </h2>
            {status && <p className="text-xs text-slate-500">{status}</p>}
          </div>
          {activeMatch && (
            <button
              type="button"
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
              onClick={loadConsent.bind(null, activeMatch.id)}
            >
              Refresh
            </button>
          )}
        </div>

        {activeMatch ? (
          <div className="mt-4 space-y-3">
            {consent ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  Agreement status: {getConsentStatus()}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Both parties confirm before proceeding further.
                </p>
                {consent?.hash && (
                  <p className="mt-3 text-xs text-slate-500">
                    Hash: {consent.hash}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  {canConfirm() && (
                    <button
                      type="button"
                      className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                      onClick={confirmConsent}
                    >
                      Confirm
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-4">
                <p className="text-sm text-slate-600">
                  Start a new agreement for this thread.
                </p>
                <button
                  type="button"
                  className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                  onClick={initConsent}
                >
                  Start agreement
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Select a thread to continue.
          </p>
        )}
      </section>
    </main>
  );
}
