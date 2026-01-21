"use client";

import { io, Socket } from "socket.io-client";
import { useEffect, useMemo, useRef, useState } from "react";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

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
  status: "pending" | "completed";
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

export default function CallPage() {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [activeMatch, setActiveMatch] = useState<MatchItem | null>(null);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

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

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = io(API_BASE, {
      auth: { token }
    });

    socket.on("connect_error", () => {
      setStatus("WebSocket connection failed.");
    });

    socket.on("call:offer", async ({ matchId, sdp }) => {
      if (!activeMatch || matchId !== activeMatch.id) {
        return;
      }
      await ensurePeer();
      await peerRef.current?.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await peerRef.current?.createAnswer();
      if (answer) {
        await peerRef.current?.setLocalDescription(answer);
        socket.emit("call:answer", { matchId, sdp: answer });
      }
    });

    socket.on("call:answer", async ({ matchId, sdp }) => {
      if (!activeMatch || matchId !== activeMatch.id) {
        return;
      }
      await peerRef.current?.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    socket.on("call:ice", async ({ matchId, candidate }) => {
      if (!activeMatch || matchId !== activeMatch.id) {
        return;
      }
      if (candidate) {
        try {
          await peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          setStatus("Failed to add ICE candidate.");
        }
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, activeMatch]);

  const loadConsent = async (matchId: string) => {
    if (!authHeader) {
      return;
    }

    const res = await fetch(`${API_BASE}/consent/${matchId}`, {
      headers: { ...authHeader }
    });

    if (res.ok) {
      const data = (await res.json()) as ConsentRecord | null;
      setConsent(data);
    }
  };

  const confirmConsent = async () => {
    if (!authHeader || !activeMatch) {
      return;
    }

    if (!agree) {
      setStatus("Please agree before confirming.");
      return;
    }

    const res = await fetch(`${API_BASE}/consent/${activeMatch.id}/confirm`, {
      method: "POST",
      headers: { ...authHeader }
    });

    if (res.ok) {
      const data = (await res.json()) as ConsentRecord;
      setConsent(data);
      setStatus("Agreement confirmed.");
    } else {
      setStatus("Failed to confirm agreement.");
    }
  };

  const ensurePeer = async () => {
    if (peerRef.current) {
      return;
    }

    const peer = new RTCPeerConnection(RTC_CONFIG);
    peer.onicecandidate = (event) => {
      if (event.candidate && activeMatch) {
        socketRef.current?.emit("call:ice", {
          matchId: activeMatch.id,
          candidate: event.candidate
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
    if (!activeMatch || !socketRef.current) {
      return;
    }

    await ensurePeer();
    socketRef.current.emit("match:join", { matchId: activeMatch.id });
    const offer = await peerRef.current?.createOffer();
    if (!offer) {
      return;
    }
    await peerRef.current?.setLocalDescription(offer);
    socketRef.current.emit("call:offer", { matchId: activeMatch.id, sdp: offer });
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
    ? activeMatch.user1.id === userId
      ? activeMatch.user2
      : activeMatch.user1
    : null;

  return (
    <main className="ui-page mx-auto grid min-h-screen w-full max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[260px_1fr]">
      <section className="ui-card p-4">
        <h1 className="text-lg font-semibold text-text-primary">Calls</h1>
        <p className="mt-1 text-xs text-text-secondary">
          Select a private thread to start a call.
        </p>
        <div className="mt-4 space-y-2">
          {matches.map((match) => {
            const other = match.user1.id === userId ? match.user2 : match.user1;
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
                Agreement status: {consent.status}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
