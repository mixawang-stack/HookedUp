"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type Recommendation = {
  id: string;
  maskName: string | null;
  maskAvatarUrl: string | null;
  country: string | null;
  preference?: {
    gender: string | null;
    lookingForGender: string | null;
    smPreference: string | null;
    tagsJson: string[] | null;
  } | null;
};

type MatchItem = {
  id: string;
  matchedAt: string;
  user1: { id: string; maskName: string | null; maskAvatarUrl: string | null };
  user2: { id: string; maskName: string | null; maskAvatarUrl: string | null };
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

export default function MatchPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recCursor, setRecCursor] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [matchCursor, setMatchCursor] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [matchPrompt, setMatchPrompt] = useState<MatchItem | null>(null);

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
          throw new Error("Failed to load profile.");
        }
        return res.json();
      })
      .then((data: { id: string }) => {
        setCurrentUserId(data.id);
      })
      .catch(() => {
        setMessage("Failed to load profile.");
      });
  }, [authHeader]);

  const loadRecommendations = async (cursor?: string | null) => {
    if (!authHeader) {
      return;
    }

    const params = new URLSearchParams();
    if (cursor) {
      params.set("cursor", cursor);
    }

    const res = await fetch(`${API_BASE}/match/recommendations?${params}`, {
      headers: { ...authHeader }
    });

    if (!res.ok) {
      setMessage("Failed to load the hall.");
      return;
    }

    const data = await readPagedResponse<Recommendation>(res);
    setRecommendations((prev) =>
      cursor ? [...prev, ...data.items] : data.items
    );
    setRecCursor(data.nextCursor ?? null);
  };

  const loadMatches = async (cursor?: string | null) => {
    if (!authHeader) {
      return [] as MatchItem[];
    }

    const params = new URLSearchParams();
    if (cursor) {
      params.set("cursor", cursor);
    }

    const res = await fetch(`${API_BASE}/match/list?${params}`, {
      headers: { ...authHeader }
    });

    if (!res.ok) {
      setMessage("Failed to load traces.");
      return [] as MatchItem[];
    }

    const data = await readPagedResponse<MatchItem>(res);
    setMatches((prev) => (cursor ? [...prev, ...data.items] : data.items));
    setMatchCursor(data.nextCursor ?? null);
    return data.items;
  };

  useEffect(() => {
    loadRecommendations(null).catch(() => setMessage("Failed to load data."));
    loadMatches(null).catch(() => setMessage("Failed to load data."));
  }, [authHeader]);

  const swipe = async (toUserId: string, action: "LIKE" | "PASS") => {
    if (!authHeader) {
      return;
    }

    const res = await fetch(`${API_BASE}/match/swipe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader
      },
      body: JSON.stringify({ toUserId, action })
    });

    if (!res.ok) {
      setMessage("Action failed.");
      return;
    }

    const data = (await res.json()) as { matchCreated?: boolean };
    await loadRecommendations(null);
    const latestMatches = await loadMatches(null);

    if (data.matchCreated && latestMatches.length > 0) {
      setMatchPrompt(latestMatches[0]);
    }
  };

  const handleContinueHall = () => {
    setMatchPrompt(null);
  };

  const handleStartChat = () => {
    if (!matchPrompt) {
      return;
    }
    setMatchPrompt(null);
    router.push("/private");
  };

  const promptOther = matchPrompt
    ? matchPrompt.user1.id === currentUserId
      ? matchPrompt.user2
      : matchPrompt.user1
    : null;

  return (
    <main className="ui-page mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <section className="ui-card p-6">
        <h1 className="text-2xl font-semibold text-text-primary">Grand Hall</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Walk the hall, leave a trace, and see who echoes back.
        </p>
        {message && <p className="mt-2 text-sm text-text-secondary">{message}</p>}
      </section>

      <section className="ui-card p-6">
        <h2 className="text-lg font-semibold text-text-primary">Hall Guests</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {recommendations.length === 0 && (
            <p className="text-sm text-text-secondary">The hall is quiet for now.</p>
          )}
          {recommendations.map((rec) => (
            <div key={rec.id} className="ui-surface flex flex-col gap-4 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-border-default bg-card">
                  {rec.maskAvatarUrl ? (
                    <img
                      src={rec.maskAvatarUrl}
                      alt="avatar"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {rec.maskName ?? "Anonymous"}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {rec.preference?.gender ?? ""} {rec.country ?? ""}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-primary"
                  onClick={() => swipe(rec.id, "LIKE")}
                >
                  Leave a trace
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => swipe(rec.id, "PASS")}
                >
                  Move on
                </button>
              </div>
            </div>
          ))}
        </div>
        {recCursor && (
          <button
            type="button"
            className="btn-secondary mt-4"
            onClick={() => loadRecommendations(recCursor)}
          >
            Load more
          </button>
        )}
      </section>

      <section className="ui-card p-6">
        <h2 className="text-lg font-semibold text-text-primary">Your traces</h2>
        <div className="mt-4 space-y-3">
          {matches.length === 0 && (
            <p className="text-sm text-text-secondary">No traces yet.</p>
          )}
          {matches.map((match) => {
            const other =
              match.user1.id === currentUserId ? match.user2 : match.user1;
            return (
              <div
                key={match.id}
                className="ui-surface flex items-center justify-between p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {other.maskName ?? "Anonymous"}
                  </p>
                  <p className="text-xs text-text-secondary">
                    Trace at {new Date(match.matchedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        {matchCursor && (
          <button
            type="button"
            className="btn-secondary mt-4"
            onClick={() => loadMatches(matchCursor)}
          >
            Load more
          </button>
        )}
      </section>

      {matchPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/20 p-6 backdrop-blur-sm">
          <div className="ui-card w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-text-primary">Hall echo</h3>
            <p className="mt-2 text-sm text-text-secondary">
              You and {promptOther?.maskName ?? "a guest"} noticed each other.
              Start a private thread?
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={handleContinueHall}
              >
                Keep wandering
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={handleStartChat}
              >
                Start private
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
