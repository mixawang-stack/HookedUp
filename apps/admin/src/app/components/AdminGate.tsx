"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function AdminGate() {
  const router = useRouter();
  const pathname = usePathname() ?? "";

  useEffect(() => {
    if (pathname.startsWith("/login")) {
      return;
    }
    const token = localStorage.getItem("accessToken");
    if (!token) {
      router.replace("/login");
    }
  }, [pathname, router]);

  return null;
}
