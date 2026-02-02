import "./globals.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import AuthGate from "./components/AuthGate";
import ActiveRoomPanel from "./components/ActiveRoomPanel";
import PageShell from "./components/PageShell";
import TopNav from "./components/TopNav";
import Footer from "./components/Footer";
import HostFloating from "./components/HostFloating";

export const metadata: Metadata = {
  title: "Hookedup Me",
  description: "Hookedup Me"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <Suspense fallback={null}>
          <AuthGate />
        </Suspense>
        <TopNav />
        {children}
        <Footer />
        <ActiveRoomPanel />
        <HostFloating />
      </body>
    </html>
  );
}
