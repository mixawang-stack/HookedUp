import type { PaywallType } from "../lib/pricing";

const BADGE_STYLES: Record<PaywallType, string> = {
  FREE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  PREMIUM: "bg-rose-100 text-rose-700 border-rose-200",
  FREE_PLUS_PAID: "bg-amber-100 text-amber-700 border-amber-200"
};

const BADGE_LABELS: Record<PaywallType, string> = {
  FREE: "Free",
  PREMIUM: "Premium",
  FREE_PLUS_PAID: "Free + Paid"
};

type PricingBadgeProps = {
  type: PaywallType;
  className?: string;
};

export default function PricingBadge({ type, className }: PricingBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${BADGE_STYLES[type]} ${className ?? ""}`}
    >
      {BADGE_LABELS[type]}
    </span>
  );
}
