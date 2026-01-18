"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/users", label: "Users" },
  { href: "/novels", label: "Novels" }
];

const OPS_ITEMS = [
  { href: "/verifications", label: "Verifications" },
  { href: "/reports", label: "Reports" }
];

export default function AdminNav() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [opsOpen, setOpsOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    router.push("/login");
  };

  if (pathname.startsWith("/login")) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-900/90 backdrop-blur-lg">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
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
          <div className="relative">
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                pathname.startsWith("/verifications") ||
                pathname.startsWith("/reports")
                  ? "bg-slate-100/10 text-white shadow-[0_0_25px_rgba(14,165,233,0.9)]"
                  : "text-slate-300 hover:text-white"
              }`}
              onClick={() => setOpsOpen((prev) => !prev)}
            >
              Operations
            </button>
            {opsOpen && (
              <div className="absolute left-0 mt-2 w-44 rounded-xl border border-white/10 bg-slate-900/95 p-2 text-xs text-slate-200 shadow-[0_20px_50px_rgba(2,6,23,0.7)] backdrop-blur">
                {OPS_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-lg px-3 py-2 text-left text-slate-200 hover:bg-white/10"
                    onClick={() => setOpsOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="relative">
          <button
            type="button"
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            Admin
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-40 rounded-xl border border-white/10 bg-slate-900/95 p-2 text-xs text-slate-200 shadow-[0_20px_50px_rgba(2,6,23,0.7)] backdrop-blur">
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
    </nav>
  );
}
