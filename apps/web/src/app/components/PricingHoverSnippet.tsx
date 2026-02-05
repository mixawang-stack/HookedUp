import type { PaywallType } from "../lib/pricing";

type PricingHoverSnippetProps = {
  type: PaywallType;
  freeChaptersCount?: number | null;
  totalChaptersCount?: number | null;
  className?: string;
};

export default function PricingHoverSnippet({
  type,
  freeChaptersCount,
  totalChaptersCount,
  className
}: PricingHoverSnippetProps) {
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
        Full access
      </p>
    );
  }
  const totalLine =
    totalChaptersCount && totalChaptersCount > 0
      ? `Total ${totalChaptersCount} chapters.`
      : "Total chapters available.";
  const freeLine =
    freeChaptersCount && freeChaptersCount > 0
      ? `First ${freeChaptersCount} chapters free.`
      : "Free preview available.";
  return (
    <div className={`space-y-1 text-xs text-text-secondary ${className ?? ""}`}>
      <p>{totalLine}</p>
      <p>{freeLine}</p>
    </div>
  );
}
