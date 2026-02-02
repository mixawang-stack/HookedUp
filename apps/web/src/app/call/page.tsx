"use client";

import { useEffect, useRef, useState } from "react";

import { getSupabaseClient } from "../lib/supabaseClient";
import { useSupabaseSession } from "../lib/useSupabaseSession";

export const dynamic = "force-dynamic";

const TURN_URL = process.env.NEXT_PUBLIC_TURN_URL;
const TURN_USERNAME = process.env.NEXT_PUBLIC_TURN_USERNAME;
const TURN_PASSWORD = process.env.NEXT_PUBLIC_TURN_PASSWORD;
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    ...(TURN_URL && TURN_USERNAME && TURN_PASSWORD
      ? [
          {
            urls: TURN_URL,
            username: TURN_USERNAME,
            credential: TURN_PASSWORD
          }
        ]
      : []),
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

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

export default function CallPage() {
  const { user, ready, session } = useSupabaseSession();
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [activeMatch, setActiveMatch] = useState<MatchItem | null>(null);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<
    NonNullable<ReturnType<typeof getSupabaseClient>>["channel"]
  > | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

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
      const readyMatches = normalized.filter(
        (item): item is MatchItem => Boolean(item.user1 && item.user2)
      );
      setMatches(readyMatches);
    };
    loadMatches().catch(() => setStatus("Failed to load threads."));
  }, [ready, user]);

  useEffect(() => {
    if (!activeMatch) {
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }
    const channel = supabase.channel(`call-${activeMatch.id}`, {
      config: { broadcast: { self: false } }
    });

    channel.on("broadcast", { event: "call:offer" }, async ({ payload }) => {
      if (!activeMatch || payload.matchId !== activeMatch.id) {
        return;
      }
      await ensurePeer();
      await peerRef.current?.setRemoteDescription(
        new RTCSessionDescription(payload.sdp)
      );
      const answer = await peerRef.current?.createAnswer();
      if (answer) {
        await peerRef.current?.setLocalDescription(answer);
        channel.send({
          type: "broadcast",
          event: "call:answer",
          payload: { matchId: activeMatch.id, sdp: answer }
        });
      }
    });

    channel.on("broadcast", { event: "call:answer" }, async ({ payload }) => {
      if (!activeMatch || payload.matchId !== activeMatch.id) {
        return;
      }
      await peerRef.current?.setRemoteDescription(
        new RTCSessionDescription(payload.sdp)
      );
    });

    channel.on("broadcast", { event: "call:ice" }, async ({ payload }) => {
      if (!activeMatch || payload.matchId !== activeMatch.id) {
        return;
      }
      if (payload.candidate) {
        try {
          await peerRef.current?.addIceCandidate(
            new RTCIceCandidate(payload.candidate)
          );
        } catch {
          setStatus("Failed to add ICE candidate.");
        }
      }
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [activeMatch?.id]);

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

  const confirmConsent = async () => {
    if (!user || !activeMatch) {
      return;
    }

    if (!agree) {
      setStatus("Please agree before confirming.");
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
    setStatus("Agreement confirmed.");
  };

  const ensurePeer = async () => {
    if (peerRef.current) {
      return;
    }
    const peer = new RTCPeerConnection(RTC_CONFIG);
    peer.onicecandidate = (event) => {
      if (event.candidate && activeMatch) {
        channelRef.current?.send({
          type: "broadcast",
          event: "call:ice",
          payload: { matchId: activeMatch.id, candidate: event.candidate }
        });
      }
    };
    peer.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));

    peerRef.current = peer;
  };

  const startCall = async () => {
    if (!activeMatch || !channelRef.current) {
      return;
    }

    await ensurePeer();
    const offer = await peerRef.current?.createOffer();
    if (!offer) {
      return;
    }
    await peerRef.current?.setLocalDescription(offer);
    channelRef.current.send({
      type: "broadcast",
      event: "call:offer",
      payload: { matchId: activeMatch.id, sdp: offer }
    });
  };

  const endCall = () => {
    peerRef.current?.close();
    peerRef.current = null;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const handleSelect = async (match: MatchItem) => {
    setActiveMatch(match);
    setConsent(null);
    setAgree(false);
    setStatus(null);
    endCall();
    await loadConsent(match.id);
  };

  const activeOther = activeMatch
    ? activeMatch.user1.id === user?.id
      ? activeMatch.user2
      : activeMatch.user1
    : null;

  const consentStatus = consent
    ? consent.confirmedAtA && consent.confirmedAtB
      ? "completed"
      : "pending"
    : "pending";

  return (
    <main className="ui-page mx-auto grid min-h-screen w-full max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[260px_1fr]">
      <section className="ui-card p-4">
        <h1 className="text-lg font-semibold text-text-primary">Calls</h1>
        <p className="mt-1 text-xs text-text-secondary">
          Select a private thread to start a call.
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
              {activeMatch ? "Call" : "Select a thread"}
            </h2>
            {activeOther && (
              <p className="text-xs text-text-secondary">
                Calling: {activeOther.maskName ?? "Anonymous"}
              </p>
            )}
            {status && <p className="text-xs text-text-secondary">{status}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={startCall}
              disabled={!activeMatch}
            >
              Start call
            </button>
            <button type="button" className="btn-secondary" onClick={endCall}>
              End
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="ui-surface p-3">
            <p className="text-xs text-text-secondary">You</p>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="mt-2 aspect-video w-full rounded-xl border border-border-default bg-card"
            />
          </div>
          <div className="ui-surface p-3">
            <p className="text-xs text-text-secondary">Thread</p>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="mt-2 aspect-video w-full rounded-xl border border-border-default bg-card"
            />
          </div>
        </div>

        {activeMatch && (
          <div className="ui-surface mt-4 p-4">
            <p className="text-sm font-semibold text-text-primary">
              Call agreement
            </p>
            <label className="mt-3 flex items-start gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                className="mt-1"
                checked={agree}
                onChange={(event) => setAgree(event.target.checked)}
              />
              I agree to the call terms and want to record this note.
            </label>
            <button
              type="button"
              className="btn-primary mt-3"
              onClick={confirmConsent}
            >
              Confirm
            </button>
            {consent && (
              <p className="mt-2 text-xs text-text-secondary">
                Agreement status: {consentStatus}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
