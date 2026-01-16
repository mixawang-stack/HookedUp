"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/hall", label: "Hall" },
  { href: "/rooms", label: "Rooms" },
  { href: "/private", label: "Private" }
];

export default function TopNav() {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 bg-slate-900/90 border-b border-white/10 backdrop-blur-lg">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center px-4 py-3">
        <div className="flex items-center gap-3">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
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
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
