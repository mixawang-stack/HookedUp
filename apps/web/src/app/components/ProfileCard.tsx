"use client";

import { useState } from "react";

type ProfileCardProps = {
  profile: {
    id: string;
    maskName: string | null;
    maskAvatarUrl: string | null;
    bio: string | null;
    preference?: {
      vibeTags?: string[] | null;
      interests?: string[] | null;
    } | null;
  };
  mutedHint?: string | null;
  onStartPrivate: (userId: string) => Promise<void> | void;
  onBlock?: (userId: string) => Promise<void> | void;
  onReport?: (userId: string) => Promise<void> | void;
  onClose: () => void;
};

export default function ProfileCard({
  profile,
  mutedHint,
  onStartPrivate,
  onBlock,
  onReport,
  onClose
}: ProfileCardProps) {
  const [starting, setStarting] = useState(false);
  const vibeTags = profile.preference?.vibeTags ?? [];
  const interests = profile.preference?.interests ?? [];

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
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/95 p-5 text-slate-100 shadow-[0_30px_80px_rgba(2,6,23,0.8)]">
        <button
          type="button"
          className="absolute right-4 top-4 text-xs text-slate-400 hover:text-white"
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
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-lg font-semibold">
              {(profile.maskName ?? "A").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold text-white">
              {profile.maskName ?? "Anonymous"}
            </p>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Profile</p>
          </div>
        </div>

        {profile.bio && (
          <p className="mt-4 text-sm text-slate-200">{profile.bio}</p>
        )}

        {vibeTags.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              Vibe tags
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {vibeTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {interests.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              Interests
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {interests.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {mutedHint && (
          <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {mutedHint}
          </p>
        )}

        <div className="mt-5 space-y-2">
          <button
            type="button"
            className="w-full rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900"
            onClick={handleStart}
            disabled={starting}
          >
            {starting ? "Starting..." : "Start private chat"}
          </button>
          <div className="flex items-center justify-between gap-2 text-xs">
            {onReport && (
              <button
                type="button"
                className="flex-1 rounded-full border border-rose-300/60 px-3 py-2 text-rose-200 hover:bg-rose-500/10"
                onClick={() => onReport(profile.id)}
              >
                Report
              </button>
            )}
            {onBlock && (
              <button
                type="button"
                className="flex-1 rounded-full border border-slate-400/60 px-3 py-2 text-slate-200 hover:bg-white/5"
                onClick={() => onBlock(profile.id)}
              >
                Block
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
