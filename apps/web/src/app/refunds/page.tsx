export const dynamic = "force-dynamic";

export default function RefundsPage() {
  return (
    <main className="ui-page">
      <div className="ui-container max-w-3xl py-12 text-text-primary">
        <h1 className="text-2xl font-semibold">Refund Policy</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Effective date: 2026-01-31
        </p>
        <p className="mt-4 text-sm text-text-secondary">
          Due to the nature of instant digital content delivery, all purchases are
          generally non-refundable.
        </p>
        <p className="mt-4 text-sm text-text-secondary">
          Refunds may be granted in the following cases:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
          <li>Duplicate or accidental charges</li>
          <li>Technical issues preventing access to the purchased content</li>
          <li>Where required by applicable law</li>
        </ul>
        <p className="mt-4 text-sm text-text-secondary">
          To request a refund, please contact:{" "}
          <span className="font-semibold">support@hookedup.me</span>
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          Please include your order email, date of purchase, and a brief description
          of the issue.
        </p>
      </div>
    </main>
  );
}
