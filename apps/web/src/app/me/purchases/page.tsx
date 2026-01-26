"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type PurchaseItem = {
  id: string;
  createdAt: string;
  amount: string;
  currency: string;
  pricingMode: "BOOK" | "CHAPTER";
  novel: { id: string; title: string };
  chapter?: { id: string; title: string; orderIndex: number } | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export default function PurchasesPage() {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);

  const authHeader = useMemo(() => {
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  useEffect(() => {
    setToken(localStorage.getItem("accessToken"));
  }, []);

  useEffect(() => {
    if (!authHeader) return;
    const load = async () => {
      const res = await fetch(`${API_BASE}/me/purchases`, {
        headers: { ...authHeader }
      });
      if (!res.ok) {
        setStatus("Failed to load purchases.");
        return;
      }
      const data = (await res.json()) as PurchaseItem[];
      setPurchases(data ?? []);
    };
    load().catch(() => setStatus("Failed to load purchases."));
  }, [authHeader]);

  return (
    <main className="ui-page">
      <div className="ui-container pb-16 pt-10 text-text-primary">
        <h1 className="text-2xl font-semibold">Payment records</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Your novel purchases appear here.
        </p>
        {status && <p className="mt-3 text-sm text-text-secondary">{status}</p>}
        <div className="mt-6 space-y-3">
          {purchases.length === 0 ? (
            <div className="ui-surface p-6 text-sm text-text-secondary">
              No purchases yet.
            </div>
          ) : (
            purchases.map((purchase) => (
              <div key={purchase.id} className="ui-card p-4">
                <p className="text-xs text-text-muted">
                  {formatDate(purchase.createdAt)}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {purchase.novel.title}
                  {purchase.chapter
                    ? ` · Chapter ${purchase.chapter.orderIndex}`
                    : ""}
                </p>
                {purchase.chapter?.title && (
                  <p className="text-xs text-text-secondary">
                    {purchase.chapter.title}
                  </p>
                )}
                <p className="mt-2 text-xs text-text-muted">
                  {purchase.pricingMode} · {purchase.amount} {purchase.currency}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
