"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import ProfileOnboardingModal from "./ProfileOnboardingModal";

const NAV_ITEMS = [
  { href: "/hall", label: "Hall" },
  { href: "/rooms", label: "Rooms" },
  { href: "/private", label: "Private" }
];

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#94a3b8"/>
          <stop offset="100%" stop-color="#64748b"/>
        </linearGradient>
      </defs>
      <rect width="72" height="72" rx="36" fill="url(#g)"/>
      <circle cx="36" cy="30" r="12" fill="#0f172a"/>
      <path d="M18 60c4-10 12-16 18-16s14 6 18 16" fill="#0f172a"/>
    </svg>`
  );

export default function TopNav() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<{
    id: string;
    maskName: string | null;
    maskAvatarUrl: string | null;
    bio: string | null;
    profileCompleted?: boolean;
    preference?: {
      vibeTags?: string[] | null;
      interests?: string[] | null;
      allowStrangerPrivate?: boolean | null;
    } | null;
  } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const isProfileComplete = Boolean(
    me?.profileCompleted ??
      (me?.maskName && me.maskName.trim().length > 0 && me?.maskAvatarUrl)
  );
  const dismissalKey = me?.id
    ? `profile_onboarding_seen_${me.id}`
    : "profile_onboarding_seen";

  const hideNav =
    pathname.startsWith("/login") || pathname.startsWith("/register");

  useEffect(() => {
    setToken(localStorage.getItem("accessToken"));
  }, []);

  const fetchMe = useCallback(
    async (accessToken: string) => {
      const res = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) {
        return null;
      }
      return res.json();
    },
    []
  );

  const fetchUnreadTotal = useCallback(async (accessToken: string) => {
    const res = await fetch(`${API_BASE}/private/unread-total`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as { total?: number };
    setUnreadTotal(Number.isFinite(data.total) ? data.total! : 0);
  }, []);

  useEffect(() => {
    if (!token) {
      setMe(null);
      setUnreadTotal(0);
      return;
    }
    fetchMe(token)
      .then((data) => setMe(data))
      .catch(() => setMe(null));
  }, [token, fetchMe]);

  useEffect(() => {
    if (!token) {
      return;
    }
    fetchUnreadTotal(token).catch(() => undefined);
  }, [token, fetchUnreadTotal, pathname]);

  useEffect(() => {
    if (!token) {
      return;
    }
    const interval = window.setInterval(() => {
      fetchUnreadTotal(token).catch(() => undefined);
    }, 20000);
    return () => window.clearInterval(interval);
  }, [token, fetchUnreadTotal]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setDismissed(localStorage.getItem(dismissalKey) === "1");
  }, [dismissalKey]);

  useEffect(() => {
    if (!me || isProfileComplete || dismissed) {
      return;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(dismissalKey, "1");
    }
    setShowOnboarding(true);
  }, [me, dismissed, isProfileComplete, dismissalKey]);

  const handleDismissOnboarding = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(dismissalKey, "1");
    }
    setDismissed(true);
    setShowOnboarding(false);
  };

  if (hideNav) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-900/90 backdrop-blur-lg">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 py-3">
        <div />
        <div className="flex items-center justify-center gap-3">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const isPrivate = item.href === "/private";
            const showUnread = isPrivate && unreadTotal > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-slate-100/10 text-white shadow-[0_0_25px_rgba(14,165,233,0.9)]"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  {item.label}
                  {showUnread && (
                    <span className="rounded-full bg-sky-400/90 px-2 py-0.5 text-[10px] font-semibold text-slate-900">
                      {unreadTotal > 99 ? "99+" : unreadTotal}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
        {me && (
          <div className="flex items-center justify-end gap-3">
            <div className="relative">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 transition-transform duration-150 hover:scale-105 active:scale-95"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="Open profile menu"
              >
                <img
                  src={me.maskAvatarUrl ?? DEFAULT_AVATAR}
                  alt={me.maskName ?? "User avatar"}
                  className="h-9 w-9 rounded-full object-cover"
                />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl border border-white/10 bg-slate-800/95 p-3 text-xs text-slate-200 shadow-[0_20px_50px_rgba(2,6,23,0.7)] backdrop-blur">
                  <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                    My profile
                  </p>
                  <button
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-slate-700/50"
                    onClick={() => router.push("/me/posts")}
                  >
                    Posts management
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-slate-700/50"
                    onClick={() => router.push("/me")}
                  >
                    Personal profile
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-slate-700/50"
                    onClick={() => router.push("/me/account")}
                  >
                    Account settings
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {showOnboarding && me && token && (
        <ProfileOnboardingModal
          token={token}
          me={me}
          onClose={handleDismissOnboarding}
          onSaved={(nextMe) => {
            setMe(nextMe);
            handleDismissOnboarding();
          }}
        />
      )}
    </nav>
  );
}
