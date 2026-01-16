"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const PUBLIC_PATHS = new Set(["/login", "/register"]);

export default function AuthGate() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();

  useEffect(() => {
    if (PUBLIC_PATHS.has(pathname)) {
      return;
    }
    const token = localStorage.getItem("accessToken");
    if (!token) {
      const search = searchParams?.toString();
      const fullPath = search ? `${pathname}?${search}` : pathname;
      const redirect = encodeURIComponent(fullPath || "/hall");
      router.replace(`/login?redirect=${redirect}`);
    }
  }, [pathname, router, searchParams]);

  return null;
}
