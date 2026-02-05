import type { PaywallType } from "../lib/pricing";
import { formatPriceWithCurrency } from "../lib/pricing";

type PricingSnippetProps = {
  type: PaywallType;
  freeChaptersCount?: number | null;
  totalChaptersCount?: number | null;
  price?: number | null;
  currency?: string | null;
  className?: string;
};

export default function PricingSnippet({
  type,
  freeChaptersCount,
  totalChaptersCount,
  price,
  currency,
  className
}: PricingSnippetProps) {
  const priceLabel = formatPriceWithCurrency(price ?? null, currency);
  if (type === "FREE") {
    return (
      <p className={`text-xs text-text-secondary ${className ?? ""}`}>
        Free to read
      </p>
    );
  }
  if (type === "PREMIUM") {
    return (
      <p className={`text-xs text-text-secondary ${className ?? ""}`}>
        {priceLabel ? `Full access ${priceLabel}` : "Pricing available soon"}
      </p>
    );
  }
  const freeLine =
    freeChaptersCount && freeChaptersCount > 0
      ? `First ${freeChaptersCount} chapters free.`
      : "Free preview available.";
  const totalLine =
    totalChaptersCount && totalChaptersCount > 0
      ? `Total ${totalChaptersCount} chapters.`
      : "Total chapters available.";
  return (
    <div className={`space-y-1 text-xs text-text-secondary ${className ?? ""}`}>
      <p>{totalLine}</p>
      <p>{freeLine}</p>
    </div>
  );
}
