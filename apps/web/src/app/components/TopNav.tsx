"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ProfileOnboardingModal from "./ProfileOnboardingModal";
import { getSupabaseClient } from "../lib/supabaseClient";
import { useSupabaseSession } from "../lib/useSupabaseSession";

const NAV_ITEMS = [
  { href: "/stories", label: "Stories" },
  { href: "/forum", label: "Forum" },
  { href: "/rooms", label: "Rooms" }
];

export default function TopNav() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { session, user, ready } = useSupabaseSession();
  const [me, setMe] = useState<{
    id: string;
    email?: string | null;
    maskName: string | null;
    maskAvatarUrl: string | null;
    bio: string | null;
    profileCompleted?: boolean;
    preference?: {
      vibeTags?: string[] | null;
      interests?: string[] | null;
      allowStrangerPrivate?: boolean | null;
      smPreference?: string | null;
    } | null;
  } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [avatarError, setAvatarError] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isProfileComplete = Boolean(
    me?.profileCompleted ??
      (me?.maskName &&
        me.maskName.trim().length > 0 &&
        me?.maskAvatarUrl &&
        ((me.preference?.vibeTags?.length ?? 0) > 0 ||
          (me.preference?.interests?.length ?? 0) > 0) &&
        (me.preference?.smPreference?.trim().length ?? 0) > 0)
  );
  const seenKey = me?.id ? `profile_onboarding_seen_${me.id}` : null;

  const hideNav =
    pathname.startsWith("/login") || pathname.startsWith("/register");

  const fetchMe = useCallback(
    async (userId: string, email?: string | null) => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return null;
      }
      const { data } = await supabase
        .from("User")
        .select(
          "id,email,maskName,maskAvatarUrl,bio,preference:Preference(vibeTagsJson,interestsJson,allowStrangerPrivate,smPreference)"
        )
        .eq("id", userId)
        .maybeSingle();
      if (!data) {
        return {
          id: userId,
          email: email ?? null,
          maskName: null,
          maskAvatarUrl: null,
          bio: null,
          preference: null
        };
      }
      return {
        id: data.id,
        email: data.email ?? email ?? null,
        maskName: data.maskName ?? null,
        maskAvatarUrl: data.maskAvatarUrl ?? null,
        bio: data.bio ?? null,
        preference: data.preference?.[0]
          ? {
              vibeTags: data.preference[0].vibeTagsJson ?? null,
              interests: data.preference[0].interestsJson ?? null,
              allowStrangerPrivate:
                data.preference[0].allowStrangerPrivate ?? null,
              smPreference: data.preference[0].smPreference ?? null
            }
          : null
      };
    },
    []
  );

  const fetchUnreadTotal = useCallback(async () => {
    setUnreadTotal(0);
  }, []);

  useEffect(() => {
    if (!ready || !user) {
      setMe(null);
      setUnreadTotal(0);
      return;
    }
    fetchMe(user.id, user.email)
      .then((data) => setMe(data))
      .catch(() => setMe(null));
  }, [ready, user, fetchMe]);

  useEffect(() => {
    if (!user) {
      return;
    }
    fetchUnreadTotal().catch(() => undefined);
  }, [user, fetchUnreadTotal, pathname]);

  useEffect(() => {
    setAvatarError(false);
  }, [me?.maskAvatarUrl]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const interval = window.setInterval(() => {
      fetchUnreadTotal().catch(() => undefined);
    }, 20000);
    return () => window.clearInterval(interval);
  }, [user, fetchUnreadTotal]);

  useEffect(() => {
    if (!me || isProfileComplete || typeof window === "undefined") {
      return;
    }
    if (seenKey && localStorage.getItem(seenKey) === "1") {
      return;
    }
    setShowOnboarding(true);
  }, [me, isProfileComplete, seenKey]);

  useEffect(() => {
    if (!me || !isProfileComplete || typeof window === "undefined") {
      return;
    }
    if (seenKey) {
      localStorage.setItem(seenKey, "1");
    }
  }, [me, isProfileComplete, seenKey]);

  const handleDismissOnboarding = () => {
    if (typeof window !== "undefined" && seenKey) {
      localStorage.setItem(seenKey, "1");
    }
    setShowOnboarding(false);
  };

  useEffect(() => {
    const handleOpen = () => {
      if (me) {
        setShowOnboarding(true);
      }
    };
    window.addEventListener("open-profile-onboarding", handleOpen);
    return () => window.removeEventListener("open-profile-onboarding", handleOpen);
  }, [me]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handleClickAway = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, [menuOpen]);

  if (hideNav) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border-default bg-card/90 backdrop-blur-lg">
      <div className="ui-container relative flex items-center justify-end py-3">
        <div className="absolute left-1/2 -translate-x-1/2">
          <div className="ui-tab-list">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`ui-tab ${isActive ? "ui-tab-active" : ""}`}
                >
                  <span className="inline-flex items-center gap-2">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
        {session ? (
          <div className="flex items-center justify-end gap-3 pr-1">
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border-default bg-surface transition-transform duration-150 hover:scale-105 active:scale-95"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="Open profile menu"
              >
                {me?.maskAvatarUrl && !avatarError ? (
                  <img
                    src={me.maskAvatarUrl}
                    alt={me.maskName ?? "User avatar"}
                    className="h-9 w-9 rounded-full object-cover"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-border-default text-text-secondary"
                    aria-hidden="true"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path
                        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.6 0-6.5 2.1-6.5 4.7V20h13v-1.3c0-2.6-2.9-4.7-6.5-4.7Z"
                        fill="currentColor"
                      />
                    </svg>
                  </span>
                )}
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border-default bg-surface p-3 text-xs text-text-secondary shadow-sm">
                  <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-text-muted">
                    Me
                  </p>
                  {me && (
                    <>
                      <button
                        type="button"
                        className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-surface"
                        onClick={() => {
                          setMenuOpen(false);
                          router.push("/me/posts");
                        }}
                      >
                        My Forum
                      </button>
                      <button
                        type="button"
                        className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-surface"
                        onClick={() => {
                          setMenuOpen(false);
                          router.push("/me");
                        }}
                      >
                        Profile
                      </button>
                      <button
                        type="button"
                        className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-surface"
                        onClick={() => {
                          setMenuOpen(false);
                          router.push("/me/account");
                        }}
                      >
                        Account
                      </button>
                      <button
                        type="button"
                        className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-surface"
                        onClick={() => {
                          setMenuOpen(false);
                          router.push("/me/purchases");
                        }}
                      >
                        Payment records
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                      className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-surface"
                      onClick={() => {
                        const supabase = getSupabaseClient();
                        supabase?.auth.signOut().catch(() => undefined);
                        setMenuOpen(false);
                        router.push("/login");
                      }}
                    >
                      Log out
                    </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2 pr-1">
            <Link
              href="/login"
              className="rounded-full border border-border-default px-3 py-1 text-xs text-text-secondary transition hover:text-text-primary"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-brand-primary px-3 py-1 text-xs font-semibold text-card"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
      {unreadTotal > 0 ? (
        <span className="sr-only">You have unread messages.</span>
      ) : null}
      {showOnboarding && me && user && (
        <ProfileOnboardingModal
          userId={user.id}
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
