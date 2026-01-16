import "./globals.css";
import type { Metadata } from "next";
import AuthGate from "./components/AuthGate";
import ActiveRoomPanel from "./components/ActiveRoomPanel";
import GlobalTips from "./components/GlobalTips";
import HostFloating from "./components/HostFloating";
import PageShell from "./components/PageShell";
import TopNav from "./components/TopNav";

export const metadata: Metadata = {
  title: "HookedUp? MVP",
  description: "HookedUp MVP running"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-slate-950 text-slate-100" suppressHydrationWarning>
        <AuthGate />
        <TopNav />
        {children}
        <GlobalTips />
        <ActiveRoomPanel />
        <HostFloating />
      </body>
    </html>
  );
}
