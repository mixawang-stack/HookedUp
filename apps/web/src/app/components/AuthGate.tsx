"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useSupabaseSession } from "../lib/useSupabaseSession";

const PUBLIC_PATHS = new Set([
  "/",
  "/hall",
  "/login",
  "/register",
  "/privacy",
  "/terms",
  "/refunds",
  "/support",
  "/novels"
]);

const PUBLIC_PREFIXES = ["/novels/"];

const isPublicPath = (pathname: string) => {
  if (PUBLIC_PATHS.has(pathname)) {
    return true;
  }
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

export default function AuthGate() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const { session, ready } = useSupabaseSession();

  useEffect(() => {
    if (isPublicPath(pathname)) {
      return;
    }
    if (!ready) {
      return;
    }
    if (!session) {
      const search = searchParams?.toString();
      const fullPath = search ? `${pathname}?${search}` : pathname;
      const redirect = encodeURIComponent(fullPath || "/hall");
      router.replace(`/login?redirect=${redirect}`);
    }
  }, [pathname, router, searchParams, ready, session]);

  return null;
}
