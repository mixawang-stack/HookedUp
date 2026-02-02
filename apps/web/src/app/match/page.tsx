"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseClient } from "../lib/supabaseClient";
import { useSupabaseSession } from "../lib/useSupabaseSession";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const CANDIDATE_MULTIPLIER = 3;
const COOLDOWN_HOURS = 24;

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

type MeProfile = {
  id: string;
  emailVerifiedAt: string | null;
  ageVerifiedAt: string | null;
  healthVerifiedAt: string | null;
  status: string | null;
  country: string | null;
  preference?: {
    gender: string | null;
    lookingForGender: string | null;
    tagsJson: string[] | null;
  } | null;
};

const normalizePair = (userA: string, userB: string) =>
  userA < userB ? [userA, userB] : [userB, userA];

const rankCandidates = (
  candidates: Recommendation[],
  userTags: string[] | null,
  userCountry: string | null
) => {
  const normalizedTags = (userTags ?? []).map((tag) => tag.toLowerCase());
  const tagSet = new Set(normalizedTags);

  return candidates
    .map((candidate) => {
      const candidateTags = candidate.preference?.tagsJson ?? [];
      let overlap = 0;
      for (const tag of candidateTags ?? []) {
        if (tagSet.has(String(tag).toLowerCase())) {
          overlap += 1;
        }
      }
      const hasAvatar = candidate.maskAvatarUrl ? 1 : 0;
      const sameCountry =
        userCountry && candidate.country === userCountry ? 1 : 0;
      return {
        candidate,
        score: overlap * 2 + hasAvatar + sameCountry
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return 0;
    })
    .map((item) => item.candidate);
};

export default function MatchPage() {
  const router = useRouter();
  const { user, ready, session } = useSupabaseSession();
  const [me, setMe] = useState<MeProfile | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recCursor, setRecCursor] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [matchCursor, setMatchCursor] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [matchPrompt, setMatchPrompt] = useState<MatchItem | null>(null);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (!user) {
      router.push("/login?redirect=/match");
    }
  }, [ready, router, user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const loadMe = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setMessage("Supabase is not configured.");
        return;
      }
      const { data } = await supabase
        .from("User")
        .select(
          "id,emailVerifiedAt,ageVerifiedAt,healthVerifiedAt,status,country,preference:Preference(gender,lookingForGender,tagsJson)"
        )
        .eq("id", user.id)
        .maybeSingle();
      if (!data) {
        setMessage("Failed to load profile.");
        return;
      }
      setMe({
        id: data.id,
        emailVerifiedAt: data.emailVerifiedAt ?? null,
        ageVerifiedAt: data.ageVerifiedAt ?? null,
        healthVerifiedAt: data.healthVerifiedAt ?? null,
        status: data.status ?? null,
        country: data.country ?? null,
        preference: data.preference?.[0]
          ? {
              gender: data.preference[0].gender ?? null,
              lookingForGender: data.preference[0].lookingForGender ?? null,
              tagsJson: data.preference[0].tagsJson ?? null
            }
          : null
      });
    };
    loadMe().catch(() => setMessage("Failed to load profile."));
  }, [user]);

  const canRecommend = useMemo(() => {
    if (!me) return false;
    if (!me.emailVerifiedAt) return false;
    if (me.status === "BANNED") return false;
    if (!me.ageVerifiedAt || !me.healthVerifiedAt) return false;
    if (!me.preference?.gender || !me.preference?.lookingForGender) return false;
    return true;
  }, [me]);

  const loadRecommendations = async (cursor?: string | null) => {
    if (!user || !me) {
      return;
    }
    if (!canRecommend) {
      setRecommendations([]);
      return;
    }
    setLoadingRecs(true);
    setMessage(null);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }
      const take = Math.min(DEFAULT_LIMIT, MAX_LIMIT);
      const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);

      const [{ data: swipes }, { data: exposures }] = await Promise.all([
        supabase
          .from("Swipe")
          .select("toUserId")
          .eq("fromUserId", user.id),
        supabase
          .from("RecommendationExposure")
          .select("targetId,lastShownAt")
          .eq("viewerId", user.id)
          .gte("lastShownAt", cutoff.toISOString())
      ]);

      const swipedIds = new Set((swipes ?? []).map((item) => item.toUserId));
      const exposureIds = new Set(
        (exposures ?? []).map((item) => item.targetId)
      );

      let query = supabase
        .from("User")
        .select(
          "id,maskName,maskAvatarUrl,country,updatedAt,preference:Preference(gender,lookingForGender,smPreference,tagsJson)"
        )
        .neq("id", user.id)
        .neq("role", "OFFICIAL")
        .order("updatedAt", { ascending: false })
        .limit(Math.min(take * CANDIDATE_MULTIPLIER, MAX_LIMIT));

      if (cursor) {
        query = query.lt("updatedAt", cursor);
      }

      const { data: candidates, error } = await query;
      if (error) {
        throw new Error("Failed to load recommendations.");
      }

      const filtered =
        candidates
          ?.map((candidate) => ({
            id: candidate.id,
            maskName: candidate.maskName ?? null,
            maskAvatarUrl: candidate.maskAvatarUrl ?? null,
            country: candidate.country ?? null,
            preference: candidate.preference?.[0]
              ? {
                  gender: candidate.preference[0].gender ?? null,
                  lookingForGender:
                    candidate.preference[0].lookingForGender ?? null,
                  smPreference: candidate.preference[0].smPreference ?? null,
                  tagsJson: candidate.preference[0].tagsJson ?? null
                }
              : null,
            updatedAt: candidate.updatedAt as string
          }))
          .filter((candidate) => {
            if (swipedIds.has(candidate.id)) return false;
            if (exposureIds.has(candidate.id)) return false;
            if (!candidate.preference) return false;
            if (
              candidate.preference.gender !== me.preference?.lookingForGender
            ) {
              return false;
            }
            if (candidate.preference.lookingForGender !== me.preference?.gender) {
              return false;
            }
            return true;
          }) ?? [];

      const ranked = rankCandidates(
        filtered,
        me.preference?.tagsJson ?? [],
        me.country
      );
      const items = ranked.slice(0, take);

      const nextCursorValue =
        items.length === take
          ? filtered[filtered.length - 1]?.updatedAt ?? null
          : null;

      setRecommendations((prev) => (cursor ? [...prev, ...items] : items));
      setRecCursor(nextCursorValue);

      if (items.length > 0) {
        await Promise.all(
          items.map((item) =>
            supabase
              .from("RecommendationExposure")
              .upsert(
                {
                  viewerId: user.id,
                  targetId: item.id,
                  lastShownAt: new Date().toISOString()
                },
                { onConflict: "viewerId,targetId" }
              )
          )
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load data.";
      setMessage(message);
    } finally {
      setLoadingRecs(false);
    }
  };

  const loadMatches = async (cursor?: string | null) => {
    if (!user) {
      return [] as MatchItem[];
    }
    setLoadingMatches(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }
      let query = supabase
        .from("Match")
        .select(
          "id,matchedAt,user1:User!Match_user1Id_fkey(id,maskName,maskAvatarUrl),user2:User!Match_user2Id_fkey(id,maskName,maskAvatarUrl)"
        )
        .or(`user1Id.eq.${user.id},user2Id.eq.${user.id}`)
        .order("matchedAt", { ascending: false })
        .limit(DEFAULT_LIMIT);

      if (cursor) {
        query = query.lt("matchedAt", cursor);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error("Failed to load matches.");
      }
      const normalized = (data ?? []).map((item) => ({
        id: item.id,
        matchedAt: item.matchedAt,
        user1: item.user1?.[0] ?? null,
        user2: item.user2?.[0] ?? null
      })) as Array<{
        id: string;
        matchedAt: string;
        user1: MatchItem["user1"] | null;
        user2: MatchItem["user2"] | null;
      }>;
      const items = normalized.filter(
        (item): item is MatchItem => Boolean(item.user1 && item.user2)
      );
      setMatches((prev) => (cursor ? [...prev, ...items] : items));
      setMatchCursor(
        items.length === DEFAULT_LIMIT ? items[items.length - 1].matchedAt : null
      );
      return items;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load matches.";
      setMessage(message);
      return [] as MatchItem[];
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadRecommendations(null).catch(() => setMessage("Failed to load data."));
    loadMatches(null).catch(() => setMessage("Failed to load data."));
  }, [user, me]);

  const swipe = async (toUserId: string, action: "LIKE" | "PASS") => {
    if (!user) {
      return;
    }
    if (!session?.access_token) {
      setMessage("Please sign in again.");
      return;
    }
    const res = await fetch("/api/match/swipe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
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
    ? matchPrompt.user1.id === user?.id
      ? matchPrompt.user2
      : matchPrompt.user1
    : null;

  return (
    <main className="ui-page mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <section className="ui-card p-6">
        <h1 className="text-2xl font-semibold text-text-primary">Forum</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Walk the forum, leave a trace, and see who echoes back.
        </p>
        {message && <p className="mt-2 text-sm text-text-secondary">{message}</p>}
      </section>

      <section className="ui-card p-6">
        <h2 className="text-lg font-semibold text-text-primary">Forum Guests</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {recommendations.length === 0 && !loadingRecs && (
            <p className="text-sm text-text-secondary">The forum is quiet for now.</p>
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
            disabled={loadingRecs}
          >
            {loadingRecs ? "Loading..." : "Load more"}
          </button>
        )}
      </section>

      <section className="ui-card p-6">
        <h2 className="text-lg font-semibold text-text-primary">Your traces</h2>
        <div className="mt-4 space-y-3">
          {matches.length === 0 && !loadingMatches && (
            <p className="text-sm text-text-secondary">No traces yet.</p>
          )}
          {matches.map((match) => {
            const other =
              match.user1.id === user?.id ? match.user2 : match.user1;
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
            disabled={loadingMatches}
          >
            {loadingMatches ? "Loading..." : "Load more"}
          </button>
        )}
      </section>

      {matchPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/20 p-6 backdrop-blur-sm">
          <div className="ui-card w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-text-primary">Forum echo</h3>
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
