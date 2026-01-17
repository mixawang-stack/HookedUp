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

  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return null;
  }

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
    setDismissed(sessionStorage.getItem("profile_onboarding_dismissed") === "1");
  }, []);

  useEffect(() => {
    if (!me || me.profileCompleted || dismissed) {
      return;
    }
    setShowOnboarding(true);
  }, [me, dismissed]);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    router.push("/login");
  };

  const handleDismissOnboarding = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("profile_onboarding_dismissed", "1");
    }
    setDismissed(true);
    setShowOnboarding(false);
  };

  return (
    <nav className="sticky top-0 z-50 bg-slate-900/90 border-b border-white/10 backdrop-blur-lg">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
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
          <div className="flex items-center gap-3">
            {!me.profileCompleted && (
              <button
                type="button"
                className="rounded-full border border-amber-300/60 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold text-amber-100"
                onClick={() => setShowOnboarding(true)}
              >
                Complete profile
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="Open profile menu"
              >
                {me.maskAvatarUrl ? (
                  <img
                    src={me.maskAvatarUrl}
                    alt={me.maskName ?? "Profile"}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-semibold text-slate-200">
                    {(me.maskName ?? "U").slice(0, 1).toUpperCase()}
                  </span>
                )}
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-xl border border-white/10 bg-slate-900/95 p-2 text-xs text-slate-200 shadow-[0_20px_50px_rgba(2,6,23,0.7)] backdrop-blur">
                  <button
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/10"
                    onClick={() => router.push("/me")}
                  >
                    My profile
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/10"
                    onClick={() => router.push("/me")}
                  >
                    Edit profile
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left text-rose-200 hover:bg-rose-500/20"
                    onClick={handleLogout}
                  >
                    Sign out
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
