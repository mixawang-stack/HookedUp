"use client";

import Link from "next/link";
import { useSupabaseSession } from "../lib/useSupabaseSession";

const FF_WORLD_06 = (process.env.NEXT_PUBLIC_FF_WORLD_06 ?? "true") !== "false";
const FF_ROOMS_08 = (process.env.NEXT_PUBLIC_FF_ROOMS_08 ?? "false") === "true";
const FF_INTENT_12 = (process.env.NEXT_PUBLIC_FF_INTENT_12 ?? "false") === "true";

export default function AuthNav() {
  const { session, ready } = useSupabaseSession();

  if (!ready || !session) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-30 border-b border-border-default bg-card/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-6 py-3 text-sm">
        {FF_WORLD_06 && (
          <Link
            href="/novels"
            className="font-semibold text-text-primary"
            title="Stories meant to be lingered with."
          >
            Stories
          </Link>
        )}
        <Link
          href="/hall"
          className="text-text-secondary hover:text-text-primary"
          title="Where everyone passes through."
        >
          Forum
        </Link>
        <Link
          href="/rooms"
          className="text-text-secondary hover:text-text-primary"
          title="Ongoing gatherings inside the castle."
        >
          Rooms
        </Link>
        {FF_INTENT_12 ? (
          <span className="text-xs text-text-muted">Intent</span>
        ) : null}
      </div>
    </nav>
  );
}
