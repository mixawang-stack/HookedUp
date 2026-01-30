"use client";

import Link from "next/link";

const LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/refunds", label: "Refunds" },
  { href: "/support", label: "Support" }
];

export default function Footer() {
  return (
    <footer className="border-t border-border-default bg-card/60">
      <div className="ui-container flex flex-col items-center justify-between gap-3 py-6 text-xs text-text-muted sm:flex-row">
        <span>© {new Date().getFullYear()} HookedUp</span>
        <nav className="flex items-center gap-4">
          {LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition hover:text-text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
