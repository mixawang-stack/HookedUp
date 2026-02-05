"use client";

import { useEffect, useState } from "react";

type ProfileCardProps = {
  profile: {
    id: string;
    maskName: string | null;
    maskAvatarUrl: string | null;
    bio: string | null;
    dob?: string | null;
    gender?: string | null;
    language?: string | null;
    city?: string | null;
    country?: string | null;
    preference?: {
      vibeTags?: string[] | null;
      interests?: string[] | null;
      allowStrangerPrivate?: boolean | null;
      smPreference?: string | null;
    } | null;
  };
  mutedHint?: string | null;
  viewerId?: string | null;
  onStartPrivate: (userId: string) => Promise<void> | void;
  onClose: () => void;
};

export default function ProfileCard({
  profile,
  mutedHint,
  viewerId,
  onStartPrivate,
  onClose
}: ProfileCardProps) {
  const [starting, setStarting] = useState(false);
  const vibeTags = profile.preference?.vibeTags ?? [];
  const interests = profile.preference?.interests ?? [];
  const allowStrangerPrivate = profile.preference?.allowStrangerPrivate ?? true;
  const smPreference = profile.preference?.smPreference ?? null;
  const tags = [...vibeTags, ...interests].filter(Boolean);
  const displayTags = tags.slice(0, 6);
  const overflowCount = Math.max(tags.length - displayTags.length, 0);
  const isSelf = Boolean(viewerId && viewerId === profile.id);
  const locationLine = [profile.city, profile.country]
    .filter((item) => item && item.trim().length > 0)
    .join(" 路 ");
  const age =
    profile.dob && !Number.isNaN(Date.parse(profile.dob))
      ? Math.max(
          0,
          new Date().getFullYear() - new Date(profile.dob).getFullYear()
        )
      : null;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleStart = async () => {
    if (starting) {
      return;
    }
    setStarting(true);
    try {
      await onStartPrivate(profile.id);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-text-primary/40 backdrop-blur" onClick={onClose} />
      <div className="relative ui-surface w-full max-w-[520px] max-h-[80vh] overflow-y-auto p-5 text-text-primary">
        <button
          type="button"
          className="absolute right-4 top-4 text-xs text-text-muted hover:text-text-primary"
          onClick={onClose}
        >
          Close
        </button>
        <div className="flex items-center gap-4">
          {profile.maskAvatarUrl ? (
            <img
              src={profile.maskAvatarUrl}
              alt={profile.maskName ?? "Profile"}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-card text-lg font-semibold">
              {(profile.maskName ?? "A").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold text-text-primary">
              {profile.maskName ?? "Anonymous"}
            </p>
            {locationLine ? (
              <p className="text-xs text-text-secondary">{locationLine}</p>
            ) : (
              <p className="text-xs uppercase tracking-[0.3em] text-text-muted">
                Profile
              </p>
            )}
          </div>
        </div>

        {profile.bio && (
          <p className="mt-4 text-sm text-text-secondary">{profile.bio}</p>
        )}

        <div className="mt-4 grid gap-2 rounded-xl border border-border-default bg-card px-4 py-3 text-xs text-text-secondary">
          {profile.gender && (
            <p>
              <span className="text-text-muted">Gender:</span> {profile.gender}
            </p>
          )}
          {age !== null && (
            <p>
              <span className="text-text-muted">Age:</span> {age}
            </p>
          )}
          {profile.language && (
            <p>
              <span className="text-text-muted">Language:</span>{" "}
              {profile.language}
            </p>
          )}
          {smPreference && (
            <p>
              <span className="text-text-muted">Preference:</span>{" "}
              {smPreference}
            </p>
          )}
        </div>

        {displayTags.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wide text-text-muted">
              Tags
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {displayTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border-default px-2 py-0.5 text-[10px] text-text-secondary"
                >
                  {tag}
                </span>
              ))}
              {overflowCount > 0 && (
                <span className="rounded-full border border-border-default px-2 py-0.5 text-[10px] text-text-muted">
                  +{overflowCount}
                </span>
              )}
            </div>
          </div>
        )}

        {!allowStrangerPrivate && (
          <p className="mt-4 rounded-xl border border-border-default bg-card px-3 py-2 text-xs text-text-secondary">
            This user accepts private chats after they reply. You can send a
            one-time request.
          </p>
        )}

        {mutedHint && (
          <p className="mt-4 rounded-xl border border-border-default bg-card px-3 py-2 text-xs text-text-secondary">
            {mutedHint}
          </p>
        )}

        <div className="mt-5 space-y-2">
          {!isSelf && (
            <button
              type="button"
              className="btn-primary w-full px-4 py-2 text-sm"
              onClick={handleStart}
              disabled={starting}
            >
              {starting
                ? "Starting..."
                : allowStrangerPrivate
                  ? "Start private chat"
                  : "Request private chat"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


