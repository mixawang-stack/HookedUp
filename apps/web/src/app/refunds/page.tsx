export const dynamic = "force-dynamic";

export default function RefundsPage() {
  return (
    <main className="ui-page">
      <div className="ui-container max-w-3xl py-12 text-text-primary">
        <h1 className="text-2xl font-semibold">Refund Policy</h1>
        <p className="mt-4 text-sm text-text-secondary">
          Due to the nature of instant digital content delivery, all purchases are
          generally non-refundable.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Refunds may be provided in cases of duplicate or accidental charges, or
          where required by law.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          If you experience any issues with your purchase, please contact:{" "}
          <span className="font-semibold">mixa.wang@gmail.com</span>
        </p>
      </div>
    </main>
  );
}
