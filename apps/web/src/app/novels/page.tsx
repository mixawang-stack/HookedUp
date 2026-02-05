"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "../lib/supabaseClient";
import PricingBadge from "../components/PricingBadge";
import PricingSnippet from "../components/PricingSnippet";
import PricingHoverSnippet from "../components/PricingHoverSnippet";
import {
  formatPriceAmount,
  formatPriceWithCurrency,
  resolvePricingMeta
} from "../lib/pricing";

type NovelItem = {
  id: string;
  title: string;
  coverImageUrl: string | null;
  description: string | null;
  category?: "DRAMA" | "AFTER_DARK";
  pricingMode?: "BOOK" | "CHAPTER";
  bookPrice?: string | number | null;
  bookPromoPrice?: string | number | null;
  currency?: string | null;
  chapters?: Array<{
    isFree?: boolean;
    isPublished?: boolean;
    price?: string | number | null;
  }> | null;
};

const CATEGORY_TABS: Array<{ id: "DRAMA" | "AFTER_DARK"; label: string }> = [
  { id: "DRAMA", label: "Drama" },
  { id: "AFTER_DARK", label: "After Dark" }
];

const resolveMediaUrl = (value?: string | null) => {
  if (!value) return null;
  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    return value;
  }
  try {
    const parsed = new URL(value);
    return parsed.toString();
  } catch {
    return value;
  }
  return value;
};

export default function StoriesPage() {
  const router = useRouter();
  const [novels, setNovels] = useState<NovelItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"DRAMA" | "AFTER_DARK">("DRAMA");

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setStatus("Stories service is not configured.");
        return;
      }
      const { data, error } = await supabase
        .from("Novel")
        .select(
          "id,title,coverImageUrl,description,category,isFeatured,createdAt,status,pricingMode,bookPrice,bookPromoPrice,currency,chapters:NovelChapter(isFree,isPublished,price)"
        )
        .eq("status", "PUBLISHED")
        .eq("category", activeTab)
        .order("isFeatured", { ascending: false })
        .order("createdAt", { ascending: false })
        .limit(30);
      if (error) {
        setStatus("Failed to load stories.");
        return;
      }
      setNovels((data ?? []) as NovelItem[]);
    };
    load().catch(() => setStatus("Failed to load stories."));
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleRefresh = () => {
      if (document.visibilityState && document.visibilityState !== "visible") {
        return;
      }
      const load = async () => {
        const supabase = getSupabaseClient();
        if (!supabase) {
          setStatus("Stories service is not configured.");
          return;
        }
        const { data, error } = await supabase
          .from("Novel")
        .select(
          "id,title,coverImageUrl,description,category,isFeatured,createdAt,status,pricingMode,bookPrice,bookPromoPrice,currency,chapters:NovelChapter(isFree,isPublished,price)"
        )
          .eq("status", "PUBLISHED")
          .eq("category", activeTab)
          .order("isFeatured", { ascending: false })
          .order("createdAt", { ascending: false })
          .limit(30);
        if (error) {
          setStatus("Failed to load stories.");
          return;
        }
        setNovels((data ?? []) as NovelItem[]);
      };
      load().catch(() => setStatus("Failed to load stories."));
    };
    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleRefresh);
    return () => {
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleRefresh);
    };
  }, [activeTab]);

  return (
    <main className="ui-page mx-auto w-full max-w-6xl px-4 py-10 text-text-primary">
      <div>
        <h1 className="text-2xl font-semibold">Stories worth staying up for</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Short reads, strange thoughts, guilty pleasures.
          <br />
          Read a little. Stay longer if you like.
        </p>
        <div className="mt-4 ui-tab-list">
          {CATEGORY_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`ui-tab ${isActive ? "ui-tab-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={isActive}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      {status && <p className="mt-3 text-sm text-brand-secondary">{status}</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {novels.map((novel) => {
          const teaser = (novel.description ?? novel.title).split("\n")[0] ?? "";
          const pricing = resolvePricingMeta({
            pricingMode: novel.pricingMode,
            bookPrice: novel.bookPrice,
            bookPromoPrice: novel.bookPromoPrice,
            currency: novel.currency,
            chapters: novel.chapters ?? []
          });
          const priceLabel = formatPriceWithCurrency(
            pricing.price,
            pricing.currency
          );
          const priceAmount = formatPriceAmount(
            pricing.price,
            pricing.currency
          );
          const totalChaptersCount =
            pricing.freeChaptersCount + pricing.paidChaptersCount;
          return (
            <div key={novel.id} className="ui-card p-4 text-text-primary">
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => router.push(`/stories/${novel.id}`)}
              >
                <div className="group relative overflow-hidden rounded-xl border border-border-default bg-card">
                  {pricing.paywallType !== "FREE_PLUS_PAID" && (
                    <div className="absolute right-3 top-3 z-10">
                      <PricingBadge type={pricing.paywallType} />
                    </div>
                  )}
                  {novel.coverImageUrl ? (
                    <img
                      src={resolveMediaUrl(novel.coverImageUrl) ?? ""}
                      alt={novel.title}
                      className="h-auto w-full object-contain"
                    />
                  ) : (
                    <div className="flex items-center justify-center p-6 text-xs text-text-muted">
                      No cover
                    </div>
                  )}
                  <div className="absolute inset-0 flex flex-col justify-end gap-3 bg-slate-950/50 px-4 py-4 opacity-0 transition duration-200 group-hover:opacity-100">
                    {pricing.paywallType !== "FREE_PLUS_PAID" && (
                      <PricingBadge type={pricing.paywallType} />
                    )}
                    {pricing.paywallType !== "FREE_PLUS_PAID" && (
                      <p className="line-clamp-2 text-sm text-white/90">
                        {teaser || novel.title}
                      </p>
                    )}
                    <PricingHoverSnippet
                      type={pricing.paywallType}
                      freeChaptersCount={pricing.freeChaptersCount}
                      totalChaptersCount={totalChaptersCount}
                      className="text-white/90"
                    />
                    <span className="inline-flex w-fit items-center justify-center rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-900">
                      {pricing.paywallType === "FREE_PLUS_PAID"
                        ? "Read the free part"
                        : pricing.paywallType === "FREE"
                          ? "Read now"
                          : priceAmount
                            ? `Unlock — ${priceAmount}`
                            : "Unlock"}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm font-semibold line-clamp-1">
                  {novel.title}
                </p>
                <p className="mt-1 text-xs text-text-secondary line-clamp-4">
                  {teaser}
                </p>
                <div className="mt-2">
                  <PricingSnippet
                    type={pricing.paywallType}
                    freeChaptersCount={pricing.freeChaptersCount}
                    price={pricing.price}
                    currency={pricing.currency}
                  />
                </div>
              </button>
              <button
                type="button"
                className="btn-primary mt-3 w-full px-3 py-2 text-xs"
                onClick={() => router.push(`/stories/${novel.id}`)}
              >
                {priceLabel ? `${priceLabel} - Read Now` : "Read Now"}
              </button>
            </div>
          );
        })}
        {novels.length === 0 && (
          <div className="ui-surface p-6 text-xs text-text-muted">
            <p>No stories here yet.</p>
            <p>Someone is probably writing one right now.</p>
          </div>
        )}
      </div>
    </main>
  );
}
