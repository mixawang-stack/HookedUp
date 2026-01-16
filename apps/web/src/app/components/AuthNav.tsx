"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const FF_WORLD_06 = (process.env.NEXT_PUBLIC_FF_WORLD_06 ?? "true") !== "false";
const FF_ROOMS_08 = (process.env.NEXT_PUBLIC_FF_ROOMS_08 ?? "false") === "true";
const FF_INTENT_12 = (process.env.NEXT_PUBLIC_FF_INTENT_12 ?? "false") === "true";

export default function AuthNav() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem("accessToken"));
  }, []);

  if (!token) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 p-4 text-sm">
        {FF_WORLD_06 && (
          <Link
            href="/hall"
            className="font-semibold text-slate-900"
            title="Where everyone passes through."
          >
            Hall
          </Link>
        )}
        <Link
          href="/rooms"
          className="text-slate-600"
          title="Ongoing gatherings inside the castle."
        >
          Rooms
        </Link>
        {FF_WORLD_06 && (
          <Link
            href="/private"
            className="text-slate-600"
            title="Conversations that continued."
          >
            Private
          </Link>
        )}
        {FF_INTENT_12 ? (
          <span className="text-xs text-slate-400">Intent</span>
        ) : null}
      </div>
    </nav>
  );
}
