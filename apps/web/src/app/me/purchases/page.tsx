"use client";

import { useEffect, useState } from "react";

import { getSupabaseClient } from "../../lib/supabaseClient";
import { useSupabaseSession } from "../../lib/useSupabaseSession";

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
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export default function PurchasesPage() {
  const { user, ready } = useSupabaseSession();
  const [status, setStatus] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);

  useEffect(() => {
    if (!ready || !user) return;
    const load = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setStatus("Supabase is not configured.");
        return;
      }
      const { data, error } = await supabase
        .from("NovelPurchase")
        .select(
          "id,createdAt,amount,currency,pricingMode,novel:Novel(id,title),chapter:NovelChapter(id,title,orderIndex)"
        )
        .eq("userId", user.id)
        .order("createdAt", { ascending: false });
      if (error) {
        setStatus("Failed to load purchases.");
        return;
      }
      const normalized = (data ?? []).map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        amount: String(item.amount ?? ""),
        currency: item.currency,
        pricingMode: item.pricingMode,
        novel: item.novel?.[0] ?? null,
        chapter: item.chapter?.[0] ?? null
      })) as Array<{
        id: string;
        createdAt: string;
        amount: string;
        currency: string;
        pricingMode: PurchaseItem["pricingMode"];
        novel: PurchaseItem["novel"] | null;
        chapter?: PurchaseItem["chapter"] | null;
      }>;
      const items = normalized.filter(
        (item): item is PurchaseItem => Boolean(item.novel)
      );
      setPurchases(items);
    };
    load().catch(() => setStatus("Failed to load purchases."));
  }, [ready, user]);

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
                    ? ` Chapter ${purchase.chapter.orderIndex}`
                    : ""}
                </p>
                {purchase.chapter?.title && (
                  <p className="text-xs text-text-secondary">
                    {purchase.chapter.title}
                  </p>
                )}
                <p className="mt-2 text-xs text-text-muted">
                  {purchase.pricingMode} - {purchase.amount} {purchase.currency}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

