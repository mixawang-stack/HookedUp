export type PaywallType = "FREE" | "PREMIUM" | "FREE_PLUS_PAID";

type ChapterPricing = {
  isFree?: boolean | null;
  isPublished?: boolean | null;
  price?: string | number | null;
};

type PricingSource = {
  pricingMode?: "BOOK" | "CHAPTER" | null;
  bookPrice?: string | number | null;
  bookPromoPrice?: string | number | null;
  currency?: string | null;
  chapters?: ChapterPricing[] | null;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£"
};

const normalizeCurrency = (currency?: string | null) =>
  (currency ?? "USD").toUpperCase();

const parseAmount = (value?: string | number | null) => {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

export const formatPriceAmount = (
  value?: string | number | null,
  currency?: string | null
) => {
  const amount = parseAmount(value);
  if (amount === null) return null;
  const normalizedCurrency = normalizeCurrency(currency);
  const symbol = CURRENCY_SYMBOLS[normalizedCurrency] ?? "";
  const fixed = amount.toFixed(2);
  if (symbol) {
    return `${symbol}${fixed}`;
  }
  return `${fixed} ${normalizedCurrency}`;
};

export const formatPriceWithCurrency = (
  value?: string | number | null,
  currency?: string | null
) => {
  const amount = parseAmount(value);
  if (amount === null) return null;
  const normalizedCurrency = normalizeCurrency(currency);
  const symbol = CURRENCY_SYMBOLS[normalizedCurrency] ?? "";
  const fixed = amount.toFixed(2);
  if (symbol) {
    return `${symbol}${fixed} ${normalizedCurrency}`;
  }
  return `${fixed} ${normalizedCurrency}`;
};

const resolveChapterPrice = (chapters: ChapterPricing[] = []) => {
  const paidPrices = chapters
    .filter((chapter) => !chapter.isFree)
    .map((chapter) => parseAmount(chapter.price))
    .filter((price): price is number => price !== null);
  if (paidPrices.length === 0) return null;
  return Math.min(...paidPrices);
};

export const resolvePricingMeta = (source: PricingSource) => {
  const chapters = source.chapters ?? [];
  const publishedChapters =
    chapters.length > 0
      ? chapters.filter((chapter) => chapter.isPublished !== false)
      : [];
  const freeChaptersCount = publishedChapters.filter(
    (chapter) => chapter.isFree
  ).length;
  const paidChaptersCount = Math.max(
    0,
    publishedChapters.length - freeChaptersCount
  );

  const currency = normalizeCurrency(source.currency);
  let price: number | null = null;
  if (source.pricingMode === "CHAPTER") {
    price = resolveChapterPrice(publishedChapters);
  } else {
    price =
      parseAmount(source.bookPromoPrice) ?? parseAmount(source.bookPrice) ?? null;
  }

  let paywallType: PaywallType = "FREE";
  if (paidChaptersCount > 0 || (price !== null && price > 0)) {
    paywallType = freeChaptersCount > 0 ? "FREE_PLUS_PAID" : "PREMIUM";
  }

  return {
    paywallType,
    freeChaptersCount,
    paidChaptersCount,
    price,
    currency
  };
};
