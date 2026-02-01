"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function AdminGate() {
  const pathname = usePathname() ?? "";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const base = process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "https://hookedup.me";
    const targetPath = pathname.startsWith("/login")
      ? "/login?redirect=/admin"
      : `/admin${pathname === "/" ? "" : pathname}`;
    window.location.replace(`${base}${targetPath}`);
  }, [pathname]);

  return null;
}
