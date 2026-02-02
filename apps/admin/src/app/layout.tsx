import "./globals.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import AdminNav from "./components/AdminNav";
import AdminGate from "./components/AdminGate";

export const metadata: Metadata = {
  title: "HookedUp Admin",
  description: "HookedUp admin console"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <Suspense fallback={null}>
        </Suspense>
        <AdminGate />
        <AdminNav />
        {children}
      </body>
    </html>
  );
}
