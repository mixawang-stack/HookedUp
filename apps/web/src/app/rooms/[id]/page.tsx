"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { emitHostStatus } from "../../lib/hostStatus";
import ProfileCard from "../../components/ProfileCard";
import { getSupabaseClient } from "../../lib/supabaseClient";

const GAME_OPTIONS = [
  { value: "NONE", label: "None" },
  { value: "DICE", label: "Dice" },
  { value: "ONE_THING", label: "One Thing" }
];

type RoomDetail = {
  id: string;
  title: string;
  description: string | null;
  capacity: number | null;
  memberCount: number;
  createdById: string;
  currentUserRole: "OWNER" | "MEMBER" | "OBSERVER" | null;
  selectedGame?: {
    type: string | null;
    selectedAt: string | null;
    selectedById: string | null;
  };
};

type RoomMessage = {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender?: {
    id: string;
    maskName: string | null;
    maskAvatarUrl: string | null;
  } | null;
};

type MessagesResponse = {
  items: RoomMessage[];
  nextCursor: string | null;
};

type InviteCandidate = {
  userId: string;
  maskName: string | null;
  maskAvatarUrl: string | null;
};

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = typeof params.id === "string" ? params.id : params.id?.[0];

  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const chatListRef =  useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteCandidates, setInviteCandidates] = useState<InviteCandidate[]>([]);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  const [profileCard, setProfileCard] = useState<{
    id: string;
    maskName: string | null;
    maskAvatarUrl: string | null;
    bio: string | null;
    preference?: {
      vibeTags?: string[] | null;
      interests?: string[] | null;
      allowStrangerPrivate?: boolean | null;
    } | null;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const isSignedIn = Boolean(userId);

  const openProfileCard = async (targetUserId: string) => {
    if (!isSignedIn) {
      setStatus("Please sign in to view profiles.");
      return;
    }
    setProfileLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setStatus("Supabase is not configured.");
        return;
      }
      const { data } = await supabase
        .from("User")
        .select(
          "id,maskName,maskAvatarUrl,bio,preference:Preference(vibeTagsJson,interestsJson,allowStrangerPrivate)"
        )
        .eq("id", targetUserId)
        .maybeSingle();
      if (!data) {
        throw new Error("Profile not found.");
      }
      const isSelf = userId && targetUserId === userId;
      setProfileCard({
        id: data.id,
        maskName: data.maskName ?? (isSelf ? "You" : null),
        maskAvatarUrl: data.maskAvatarUrl ?? null,
        bio: data.bio ?? null,
        preference: data.preference?.[0]
          ? {
              vibeTags: data.preference[0].vibeTagsJson ?? null,
              interests: data.preference[0].interestsJson ?? null,
              allowStrangerPrivate:
                data.preference[0].allowStrangerPrivate ?? null
            }
          : null
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load profile.";
      setStatus(message);
    } finally {
      setProfileLoading(false);
    }
  };

  const blockUser = async (targetUserId: string) => {
    if (!isSignedIn) {
      setStatus("Please sign in to manage blocks.");
      return;
    }
    setStatus("Blocking will be available after messaging migration.");
  };

  const reportUser = async (targetUserId: string) => {
    if (!isSignedIn) {
      setStatus("Please sign in to report.");
      return;
    }
    setStatus("Reporting will be available after moderation migration.");
  };

  const startConversation = async (targetUserId: string) => {
    if (!isSignedIn) {
      setStatus("Please sign in to start a private conversation.");
      return;
    }
    setStatus("Private chat migration is in progress.");
  };

  useEffect(() => {
    const loadUser = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    };
    loadUser().catch(() => setUserId(null));
  }, []);

  useEffect(() => {
    if (!roomId) {
      return;
    }

    let active = true;
    const loadRoom = async () => {
      setLoading(true);
      setStatus(null);
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          throw new Error("Supabase not configured.");
        }

        if (userId) {
          await supabase.from("RoomMembership").upsert(
            {
              roomId,
              userId,
              role: "MEMBER",
              mode: "PARTICIPANT"
            },
            { onConflict: "roomId,userId" }
          );
          window.dispatchEvent(new Event("active-room-changed"));
        }

        const { data: roomData } = await supabase
          .from("Room")
          .select(
            `
            id,
            title,
            description,
            capacity,
            createdById,
            status,
            memberships:RoomMembership(count)
          `
          )
          .eq("id", roomId)
          .single();

        const { data: messagesData } = await supabase
          .from("RoomMessage")
          .select("id,roomId,senderId,content,createdAt,sender:User(id,maskName,maskAvatarUrl)")
          .eq("roomId", roomId)
          .order("createdAt", { ascending: true })
          .limit(200);

        if (!active) {
          return;
        }

        if (!roomData) {
          throw new Error("Room unavailable.");
        }

        let currentUserRole: RoomDetail["currentUserRole"] = null;
        if (userId) {
          const { data: membership } = await supabase
            .from("RoomMembership")
            .select("role")
            .eq("roomId", roomId)
            .eq("userId", userId)
            .maybeSingle();
          currentUserRole =
            (membership?.role as RoomDetail["currentUserRole"]) ?? null;
        }

        setRoom({
          id: roomData.id,
          title: roomData.title,
          description: roomData.description ?? null,
          capacity: roomData.capacity ?? null,
          memberCount: roomData.memberships?.[0]?.count ?? 0,
          createdById: roomData.createdById,
          currentUserRole,
          selectedGame: undefined
        });
        setMessages(
          (messagesData ?? []).map((message) => ({
            ...message,
            sender: message.sender?.[0] ?? null
          })) as RoomMessage[]
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load room.";
        setStatus(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadRoom();

    return () => {
      active = false;
    };
  }, [roomId, userId]);

  useEffect(() => {
    if (!room) {
      return;
    }
    emitHostStatus({ page: "room", cold: messages.length === 0 });
  }, [room, messages]);

  useEffect(() => {
    if (!chatListRef.current) {
      return;
    }
    chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
  }, [messages]);

  // Real-time room messaging will be re-enabled after Supabase Realtime migration.

  const ensureJoined = async () => {
    if (!isSignedIn || !roomId) {
      throw new Error("Please sign in to continue.");
    }
    const supabase = getSupabaseClient();
    if (!supabase || !userId) {
      throw new Error("Supabase not ready.");
    }
    await supabase.from("RoomMembership").upsert(
      {
        roomId,
        userId,
        role: "MEMBER",
        mode: "PARTICIPANT"
      },
      { onConflict: "roomId,userId" }
    );
  };

  const handleSendMessage = async (overrideContent?: string) => {
    if (!roomId) {
      return;
    }
    const content = (overrideContent ?? messageInput).trim();
    if (!content) {
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      await ensureJoined();
      if (!isSignedIn) {
        setStatus("Please sign in to send a message.");
        return;
      }
      const supabase = getSupabaseClient();
      if (!supabase || !userId) {
        throw new Error("Supabase not ready.");
      }
      const { data, error } = await supabase
        .from("RoomMessage")
        .insert({
          roomId,
          senderId: userId,
          content
        })
        .select("id,roomId,senderId,content,createdAt,sender:User(id,maskName,maskAvatarUrl)")
        .single();
      if (error || !data) {
        throw new Error("Failed to send.");
      }
      const normalizedMessage = {
        ...data,
        sender: data.sender?.[0] ?? null
      } as RoomMessage;
      setMessages((prev) => [...prev, normalizedMessage]);
      if (!overrideContent || content === messageInput.trim()) {
      setMessageInput("");
      }
      setLastFailedMessage(null);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Failed to send.";
      const normalized = rawMessage.toLowerCase();
      const isNetwork =
        error instanceof TypeError ||
        normalized.includes("network") ||
        normalized.includes("fetch");
      setStatus(
        isNetwork
          ? "Network issue. Check your connection and retry."
          : rawMessage
      );
      setLastFailedMessage(content);
    } finally {
      setSending(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!isSignedIn || !roomId) {
      return;
    }
    try {
      const supabase = getSupabaseClient();
      if (!supabase || !userId) {
        throw new Error("Supabase not ready.");
      }
      await supabase
        .from("RoomMembership")
        .delete()
        .eq("roomId", roomId)
        .eq("userId", userId);
      window.dispatchEvent(new Event("active-room-changed"));
      router.push("/rooms");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to leave room.";
      setStatus(message);
    }
  };

  const handleSelectGame = async (gameType: string) => {
    if (!isSignedIn || !roomId) {
      setStatus("Please sign in to select a game.");
      return;
    }
    setStatus("Game selection will be available after room game migration.");
  };

  const loadInviteCandidates = async () => {
    if (!isSignedIn || !roomId) {
      return;
    }
    setInviteLoading(false);
    setInviteStatus("Invites will be available after messaging migration.");
  };

  const handleOpenInvite = async () => {
    setShowInvite(true);
    await loadInviteCandidates();
  };

  const handleSendInvite = async (inviteeId: string) => {
    if (!isSignedIn || !roomId) {
      return;
    }
    setInvitingId(inviteeId);
    setInviteStatus("Invites will be available after messaging migration.");
    setInvitingId(null);
  };

  const handleGenerateShareLink = async () => {
    if (!isSignedIn || !roomId) {
      return;
    }
    setShareLoading(false);
    setShareStatus("Share links will be available after room migration.");
  };

  const handleCopyShareLink = async () => {
    if (!shareLink) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareStatus("Copied to clipboard.");
    } catch {
      setShareStatus("Copy failed.");
    }
  };

    if (loading) {
    return (
      <main className="ui-page flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-text-muted">Loading room...</p>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="ui-page flex min-h-screen flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm text-brand-secondary">
          {status ?? "Room unavailable."}
        </p>
        <button
          type="button"
          className="btn-secondary px-4 py-2 text-xs"
          onClick={() => router.push("/rooms")}
        >
          Back to Rooms
        </button>
      </main>
    );
  }

  const selectedGameType = room.selectedGame?.type ?? "NONE";
  const selectedGameLabel =
    GAME_OPTIONS.find((option) => option.value === selectedGameType)?.label ??
    selectedGameType;
  const isOwner = room.currentUserRole === "OWNER";
  const rawMessageCount =
    (room as { messageCount?: number | string }).messageCount ??
    (room as { messagesCount?: number | string }).messagesCount ??
    (room as { message_count?: number | string }).message_count;
  const messageCount = Number.isFinite(Number(rawMessageCount))
    ? Number(rawMessageCount)
    : null;
  const messageLabel = messageCount === null ? "-" : String(messageCount);
  const isLive =
    (room as { status?: string }).status === "LIVE" ||
    (room as { isLive?: boolean }).isLive === true ||
    (room as { live?: boolean }).live === true ||
    (room as { is_live?: boolean }).is_live === true;
  const guidelines = room.description
    ? [room.description]
    : ["Be respectful", "Stay on topic", "No spam"];

  return (
    <>
      <main className="ui-page">
        <div className="ui-container flex min-h-screen flex-col gap-6 py-8">
          <section className="ui-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border-default bg-surface text-base font-semibold text-text-secondary">
                  {room.title.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-text-primary">
                    {room.title}
                  </h1>
                  <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
                    <span>{room.memberCount ?? 0} Members</span>
                    <span>{messageLabel} Messages</span>
                  </div>
                </div>
              </div>
              {isLive && (
                <span className="ui-badge ui-badge-live">
                  <span className="mr-1 inline-flex h-1.5 w-1.5 rounded-full bg-brand-primary" />
                  Live
                </span>
              )}
            </div>
          </section>

          <section className="ui-surface p-5 text-sm text-text-secondary">
            <ul className="list-disc space-y-2 pl-5">
              {guidelines.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="ui-card flex min-h-[50vh] flex-col p-4">
            <div
              ref={chatListRef}
              className="flex-1 space-y-4 overflow-y-auto pr-2"
            >
              {messages.map((message) => {
                const senderName = message.sender?.maskName ?? "Member";
                return (
                  <div key={message.id} className="flex items-start gap-3">
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border-default bg-surface"
                      onClick={() => {
                        if (message.sender?.id) {
                          openProfileCard(message.sender.id);
                        }
                      }}
                      aria-label="Open profile"
                    >
                      {message.sender?.maskAvatarUrl ? (
                        <img
                          src={message.sender.maskAvatarUrl}
                          alt={senderName}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-text-secondary">
                          {senderName.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </button>
                    <div className="flex-1 rounded-2xl border border-border-default bg-card px-4 py-3">
                      <div className="flex items-center justify-between text-xs text-text-muted">
                        <span>{senderName}</span>
                        <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="mt-2 text-sm text-text-primary whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <p className="text-sm text-text-muted">No messages yet.</p>
              )}
            </div>
          </section>

          <section className="ui-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                placeholder="Drop a message to the room..."
                className="flex-1 rounded-full border border-border-default bg-card px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
              />
              <button
                type="button"
                className="btn-primary px-5 py-2.5 text-sm"
                onClick={() => handleSendMessage()}
                disabled={sending}
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </section>
        </div>
      </main>

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 p-6">
          <section className="ui-card w-full max-w-lg p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">
                Invite to room
              </h2>
              <button
                type="button"
                className="text-xs text-text-muted"
                onClick={() => setShowInvite(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-2 text-sm text-text-secondary">
              Invite someone you have a mutual chat with.
            </p>
            <div className="mt-4 space-y-3">
              {inviteLoading && (
                <p className="text-sm text-text-muted">Loading candidates...</p>
              )}
              {!inviteLoading && inviteCandidates.length === 0 && (
                <p className="text-sm text-text-muted">
                  No eligible candidates.
                </p>
              )}
              {!inviteLoading &&
                inviteCandidates.map((candidate) => (
                  <div
                    key={candidate.userId}
                    className="ui-surface flex items-center justify-between px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      {candidate.maskAvatarUrl ? (
                        <img
                          src={candidate.maskAvatarUrl}
                          alt={candidate.maskName ?? "Member"}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <span className="h-8 w-8 rounded-full bg-surface" />
                      )}
                      <span className="text-sm text-text-secondary">
                        {candidate.maskName ?? "Anonymous"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary px-3 py-1 text-xs"
                      onClick={() => handleSendInvite(candidate.userId)}
                      disabled={invitingId === candidate.userId}
                    >
                      {invitingId === candidate.userId ? "Inviting..." : "Invite"}
                    </button>
                  </div>
                ))}
            </div>
            {inviteStatus && (
              <p className="mt-3 text-sm text-text-muted">{inviteStatus}</p>
            )}
          </section>
        </div>
      )}
      {profileCard && (
        <ProfileCard
          profile={profileCard}
          onClose={() => setProfileCard(null)}
          onStartPrivate={async (userId) => {
            await startConversation(userId);
            setProfileCard(null);
          }}
          onBlock={blockUser}
          onReport={reportUser}
        />
      )}
      {profileLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center text-xs text-text-secondary">
          Loading profile...
        </div>
      )}
    </>
  );
}
